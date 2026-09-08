# soul.md — bb-adapter-evolver

> Long-running, append-mostly notes shared between human and agent. Mirrors openclaw's user/soul/memory pattern. **Add to the bottom; do not rewrite history.** Date every entry.

---

## 2026-04-22 — Phase 1 bootstrapped

Created the repo skeleton and Phase 1 deliverables:

- `AGENTS.md` — conventions, hard rules, phase status
- `README.md` — why this repo exists, four-phase plan, quick start
- `docs/claude/contracts/ecommerce/v1.md` — the canonical 9 P0 + 6 P1 adapters, output schema, forbidden list
- `docs/claude/skills/bb-adapter-author/SKILL.md` — the prompt a coding agent reads before writing any adapter
- `docs/claude/methodology/reverse-engineering/playbook.md` — capture-first flow distilled from the jike incident
- `docs/claude/methodology/evaluation/bb-eval-usage.md` — bb-eval reference
- `docs/claude/decisions/2026-04-22-why-not-evolver-first.md` — record of the staging decision (rejected: jump straight to evolver; accepted: 4 phases)
- `tools/bb-eval` — shell + jq static checker (executable)

### Validation against ysbang reference

Ran `bb-eval` against six existing ysbang adapters. Results match the contract's intent:

| Adapter | Result | Notes |
|---|---|---|
| `search.js` | 12 PASS / 2 WARN / 0 FAIL | Canonical, has constraint trio + nextActions; missing pagination object and full error triple. |
| `auth.js` | 9 PASS / 0 WARN / 1 FAIL | Missing URL constant in first 50 lines (genuine omission). |
| `order-list.js` | 9 PASS / 5 WARN / 0 FAIL | Canonical name; missing constraint trio, pagination, nextActions. |
| `search-by-price.js` | 10 PASS / 1 WARN / 1 FAIL | **Correctly rejected** — filter-variant of search. |
| `cart-summary.js` | 8 PASS / 2 WARN / 1 FAIL | **Correctly rejected** — should merge into cart-list. |
| `order-create.js` | 7 PASS / 2 WARN / 2 FAIL | **Correctly rejected** — submit-state forbidden + missing readOnly. |

Conclusion: the Phase 1 contract + bb-eval correctly identifies the anti-patterns the user was concerned about.

### Open items before Phase 2

- Existing `ysbang/search.js` declares URLs but lacks the full `error/hint/action` triple and `pagination` object. We can either (a) revise it to fully comply with v1, or (b) treat it as legacy and only enforce the contract on new adapters. **Decision needed from user.**
- Need a fixture: snapshot of a successful `ysbang/search` call to put under `fixtures/ecommerce/`. Requires user to be logged in to ysbang.
- 1yaocheng (`111.com.cn`) is not yet in any adapter set. Need to confirm the user wants this site in scope for Phase 3, or drop in favor of jd/pdd which have wider coverage.

### Honest caveats on bb-eval v1

- It's a **static** checker. It cannot know whether the captured endpoint actually works, only whether the file says the right things.
- The `error-envelope` check uses a coarse grep. An adapter that returns errors via `throw` instead of `return { error: ... }` will silently pass. Will refine if it bites us.
- `url-declared` accepts any `[A-Z_]*URL[A-Z_]*` constant — so `MY_URL_FOO`, `FALLBACK_URL`, etc. all count. Good enough for v1.

---

---

## 2026-04-23 — Dual-daemon setup for WSL2 → Windows Chrome

`mall.yaoex.com` won't render correctly in the WSL2 chromium (anti-bot redirect loop between mall.yaoex.com and m.yaoex.com). Switched to driving Windows-host Chrome via CDP.

Key facts (in case this needs to be redone):
- **Chrome 111+** silently ignores `--remote-debugging-address=0.0.0.0`. Use `netsh interface portproxy` from Windows to expose 9222 via 9223.
- Two daemons run concurrently, isolated by `BB_BROWSER_HOME`:
  - `~/.bb-browser/` (default) → local WSL2 chromium on `:19825`, daemon on `:19824`. Holds existing ERP/即刻 work tabs.
  - `~/.bb-browser-windows/` → Windows Chrome on `<host>:9223`, daemon on `:19834`. Used for yaoex.
