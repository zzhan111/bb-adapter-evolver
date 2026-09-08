/**
 * bb-browser Social-Media Adapter Template — READ skeleton (search)
 *
 * Shows the REQUIRED structure for any social-media read adapter.
 * Conforms to docs/claude/contracts/social-media/v1.md.
 * A WRITE skeleton (like) lives in TEMPLATE-write.js next to this file.
 *
 * FILE FORMAT (runtime rule): bb-browser strips the first @meta block comment and
 * evaluates the remaining file body as ONE expression, (body)(args). So each
 * adapter file = the @meta block + exactly ONE named async function; all consts
 * (HOME_URL included) and helpers live INSIDE that function. Top-level `const`,
 * extra statements, or `module.exports = ...` throw SyntaxError at runtime even
 * though `node --check` parses them fine as a standalone module.
 *
 * Run bb-eval to verify:  tools/bb-eval <your-adapter.js> --domain social-media
 *
 * Required @meta fields:
 *   name "<site>/<adapter>", description, domain "social-media", args,
 *   capabilities, readOnly, example, accessTier, intent (contract §3/§5).
 *
 * Required code patterns:
 *   1. const HOME_URL = 'https://...' as the first statement inside the function
 *      (must appear within the first 50 lines of the file)
 *   2. error/hint/action triple on ALL error returns (10-code enum)
 *   3. recommendedNextActions on every success return (except `auth`)
 *   4. authStatus field on every return (reflects tier ACTUALLY in effect)
 *   5. List adapters: constraints trio + pagination object
 *   6. Per-object token cache (xsecToken on XHS) — see social-media-playbook.md
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

async function search(args) {
  const HOME_URL = 'https://www.xiaohongshu.com';

  // Per-note access token cache (XHS xsecToken pattern; see social-media-playbook.md §xsecToken cache).
  // Populated by listing adapters, consulted by detail/comment/like adapters.
  // In real adapters the cache is per-invocation; listing adapters return tokens
  // in each Note so downstream adapters receive them via args.
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
