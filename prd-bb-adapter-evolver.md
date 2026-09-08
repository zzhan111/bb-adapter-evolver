# PRD · bb-adapter-evolver
**「好 adapter」的定义层：合约卡住表面积，静态闸门卡住差草稿，对齐 ma-browser v0.13 冻结飞轮**

| | |
|---|---|
| 状态 | Draft · 待拍板 |
| 日期 | 2026-09-08 |
| 产品 | `bb-adapter-evolver`（本仓库） |
| 基线 | 工作树 `W:\home\zhang\.openclaw\workspace\bb-adapter-evolver` · 分支 `feat/social-media-contract` · HEAD `44b08997f08670299970582ba97cd9145524aa41`（本会话开始时观察到 `6da9faf`；会话中另有 `docs(memory)` 提交推进到此处，未丢弃） |
| 对照运行时 | ma-browser **v0.13** PRD（`prd-ma-browser-v0.13.md`，冻结 / TTL 沉淀 / 健康 / 路 Y spike） |
| 作者 | Grok Build 4.6，根据本仓库文档 + 亲手跑 `bb-eval` + soul.md 现场记录起草 |
| 替代关系 | **不替代** `docs/claude/contracts/*/v1.md`（规范合约）、`docs/claude/decisions/`（ADR）、`memory/soul.md`（现场笔记）。本文是下一阶段可排期产品切口：把「好 adapter」定义接到 v0.13 冻结草稿上。 |
| 文档位置 | 仓库根 `prd-bb-adapter-evolver.md`。这是对 `AGENTS.md` 硬规则 #7（文档只进 `docs/claude/...`）的**产品工件例外**，对齐 ma-browser 把 PRD 放仓库根的做法。 |

本文件是产品需求，不是合约。合约仍以 `docs/claude/contracts/<domain>/v1.md` 为准。

---

## 0. 一句话

> **evolver 不发明浏览器，也不存 adapter。它定义「一个意图一个 adapter」并用 `bb-eval` 在一秒内否决差的草稿；ma-browser v0.13 负责把刚抓到的网络请求冻成私有 JS、把只读结果按 TTL 沉淀、把调用健康落盘。两边对上，第二个 agent 才不必把同一页再点一遍。**

Phase 4 的 `darwinian_evolver` 仍然是条件项，不是本轮交付。TTL 缓存、动态 MCP 工具、`site_freeze` 运行时都不是本仓库的活。

---

## 1. 为什么现在

1. **运行时已经把飞轮缺口写成 v0.13。** ma-browser 0.12.1 解决的是「别人敢把登录态交给这个进程」。v0.13 要把 `network` 冻成 `$BB_BROWSER_HOME/sites/<site>/<cmd>.js` 草稿（F1–F8）、给只读 `site_run` 加本机 TTL（K1–K6）、给失败加落盘健康（H1–H5）。冻结器会写出带 `/* @meta */` 的 `async function`。若 evolver 的质量闸对不准这份草稿，飞轮会把「ysbang 38 个文件」问题复制到每个被冻过的站点。
2. **「好 adapter」已经有三个域的定义，但教法仍在教幽灵 API。** 本分支完成了 ecommerce / pharma-data / social-media 三份 v1 合约、SOC-1..13、运行时语义的 Check 0（剥 `@meta` 后按 `(body)(args)` 编译）、`no-ghost-api`。亲手复跑：`1688/search` **16 pass / 0 warn / 0 fail**。同一套检查对三个官方 TEMPLATE 全部 **FAIL `no-ghost-api`**（`bb.goto` / `bb.$$eval`）。v0.13 冻结器若抄 TEMPLATE，草稿一落地就被自己的闸门打死。
3. **CLI 已经改名，文档还在教 `bb-browser`。** soul.md 2026-09-07 记录：本机 CLI 是 `ma-browser`。SKILL、合约 `@meta.example`、wiki author-loop 仍写 `bb-browser site ...`。冻结成功后的中文提示（v0.13 F7）会和 evolver 教的命令对不上。
4. **静态绿 ≠ 能跑，但静态红一定不该进冻结成功路径。** 1688 写路径在 soul.md 里走过 isTrusted、CHIPS、再被 warm-up 配方打通 `render`——这是现场 adapter/daemon 的活，合约检查器替代不了截图对照。evolver 该做的是：冻结草稿至少过 `bb-eval`；健康启发式能告诉 daemon「这是登录问题还是结构问题」。
5. **Phase 4 的触发条件仍未出现。** 决策 `docs/claude/decisions/2026-04-22-why-not-evolver-first.md`：单次 SKILL 成功率 <30% 才接达尔文演化。soul.md 记录的是反面：yaoex 9/9 P0、yaozh 6+1、XHS 15 个 adapter 静态 0 fail。本轮再接 population search 是浪费。

---

## 2. 受众

