---
title: Social-media adapter reference
type: wiki-reference
domain: social-media
last_updated: 2026-06-28
---

# Social-media adapter reference

The full set of canonical and forbidden adapter names for social-media. **Always check the canonical contract** at [`docs/claude/contracts/social-media/v1.md`](../../contracts/social-media/v1.md) — this page is the wiki summary.

## P0 — required (13)

| Adapter | Intent | Read/Write | Min tier | Purpose |
|---|---|---|---|---|
| `auth` | manage | read | anonymous | Report login state. No side effects. |
| `search` | discover | read | auth_read* | Keyword (+ topic/hashtag, sort, type) → Note[]. |
| `feed` | discover | read | auth_read* | Algorithmic / trending feed. `source` arg. |
| `post-detail` | consume | read | auth_read | Single note by id. |
| `comments` | consume | read | auth_read | Top-level comments on a post. |
| `user` | consume | read | auth_read | User profile. |
| `user-notes` | consume | read | auth_read | A user's published/liked/favorited notes. |
| `notifications` | consume | read | auth_read | Notification feed. |
| `unread` | consume | read | auth_read | Unread counts across notification types. |
| `like` | engage | write | auth_write | Like / unlike a post. |
| `favorite` | engage | write | auth_write | Bookmark / unbookmark. |
| `comment-post` | engage | write | auth_write | Post a comment. |
| `follow` | engage | write | auth_write | Follow / unfollow a user. |
| `post-create` | create | write | auth_write | Publish a new post. |

\* `search` / `feed` may partially work at `anonymous`. Declare `auth_read` as the tier needed for full results.

## P1 — implement only when the site exposes them

| Adapter | Intent | When to implement |
|---|---|---|
| `post-delete` | manage | Site supports deleting own posts (XHS does). |
| `comment-delete` | manage | Site supports deleting own comments (XHS does). |
| `dm-list` | consume | Site exposes DMs (XHS web API doesn't; twitter does). |
| `dm-send` | engage | Site exposes DMs. |
| `follow-list` | consume | Site exposes who-a-user-follows. |
| `follower-list` | consume | Site exposes a-user's followers. |

## Forbidden (SOC-6 FAILs)

| Pattern | Why | Correct approach |
|---|---|---|
| `feed-hot`, `feed-recommendation`, `feed-category`, `feed-following` | Filter-variant of `feed` | `source` arg |
| `search-topic`, `search-hashtag`, `topics` | Topic is keyword form | `topic` / `hashtag` arg on `search` |
| `user-posts`, `user-favorites`, `user-likes`, `favorites`, `likes` (as separate adapters) | Same intent, different subset | `which-list` arg on `user-notes` |
| `feed-summary`, `note-summary` | Agent always wants full Note | Return full Note objects |
| `hot-categories` | Dead-end enumeration | Document valid categories in `description` |
| `auto-login`, `login-flow` | AGENTS.md #5 | `auth` reports state only |
| `*-debug`, `*-v2` | Dead code | Delete before merge |

## Worked `@meta` blocks

### `auth`

```jsonc
/* @meta
{
  "name": "xiaohongshu/auth",
  "description": "Check login state for Xiaohongshu. No side effects.",
  "domain": "social-media",
  "args": [],
  "capabilities": ["cookie"],
  "readOnly": true,
  "accessTier": "anonymous",
  "intent": "manage",
  "example": "bb-browser site xiaohongshu/auth"
}
*/
```

### `search`

```jsonc
/* @meta
{
  "name": "xiaohongshu/search",
  "description": "Search XHS by keyword, topic, or hashtag. Supports sort, type filter, pagination.",
  "domain": "social-media",
  "args": [
    { "name": "keyword", "type": "string", "required": true },
    { "name": "sort", "type": "enum", "values": ["general", "latest"] },
    { "name": "type", "type": "enum", "values": ["image", "video"] },
    { "name": "cursor", "type": "string" }
  ],
  "capabilities": ["read", "list"],
  "readOnly": true,
  "accessTier": "auth_read",
  "intent": "discover",
  "example": "bb-browser site xiaohongshu/search --keyword '咖啡推荐'"
}
*/
```

### `like`

```jsonc
/* @meta
{
  "name": "xiaohongshu/like",
  "description": "Like (and --undo unlike) a post. Requires auth_write. CONFIRM required for write.",
  "domain": "social-media",
  "args": [
    { "name": "noteId", "type": "string", "required": true },
    { "name": "xsecToken", "type": "string", "required": true },
    { "name": "undo", "type": "boolean", "default": false },
    { "name": "confirm", "type": "boolean", "default": false, "desc": "Required true to execute the write." }
  ],
  "capabilities": ["dom"],
  "readOnly": false,
  "accessTier": "auth_write",
  "intent": "engage",
  "example": "bb-browser site xiaohongshu/like --noteId <id> --xsecToken <t> --confirm"
}
*/
```

## Sites currently in production

| Site | Coverage | bb-eval | runtime-shape |
|---|---|---|---|
| `xiaohongshu` | 13 P0 + 2 P1 | 378 / 0 / 0 | 16 / 16 PASS |

## See also

- [Contract source](../../contracts/social-media/v1.md)
- [Note / Author / User / Comment / WriteReceipt schemas](social-media-note.md)
- [Social-media domain](../domains/social-media.md)
- [XHS reverse-engineering playbook](../../methodology/reverse-engineering/social-media-playbook.md)
