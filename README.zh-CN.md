# bb-adapter-evolver

[English](README.md) | 简体中文

> 演化高质量 [bb-browser](https://github.com/epiral/bb-browser) adapter 的基础设施——目标是好用到 AI agent 可以作为主要使用者直接使用。

## 这是什么（以及不是什么）

**是：** 包裹在 adapter 编写流程外围的合约（contract）、技能（skill）、方法论和工具层。读一遍，长期受用。

**不是：** 存放 adapter 的地方。Adapter 存放在 `~/.bb-browser/sites/<site>/adapters/`。本仓库从不发布 adapter；它发布的是「好 adapter」的**定义**，以及**把任何 adapter 对照该定义进行校验**的工具。

## 为什么会有这个仓库

用户观察到 `~/.bb-browser/sites/ysbang/adapters/` 里有 38 个文件——`search`、`search-by-price`、`search-by-factory`、`search-by-provider`、`search-by-expriation_date`、`search-by-free-shipping`、`search-with-filters`、`search-filters`、`search-plan`……其中大部分都能收敛到少数几个标准用例（search、add-to-cart、checkout、order-list、switch-store）。

根本原因**不是**编码 agent 写不好 adapter，而是**「好 adapter」从未被定义过**。没有合约，每个新请求都会变成一个新 adapter，表面积单调增长。

本仓库的做法：先定义合约，再建执行合约的工具，最后才考虑自动化演化。

## 域（Domains）

「域」是一类站点，各自拥有独立的合约、检查族和模板。`tools/bb-eval` 从 `--domain`、`@meta.domain`（合约名或主机名）或 `@meta.name` 启发式解析所属域。

| 域 | 合约 | bb-eval 检查 | 模板 | 已验证站点 |
|---|---|---|---|---|
| ecommerce | `docs/claude/contracts/ecommerce/v1.md` | 13 项通用检查 | `templates/ecommerce/` | ysbang（1药城天津）、yaoex（1药城全国）9/9 P0 |
| pharma-data | `docs/claude/contracts/pharma-data/v1.md` | PHR-1..10 | `templates/pharma-data/` | yaozh（db.yaozh.com） |
| social-media | `docs/claude/contracts/social-media/v1.md` | SOC-1..13 | `templates/social-media/` | 小红书——15 个 adapter（SM-2）；twitter/bilibili 跨站验证待做（SM-3） |

所有域共享的粒度规则：**一个 adapter 对应一个意图（intent）；filter 变体折叠进参数。** `search-by-X` 式 adapter 是本仓库要防止的反模式。

## 四个阶段

| 阶段 | 内容 | 后续阶段为何依赖它 |
|---|---|---|
| 1. 合约 + bb-eval（✅ 已完成） | 编写 `docs/claude/contracts/ecommerce/v1.md`。构建 `tools/bb-eval` 静态检查器。对照 ysbang adapter 验证。 | 没有合约，演化就没有适应度信号。 |
| 2. Skill 循环（✅ 已完成） | 编码 agent 读 `SKILL.md`，写 adapter，`bb-eval` 打分，agent 迭代。从实际失败中打磨 `SKILL.md`。 | 在增加更多域之前，先证明合约是可教授的。 |
| 3. 跨站验证（✅ 已完成） | 只凭 SKILL 为 jd / pdd / 1药城 编写 adapter。从真实摩擦中打磨合约。 | 在自动化之前，先证明合约是通用的。 |
| 4.（条件触发）Evolver（未开始） | 对单次成功率低于 30% 的 tier-3 adapter，接入 `darwinian_evolver`。有机体 = adapter 源码。评估器 = `bb-eval` + example 运行。变异器 = 带着 SKILL 的编码 agent。 | 只有 1-3 都是真的，这一步才有意义。 |

用户在我主张「不要直接跳到 evolver」之后同意了这个分期——见 `docs/claude/decisions/2026-04-22-why-not-evolver-first.md`。

阶段 1-3 在 ecommerce 线上完成。之后 pharma-data 和 social-media 域按各自的线（PHR-*、SM-*）重复了同样的「合约 → 检查 → 模板 → 真实 adapter」循环；见 `memory/soul.md`。

## 仓库结构

```
bb-adapter-evolver/
├── AGENTS.md              # 任何 agent（人或 AI）在此工作的约定
├── README.md              # 本文件的英文版
├── README.zh-CN.md        # 本文件（简体中文）
├── docs/claude/
│   ├── contracts/         # 每个域一份 v1.md：ecommerce、pharma-data、social-media
│   ├── skills/
│   │   └── bb-adapter-author/
│   │       └── SKILL.md   # adapter 编写 agent 的系统提示词
│   ├── methodology/
│   │   ├── reverse-engineering/
│   │   │   ├── playbook.md               # 通用的 capture-before-code 手册
│   │   │   └── social-media-playbook.md  # XHS 专用：per-note token、签名、验证码冷却
│   │   ├── evaluation/
│   │   │   └── bb-eval-usage.md
│   │   └── setup/
│   │       └── wsl2-windows-chrome-cdp.md
│   ├── decisions/         # 带日期的决策记录（why-not-evolver-first、why-social-media-contract 等）
│   └── wiki/              # 覆盖以上全部内容的可导航 wiki（从 wiki/README.md 开始）
├── templates/             # 每个域的参考 adapter 骨架
│   ├── ecommerce/
│   ├── pharma-data/
│   └── social-media/
├── tools/
│   ├── bb-eval                          # 静态合约检查器（bash + jq，每个 adapter <1 秒）
│   ├── verify-adapter-runtime-shape.js  # 沙箱运行时校验器（mock 的 bb.*/page.* API）
│   ├── wiki-cli                         # docs/claude/wiki/ 的 CRUD CLI
│   └── cdp-windows                      # 启动第二个 daemon，经 portproxy 驱动 Windows Chrome
├── fixtures/              # 快照的示例输出，用于回归
├── tests/
│   └── wiki/              # test-curd.sh —— wiki-cli 回归测试套件
└── memory/
    └── soul.md            # 长期笔记（人类 + agent 共同追加），openclaw 风格
```

## 快速开始

对被要求「写一个 bb-browser adapter」的编码 agent：

```bash
# 1. 读 skill
cat docs/claude/skills/bb-adapter-author/SKILL.md

# 2. 判断域，读对应合约（ecommerce | pharma-data | social-media）
cat docs/claude/contracts/<domain>/v1.md

# 3. 编写 adapter（文件在本仓库之外，位于 ~/.bb-browser/sites/...）

# 4. 静态打分
./tools/bb-eval ~/.bb-browser/sites/<site>/adapters/<name>.js

# 5. 无浏览器校验返回 envelope 的形状
node tools/verify-adapter-runtime-shape.js --only <site>/<adapter>

# 6. 如果需要登录态，先停下来找人类，再运行 example。
```

## 状态

- 2026-04-22：Phase 1 启动。ecommerce 合约 v1、bb-eval、SKILL 初稿入库。
- 2026-06-16：Phase 1-3 完成（ecommerce 在 ysbang + yaoex 上验证）。pharma-data 域加入并在 yaozh 上验证。
- 2026-06-18：social-media 合约 v1 交付（SM-1）：合约、决策记录、playbook、模板、SOC-1..13 检查。
- 2026-06-19：SM-2 完成——15 个小红书 adapter（13 P0 + 2 P1），378 项 SOC 检查 / 0 fail，16/16 runtime-shape 验证通过。SM-3（twitter/bilibili 跨站）未开始。

滚动状态见 `memory/soul.md`（人类和 agent 都往里追加）。
