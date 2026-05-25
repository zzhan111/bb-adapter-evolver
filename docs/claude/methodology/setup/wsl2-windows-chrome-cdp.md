---
name: WSL2 → Windows Chrome (dual-daemon setup)
type: methodology
last_updated: 2026-04-23
applies_when:
  - target site refuses to load inside WSL2 chromium (anti-bot, UA-based redirects)
  - login state is hard to reproduce inside WSL2 (existing logged-in Windows session)
  - you still need the WSL2 chromium for other ongoing work (ERP tabs, etc.)
---

# WSL2 → Windows Chrome via dual bb-browser daemons

bb-browser normally drives a chromium running inside WSL2 (`~/.bb-browser/browser/`) via a single daemon at `127.0.0.1:19824`. Some sites (e.g. mall.yaoex.com) refuse to render properly under that headless-ish chromium because of anti-bot, UA detection, or redirect loops. The Windows Chrome on the host machine has none of those problems and already holds your real login state.

Solution: run a **second** bb-browser daemon, isolated by `BB_BROWSER_HOME`, that talks to the Windows Chrome's CDP through a Windows portproxy.

```
┌────────────────────────────────────────────────────────────────────┐
│ WSL2                                                               │
│                                                                    │
│   bb-browser CLI (BB_BROWSER_HOME=~/.bb-browser/)                  │
│        │                                                           │
│        ▼                                                           │
│   daemon A   :19824 ──CDP──▶ local chromium :19825                 │
│   ~/.bb-browser/                                                   │
│                                                                    │
│   bb-browser CLI (BB_BROWSER_HOME=~/.bb-browser-windows/)          │
│        │                                                           │
│        ▼                                                           │
│   daemon B   :19834 ──CDP──▶ Windows host :9223 ─ portproxy ──▶    │
│   ~/.bb-browser-windows/                          127.0.0.1:9222   │
│                                                          │         │
└─────────────────────────────────────────────────────────│─────────┘
                                                          ▼
                                                Windows Chrome (147+)
                                                with --remote-debugging-port=9222
```

## One-time Windows-side setup

### 1. Launch Chrome with remote debugging

Close all Chrome windows first (`taskkill /F /IM chrome.exe` if needed), then launch with the flag:

```cmd
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
```

Save this as a `.bat` or shortcut for reuse.

> **Why no `--remote-debugging-address=0.0.0.0`?** From Chrome 111+ (March 2023) that flag is silently ignored — Chrome force-binds CDP to `127.0.0.1`. We work around this with portproxy in step 2.

### 2. Forward 9222 to a LAN-reachable port (PowerShell as Administrator)

```powershell
netsh interface portproxy add v4tov4 `
  listenaddress=0.0.0.0 listenport=9223 `
  connectaddress=127.0.0.1 connectport=9222
```

Verify:

```cmd
netsh interface portproxy show all
netstat -ano | findstr :9223
```

Should show a `0.0.0.0:9223 LISTENING` row.

> **Persistence**: portproxy rules survive reboot. Set once.

### 3. Allow inbound 9223 from WSL2 subnet (PowerShell as Administrator)

```powershell
New-NetFirewallRule -DisplayName "WSL CDP 9223" `
  -Direction Inbound -LocalPort 9223 -Protocol TCP `
  -Action Allow -RemoteAddress 172.16.0.0/12
```

`172.16.0.0/12` covers the WSL2 default subnet range. Tighten to your actual `172.28.x.x/20` for extra safety; check via `ip route show default` from WSL2.

> **Security note**: even with the subnet limit, anyone on your machine that can reach 9223 can drive your Chrome (read cookies, run JS in any tab). On a shared machine, do not do this.

## Per-session WSL2 usage

### Start the second daemon

```bash
~/.openclaw/workspace/bb-adapter-evolver/tools/cdp-windows
```

The script:
- Auto-detects Windows host IP via `ip route show default`
- Probes `http://<host>:9223/json/version` and aborts with diagnosis if unreachable
- Sets `BB_BROWSER_HOME=~/.bb-browser-windows` so daemon state does not collide with the local daemon
- Starts `bb-browser daemon --port 19834 --cdp-host <win-ip> --cdp-port 9223`
- Stays in the foreground; Ctrl-C to stop

You only need to re-run this if WSL2 was restarted (host IP can change) or you killed the daemon.

### Talk to Windows Chrome from any other shell

```bash
export BB_BROWSER_HOME=~/.bb-browser-windows
bb-browser tab list
bb-browser site mall-yaoex/search --keyword "阿莫西林"
```

### Talk to local WSL2 chromium

```bash
unset BB_BROWSER_HOME              # or
export BB_BROWSER_HOME=~/.bb-browser
bb-browser tab list
```

### Suggested shell aliases

Add to your `.bashrc`:

