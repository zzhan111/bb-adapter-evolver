---
title: Pharma-data Record object
type: wiki-reference
domain: pharma-data
last_updated: 2026-06-28
---

# Pharma-data Record object

The canonical `Record` shape returned by `list()` and `item()`. **Always check the canonical contract** at [`docs/claude/contracts/pharma-data/v1.md`](../../contracts/pharma-data/v1.md) — this page is the wiki summary.

## Shape

```jsonc
{
  "dbKey": "yaopinjiage",
  "id": "12345",                       // numeric OR base64
  "url": "https://db.yaozh.com/yaopinjiage/detail?id=12345",
  "title": "药品价格 — 记录标题",
  "fields": {                          // dynamic, depends on dbKey
    "药品名称": "阿莫西林胶囊",
    "剂型": "胶囊剂",
    "规格": "0.25g*24粒",
    "生产企业": "石药集团",
    "中标价": "¥12.50",
    "...": "..."
  },
  "authStatus": "public",              // public | soft_vip | hard_wall
  "vipGatedFields": [],                // field names whose values were cleared
  "scrapedAt": "2026-06-16T10:00:00.000Z"
}
```

## Field-by-field

| Field | Type | Required | Notes |
|---|---|---|---|
| `dbKey` | string | yes | The database identifier; must match `@meta.dbKey`. |
| `id` | string | yes | Numeric (`"12345"`) or base64 (`"YWJjZGVm..."`). The `item()` adapter auto-detects. |
| `url` | string | yes | Direct record URL on the source site. |
| `title` | string | yes | Display title (the row's primary label). |
| `fields` | object | yes | Dynamic, key→value map of all columns. Keys are the site's column names (often Chinese). |
| `authStatus` | enum | yes | `public` / `soft_vip` / `hard_wall` — the level actually in effect. |
| `vipGatedFields` | array | optional (soft_vip) | Names of fields whose values were cleared because the user lacks VIP. Empty if no gating. |
| `scrapedAt` | string | yes | ISO 8601 UTC timestamp. |

## Why `fields` is a dynamic object (not fixed keys)?

Each database has different columns. `yaopinjiage` has 药品名称 / 剂型 / 规格 / 生产企业 / 中标价. `policies` has policies_title / 发文字号 / 发布日期 / 发布机构. Hardcoding fields per dbKey would mean a new contract per database; the dynamic `fields` object is one contract that fits all.

## Why `vipGatedFields` is explicit (not implicit)?

When a record is `soft_vip`, some fields show "查看" / "view" instead of the actual value. The adapter's job is to:

1. **Detect** the gated values.
2. **Clear** them (set to empty string or `null`).
3. **List** them in `vipGatedFields` so the agent knows what's missing.
4. **Tell the agent how to upgrade** in `recommendedNextActions`.

**Never invent values.** A fake value is a lie the agent will trust. Empty + listed is honest.

## Worked examples

### public record (yaopinjiage)

```jsonc
{
  "dbKey": "yaopinjiage",
  "id": "12345",
  "url": "https://db.yaozh.com/yaopinjiage/detail?id=12345",
  "title": "阿莫西林胶囊 0.25g*24粒",
  "fields": {
    "药品名称": "阿莫西林胶囊",
    "剂型": "胶囊剂",
    "规格": "0.25g*24粒",
    "生产企业": "石药集团",
    "中标价": "¥12.50"
  },
  "authStatus": "public",
  "scrapedAt": "2026-06-16T10:00:00.000Z"
}
```

### soft_vip record (ypxs)

```jsonc
{
  "dbKey": "ypxs",
  "id": "YWJjZGVmMTIzNDU2Nzg5MA==",
  "url": "https://db.yaozh.com/ypxs/detail?id=YWJjZGVmMTIzNDU2Nzg5MA==",
  "title": "进口药品 — 样品记录",
  "fields": {
    "中文名称": "样品A",
    "英文名称": "",
    "品牌": "",
    "生产企业": "某国外厂商"
  },
  "authStatus": "soft_vip",
  "vipGatedFields": ["英文名称", "品牌"],
  "scrapedAt": "2026-06-16T10:00:00.000Z"
}
```

The empty strings in `fields["英文名称"]` and `fields["品牌"]` are **deliberate**. They indicate "the site had a value here, but we don't have permission to read it." The agent sees `vipGatedFields` and knows to either upgrade or skip these fields.

### hard_wall (yaopinzhongbiao before login)

```jsonc
{
  "dbKey": "yaopinzhongbiao",
  "id": null,
  "url": "https://db.yaozh.com/yaopinzhongbiao",
  "title": null,
  "fields": {},
  "authStatus": "hard_wall",
  "scrapedAt": "2026-06-16T10:00:00.000Z"
}
```

When the entire database is gated, `list()` returns this shape with `data: []` and an error envelope:

```jsonc
{
  "ok": false,
  "authStatus": "hard_wall",
  "data": null,
  "error": "HARD_LOGIN_WALL",
  "hint": "Run yaozh-auth first to inject session cookie.",
  "action": "stop_and_wait_for_human",
  "recommendedNextActions": [{ "adapter": "yaozh-auth", "args": { "cookie": "..." }, "why": "Inject session." }]
}
```

## See also

- [Contract source](../../contracts/pharma-data/v1.md)
- [Pharma-data adapter reference](pharma-data-adapters.md)
- [Pharma-data domain](../domains/pharma-data.md)
- [Field-extraction algorithm v7](../domains/pharma-data.md#field-extraction-algorithm-v7-stable)
