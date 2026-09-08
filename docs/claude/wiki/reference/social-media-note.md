---
title: Social-media Note / Author / User / Comment / WriteReceipt
type: wiki-reference
domain: social-media
last_updated: 2026-06-28
---

# Social-media object schemas

The five canonical shapes returned by social-media adapters. **Always check the canonical contract** at [`docs/claude/contracts/social-media/v1.md`](../../contracts/social-media/v1.md#5-object-model) — this page is the wiki summary.

## `Note`

Returned by `search`, `feed`, `user-notes`, `notifications` (as array); returned in full by `post-detail`.

```jsonc
{
  "id": "noteId",                              // platform primary key
  "url": "https://www.xiaohongshu.com/explore/noteId?xsec_token=...",
  "type": "image" | "video",
  "title": "笔记标题",
  "desc": "正文",                              // full text only in post-detail; list adapters may return "" or truncated
  "author": { /* Author, see below */ },
  "tags": ["美食", "旅行"],                    // hashtag array
  "topics": [                                  // associated topics; post-detail only
    { "id": "topicId", "name": "旅行" }
  ],
  "stats": {
    "likes": 1234,                             // int, agent-comparable
    "likesLabel": "1234",                      // raw site string, preserved
    "collections": 56,
    "comments": 78,
    "shares": 9
  },
  "mediaCount": 9,                             // image count, or video duration seconds
  "publishedAt": "2026-06-10T08:30:00.000Z",   // ISO 8601 UTC; null if unknown
  "xsecToken": "...",                          // per-note access token; empty string on non-XHS sites
  "scrapedAt": "2026-06-18T10:00:00.000Z"
}
```

### Field notes

- **`id`** — platform primary key. XHS uses 24-char hex.
- **`url`** — every note carries a direct URL.
- **`type`** — `image` or `video`. Some sites add `text` or `audio`; map to one of these or extend (but extension requires a contract bump).
- **`title`** — short label, not the full body.
- **`desc`** — full body text. List adapters may truncate to save bandwidth; `post-detail` returns full text.
- **`tags`** — hashtag array (without the `#` prefix).
- **`topics`** — associated topic pages. `post-detail` only; list adapters may omit.
- **`stats`** — every numeric stat is an integer (`agent-comparable`) paired with a `*Label` string (`"1.2万"` preserved). **Never just one.**
- **`mediaCount`** — image count, or video duration in seconds. Adapter should normalize to the same field.
- **`publishedAt`** — ISO 8601 UTC. `null` if the site doesn't expose it.
- **`xsecToken`** — XHS-only per-note access token. Empty string on non-XHS sites. Carried through `post-detail`, `comments`, `like`, etc.
- **`scrapedAt`** — when this envelope was generated. Always set.

## `Author` (nested in `Note.author`)

The minimal form embedded in every Note:

```jsonc
{
  "id": "userId",
  "nickname": "昵称",
  "url": "https://www.xiaohongshu.com/user/profile/userId"
}
```

Three fields. The full `User` object is returned only by the `user` adapter.

## `User` (returned by `user` adapter)

Full form. Shares field names with `Author` so the agent doesn't learn two schemas.

```jsonc
{
  "id": "userId",
  "nickname": "昵称",
  "redId": "小红书号",                        // platform public handle; empty on non-XHS sites
  "desc": "个人简介",
  "ipLocation": "IP 属地",
  "gender": "male" | "female" | "unknown",
  "url": "https://www.xiaohongshu.com/user/profile/userId",
  "stats": {
    "fans": 12000,                            // follower count
    "follows": 300,                           // following count
    "interaction": 45000                      // likes+collections composite (XHS metric)
  }
}
```

`redId` is XHS-specific. Other platforms have analogous public handles (`@username` for twitter); preserve them as `redId` for consistency, or extend the contract for a new field.

## `Comment`

Returned by `comments` and `comment-post` (as array / single).

```jsonc
{
  "id": "commentId",
  "noteId": "所属笔记 id",
  "author": { /* Author */ },
  "content": "评论正文",
  "stats": { "likes": 5, "subComments": 12 },
  "subComments": [ /* Comment[], recursive; comments adapter returns top-level only by default */ ],
  "createdAt": "2026-06-15T10:00:00.000Z",
  "url": "https://www.xiaohongshu.com/explore/noteId?comment=commentId"
}
```

`subComments` is recursive. By default, `comments` returns top-level only; `--all` auto-paginates and inlines sub-comments.

## `WriteReceipt`

Returned by all write adapters (`like`, `favorite`, `comment-post`, `follow`, `post-create`, P1 writes). Write adapters do NOT return the full Note/User — that's a read adapter's job. They return a lightweight receipt so the agent knows the action succeeded, whether it's undoable, and how to undo.

```jsonc
{
  "action": "like" | "unlike" | "favorite" | "unfavorite" | "comment" | "follow" | "unfollow" | "post",
  "targetId": "noteId | userId",               // the object acted upon
  "resultId": "commentId | newNoteId",         // only for comment / post-create
  "undoable": true,                            // whether the action can be reversed
  "undoAdapter": "like --undo",                // literal command string when undoable
  "undoHint": "Re-running `like` with --undo toggles the state back.",
  "url": "https://www.xiaohongshu.com/explore/newNoteId"
}
```

`undoAdapter` is a **literal command string** the agent can execute. Don't make the agent re-derive it.

## Why are stats `int + Label`?

The site may display `1.2万` or `12.3k` or `12,345`. The agent can't do arithmetic on `1.2万`. The `int` field (`12000`) is for arithmetic; the `*Label` field preserves the raw site string for human-readable display. **Always both.**

## Why is `xsecToken` part of the Note object?

XHS binds a token to the source of each note (`pc_search` / `pc_feed` / `pc_explore`). Subsequent calls (`post-detail`, `comments`, `like`) need the token or they 403. By carrying it on the Note, the agent can chain without re-deriving. **Adapter responsibility:** maintain a `noteId → xsecToken` cache; bb-eval SOC-13 warns if no cache evidence.

`xsecToken` is documented as XHS-only in the contract. Other social-media sites have analogous mechanisms (twitter's `x-agent-id` etc.); preserve them in a separate field, do not generalize into `xsecToken`.

## See also

- [Contract source](../../contracts/social-media/v1.md)
- [Social-media adapter reference](social-media-adapters.md)
- [Social-media domain](../domains/social-media.md)
- [Error codes](error-codes.md)
