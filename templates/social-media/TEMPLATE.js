/**
 * bb-browser Social-Media Adapter Template
 *
 * Shows the REQUIRED structure for any social-media domain adapter.
 * Conforms to docs/claude/contracts/social-media/v1.md.
 *
 * Run bb-eval to verify:  tools/bb-eval <your-adapter.js> --domain social-media
 *
 * Required @meta fields:
 *   name         - "<site>/<adapter>" (e.g. "xiaohongshu/search")
 *   description  - what it does
 *   domain       - MUST be "social-media"
 *   args         - parameter definitions
 *   capabilities - array, e.g. ["read","list"] or ["write"]
 *   readOnly     - true for reads, false for writes (SOC-5 cross-checks with accessTier)
 *   example      - "bb-browser site <site>/<adapter> ..."
 *
 * social-media-specific required fields:
 *   accessTier   - "anonymous" | "auth_read" | "auth_write"
 *   intent       - "discover" | "consume" | "engage" | "create" | "manage"
 *
 * Required code patterns:
 *   1. const HOME_URL = 'https://...' in first 50 lines
 *   2. error/hint/action triple on ALL error returns (use the 10-code enum)
 *   3. recommendedNextActions on every success return (except `auth`)
 *   4. authStatus field on every return (reflects tier ACTUALLY in effect)
 *   5. List adapters: constraints trio + pagination object
 *   6. Write adapters: return WriteReceipt (action/targetId/undoable/undoAdapter)
 *   7. Per-object token cache (xsecToken on XHS) — see social-media-playbook.md
 *
 * This file shows TWO skeletons: a READ list adapter (search) and a WRITE adapter (like).
 * Copy the one you need; delete the other.
 */

/* @meta
{
  "name": "xiaohongshu/search",
  "description": "Search Xiaohongshu notes by keyword, topic, or hashtag. Supports sort (general/latest), type (image/video), pagination via cursor.",
  "domain": "social-media",
  "args": [
    { "name": "keyword", "type": "string", "required": true, "desc": "Search term, topic name, or #hashtag" },
    { "name": "sort", "type": "enum", "values": ["general", "latest"], "default": "general" },
    { "name": "type", "type": "enum", "values": ["image", "video"] },
    { "name": "cursor", "type": "string", "desc": "Pagination cursor from previous page's pagination.nextArgs" }
  ],
  "capabilities": ["read", "list", "network"],
  "readOnly": true,
  "accessTier": "auth_read",
  "intent": "discover",
  "example": "bb-browser site xiaohongshu/search --keyword '咖啡推荐' --json"
}
*/

const HOME_URL = 'https://www.xiaohongshu.com';

// Per-note access token cache (XHS xsecToken pattern; see social-media-playbook.md §xsecToken cache).
// Populated by listing adapters, consulted by detail/comment/like adapters.
const noteContextCache = new Map();  // noteId -> { xsecToken, source, fetchedAt }

function cacheNoteContext(note) {
  if (note && note.id && note.xsecToken) {
    noteContextCache.set(note.id, {
      xsecToken: note.xsecToken,
      source: note._source || 'pc_search',
      fetchedAt: Date.now(),
    });
  }
}

// ===========================================================================
// SKELETON A — READ LIST ADAPTER (search). Copy this for: feed, user-notes,
// comments, notifications. Delete if authoring a write adapter.
// ===========================================================================

