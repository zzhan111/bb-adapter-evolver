/**
 * bb-browser Social-Media Adapter Template — WRITE skeleton (like)
 *
 * Shows the REQUIRED structure for any social-media write adapter
 * (favorite / comment-post / follow / post-create / post-delete / comment-delete).
 * Conforms to docs/claude/contracts/social-media/v1.md.
 * The READ skeleton (search) lives in TEMPLATE.js next to this file.
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
 * Write-adapter specifics (contract §5 WriteReceipt, §3 access tiers):
 *   - @meta must declare readOnly: false, accessTier: "auth_write", intent per
 *     the SOC-4 pairing (like/favorite/comment-post/follow/dm-send → engage;
 *     post-create → create; post-delete/comment-delete → manage)
 *   - Return a WriteReceipt: action / targetId / undoable / undoAdapter
 *   - Writes ALWAYS hand control to the human when login is missing (AGENTS.md #5)
 *   - Destructive or hard-to-undo writes must require an explicit confirm arg
 *   - Per-note token (xsecToken on XHS) comes from the listing/detail adapter
 */

/* @meta
{
  "name": "xiaohongshu/like",
  "description": "Like or unlike a Xiaohongshu note. Returns a WriteReceipt with an undo action.",
  "domain": "social-media",
  "args": [
    { "name": "noteId", "type": "string", "required": true, "desc": "24-char note id from search/feed/post-detail" },
    { "name": "xsecToken", "type": "string", "required": false, "desc": "Per-note access token from the listing adapter" },
    { "name": "undo", "type": "boolean", "required": false, "desc": "true to unlike (default false)" }
  ],
  "capabilities": ["write", "network"],
  "readOnly": false,
  "accessTier": "auth_write",
  "intent": "engage",
  "example": "bb-browser site xiaohongshu/like --noteId 69f5d0bc0000000035033f20 --xsecToken <token> --json"
}
*/

async function like(args) {
  const HOME_URL = 'https://www.xiaohongshu.com';

  // Per-note token cache — populated when the same invocation lists/reads notes.
  // Cross-adapter, the token travels via args (see TEMPLATE.js read skeleton).
  const noteContextCache = new Map();  // noteId -> { xsecToken, source, fetchedAt }

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