| 角色 | 他们要什么 | 本 PRD 成功的样子 |
|---|---|---|
| 主用户：写 adapter 的编码 agent | 读一份 SKILL + 一份合约，写出能过闸、能被 `site_run` 执行的文件 | TEMPLATE 不再调用 `bb.*`；`bb-eval` 对冻结草稿给机器可读 JSON；forbidden-name 挡住 `search-by-*` |
| 次用户：跑 ma-browser 的后到 agent | 调用面稳定：字段名、错误三元组、下一步 action | envelope 的 `success`/`ok` 分裂被写死或收敛；`NAVIGATE_REQUIRED` 成为跨域一等错误 |
| 冻结器实现者（ma-browser daemon） | 知道草稿怎样才算合格，不必重新发明粒度 | 冻结输出对 evolver 的 `@meta` / 单表达式 / 无幽灵 API / 无 Cookie 字面量 有明确闸门 |
| 维护者（同一人） | 知道哪个检查在撒谎、哪个域还没跨站证明 | PHR-8 对 dbKey 文件名的误 WARN 被修或被文档化为预期；SM-3 仍标未做 |
| 非用户 | adapter 商店、云端执行、跨站数仓、自动代提 bb-sites PR | 明确非目标 |

Adapter 文件永远住在 `~/.bb-browser/sites/`（Windows：`C:\Users\zhang\.bb-browser\sites`），**不进本仓库**。本仓库发布定义和检查器。

---

## 3. 产品原则（拍板，可反对）

沿用 `AGENTS.md` 八条硬规则。本轮只追加与 v0.13 对齐需要的三条。

| # | 决策 | 含义 |
|---|---|---|
| P1 | **合约先于演化** | 没有 fitness 信号不准接 `darwinian_evolver`。本轮仍不碰 Darwinian 主路径。 |
| P2 | **一个意图一个 adapter；filter 进参数** | ysbang 的 `search-by-*` 是反模式。XHS 的 `search` vs `feed` vs `user-notes` 是不同意图，允许并存。forbidden-name 表是闸门，不是风格建议。 |
| P3 | **主消费者是 AI agent** | 字段全英文、单位在值里、每条实体带 URL、失败必有 `error/hint/action`、成功带 `recommendedNextActions`。 |
| P4 | **默认假设 tier-2/3** | Cookie-only 是例外。冻结器做不到 Tier 3 时标 `incomplete`，evolver 不假装能生成签名。 |
| P5 | **登录是人类的活** | 任何需要会话的路径停下来等。禁止 stub cookie。写操作要 `confirm`（social 已有；ecommerce 的 `order-create` 仍禁止）。 |
| P6 | **静态闸门必须匹配真实运行时** | 运行时是剥 `@meta` 后 `(body)(args)`，页面上下文**没有** `bb` 全局。Check 0 与 `no-ghost-api` 优先于 `node --check`。 |
| P7 | **evolver 不写运行时状态** | 不写 TTL 缓存、不写 `adapter-health.json`、不注册 MCP 工具、不往 `bb-sites/` 推。那些是 ma-browser / daemon。 |
| P8 | **冻结草稿按私有代码供应链对待** | `source: "freeze-draft"` 是一等公民。evolver 给质量闸，不给「一键发布社区」。 |
| P9 | **域按用户主意图选，不按站点品牌选** | 有购物车走 ecommerce；查监管记录走 pharma-data；UGC+社交图走 social-media。硬套会废掉一半检查（见两份「为什么新建域」ADR）。 |
| P10 | **诚实优于礼貌** | 静态绿不能写成「生产就绪」。soul.md 已纠正过「匿名函数是 bug」的倒置结论；本 PRD 不再重复那个错误。 |

---

## 4. 相对现状（以本工作树为准）

对照 README / AGENTS.md / soul.md / 亲手 `bb-eval`。不引用 `D:\Apps\bb-adapter-evolver`。本仓库相对 `main`（`f2ae503`）约 +7434/−220，核心是 social-media 合同 + wiki + 运行时语义修复。工作树相对 HEAD **干净**（仅未跟踪的 `.grok-evolver-prd-prompt.md`）；1688 / XHS / yaozh 的 adapter 改动在 `~/.bb-browser/sites/`，不在本 git 树里。