- Launcher: `tools/cdp-windows` (re-run after WSL2 restart since host IP can shift).
- Full setup + troubleshooting: `docs/claude/methodology/setup/wsl2-windows-chrome-cdp.md`

WSL2 had `http_proxy=http://172.28.192.1:7890` set, which made every diagnostic curl go through Clash and return 502. The launcher script always probes with the proxy bypassed, but if you debug manually use `curl --noproxy '*'`.

---

## 2026-04-23 — yaoex reverse engineering (auth + search)

First non-ysbang validation of the contract. Findings worth keeping out of git history:

### API surface

- **Real backend:** `gateway-b2b.fangkuaiyi.com`, NOT `mall.yaoex.com`. The latter is a Vue 2 SPA whose XHRs all go through the gateway. Anyone trying to capture from `mall.yaoex.com` will see only static asset requests.
- **Search:** `POST /home/search/homeSearchList` with form-urlencoded body `{keyword, pageNo, pageSize}`. Pagination signal is `data.pageCount` (totalPages — server does NOT return totalItems).

### Auth scheme — tier 2, not tier 3

The captured request looks intimidating: `closesignature=yes&signature_method=md5&signature=****&token=<long>&userToken=<same long>`. Two key facts make this tier 2:

1. **`signature=****` is literal four asterisks.** Combined with `closesignature=yes` it tells the gateway "skip signature validation". I verified this end-to-end by issuing a hand-crafted fetch from inside the page with the literal `****` and got a valid response. There is no MD5 signing to implement.
2. **`token` and `userToken` are both identical** and read from the `ycgltoken` cookie (same value also lives in `yc_pass_gltoken`). The `yctoken` cookie name exists but its value is empty — that's a red herring.

So the adapter just URL-encodes the cookie into the query string. No tier-3 webpack injection needed for the request itself.

### Price decryption — required tier-3-ish twist

`productPrice`, `channelPrice`, `recommendPrice`, `availableVipPrice`, etc. come back as AES-128-ECB / PKCS7 base64 ciphertext. Decryption helper found in `app.237cfb53.js`:

```js
const a = "GDLSAUO1KUMIIBCE";
let o = null;
function c(e){ const t=o; let r=a; t&&(r=a.slice(0,10)+t.slice(0,6).padStart(6,"0")); ...AES.decrypt(e, parse(r), {ECB, PKCS7}) }
function g(e){ ["channelPrice","productPrice","availableVipPrice","visibleVipPrice","price","discountPrice","originalPrice","recommendPrice"].forEach(k => e[k] = h(e[k])); ... }
```

Empirically `o` is set to the user's `ycuserId` cookie value (verified: userId=`678959` → key=`GDLSAUO1KU678959` → ciphertext `iwPpf/gohIa56NGs5AWvcQ==` decrypts to `5.65`). The static fallback key `GDLSAUO1KUMIIBCE` does NOT decrypt logged-in payloads.

Adapter calls `window.CryptoJS` (already global on the page) so no library loading needed.

### Tab/session caveat