```bash
alias bbw='BB_BROWSER_HOME=~/.bb-browser-windows bb-browser'
alias bbl='BB_BROWSER_HOME=~/.bb-browser bb-browser'
# usage:  bbw tab list      bbl tab list
```

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `cdp-windows` reports "cannot reach Chrome CDP" with **timeout** | Windows Firewall dropping packets | Add the firewall rule in step 3, or temporarily allow `-RemoteAddress Any` to confirm |
| Same probe returns **HTTP 502 Bad Gateway** in raw curl | WSL2 has `http_proxy` env set; curl is going through Clash/v2ray | The probe script already bypasses; for manual testing use `curl --noproxy '*' http://<host>:9223/json/version` |
| `netstat` shows `127.0.0.1:9222 LISTENING` but **no** `0.0.0.0:9223` | portproxy step 2 not applied | Re-run the `netsh interface portproxy add` command as Administrator |
| `bb-browser tab list` returns local chromium tabs instead of Windows ones | `BB_BROWSER_HOME` not exported, or pointing at default | `export BB_BROWSER_HOME=~/.bb-browser-windows` in the current shell |
| `EADDRINUSE: 127.0.0.1:19834` | Previous `cdp-windows` daemon still running | `pkill -f "cdp-port 9223"` then restart, or pass `--daemon-port 19835` |
| After WSL2 restart, daemon fails to connect | Windows host IP changed | `cdp-windows` re-detects on each run; just re-run it |

## Removing the setup

```powershell
# Windows
netsh interface portproxy delete v4tov4 listenaddress=0.0.0.0 listenport=9223
Remove-NetFirewallRule -DisplayName "WSL CDP 9223"
```

```bash
# WSL2
pkill -f "cdp-port 9223"
rm -rf ~/.bb-browser-windows
```

## Why not just one daemon?

The local WSL2 chromium often holds long-lived tabs the user is actively working in (ERP dashboards, Slack-like UIs). Killing it to repurpose `127.0.0.1:19824` for Windows-Chrome work would lose those sessions. Two daemons cost ~50 MB of node and are isolated by `BB_BROWSER_HOME`, which is the cheapest and least-disruptive split.

## Related

- `tools/cdp-windows` — the launcher script
- `~/.bb-browser/AGENTS.md` — bb-browser daemon architecture (TabStateManager, short tab IDs)
- `bb-browser daemon --help` — `--port`, `--cdp-host`, `--cdp-port` flags

---

## 2026-05-18 — Alternative: Single-daemon approach (simpler)

The dual-daemon approach above works when you need **both** WSL chromium and Windows browser simultaneously. But if you only need Windows browser (e.g. 360ChromeX for yaoex/1yaocheng), a simpler single-daemon approach exists:

### How it works

Kill the WSL daemon, rewrite `~/.bb-browser/daemon.json` to point at the Windows daemon. All MCP tools (`mcp_bb_browser_*`) automatically route to Windows because they read `daemon.json`.

```
WSL MCP tools
    | read ~/.bb-browser/daemon.json
WSL daemon.json (host=172.28.192.1, port=19824)
    | portproxy
Windows 0.0.0.0:19824 -> 127.0.0.1:19824 (Windows daemon)
    | CDP
360ChromeX :19825
```

### Steps

1. **Windows PowerShell (Admin):** Add portproxy rule
   `netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=19824 connectaddress=127.0.0.1 connectport=19824`

2. **WSL:** Kill local daemon
   `kill $(jq -r .pid ~/.bb-browser/daemon.json 2>/dev/null)`

3. **WSL:** Get Windows host IP and token
   `HOST_IP=$(ip route show default | awk '{print $3}')`
   `TOKEN=$(jq -r .token /mnt/c/Users/zhang/.bb-browser/daemon.json)`

4. **WSL:** Rewrite daemon.json with jq
   `jq -n --arg host "$HOST_IP" --arg token "$TOKEN" --argjson pid "$PID" '{pid:$pid, host:$host, port:19824, token:$token, cdpPort:19825}' > ~/.bb-browser/daemon.json`

5. **Verify:** `mcp_bb_browser_browser_tab_list` should show Windows browser tabs

### Token format (CRITICAL PITFALL)

bb-browser daemon tokens are **32-char hex, NO hyphens**:
- Correct: `6be89ee101b74e7fba73f06aa931c3a8`
- Wrong: `6be89ee1-01b7-4e7f-ba73-f06aa931c3a8` (UUID format — breaks auth)

The token written by `bb-browser daemon start` is always no-hyphen. When copying manually, ensure you don't accidentally add hyphens.

### Switch back to WSL chromium

`bb-browser daemon start` (it will write a fresh daemon.json with local daemon info)

### When to use which approach

| Scenario | Approach |
|----------|----------|
| Only need Windows browser (yaoex, 1yaocheng) | **Single daemon** (this section) |
| Need both WSL chromium AND Windows browser | **Dual daemon** (above) |
| WSL chromium has important open tabs | **Dual daemon** (avoid losing sessions) |

### 360ChromeX notes

- User data: `%LOCALAPPDATA%\360ChromeX\Chrome\User Data\`
- Launch: `--remote-debugging-port=19825`
- Windows daemon port: 19824 (standard), CDP port: 19825