| 声称将为真 | 2026-09-08 实际 |
|---|---|
| Phase 1–3 ecommerce | **已落地。** 合约 v1 + `bb-eval` + SKILL。yaoex（站点目录名 `ybm`，域名 `ybm100.com`）文档记录 **9/9 P0** 全部 bb-eval PASS（auth 10/10 … order-detail 11/11）。ysbang 仍是反模式基线：`search-by-price` 亲手复跑 **forbidden-name FAIL**（12 pass / 1 warn / 1 fail）。 |
| pharma-data 域 | **已落地。** 6 库 + `yaozh-auth` helper。`yaopinjiage` 亲手复跑 **24 pass / 1 warn / 0 fail**；WARN 是 PHR-8 把 dbKey 文件名当成非 canonical（合约要求「一库一文件」，检查表却只认 `auth\|list\|item\|search\|export\|related`）。这是闸门自相矛盾，不是 adapter 错。 |
| social-media SM-1 | **已落地。** 合约 v1、ADR、playbook、SOC-1..13、TEMPLATE 读/写骨架。 |
| social-media SM-2 | **静态完成，运行时分层。** soul.md：15 个 XHS adapter（13 P0 + 2 P1），378 SOC / 0 fail；auth/search/post-detail/like 有真实浏览器验证。其余以 runtime-shape + 静态为主。亲手复跑 `xiaohongshu/search`：**30 pass / 0 warn / 0 fail**。 |
| SM-3 twitter/bilibili 跨站 | **未开始。** `C:\Users\zhang\.bb-browser\sites\twitter\tweets.js` 存在，但不是按 social-media 合同写的套件。 |
| Phase 4 darwinian | **未触发。** 没有 <30% 单次成功率的证据。 |
| 运行时文件格式 | **已纠正（SM-2.9）。** 单表达式；顶层 `const` / `module.exports` 会在 site.ts 里 SyntaxError。Check 0 用 `vm.Script("(" + body + ")")`。 |
| 无幽灵 `bb.*` | **真实 adapter 已迁（SM-2.10），TEMPLATE 未迁。** 1688/search、xhs/search、yaopinjiage 均 PASS `no-ghost-api`。三个 TEMPLATE 均 FAIL。wiki `runtime-verification.md` 仍列出 mock `bb.goto`。 |
| SKILL 可直接用于冻结草稿 | **未对齐。** 仍教 `bb-browser network` 五步；未提 `site_freeze`、`NAVIGATE_REQUIRED`、`(body)(args)`、`ma-browser` 命令名。 |
| envelope 跨域同一 | **文档分裂。** ecommerce 合约用 `success`；social-media 合约与 wiki envelope 用 `ok`。1688/search 源码返回 `success`。冻结器若只学一份会写错字段。 |
| `bb-eval` 可 `./tools/bb-eval` 直接跑 | **未落地。** 文件模式 `-rw-r--r--`。`./tools/bb-eval` → `Permission denied`。必须 `bash tools/bb-eval`。 |

**已在本分支、不必当新需求：** 三域合约正文、SOC/PHR 检查族、wiki 骨架、intent 粒度规则、`WriteReceipt`、`NAVIGATE_REQUIRED` 错误码、Check 0 运行时语义、`no-ghost-api`、ybm100.com 启发式、URL 窗口改为「`@meta` 之后 50 行」。

**soul.md 已记录、本轮不当成 evolver 功能：** 1688 写路径的 isTrusted / CHIPS / mtop 签名；`render` 已有 SUCCESS 配方（warm-up + `data=` + 小写 API），`cart-add` 端到端未在文档里关闭。见 v0.13 非目标「Tier 3 自动生成」——evolver 不实现 CDP `clickAt`。

---

## 5. 目标与非目标

### 5.1 目标（本增量结束时必须为真）

1. 一份冻结草稿（`source: "freeze-draft"`，私有 `sites/<platform>/<command>.js`）可以用本仓库的 `bb-eval --json` 打分；**任一 FAIL 即视为未过质量闸**。daemon 不需要 fork 一份检查器。
2. 三个官方 TEMPLATE 在对应 `--domain` 下 **0 FAIL**（含 `no-ghost-api`），并且示范的是页面原生 API（`fetch` / `document` / `cookieStore` / `location`）+ 必要时返回 `NAVIGATE_REQUIRED`，而不是 `bb.goto`。
3. SKILL + wiki author-loop 描述的运行时与 site.ts 一致：单表达式、无 `bb` 全局、登录停等人类、写操作有 confirm。命令示例同时给出 `ma-browser site ...`（主）和历史 `bb-browser`（兼容一句）。
4. 冻结器需要的 `@meta` 最小集写进合约或 SKILL 的「freeze-draft」一节：`name` / `description` / `domain` / `args` / `readOnly` / `example` / `source`。ecommerce 的 `domain` 可以是 hostname；pharma-data / social-media 必须是合同名——**冻结器按域分支写，或 evolver 接受 hostname 并靠 `--domain` / `@meta.name` 启发式**，二选一写死，禁止再静默 `unknown`。
5. 跨域 envelope 要么收敛到一个顶层布尔字段，要么在合约+SKILL 用对照表写死「ecommerce=`success`，social/pharma=`ok`」，daemon 健康映射不得猜。
6. PHR-8 与「一库一文件、文件名=dbKey」一致：`yaopinjiage` 这类名字不再误 WARN。
7. SM-3 至少在 twitter **或** bilibili 上落地 **≥1 个** 读 adapter（建议 `auth` 或 `search`），bb-eval 0 FAIL，证明合同不是 XHS 专属。不做完 13 个 P0 也可以退出 SM-3。

### 5.2 非目标（本增量不做）

