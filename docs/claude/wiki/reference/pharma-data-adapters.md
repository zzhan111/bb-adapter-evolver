---
title: Pharma-data adapter reference
type: wiki-reference
domain: pharma-data
last_updated: 2026-06-28
---

# Pharma-data adapter reference

The full set of canonical and forbidden adapter names for pharma-data. **Always check the canonical contract** at [`docs/claude/contracts/pharma-data/v1.md`](../../contracts/pharma-data/v1.md) — this page is the wiki summary.

## P0 — required per database (3)

| Adapter | Purpose | Read/Write |
|---|---|---|
| `auth` | Check login state. **Optional** — most public databases work without. | read |
| `list` | Database-key + filters → page of records. | read |
| `item` | Detail by ID. Auto-detects numeric vs base64 ID. | read |

## P1 — implement only when the database has the concept

| Adapter | Implement when |
|---|---|
| `search` | The site exposes a keyword-search box distinct from `list` filters. |
| `export` | The database has a CSV/Excel export button (typically VIP-gated). |
| `related` | The database exposes "related records" links. |

## Helper (cross-cutting, NOT per-database)

| Helper | Purpose |
|---|---|
| `yaozh-auth` (or generic `<site>-auth`) | Cookie-injector. Reads a session cookie, attaches to every request. **Does not perform login.** |

`yaozh-auth` is declared with `kind: helper`. `bb-eval` PHR-4/5/6/7 skip helpers.

## Naming rule

The adapter **file name** is the **dbKey**: `~/.bb-browser/sites/yaozh/adapters/<dbKey>.js`. The `@meta.name` is `<site>/<dbKey>`.

Example: `dbKey=yaopinjiage` → file `yaopinjiage.js` → `@meta.name = "yaozh/yaopinjiage"`.

## Forbidden (PHR-8 FAILs)

| Pattern | Why forbidden | Correct approach |
|---|---|---|
| `<dbKey>-list`, `<dbKey>-detail` as separate files | One adapter, two methods | Single adapter exporting `list` and `item` |
| `<filter>-list`, `<filter>-detail` | Multiplies surface area | Pass filter as `list` argument |
| `<dbKey>-debug`, `<dbKey>-v2` | Dead code | Delete before merge |
| Auto-login workflow | AGENTS.md #5 | `auth` reports state only |
| Hardcoded credentials / API keys / `Bearer ` literals | Security; rotates | Read from env / input at runtime |
| Adapter name not in canonical set | Sprawl | Use canonical name; if it doesn't fit, the contract is wrong |

## Worked `@meta` blocks

### Per-database (e.g. yaopinjiage)

```jsonc
/* @meta
{
  "name": "yaozh/yaopinjiage",
  "description": "List and item lookup for 药品价格 database on yaozh.",
  "domain": "pharma-data",
  "dbKey": "yaopinjiage",
  "args": [
    { "name": "name", "type": "string", "required": false, "desc": "keyword filter (column-specific)" },
    { "name": "page", "type": "int", "default": 1 }
  ],
  "capabilities": ["network"],
  "readOnly": true,
  "example": "bb-browser site yaozh/yaopinjiage --name '阿莫西林'"
}
*/
```

### Helper (yaozh-auth)

```jsonc
/* @meta
{
  "name": "yaozh/yaozh-auth",
  "description": "Cookie-injector for yaozh databases. Reads session cookie, attaches to all subsequent calls. Does NOT log in.",
  "domain": "pharma-data",
  "kind": "helper",
  "args": [
    { "name": "cookie", "type": "string", "required": true, "desc": "PHPSESSID or equivalent" }
  ],
  "capabilities": ["cookie"],
  "readOnly": true,
  "example": "bb-browser site yaozh/yaozh-auth --cookie '$COOKIE'"
}
*/
```

## Real databases currently in production (db.yaozh.com)

| dbKey | Records | Tier | keyword arg |
|---|---|---|---|
| `yaopinjiage` | 660,613 | public | `name` |
| `policies` | 27,203 | public | `policies_title` |
| `ypzl` | ~10 | public | `name` |
| `ypxs` | 35 | soft_vip | `cname` / `brandname` / `name` / `brandnamecn` |
| `dijia` | 32 | public | `name` |
| `yaopinzhongbiao` | 1,986,638 | hard_wall | `comprehensivesearchcontent` |
| `yaozh-auth` | — | helper | `cookie` |

Total: 6 databases + 1 helper.

## ID encoding

| Flavor | Example dbKey | Detection |
|---|---|---|
| Numeric | `yaopinjiage`, `policies` | `/^\d+$/.test(id)` |
| Base64 | `ypzl`, `dijia`, `ypxs` | `btoa`-shaped; longer than numeric |

`item()` auto-detects via discriminator. `bb-eval PHR-6` is a WARN — static check can't verify dynamic logic.

## See also

- [Contract source](../../contracts/pharma-data/v1.md)
- [Record schema](pharma-data-record.md)
- [Pharma-data domain](../domains/pharma-data.md)
- [Field-extraction algorithm v7](../domains/pharma-data.md#field-extraction-algorithm-v7-stable)