Driving Windows Chrome via CDP exposes a behavior trap: `bb-browser site <name>` opens a fresh tab on the target domain. Session-only cookies (and the user's existing logged-in tab) do not transfer. Workflow:
1. User logs in once in Windows Chrome (manually).
2. Windows Chrome must stay open AND the same Chrome process must persist — restart wipes session cookies.
3. If session is lost, the only signal is `auth` returning NOT_LOGGED_IN.

### Adapters delivered

- `~/.bb-browser/sites/yaoex/auth.js` — tier 1, reads cookie state, surfaces `qualificationExpired` warning.
- `~/.bb-browser/sites/yaoex/search.js` — tier 2 + AES decryption. Maps to canonical Product schema. Constraint trio populated; `manufacturer` deferred to local filter; pagination + recommendedNextActions present.
- Both: `bb-eval` 100% pass (10/10 and 13/13, no warns).

### Open before cart-list / cart-add

- **Live fixture not yet captured** — Windows Chrome session lapsed mid-run; needs user re-login then `bb-browser site yaoex/search --keyword 阿莫西林`. Snapshot will land at `fixtures/ecommerce/yaoex-search.json`.
- **资质已过期** warning was visible in the user's enterprise context (天津市正顺大药房有限公司第一分公司). cart-add and checkout-preview may fail server-side before they fail any contract check; treat as a real adapter failure mode and add a hint, not a quirk.
- **bb-eval domain heuristic** updated to recognize `yaoex` / `fangkuaiyi`.

---

## How to use this file

- **Human**: drop a dated entry whenever you make a decision, change direction, or learn something the agent should know in the next session. Don't rewrite — append.
- **Agent**: when you finish meaningful work or hit a decision point, append a dated entry summarizing what changed and what's open. Use the format above (date heading, narrative, table or bullets, open items).
- Both: keep entries dense. This is not a changelog (`git log` exists). Capture only what is non-obvious from the code.

## 2026-05-18 — Phase 1 fixture captured: ysbang/search

**Fixture**: `fixtures/ecommerce/ysbang-search-amoxicillin.json`
- Keyword: 阿莫西林
- Result: 65 products, 4 pages (20/page), pagination object present
- bb-eval: 13 PASS / 0 WARN / 0 FAIL
- Session: logged-in (天津市正顺大药房有限公司第一分公司)
- Price status: 5/65 readable (颗粒/注射剂), 60/65 garbled (font obfuscation)

**ysbang/search.js status**: Contract v1 compliant rewrite complete. Three-phase wait SPA fix documented in CLAUDE.md and Hermes skill `ysbang-adapter-debugging`.

### Still open before Phase 2
- Fixture: yaoex/search (needs Windows Chrome login — session lapsed)
- 1yaocheng scope decision

---

## 2026-05-18 — WSL → Windows 360ChromeX connection established

### What we did

Connected WSL bb-browser MCP tools to Windows 360ChromeX via single-daemon approach:
1. Windows portproxy: `0.0.0.0:19824 → 127.0.0.1:19824` (Windows daemon)
2. Killed WSL daemon (pid 1306217, CDP was disconnected)
3. Rewrote `~/.bb-browser/daemon.json` to point at Windows daemon via `172.28.192.1:19824`
4. Verified: `mcp_bb_browser_browser_tab_list` returns 8 Windows tabs

### Key lesson: Token format

bb-browser daemon tokens are **32-char hex without hyphens**. UUID format with hyphens (`6be89ee1-01b7-4e7f-...`) breaks MCP auth. First attempt failed because we wrote the token with hyphens. Fix: copy token verbatim from Windows `daemon.json`.

### Architecture decision: single vs dual daemon

- **Single daemon** (chosen): simpler, no `BB_BROWSER_HOME` switching, but loses WSL chromium tabs
- **Dual daemon** (existing doc): two isolated daemons via `BB_BROWSER_HOME`, preserves WSL chromium sessions
- Trade-off: user doesn't need WSL chromium for current work, so single daemon is fine

### Updated documentation
- `docs/claude/methodology/setup/wsl2-windows-chrome-cdp.md` — appended single-daemon section with 360ChromeX notes
- Hermes skill `wsl-bb-browser-windows` created — cross-session reference for connection setup

### Open items
- Portproxy `listenaddress=0.0.0.0` rules may be cleared by Tailscale restart. If MCP breaks, re-add the rule.

## 2026-05-18 — yaoex fixtures captured (search + cart-list)

### search fixture
- File: `fixtures/ecommerce/yaoex-search-amoxicillin.json`
- Keyword: 阿莫西林, 10 products (server caps pageSize=10), 240 pages total
- Price decryption: 9/10 success (AES-128-ECB, key=GDLSAUO1KU+userId[0:6])
- Price range: ¥3.84 - ¥12.84
- API: POST gateway-b2b.fangkuaiyi.com/home/search/homeSearchList
- Auth: tier-2 (token from ycgltoken cookie, signature=****, closesignature=yes)

### cart-list fixture
- File: `fixtures/ecommerce/yaoex-cart-list.json`
- 14 products across 8 supply stores (4 valid, 10 invalid/expired)
- API: POST gateway-b2b.fangkuaiyi.com/api/cart/list (body: showreducedpricegood=0)
- Data path: data.supplyCartList[].productGroupList[].groupItemList[]
- Auth: same tier-2 as search
- Note: productList field is empty; products live in productGroupList[].groupItemList[]
- Note: price field in cart context may not decrypt same as search; originalPrice works

### site_run issue
- `mcp_bb_browser_site_run` returns "Cannot find Chromium-based browser" when daemon points to Windows
- Workaround: navigate to site domain manually, then use browser_eval to run adapter JS inline
- This is because site_run tries to launch a local browser rather than using daemon's CDP
- Need to investigate whether this is a daemon config issue or by design

## 2026-05-18 — Phase 2 progress: yaoex adapter suite

### Adapters delivered (all bb-eval PASS)

| Adapter | bb-eval | Auth | Notes |
|---------|---------|------|-------|
| auth.js | 10/10 | tier-1 | Cookie-based, reads ycgltoken/ycuserId |
| search.js | 13/13 | tier-2 | AES price decryption, constraint tracking |
| cart-list.js | 13/13 | tier-2 | supplyCartList[].productGroupList[].groupItemList[] |
| cart-add.js | 11/11 | tier-2 | XHR body: spuCode, supplyId, productNum |

### Key API findings
- All APIs on gateway-b2b.fangkuaiyi.com
- Auth: token from ycgltoken cookie, signature=****, closesignature=yes
- Cart data path: supplyCartList[].productGroupList[].groupItemList[]
- Cart-add body: itemList=[{productNum, spuCode, supplyId}], addType=1, sourceType=17052
- Price key: GDLSAUO1KU + userId[0:6].padStart(6,'0'), AES-128-ECB PKCS7

### Remaining
- cart-remove, checkout-preview, order-list, order-detail: not yet implemented
- 1yaocheng (111.com.cn): Phase 3, needs user login
- bb-eval integration into authoring loop: documented in SKILL.md, workflow is manual but effective

---

## 2026-05-18 — Phase 2 COMPLETE: yaoex 9/9 P0 adapters

### All adapters delivered (all bb-eval PASS)

| Adapter | bb-eval | Auth | API Endpoint | Notes |
|---------|---------|------|-------------|-------|
| auth.js | 10/10 | tier-1 | (cookie read) | Cookie-based, reads ycgltoken/ycuserId |
| search.js | 13/13 | tier-2 | POST /home/search/homeSearchList | AES price decryption, constraint tracking |
| product.js | 11/11 | tier-2 | POST /product/detail | spuCode+sellerCode, AES price decrypt |
| cart-list.js | 13/13 | tier-2 | POST /api/cart/list | supplyCartList[].productGroupList[].groupItemList[] |
| cart-add.js | 11/11 | tier-2 | POST /api/cart/add | spuCode+supplyId+productNum, addType=1 |
| cart-remove.js | 11/11 | tier-2 | POST /api/cart/delete | shoppingcartid=JSON array, deleteType=0 |
| checkout-preview.js | 11/11 | tier-2 | POST /api/cart/checkOrder | Full order preview with shops/products/address |
| order-list.js | 13/13 | tier-2 | POST /api/order/list | jsonParams body, status filter, pagination |
| order-detail.js | 11/11 | tier-1 | GET /center/order/{id}/main + /logistic | Cookie auth, same-domain, no gateway signature |

### Key API discoveries (order adapters)

- **order-list** uses POST to `gateway-b2b.fangkuaiyi.com/api/order/list` with `jsonParams` body param containing pageNo, pageSize, and param object (orderStatus, productName, etc.)
- **order-detail** is different from other adapters — uses **GET** requests to same-domain `/center/order/{orderId}/main` and `/center/order/{orderId}/logistic` with cookie auth only (no gateway signature needed)
- Order detail page is jQuery-based (not Vue), server-rendered with AJAX data loading
- Order list page is in iframe under `/center/#/center/order`, actual page at `/v2/orderList/`
- Order status codes: 1=pending_payment, 2=pending_shipment, 3=shipped, 7=completed, 9=cancelled, 10=refund

### Contract v1 decisions enforced

- `order-create` BANNED — checkout-preview replaces it (readOnly, no submission)
- `product` not `product-detail` — canonical P0 name
- `checkout-preview` not `order-create` — contract explicitly forbids submit-side-effect adapters
- 9 adapters max per site, no search-by-* variants

### Architecture notes

- SPA navigation: order list at `/v2/orderList/` requires navigation via `/center/#/center/order` (iframe) then clicking "订单详情" opens new tab
- order-detail page is jQuery server-rendered (not Vue SPA), data loaded via AJAX GET
- bb-eval boolean detection bug fixed (jq `// empty` treats false/0 as falsy)
- site_run workaround: browser_eval inline (Windows daemon can't launch local browser)

### Phase 3 status

- Phase 3 (cross-site validation) completed via yaoex cross-validation with ysbang
- 1yaocheng (111.com.cn) is B2C, not in Phase 3 scope
- Contract v1 proven across two independent B2B pharmaceutical sites

---

## 2026-06-16 — db.yaozh.com (药智数据) pharma-data 新合同域 + 6+1 adapter 套件

### 用户的目标重定义

最初用户说"接下来为 https://db.yaozh.com/ 药智数据网 全套 adapters"。recon 一做发现 db.yaozh.com 不是电商，而是医药数据情报站（药品注册、临床试验、定价、市场行为、监管公告……）。**没有购物车/订单/价格加解密。** 硬套 ecommerce v1 contract 会 FAIL 一片。

跟用户走完 brainstorming 决定：
- 新建合同域 `pharma-data`（不复用、不扩展 ecommerce）
- 双轨文档：spec → `docs/superpowers/specs/`，contract → `docs/claude/contracts/pharma-data/v1.md`
- 6+1 adapter 方案：6 个数据查询 adapter + 1 个 cookie 注入 helper
- 公开优先、cookie 注入、不做自动登录（守 AGENTS.md #5）

设计 spec 见 `docs/superpowers/specs/2026-06-16-pharma-data-design.md`。决策文档见 `docs/claude/decisions/2026-06-16-why-pharma-data-contract.md`。

### bb-eval 扩展

`tools/bb-eval` 加了 `--domain pharma-data` 选项 + 10 个 PHR-* 检查项（PHR-1 domain-set, PHR-2 dbkey-declared, PHR-3 url-constant, PHR-4 list-function/item-function, PHR-5 record-shape, PHR-6 id-detect, PHR-7 auth-status, PHR-8 canonical-name, PHR-9 helper-name, PHR-10 no-creds）。helper adapter (kind:helper) 自动跳过 list/item/record 检查。

修复了两个 bb-eval bug（学到的教训）：
1. **PHR-5 过严**：原版只匹配 `id: url: dbKey:`，不接受 shorthand `id,` → 放宽
2. **PHR-3 引用 `$HEADER`** 在它被定义之前 → 重排到 Check 1 之后

### 6+1 adapter 产出（bb-eval 152 pass / 0 fail）

| Adapter | 鉴权 | 数据 | 详情 ID | keyword 参数 |
|---|---|---|---|---|
| yaopinjiage | public | 660,613 | 数字 | `name` |
| policies | public | 27,203 | 数字 | `policies_title` |
| ypzl | public | ~10 | base64 | `name` |
| ypxs | soft_vip | 35 | base64 | `cname|brandname|name|brandnamecn` |
| dijia | public | 32 | base64 | `name` |
| yaopinzhongbiao | hard_wall | 1,986,638 | 药品名 | `comprehensivesearchcontent` |
| yaozh-auth | helper | — | — | — |

菜单数字（"53 条政策"）严重过时——实际 27,203 条；"4 条低价药"实际 32 条。**别信菜单估算，以 live 抓取为准。**

### 实战中学到的（写给未来的 agent）

1. **每个 DB 用不同的 keyword 字段名**——绝不能假设通用。`scrme_name` 是模板里的默认值，**所有 6 个 adapter 都失效**。正确做法：读 listing 页面的 `<form>` 找 `name="..."` input。侦察阶段必须做。
2. **`is_search=1` 隐藏 flag 必填**——GET 请求不加这个 flag，过滤参数会被忽略。
3. **ID 编码两种**：数字（旧库：policies/yaopinjiage）vs base64（新库：ypzl/dijia/customs/ypxs）。模板的 ID discriminator `isNumeric || isBase64` 两种都接受。
4. **soft_vip 字段值是字面 `"查看"`**——adapter 检测到该值就标 `vipGatedFields` + 清空值，绝不编造。
5. **通用字段提取算法 v7（最终稳定版）**：
   - selector: `table.table.zjlsearFromVal tbody tr`
   - cells: 用 `th, td` 拿全部（包括 th 标题列）
   - titleCellIdx = 含 `a[href*=".html"]` 的 cell
   - titleHeaderIdx = 在 titleHeaderNames 数组里找 headers[] 匹配
   - offset = linkCellIdx - titleHeaderIdx，剩下 cells 按位置映射到 headers
6. **yaopinzhongbiao 是硬登录墙**——`authStatus: hard_wall`，adapter 在 list() 前查 `table.table:not(.responsivetable-clone)` 是否存在，不存在返回 `HARD_LOGIN_WALL` + 指向 yaozh-auth。
7. **yaopinzhongbiao 详情链外部政府站**（scyxzbcg.cn 等），adapter 把外部 URL 推荐给调用者，自己不抓外部页。
8. **菜单估算 vs 实际条数差距巨大**：必须 live 抓取验证，不能信 recon 报告里的初始数字。

### Phase 4 conditional status

yaoex P0 已满，ysbang 已有 9/9。现在 yaozh 6+1（其中 yaopinzhongbiao gated）。Phase 4 (darwinian_evolver) 仍是 conditional —— bb-eval 现在覆盖两个 domain（ecommerce 12 checks + pharma-data 10 checks），fitness signal 比 Phase 1 强得多，**但还没触发 single-shot success rate < 30% 的标准**。当前所有 6+1 都是 SKILL-driven 一次性通过的。

### 仍然未做（明确边界）

- **yaopinzhongbiao 详情**：URL 指向外部政府站点。adapter 只返回链接，不抓外部页。
- **yaozh-auth**：静态通过，未实测（需要真实 cookie 验证）。
- **drugad 数据库**：菜单有但详情链接是 `#`，未实现（v2 候选）。
- **db.yaozh.com 其他子域**（/zhuce 注册、/linchuangshiyan 临床、/company_info 企业 等）—— recon 阶段已识别，但本轮按"市场信息"子域限定。

### Git 备份

- 备份 tag: `v1.0-pre-yaozh`（已 push origin），指向 Phase 3 baseline commit `9bbf896`
- 全程 commit history 推送 `zzhan111/bb-adapter-evolver` main 分支
- 回滚命令：`git reset --hard v1.0-pre-yaozh`

### 1688 详情页 JS bundle 加购 API 发现（未完成，记录以供后续）

详情页加载的 JS bundle 列表已收集：
- `upkg/od-sku-selection/0.26.6/index.amd.js` (60KB) — 含 `mtop.1688.mmga.offerdetail.service`
- `upkg/od-cart-sider/0.26.10/index.amd.js` (17KB) — 无 mtop API（纯 UI 组件）
- `upkg/od-submit-order/0.26.6/index.amd.js` (92KB) — 含 `mtop.alibaba.tradedata.center.repurchase.access` 和 `mtop.mbox.fc.common.gateway`
- `@ali/lib-mtop.js` — mtop 库
- `upkg/od-main-price/0.26.2/index.amd.js` — 价格模块
- `upkg/od-sku-selection/0.26.6/index.amd.js` — SKU 选择模块

加购 API 可能在 `od-sku-selection` 的动态加载子模块中（60KB 可能只是入口文件），或使用非 mtop 协议（如 REST）。后续需用 Chrome DevTools Network 面板人工加购一次来抓包。