- `site_freeze` 运行时、私有目录写入、`isEvalLike` 提权（ma-browser F*）
- TTL 结果缓存、`cacheHit`、缓存失效（ma-browser K*）
- 把健康状态落到 `$BB_BROWSER_HOME/state/adapter-health.json` 或 `/api/sites`（ma-browser H*）
- 动态 MCP 真工具 spike（ma-browser Y*）
- 接入 `darwinian_evolver` / 种群搜索 / 对 SKILL.md 本身做进化（Phase 4）
- 向 [zzhan111/bb-sites](https://github.com/zzhan111/bb-sites) 代开 PR、把冻结草稿当社区更新
- 把 ysbang 现存 37 个 legacy adapter 全部改写成合同形状（继续当反模式基线；`bb-eval` 继续 FAIL `search-by-*`）
- 实现 1688 `cart-add` 所需的 CDP `clickAt` / `dispatchMouseEvent`
- 新的第四个域（新闻、直播、金融）——没有「现有检查被迫 N/A」的证据就不开域
- 本仓库内发布任何站点的 adapter 源码
- 编造安装量、命中率、单次成功率百分比（文档没写的数字本文不写）

---

## 6. 用户旅程（验收剧本）

### U1 · 编码 agent 写新 adapter（P0）

1. 读 `docs/claude/skills/bb-adapter-author/SKILL.md`。
2. 用 wiki「选域」三问选定 ecommerce / pharma-data / social-media。
3. 从对应 TEMPLATE 复制，**文件体是单函数**，URL 常量在 `@meta` 后的前 50 行代码内。
4. `bash tools/bb-eval --domain <d> <path>` → 0 FAIL。
5. 若需登录：停。人类在真实 Chrome 登录后再跑 example。
6. 成功则在 `fixtures/<domain>/` 留一份真实输出（已有的 yaoex/ysbang fixture 模式）。

失败即 P0：TEMPLATE 自己 FAIL；SKILL 教的 API 在运行时 ReferenceError。

### U2 · 冻结草稿过 evolver 闸（P0，对齐 v0.13 U1）

1. ma-browser 在已登录 tab 上 `site_freeze` 写出私有草稿（daemon 的活）。
2. evolver：`bash tools/bb-eval --json --domain <d> $BB_BROWSER_HOME/sites/<p>/<c>.js`。
3. JSON 含 pass/warn/fail 计数、每条 check 的 level/name/message、exit 语义（有 FAIL → 非 0）。
4. 草稿含 Cookie / `Authorization: Bearer` 字面量 → FAIL（与 v0.13 F4 同方向；evolver 用静态 grep 做第二道闸）。
5. 社区目录 `bb-sites/` 不被本仓库任何工具写入。

### U3 · 粒度闸门挡住反模式（P0）

1. 对 `ysbang/search-by-price.js` 跑 bb-eval → `forbidden-name` FAIL。
2. 对合法的 `1688/search.js` → 0 FAIL。
3. 对 `xiaohongshu/feed-hot` 这类名字（若有人冻出来）→ SOC-6 FAIL。
4. agent 读 SKILL 后应提议「把 filter 折进 `search` 的 args」，而不是新文件。

### U4 · 登录墙与写操作停等（P0）

1. 需登录的 adapter 返回 `LOGIN_REQUIRED` + `hint` + `action`（ecommerce 的 action 可以是可执行命令；social 绑定 `stop_and_wait_for_human`）。
2. 写 adapter（`like` / `cart-add`）未带 confirm / 人类在场时不得在文档里鼓励静默执行。
3. `order-create` 仍 forbidden。

### U5 · 跨站合同不是 XHS 专属（P1，SM-3）

1. 为 twitter 或 bilibili 写 `auth` 或 `search`，遵守 social-media v1（`accessTier` / `intent` / envelope）。
2. bb-eval `--domain social-media` 0 FAIL。
3. 不把 `xsecToken` 写进非 XHS 站点的必填字段。

### U6 · 被拒绝的行为

1. TEMPLATE 或 SKILL 再引入 `bb.goto` / `bb.eval` / `page.$eval` 作为推荐写法。
2. 把 evolver 做成 daemon：监听 19824、写 cache、改 `adapter-health.json`。
3. 为了「冻结成功率」放宽 forbidden-name 或删掉 `no-ghost-api`。
4. 静默把 `unknown` 域当成通过。

---

## 7. 需求

P0 挡住本增量宣布完成；P1 同增量应有，可不堵「冻结质量闸」本身；P2 不阻塞。

ID 前缀刻意避开 ma-browser 的 F/K/H/Y，避免两边文档对不上号。

### 7.1 P0 · 冻结草稿的质量闸（evolver 侧的 F*）

ma-browser 拥有：读 network ring、写私有 JS、`isEvalLike`、禁止写社区库。evolver 拥有：草稿必须长什么样、怎样算 FAIL。

| ID | 需求 | 验收 |
|---|---|---|
| QF-1 | 冻结草稿必须是：`/* @meta */` + **恰好一个** 可作为表达式求值的 `async function`。Check 0 保持 `(body)` 编译。 | U2；现有 1688/search 继续 PASS |
| QF-2 | `@meta` 最小集：`name`（`site/adapter`）、`description`、`domain`、`args`、`readOnly`、`example`。允许额外字段 `source: "freeze-draft"`、`title`、`risk`（1688/search 已有，不得因此 FAIL）。 | 单测或 fixture：一份最小冻结草稿 0 FAIL |
| QF-3 | `no-ghost-api` 保持 FAIL 级。注释里提到 `bb.goto` 不误报。 | U1；三个 TEMPLATE 修复后 0 FAIL |
| QF-4 | Cookie / `Authorization: Bearer <token>` / `password=` 字面量 FAIL（ecommerce 走现有 no-creds 风格；social 已有 SOC-12；补一条跨域检查以免冻结器漏网）。 | 与 v0.13 U5.2 同方向的静态 grep |
| QF-5 | `bb-eval --json` 稳定：`domain`、`adapter`、`pass`/`warn`/`fail`、`results[]`（level/check/message）、进程 exit 0 当且仅当 fail=0。 | daemon 可解析；人工 `jq` 一遍 |
| QF-6 | 域解析顺序写进 SKILL 与 bb-eval 头注释：显式合同名 → `--domain` → `@meta.domain`+`@meta.name` 启发式 → `unknown`（unknown 不得假装全绿：应 FAIL 或明确「checks skipped」）。 | 1688 hostname `s.1688.com` 仍进 ecommerce；xhs `social-media` 仍进 SOC |
| QF-7 | URL 常量规则保持「`@meta` 之后 50 行代码」。helper（`kind: helper`）豁免 PHR-3。 | 与 AGENTS.md #1 一致；June-29 大 `@meta` 头不再误杀 |

### 7.2 P0 · 把教法改成页面上下文（TEMPLATE / SKILL / wiki）

| ID | 需求 | 验收 |
|---|---|---|
| QS-1 | `templates/ecommerce/TEMPLATE.js`、`templates/pharma-data/TEMPLATE.js`、`templates/social-media/TEMPLATE.js`、`TEMPLATE-write.js` 去掉 `bb.*` / `page.*` 调用。读路径示范 `fetch(..., {credentials:'include'})` 或读已有 DOM/`__INITIAL_STATE__`；跨页示范 `NAVIGATE_REQUIRED` envelope。 | U1；bb-eval 0 FAIL |
| QS-2 | SKILL.md 增加「运行时没有 `bb` 全局」和「文件必须是单表达式」两条不可违反规则。捕获步骤改为：优先 `ma-browser` network / 未来的 `site_freeze`；五步手工保留给 Tier 3（与 v0.13 F7「不删五步」一致）。 | 全文检索 `bb.goto` 不得出现在推荐代码块 |
| QS-3 | wiki `workflow/author-loop.md`、`workflow/runtime-verification.md`、`methodology/reverse-engineering/playbook.md`、`social-media-playbook.md` 同步。verifier 文档不得再把 mock `bb.goto` 写成推荐运行时。 | 文档 diff 可审 |
| QS-4 | 所有 `@meta.example` 与 SKILL 命令主形式改为 `ma-browser site ...`；允许一行注明旧名 `bb-browser` 等价。 | U2 冻结成功提示与 SKILL 同一命令族 |
| QS-5 | `tools/bb-eval` 加可执行位，或 README 只教 `bash tools/bb-eval`。二选一，禁止文档写 `./tools/bb-eval` 而文件 `644`。 | 按文档复制即可跑 |

### 7.3 P0 · 合约修补（小而硬，不做 v2）

不新开 v2 文件。在现有 v1 上补齐冻结需要对齐的洞。

| ID | 需求 | 验收 |
|---|---|---|
| QC-1 | **envelope 对照表**写入三份合约或单独 `docs/claude/contracts/_shared/envelope.md`：ecommerce 顶层布尔是 `success`；social-media 是 `ok`；pharma-data 正文目前写 `success`。本轮默认：**不强制改已有 1688/ybm 源码**；冻结器按域选字段；SKILL 用表而不是「永远叫 ok」。若拍板收敛，另开任务，不藏在本 PRD 里偷偷改 80 个 adapter。 | U2；开放问题 #1 |
| QC-2 | ecommerce 合约把 `NAVIGATE_REQUIRED` 收进错误枚举（social-media v1 已有）。action 形如 `open <url>`。 | 1688/ybm 已在用该模式；合约追上代码 |
| QC-3 | PHR-8：dbKey 文件名（`yaopinjiage`、`policies`、…）视为 canonical per-database adapter；`auth`/`search`/`export`/`related`/`<site>-auth` 仍在集合内。`<dbKey>-list` 继续 FAIL。 | `yaopinjiage` 0 warn（或只剩真正的 PHR-6 类 WARN） |
| QC-4 | `@meta.domain` 约定写进选域页：pharma-data / social-media = 合同名；ecommerce = hostname **或** `"ecommerce"`，bb-eval 两种都认（已部分实现，SKILL 要写清楚）。 | 冻结器不会因 hostname 把 XHS 草稿打进 ecommerce |
| QC-5 | 冻结草稿 `source: "freeze-draft"` 不得触发 `unknown-name` 以外的额外 FAIL。canonical-name 仍按 adapter 本地名检查。 | 一份 example 草稿 |

### 7.4 P1 · 静态健康启发式（给 daemon H* 用，本仓库不落盘）

ma-browser 拥有：`site_run` 后写 `adapter-health.json`、在 `/api/sites` 展示。evolver 拥有：从合约/静态检查能推出的「下一步 action」建议，供 daemon 在 `broken` 时引用。

| ID | 需求 | 验收 |
|---|---|---|
| QH-1 | 输出一份短表（wiki 或 `docs/claude/methodology/evaluation/health-heuristics.md`）：401/403/`LOGIN_REQUIRED` → 去登录；`NAVIGATE_REQUIRED` → 打开 action 里的 URL 再跑；`forbidden-name` / `no-ghost-api` / Check 0 FAIL → 不要重试调用，去改源码或重新冻结；连续业务空结果且 success=true → 标「可能选择器漂移」，**不**由 evolver 改 status 文件。 | daemon H3 的 `action` 能链到这些句子 |
| QH-2 | `bb-eval --json` 的 FAIL 集合可被映射为 `broken` 的「结构失败」候选（语法、幽灵 API）。evolver **不**在 `site_run` 时写健康。 | 对照 v0.13 H1：写盘仍是 daemon |
| QH-3 | 不把 ysbang legacy 的 15 个 forbidden-name FAIL 当成「站点挂了」。健康启发式按 adapter name 粒度，不按站点一锅炖。 | 文档一句即可 |

### 7.5 P1 · SM-3 跨站（合同可移植）

| ID | 需求 | 验收 |
|---|---|---|
| XS-1 | twitter 或 bilibili：至少 1 个 P0 读 adapter，走 social-media 合同。 | U5 |
| XS-2 | `xsecToken` 继续标注 XHS-only。跨站 adapter 该字段可空。SOC-13 对非 XHS 不得 FAIL（保持 WARN 或跳过）。 | bb-eval 行为可复述 |
| XS-3 | 不把 SM-3 当成 13 个 P0 全量重做。全量是后续站点工作，不是 evolver 增量退出条件。 | 里程碑退出句 |

### 7.6 P2 · 工具卫生

| ID | 需求 | 验收 |
|---|---|---|
| P2-1 | `verify-adapter-runtime-shape.js` 与 Check 0 同一调用约定（剥 `@meta` + `(body)(args)`），sandbox **不提供** `bb`。wiki 与文件头一致。soul.md 写过 v3，文档有残留。 | 跑 TEMPLATE 修复后应 PASS 或诚实 skip，不得因 mock `bb` 而假绿 |
| P2-2 | ecommerce `templates/ecommerce/fixed/` 与 `reference/` 若仍教幽灵 API 或旧格式，在 README 标明「历史，勿作起点」。起点只有 TEMPLATE.js。 | 新 agent 不会复制 fixed/ 里的过期文件 |
| P2-3 | wiki-cli 保持；本增量不扩 wiki 产品面。 | 无新 CLI 旗标也可退出 |

### 7.7 明确不属于 evolver 的需求（对照 v0.13）

| v0.13 ID | 谁做 | evolver 做什么 |
|---|---|---|
| F1–F8 `site_freeze` | ma-browser daemon/CLI/MCP | QF-* 质量闸 + TEMPLATE |
| K1–K6 TTL 缓存 | ma-browser | 无 |
| H1–H5 健康落盘与 Capabilities | ma-browser | QH-* 启发式文案 |
| Y1–Y4 动态工具 spike | ma-browser MCP | 无 |
| Phase 4 darwinian | 本仓库未来条件项 | 本增量不排期 |

---

## 8. 架构约束

```
编码 agent / 人类
    |  读 SKILL + 合约 + TEMPLATE
    v
bb-adapter-evolver          定义层（本仓库）
    ├── docs/claude/contracts/<domain>/v1.md
    ├── docs/claude/skills/bb-adapter-author/SKILL.md
    ├── templates/<domain>/
    ├── tools/bb-eval            静态闸门（bash + jq + node vm）
    └── tools/verify-adapter-runtime-shape.js   沙箱形状（无真实 Chrome）
            |
            |  质量信号（JSON / exit code）
            v
ma-browser daemon (127.0.0.1)   运行时（另一个仓库）
    ├── site_freeze  →  $BB_BROWSER_HOME/sites/   私有草稿
    ├── site_run     →  真实 Chrome CDP，(body)(args)
    ├── cache/adapters/          TTL（v0.13）
    └── state/adapter-health.json 健康（v0.13）
```

约束：

- Adapter 源码的唯一运行时宿主是 **页面上下文**。evolver 的检查器不得假设 Node module、`require`、或 `bb` 全局。
- `bb-eval` 继续 **零网络、零 Chrome**。冻结器要跑草稿，用 ma-browser `site_run`。
- evolver 进程不绑定 19824，不读 `daemon.json`，不写 `$BB_BROWSER_HOME/state`。
- 跨 WSL/Windows：检查器跑在哪一侧都可以（纯文件）；**执行**必须走 daemon 那一侧的 Chrome（v0.13 D3）。本仓库的 `tools/cdp-windows` 只是历史启动器，不是产品路径。
- 新检查仍然是 `record LEVEL check message` 一块 bash。禁止把 bb-eval 重写成需要编译的服务。
- 合约变更的诊断顺序不变：先问合约是否真要求、再问检查是否错、最后才改 adapter。禁止为单个冻结草稿放宽闸门。

---

## 9. 成功指标

不编业务数字、不设「adapter 成功率 KPI」、不把 yaoex 9/9 或 XHS 378 pass 当成本增量的新成绩（那是已经发生的历史）。

| 闸门 | 通过线 |
|---|---|
| 冻结质量 | U2：一份真实或 fixture 冻结草稿 `bb-eval --json` fail=0；含 Cookie 的负例 FAIL |
| 教法 | 三个 TEMPLATE 0 FAIL；SKILL 推荐代码块无 `bb.goto` |
| 反模式 | `ysbang/search-by-price` 仍 FAIL `forbidden-name`；`1688/search` 仍 0 FAIL |
| 运行时语义 | Check 0 继续按表达式编译；多语句 fixture FAIL |
| 域 | 1688 hostname → ecommerce；xhs → social-media；yaozh → pharma-data；PHR-8 不再误伤 dbKey 名 |
| 跨站 | XS-1 有一个非 XHS 读 adapter 0 FAIL（P1，不堵 QF） |
| 边界 | 仓库 diff **不出现** cache 目录实现、health JSON writer、MCP `registerTool`、darwinian 接线 |
| 回归 | 上述 bb-eval 命令可在 WSL 用 `bash tools/bb-eval` 复跑 |

---

## 10. 里程碑与估期

一个人、不并行改 ma-browser。可压缩，不可跳过 P0。SM-3 不堵冻结质量闸。

| 阶段 | 内容 | 估期 | 退出 |
|---|---|---|---|
| M0 教对运行时 | QS-1..5：TEMPLATE 去幽灵 API；SKILL/wiki/`bb-eval` 可执行位或文档改 `bash` | 1–2 天 | U1；三 TEMPLATE 0 FAIL |
| M1 冻结闸 | QF-1..7 + QC-2..5：`--json`、freeze-draft meta、跨域 no-creds、NAVIGATE_REQUIRED 进 ecommerce | 2–3 天 | U2、U3、U6 |
| M2 envelope 诚实化 | QC-1 对照表（默认不改 80 个 adapter） | 0.5–1 天 | 对照表合入 SKILL |
| M3 健康启发式 | QH-1..3 短文，供 v0.13 H3 引用 | 0.5–1 天 | 文档可链 |
| M4 SM-3 | XS-1..3 一个跨站读 adapter | 2–4 天（含一次真实登录，人类在场） | U5 |
| 不排期 | Phase 4 darwinian；ysbang 37 文件清理；1688 写路径 | — | 触发条件见 §11 |

合计大约 **6–11 人日**（含 SM-3）或 **4–7 人日**（不含 SM-3）。M4 可与 ma-browser M1 冻结接入并行，但 evolver M0/M1 应先于「冻结器抄 TEMPLATE」。

**明确不进本里程碑：** darwinian 接线、TTL、动态 MCP 工具、托盘、Windows CI、把本仓库改成 daemon。

---

## 11. 开放问题（只这些问题需要拍）

尽量给默认，避免不拍就无法开工。

1. **`success` vs `ok` 是否本轮收敛？** 建议：**不收敛代码，只发对照表**（QC-1 默认）。1688/ybm/ysbang 用 `success`；XHS 合同用 `ok`。强行改 80 个文件会和「不丢未提交 adapter 改动」冲突，且与运行时无关。若拍板收敛，指定目标字段名后再开任务。
2. **冻结器的 `@meta.domain` 写 hostname 还是合同名？** 建议：ecommerce 写 hostname（与 1688 现状一致）；pharma-data / social-media 写合同名。冻结器必须知道域；evolver 用 `--domain` 兜底。不拍则按此默认。
3. **SM-3 选 twitter 还是 bilibili？** 建议：看人类当天能登录哪一个（AGENTS.md #5）。一个站点一个读 adapter 即可退出。两个都做完才许退出会拖死 M4。
4. **`bb-eval` 是否要 chmod +x？** 建议：加可执行位，README 两种调用都写。Windows 侧仍用 `bash tools/bb-eval`。

已关闭、不再问：

| 旧问题 | 处置 |
|---|---|
| 要不要先接 darwinian_evolver？ | 否。ADR 2026-04-22 仍有效。 |
| social-media 是否扩展 ecommerce？ | 否。ADR 2026-06-18。 |
| pharma-data 是否扩展 ecommerce？ | 否。ADR 2026-06-16。 |
| 匿名函数是不是语法错误？ | 否。2026-09-07 勘误：那是运行时合法格式。 |
| adapter 是否迁入本仓库？ | 否。永远在 `~/.bb-browser/sites/`。 |

---

## 12. 附录

### A. 与 ma-browser v0.13 的边界（规范表）

| 关注点 | evolver 拥有 | ma-browser / daemon 拥有 |
|---|---|---|
| 冻结 network→adapter 草稿（F*） | 草稿质量闸：合约、SKILL、TEMPLATE、`bb-eval`、forbidden-name、无幽灵 API、无密钥字面量 | `site_freeze` 运行时、私有 `sites/` 写入、overwrite 策略、`isEvalLike`、候选请求挑选、禁止写社区库 |
| adapter 健康（H*） | 静态信号 + 启发式文案（登录 / 重冻 / 改源码） | `site_run` 后落盘、`/api/sites` / Capabilities 展示、broken 使缓存失效 |
| TTL 缓存 / 沉淀 | **不做** | 本机 `cache/adapters/`、TTL、`fresh`、按 mtime/pin 失效 |
| 动态 MCP 工具 spike | **不做** | MCP `registerTool` / `list_changed`，书面 A/B/C 退出 |
| Phase 4 darwinian evolver | 条件项，本轮不排期 | N/A |
| 登录与写操作 | 合同规定停等、confirm、禁止 `order-create` | 真实 Chrome 会话、CDP 点击、提权 scope |
| Tier 3 签名 / Pinia / isTrusted | 合同标明「冻结器标 incomplete」；playbook 教怎么 capture | 做不到就 `incomplete` + 指向 `ma-browser guide`；不在 0.13 自动生成 |

### B. 如何消化现有文档

| 文档 | 用法 |
|---|---|
| 本文件 | 下一阶段排期。不替代合约。 |
| `prd-ma-browser-v0.13.md` | 运行时飞轮。F/K/H/Y 的实现以那份为准；本文件只接质量闸。 |
| `docs/claude/contracts/*/v1.md` | 规范。检查器服从合约，不是反过来。 |
| `docs/claude/decisions/2026-04-22-why-not-evolver-first.md` | Phase 4 仍条件触发。 |
| `docs/claude/decisions/2026-06-16-why-pharma-data-contract.md` | 为什么不扩展 ecommerce。 |
| `docs/claude/decisions/2026-06-18-why-social-media-contract.md` | 意图 vs filter；`post-create` 可逆故进 P0。 |
| `docs/claude/skills/bb-adapter-author/SKILL.md` | agent 系统提示。M0 必须改。 |
| `docs/claude/wiki/` | 导航层。与 SKILL 冲突时以合约+SKILL 为准，wiki 随后改。 |
| `memory/soul.md` | 现场事实（1688 截图对照、XHS 真实 bug、SM-2.8 勘误）。PRD 不重写这些历史，只引用。 |
| `docs/browser-for-agents-vision.md`（在 ma-browser 仓库） | 远景。evolver 对应「什么算好命令」；marketplace / 语义湖仍不做。 |

### C. 亲手复跑的 bb-eval（2026-09-08，WSL `ubuntu-work`）

环境：`tools/bb-eval` 模式 `644`，调用 `bash tools/bb-eval`；`jq` `/usr/bin/jq`；`node` `/usr/bin/node`。

```
bb-eval --domain ecommerce /home/zhang/.bb-browser/sites/1688/adapters/search.js
→ 16 pass / 0 warn / 0 fail

bb-eval --domain ecommerce templates/ecommerce/TEMPLATE.js
→ 14 pass / 0 warn / 1 fail   (no-ghost-api: bb.goto)

bb-eval --domain social-media templates/social-media/TEMPLATE.js
→ 28 pass / 0 warn / 1 fail   (no-ghost-api: bb.goto)

bb-eval --domain pharma-data templates/pharma-data/TEMPLATE.js
→ 23 pass / 1 warn / 1 fail   (no-ghost-api; PHR-8 EXAMPLE_DBKEY)

bb-eval --domain social-media ~/.bb-browser/sites/xiaohongshu/adapters/search.js
→ 30 pass / 0 warn / 0 fail

bb-eval --domain pharma-data ~/.bb-browser/sites/yaozh/adapters/yaopinjiage.js
→ 24 pass / 1 warn / 0 fail   (PHR-8 dbKey 名)

bb-eval --domain ecommerce ~/.bb-browser/sites/ysbang/adapters/search-by-price.js
→ 12 pass / 1 warn / 1 fail   (forbidden-name)
```

1688/search 的 16 项：`meta-block-valid`、`syntax-check`、`no-ghost-api`、`url-declared`、6 个 `meta-field-*`、`canonical-name`、`error-envelope`、`constraint-tracking`、`next-actions`、`pagination`。

### D. 已验证站点（只引用文档已声称的）

| 站点 | 域 | 文档状态 |
|---|---|---|
| ysbang | ecommerce | 反模式起源（约 37–38 文件）；`search` 曾 13/13；大量 `search-by-*` 仍在 |
| yaoex / ybm（ybm100.com） | ecommerce | 9/9 P0，bb-eval PASS（AGENTS.md / soul.md） |
| 1688 | ecommerce | soul.md：8/11 截图验证可用；写路径曾判 CHIPS 不可绕过，同日 `render` API 以 warm-up 配方打通；`cart-add` 端到端未关闭 |
| yaozh | pharma-data | 6+1；152 pass / 0 fail（决策记录）；PHR-8 误 WARN 仍在 |
| xiaohongshu | social-media | 15 adapter，378 SOC / 0 fail；4 个有真实浏览器验证 |

### E. 与远景冲突时以谁为准

若实施中想「为了冻结成功率」删掉 `no-ghost-api`、允许 `search-by-price`、或把 evolver 做成带缓存的服务——**不准。** P2/P6/P7 优先于冻结便利。冻结做不成 Tier 2/3 就让 ma-browser 标 `incomplete`，不要降低「好 adapter」的定义。