async function search(args) {
  const { keyword, sort = 'general', type, cursor } = args;

  // 1. Validate args
  if (!keyword) {
    return {
      ok: false,
      authStatus: 'anonymous',
      data: null,
      error: 'MISSING_ARG',  // NOTE: argument errors use a non-enum code; only runtime site errors use the 10-code enum
      hint: 'keyword is required.',
      action: 'abort',
    };
  }

  // 2. Ensure page context (navigate to search page so the signing module loads)
  const targetUrl = `${HOME_URL}/search_result?keyword=${encodeURIComponent(keyword)}&source=web_explore_feed`;
  const page = await bb.goto(targetUrl, { waitUntil: 'networkidle' });

  // 3. Detect login state. If login required and missing, STOP (AGENTS.md #5).
  const loginState = await bb.eval(() => !!(document.cookie.match(/web_session=([^;]+)/)));
  if (!loginState) {
    return {
      ok: false,
      authStatus: 'anonymous',
      data: null,
      error: 'LOGIN_REQUIRED',
      hint: 'Search needs a logged-in session. Run `auth`, then hand control to the human to log in.',
      action: 'stop_and_wait_for_human',
      recommendedNextActions: [
        { adapter: 'auth', args: {}, why: 'Check login state.' },
      ],
    };
  }

  // 4. Build the API request. Sign it via the live page function (tier-3).
  //    Replace this block with the actual captured endpoint from network capture.
  const apiPath = '/api/sns/web/v1/search/notes';
  const reqBody = { keyword, page: 1, page_size: 20, search_id: '', sort, note_type: type || 0 };
  const sign = await bb.eval((p, b) => window._webmsxyw(p, b), apiPath, reqBody).catch(() => null);

  let resp;
  try {
    resp = await bb.fetch(`https://edith.${HOME_URL.replace(/^https?:\/\//, '')}${apiPath}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-s': sign ? sign['X-s'] : '',
        'x-t': sign ? String(sign['X-t']) : '',
      },
      body: JSON.stringify(reqBody),
    });
  } catch (e) {
    return {
      ok: false,
      authStatus: 'auth_read',
      data: null,
      error: 'SIGNATURE_FAILED',
      hint: `Signing module unreachable or request rejected: ${e.message}`,
      action: 'refresh_and_retry',
      recommendedNextActions: [],
    };
  }

  // 5. Handle site error codes
  if (resp.status === 471 || resp.status === 461) {
    return {
      ok: false,
      authStatus: 'auth_read',
      data: null,
      error: 'CAPTCHA_REQUIRED',
      hint: 'XHS triggered a captcha. Human must solve it in-page; do not auto-retry within 60s.',
      action: 'stop_and_wait_for_human',
      recommendedNextActions: [],
    };
  }
  if (resp.status === 429) {
    return {
      ok: false,
      authStatus: 'auth_read',
      data: null,
      error: 'RATE_LIMITED',
      hint: 'Search rate-limited. Wait 60-300s before retrying.',
      action: 'backoff_and_retry',
      recommendedNextActions: [],
    };
  }

  const payload = await resp.json();
  if (!payload.success && payload.code !== 0) {
    return {
      ok: false,
      authStatus: 'auth_read',
      data: null,
      error: 'SIGNATURE_FAILED',
      hint: `Site code ${payload.code}: ${payload.msg || ''}`,
      action: 'refresh_and_retry',
      recommendedNextActions: [],
    };
  }

  // 6. Map raw items to Note objects (see contract §5)
  const rawItems = payload.data?.items || [];
  const notes = rawItems.map((item) => {
    const nc = item.note_card || {};
    const user = nc.user || {};
    const interact = nc.interact_info || {};
    const note = {
      id: item.id || nc.note_id,
      url: `${HOME_URL}/explore/${item.id || nc.note_id}`,
      type: nc.type === 'video' ? 'video' : 'image',
      title: nc.title || nc.display_title || '',
      desc: '',  // list adapters omit full desc; post-detail returns it
      author: {
        id: user.user_id || '',
        nickname: user.nickname || '',
        url: user.user_id ? `${HOME_URL}/user/profile/${user.user_id}` : '',
      },
      tags: (nc.tag_list || []).map((t) => t.name).filter(Boolean),
      topics: [],
      stats: {
        likes: parseInt(interact.liked_count || '0', 10) || 0,
        likesLabel: String(interact.liked_count || '0'),
        collections: parseInt(interact.collected_count || '0', 10) || 0,
        comments: parseInt(interact.comment_count || '0', 10) || 0,
        shares: parseInt(interact.share_count || '0', 10) || 0,
      },
      mediaCount: (nc.image_list || []).length,
      publishedAt: null,
      xsecToken: item.xsec_token || nc.xsec_token || '',
      scrapedAt: new Date().toISOString(),
      _source: 'pc_search',
    };
    cacheNoteContext(note);  // populate cache for downstream adapters
    return note;
  });

  // 7. Build pagination + constraints
  const hasMore = !!payload.data?.has_more;
  const nextCursor = payload.data?.cursor || '';

  return {
    ok: true,
    authStatus: 'auth_read',
    data: notes,
    constraints: {
      requestedConstraints: { keyword, sort, type: type || null },
      executedConstraints:   { keyword, sort },
      deferredConstraints:   type ? { type } : {},
    },
    pagination: {
      page: 1,
      pageSize: notes.length,
      hasMore,
      cursor: nextCursor,
      nextArgs: hasMore ? { keyword, sort, type, cursor: nextCursor } : null,
    },
    recommendedNextActions: notes.slice(0, 3).map((n) => ({
      adapter: 'post-detail',
      args: { noteId: n.id, xsecToken: n.xsecToken },
      why: `View full content of "${n.title}".`,
    })),
  };
}

// ===========================================================================
// SKELETON B — WRITE ADAPTER (like). Copy this for: favorite, comment-post,
// follow, post-create. Delete if authoring a read adapter.
//
// NOTE: when authoring a write adapter, change the @meta block at top:
//   "name": "xiaohongshu/like"
//   "capabilities": ["write", "network"]
//   "readOnly": false
//   "accessTier": "auth_write"
//   "intent": "engage"
// ===========================================================================

async function like(args) {
  const { noteId, xsecToken: tokenArg, undo = false } = args;

  if (!noteId) {
    return {
      ok: false,
      authStatus: 'anonymous',
      data: null,
      error: 'MISSING_ARG',
      hint: 'noteId is required.',
      action: 'abort',
    };
  }

  // 1. Resolve per-note token: prefer explicit arg, fall back to cache
  const ctx = noteContextCache.get(noteId) || {};
  const xsecToken = tokenArg || ctx.xsecToken || '';
  if (!xsecToken) {
    return {
      ok: false,
      authStatus: 'auth_read',
      data: null,
      error: 'PERMISSION_DENIED',
      hint: `No xsecToken for noteId ${noteId}. Run search/feed first to obtain it.`,
      action: 'abort',
      recommendedNextActions: [
        { adapter: 'search', args: { keyword: '' }, why: 'Obtain note list with tokens.' },
      ],
    };
  }

  // 2. Ensure login (writes ALWAYS need auth_write tier)
  const loginState = await bb.eval(() => !!(document.cookie.match(/web_session=([^;]+)/)));
  if (!loginState) {
    return {
      ok: false,
      authStatus: 'anonymous',
      data: null,
      error: 'LOGIN_REQUIRED',
      hint: 'Writes require a logged-in session. Hand control to the human to log in.',
      action: 'stop_and_wait_for_human',
      recommendedNextActions: [
        { adapter: 'auth', args: {}, why: 'Check login state.' },
      ],
    };
  }

  // 3. Call the write API (sign via live page function — tier-3)
  const apiPath = '/api/sns/web/v1/note/like';
  const reqBody = { note_oid: noteId };
  const sign = await bb.eval((p, b) => window._webmsxyw(p, b), apiPath, reqBody).catch(() => null);

  let resp;
  try {
    resp = await bb.fetch(`https://edith.${HOME_URL.replace(/^https?:\/\//, '')}${apiPath}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-s': sign ? sign['X-s'] : '',
        'x-t': sign ? String(sign['X-t']) : '',
      },
      body: JSON.stringify(reqBody),
    });
  } catch (e) {
    return {
      ok: false,
      authStatus: 'auth_write',
      data: null,
      error: 'WRITE_FAILED',
      hint: `Network error during like: ${e.message}`,
      action: 'retry_or_abort',
      recommendedNextActions: [],
    };
  }

  // 4. Map site errors
  if (resp.status === 471 || resp.status === 461) {
    return {
      ok: false, authStatus: 'auth_write', data: null,
      error: 'CAPTCHA_REQUIRED',
      hint: 'Write triggered captcha. Human must solve; do not auto-retry within 60s.',
      action: 'stop_and_wait_for_human',
      recommendedNextActions: [],
    };
  }
  if (resp.status === 429) {
    return {
      ok: false, authStatus: 'auth_write', data: null,
      error: 'RATE_LIMITED',
      hint: 'Like rate-limited. Wait 60-300s.',
      action: 'backoff_and_retry',
      recommendedNextActions: [],
    };
  }
  const payload = await resp.json();
  if (!payload.success && payload.code !== 0) {
    return {
      ok: false, authStatus: 'auth_write', data: null,
      error: 'WRITE_FAILED',
      hint: `Site code ${payload.code}: ${payload.msg || ''}`,
      action: 'retry_or_abort',
      recommendedNextActions: [],
    };
  }

  // 5. Return WriteReceipt (contract §5 WriteReceipt)
  return {
    ok: true,
    authStatus: 'auth_write',
    data: {
      action: undo ? 'unlike' : 'like',
      targetId: noteId,
      resultId: '',
      undoable: true,
      undoAdapter: `like --noteId ${noteId} --undo`,
      undoHint: 'Re-run with --undo to toggle the like state back.',
      url: `${HOME_URL}/explore/${noteId}`,
    },
    recommendedNextActions: [
      { adapter: 'like',        args: { noteId, undo: !undo },         why: 'Undo this action if unintended.' },
      { adapter: 'post-detail', args: { noteId, xsecToken },           why: 'Re-read to confirm updated like count.' },
    ],
  };
}
