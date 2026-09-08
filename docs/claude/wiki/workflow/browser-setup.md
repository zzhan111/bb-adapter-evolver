---
title: Browser setup
type: wiki-workflow
last_updated: 2026-06-28
---

# Browser setup

How to get bb-browser MCP talking to a Chrome that can render the sites you need. Most adapters need real browser rendering — pure HTTP capture is rarely enough because of SPAs, anti-bot redirects, and signed JS contexts.

## Two scenarios

| Scenario | Recommended setup |
|---|---|
| Local Linux/macOS development with a Chromium binary that works | Single daemon. Point MCP at local Chromium. |
| WSL2 ↔ Windows-host Chrome (e.g. yaoex, mall.yaoex.com, XHS in mainland China) | Single daemon via `netsh portproxy` or dual daemon via `BB_BROWSER_HOME`. |

## Single daemon (default)

```bash
# Start bb-browser daemon with default settings
bb-browser daemon start

# Verify
bb-browser tab list
```

The daemon controls a local Chromium instance via CDP (Chrome DevTools Protocol). Most sites that don't do aggressive anti-bot detection work fine here.

## WSL2 → Windows-host Chrome

Some sites (notably `mall.yaoex.com`, `xiaohongshu.com`) detect WSL2's Chromium and loop redirects. Drive a Windows-host Chrome from WSL2 instead.

### Architecture

```
WSL2 bb-browser MCP tools
       │
       ▼
WSL2 bb-browser daemon (pid A, CDP on :19824)
       │
       ▼ portproxy 0.0.0.0:19824 → 127.0.0.1:19824
Windows bb-browser daemon (pid B, CDP on :19824)
       │
       ▼
Windows Chrome (CDP on :9222)
```

### Step-by-step

1. **On Windows**, start Chrome with remote debugging:
   ```powershell
   "C:\Program Files\Google\Chrome\Application\chrome.exe" `
     --remote-debugging-port=9222 `
     --remote-debugging-address=0.0.0.0
   ```

2. **On Windows**, start bb-browser daemon:
   ```powershell
   bb-browser daemon start --port 19824
   ```

3. **On Windows**, expose 9222 to WSL2 (one-time, may need re-run after Tailscale restart):
   ```powershell
   netsh interface portproxy add v4tov4 `
     listenport=19824 listenaddress=0.0.0.0 `
     connectport=19824 connectaddress=127.0.0.1
   ```

4. **On WSL2**, rewrite `~/.bb-browser/daemon.json` to point at the Windows daemon:
   ```json
   {
     "host": "172.28.192.1",
     "port": 19824,
     "token": "<copy verbatim from Windows daemon.json — 32-char hex WITHOUT hyphens>"
   }
   ```

5. **Verify**:
   ```bash
   bb-browser tab list   # should return Windows tabs
   ```

### Gotchas

| Symptom | Cause | Fix |
|---|---|---|
| `browser_eval` returns `{}` on every page | MCP channel disconnected from daemon | Restart bb-browser daemon on Windows; reload MCP |
| `bb-browser` fails to authenticate | Token has hyphens | Copy token **verbatim** from Windows `daemon.json` — no UUID format |
| Portproxy gone after Tailscale restart | `netsh` rules persist, but listeners may need re-add | Re-run the `portproxy add` command |
| `mcp_bb_browser_site_run` says "Cannot find Chromium" | site_run tries to launch local browser; doesn't use daemon's CDP | Use `browser_open` + `browser_eval` instead of `site_run` |
| Chrome 111+ ignores `--remote-debugging-address=0.0.0.0` | upstream Chrome change | Always use `netsh portproxy` to forward; do not rely on the flag |
| WSL2 has `http_proxy=http://172.28.192.1:7890` set (Clash) | Proxies all curl; localhost probes return 502 | Diagnostic curls use `curl --noproxy '*'` |

### Dual daemon (alternative)

If you must preserve WSL2 Chromium tabs AND drive Windows Chrome, run **two daemons** with different `BB_BROWSER_HOME`:

```bash
# Default daemon (WSL2 Chromium)
BB_BROWSER_HOME=~/.bb-browser bb-browser daemon start --port 19824

# Windows daemon
BB_BROWSER_HOME=~/.bb-browser-windows bb-browser daemon start --port 19834
```

`tools/cdp-windows` automates the launcher. See [`docs/claude/methodology/setup/wsl2-windows-chrome-cdp.md`](../../methodology/setup/wsl2-windows-chrome-cdp.md) for the full setup + troubleshooting guide.

## Single vs dual daemon — when to use which

| If you… | Use |
|---|---|
| Don't need WSL2 Chromium tabs | Single daemon (simpler, no env switching) |
| Need both WSL2 Chromium and Windows Chrome concurrently | Dual daemon |
| Are scripting (CI / fixture capture) | Single daemon, deterministic port |

## Related

- [Setup playbook (canonical)](../../methodology/setup/wsl2-windows-chrome-cdp.md)
- [Author loop](author-loop.md)
- [Memory 2026-04-23 (dual-daemon)](../../../../memory/soul.md)
- [Memory 2026-05-18 (single-daemon + 360ChromeX)](../../../../memory/soul.md)
