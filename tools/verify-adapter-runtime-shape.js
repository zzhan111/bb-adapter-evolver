#!/usr/bin/env node
/**
 * verify-adapter-runtime-shape.js (v2 — runtime mock execution)
 *
 * Runs each adapter's exported function in a sandboxed Node context with
 * `bb.*` and `page.*` APIs mocked. This is **runtime shape verification**
 * without needing a real browser:
 *
 *   - We invoke adapter(args) with synthesized mock args.
 *   - Adapter's internal page.goto / page.eval calls return canned shapes
 *     (e.g. INITIAL_STATE.user.userInfo._value).
 *   - Adapter returns an envelope; we inspect it for shape compliance.
 *
 * This catches what regex-based static analysis cannot:
 *   - "Return object looks fine on paper" but actually builds the wrong shape.
 *   - Refs to undefined variables (ReferenceError).
 *   - Conditional branches that silently skip required fields.
 *
 * Run:
 *   node tools/verify-adapter-runtime-shape.js --domain social-media
 *   node tools/verify-adapter-runtime-shape.js --only xiaohongshu/feed
 *   node tools/verify-adapter-runtime-shape.js --json
 *
 * Limitations:
 *   - Adapter may need xsecToken in args; we pass canonical mock tokens.
 *   - Adapter may branch on user role/permission; we mock them as success.
 *   - Mocked page responses are simplified; adapter's specific field
 *     expectations might not all be satisfied.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const ADAPTERS_DIR = process.env.BB_ADAPTERS_DIR
  || 'C:\\Users\\zhang\\.bb-browser\\sites';

const argv = process.argv.slice(2);
function getArg(flag) {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : null;
}
const onlyAdapter = getArg('--only');
const domainFilter = getArg('--domain');
const jsonMode = argv.includes('--json');

// ---------------------------------------------------------------------------
// Contract spec
// ---------------------------------------------------------------------------
const ACCESS_TIERS = ['anonymous', 'auth_read', 'auth_write'];
const INTENTS = ['discover', 'consume', 'engage', 'create', 'manage'];
const ERROR_CODES = [
  'LOGIN_REQUIRED', 'CAPTCHA_REQUIRED', 'RATE_LIMITED',
  'SIGNATURE_FAILED', 'IP_BLOCKED', 'NOT_FOUND',
  'PERMISSION_DENIED', 'CONTENT_REJECTED', 'WRITE_FAILED', 'AUTH_EXPIRED',
];
const ERROR_TO_ACTION = {
  LOGIN_REQUIRED: 'stop_and_wait_for_human',
  CAPTCHA_REQUIRED: 'stop_and_wait_for_human',
  RATE_LIMITED: 'backoff_and_retry',
  SIGNATURE_FAILED: 'refresh_and_retry',
  IP_BLOCKED: 'stop_and_wait_for_human',
  NOT_FOUND: 'abort',
  PERMISSION_DENIED: 'abort',
  CONTENT_REJECTED: 'abort',
  WRITE_FAILED: 'retry_or_abort',
  AUTH_EXPIRED: 'stop_and_wait_for_human',
};
const WRITE_ADAPTERS = new Set(['like', 'favorite', 'comment-post', 'follow', 'post-create', 'post-delete', 'comment-delete']);
const LIST_ADAPTERS = new Set(['search', 'feed', 'user-notes', 'comments', 'notifications']);
const READ_ADAPTERS = new Set(['auth', 'search', 'feed', 'post-detail', 'user', 'user-notes', 'comments', 'notifications', 'unread', 'like', 'favorite', 'comment-post', 'follow', 'post-create', 'post-delete', 'comment-delete']);

// ---------------------------------------------------------------------------
// Adapter discovery
// ---------------------------------------------------------------------------
function findAdapters() {
  const out = [];
  if (!fs.existsSync(ADAPTERS_DIR)) return out;
  for (const site of fs.readdirSync(ADAPTERS_DIR)) {
    const sitePath = path.join(ADAPTERS_DIR, site, 'adapters');
    if (!fs.existsSync(sitePath)) continue;
    for (const file of fs.readdirSync(sitePath)) {
      if (!file.endsWith('.js')) continue;
      out.push({
        site,
        adapter: file.replace(/\.js$/, ''),
        path: path.join(sitePath, file),
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// @meta extraction
// ---------------------------------------------------------------------------
function extractMeta(src) {
  const m = src.match(/\/\*\s*@meta\s*(\{[\s\S]*?\})\s*\*\//);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch (e) { return { _parseError: e.message }; }
}

// ---------------------------------------------------------------------------
// Mock data factory
// ---------------------------------------------------------------------------
const MOCK_USERINFO = {
  userId: '5fe95be5000000000100a0fb',
  nickName: '达霖Darling',
  nickname: '达霖Darling',
  redId: '1100796236',
  desc: 'mock user',
  ipLocation: '上海',
  gender: 'male',
  fans: '12000',
  follows: '300',
  interaction: '45000',
  notes: '12',
  image: 'https://mock/avatar.jpg',
  avatar: 'https://mock/avatar.jpg',
};

const MOCK_SEARCH_FEEDS = [
  { id: 'note001', noteCard: { user: { userId: 'u1', nickName: 'AI 李放心' }, type: 'video', displayTitle: 'mock note 1', interactInfo: { likedCount: '100', collectedCount: '50', commentCount: '10', sharedCount: '5' }, imageList: [{}] }, xsecToken: 'AB2xtF2QyC4ElRF9Lk7jOLnvQii2tO15OmjxHZWW' },
  { id: 'note002', noteCard: { user: { userId: 'u2', nickName: 'User 2' }, type: 'normal', displayTitle: 'mock note 2', interactInfo: { likedCount: '200', collectedCount: '80', commentCount: '20', sharedCount: '10' }, imageList: [{}] }, xsecToken: 'XY9zTr2QyC4ElRF9Lk7jOLnvQii2tO15OmjxHZWX' },
];

const MOCK_NOTE_DETAIL = {
  noteId: '69f5d0bc0000000035033f20',
  type: 'video',
  title: 'mock note title',
  displayTitle: 'mock note title',
  desc: 'mock desc with detail (this is only available on detail/feed endpoints)',
  user: { userId: '5c55880f0000000012004d14', nickName: '我是阿众', redId: '123456', ipLocation: '北京', userId: '5c55880f0000000012004d14' },
  tagList: [{ id: 't1', name: 'skill', type: 'topic' }, { id: 't2', name: 'claude', type: 'topic' }, { id: 't3', name: 'ai', type: 'topic' }],
  topicList: [],
  interactInfo: { likedCount: '1931', collectedCount: '4188', commentCount: '16', sharedCount: '3' },
  time: 1777717436000,
  lastUpdateTime: 1777717437000,
  imageList: [{}],
  video: { url: 'mock.mp4' },
  comments: {
    _value: [
      { id: 'c1', userInfo: { userId: 'u3', nickName: '宫保' }, content: 'mock comment', interactInfo: { likedCount: '5' }, subComments: [], createTime: 1777717436000, ipLocation: '天津' },
    ],
  },
};

function mockInitialState(scenario) {
  const base = {
    global: {},
    user: {
      userInfo: MOCK_USERINFO,
    },
    search: { feeds: MOCK_SEARCH_FEEDS, hasMore: { _value: true } },
    note: {
      currentNoteId: { _value: '69f5d0bc0000000035033f20' },
      noteDetailMap: {
        undefined: { note: null },
        '': { note: null },
        '69f5d0bc0000000035033f20': { note: MOCK_NOTE_DETAIL },
      },
    },
    notification: {
      all: [
        { id: 'n1', type: 'like', userInfo: { userId: 'u4', nickName: 'Actor' }, content: 'liked your note', createTime: 1777717436000, read: false },
      ],
      mentions: [],
      likes: [{ id: 'n1', type: 'like', userInfo: { userId: 'u4', nickName: 'Actor' }, content: 'liked your note', read: false }],
      connections: [],
      messages: [{ id: 'n1', type: 'like', content: 'mock notification', read: false }],
      messageMap: { all: [{ id: 'n1', type: 'like', content: 'mock', read: false }] },
      unread: 1,
      unreadCount: 1,
    },
    feed: {
      feeds: MOCK_SEARCH_FEEDS,
      recommendFeeds: MOCK_SEARCH_FEEDS,
      hotFeeds: MOCK_SEARCH_FEEDS,
      categoryFeeds: MOCK_SEARCH_FEEDS,
      followingFeeds: MOCK_SEARCH_FEEDS,
    },
  };
  return base;
}

// ---------------------------------------------------------------------------
// Mock bb / page API
// ---------------------------------------------------------------------------
function makeMockBb(scenario) {
  const initialState = mockInitialState(scenario);

  const mockPage = {
    eval: async (script, ...args) => {
      // script is a function string like "() => { ... }" or "async () => { ... }".
      // Run it inside a sandbox with the mock initial state.
      return await runInSandbox(script, args, initialState, scenario);
    },
    goto: async (url, opts) => {
      return mockPage;
    },
    wait: async (ms) => {},
    click: async (ref) => ({ role: 'div', name: 'mock' }),
  };

  return {
    goto: mockPage.goto,
    eval: mockPage.eval,
    wait: mockPage.wait,
    click: mockPage.click,
    _scenario: scenario,
    _initialState: initialState,
  };
}

async function runInSandbox(fnSrc, fnArgs, initialState, scenario) {
  // The adapter passes functions like `() => document.cookie.split(';')...`
  // We need to provide:
  //   - window, document, location, console, cookieStore, URL, JSON
  //   - window.__INITIAL_STATE__ = mock state
  //   - window.fetch
  const sandbox = {
    window: {},
    document: makeMockDocument(scenario),
    location: { href: 'https://www.xiaohongshu.com/explore' },
    console,
    URL,
    JSON,
    setTimeout, clearTimeout, setInterval, clearInterval, Promise,
    fetch: async () => ({ ok: true, status: 200, json: async () => ({ code: 0, success: true, data: {} }), text: async () => '{"code":0}' }),
    cookieStore: {
      getAll: async () => [
        { name: 'a1', value: 'mock-a1-token', sameSite: 'lax', httpOnly: false, secure: false, partitionKey: null, path: '/' },
        { name: 'webId', value: 'mock-webid', sameSite: 'lax', httpOnly: false, secure: false, partitionKey: null, path: '/' },
      ],
    },
  };
  sandbox.window.__INITIAL_STATE__ = initialState;
  sandbox.window.cookieStore = sandbox.cookieStore;
  sandbox.window.fetch = sandbox.fetch;
  sandbox.window.location = sandbox.location;
  sandbox.window.console = console;
  sandbox.window.URL = URL;
  sandbox.window.JSON = JSON;
  sandbox.window.setTimeout = setTimeout;
  sandbox.window.Promise = Promise;
  // Wrap fnSrc in a call. fnSrc is typically "() => { ... }" — we wrap it as `(fnSrc)(...)`.
  // To handle all forms, simply wrap as `((...args) => ${fnSrc.trim()})(...args)`.
  // Actually simpler: append `; return (() => ${fnSrc})()` to invoke. But the safest:
  //   wrap the entire fnSrc in parens and call with args.
  let result;
  try {
    const wrapped = `(${fnSrc})(...args)`;
    const fn = new vm.Script(wrapped);
    const fnVal = fn.runInNewContext({ ...sandbox, args: fnArgs });
    result = await fnVal;
  } catch (e) {
    return { __mockError: e.message };
  }
  return result;
}

function makeMockDocument(scenario) {
  // Adapter sometimes calls document.querySelectorAll('[contenteditable="true"]').
  // Mock with an empty NodeList that supports .find().
  const emptyNodeList = {
    find: () => null,
    forEach: () => {},
    length: 0,
    0: undefined,
  };
  // Adapter auth does `await cookies.map(...)` etc — need real Array methods.
  const emptyArray = [];
  return {
    cookie: 'a1=mock-a1-token; webId=mock-webid',
    querySelector: (sel) => null,
    querySelectorAll: (sel) => {
      // auth.js does `cookies.map(c => c.name)` — return real array.
      if (sel === '*' || sel === 'button' || sel === '[contenteditable="true"]') return emptyArray;
      return emptyNodeList;
    },
    getElementById: (id) => null,
    readyState: 'complete',
    title: '小红书 - 你的生活兴趣社区',
  };
}

// ---------------------------------------------------------------------------
// Build default mock args per adapter
// ---------------------------------------------------------------------------
function defaultArgsFor(adapterName) {
  switch (adapterName) {
    case 'auth': return {};
    case 'search': return { keyword: '咖啡推荐' };
    case 'feed': return { source: 'recommendation' };
    case 'post-detail': return { noteId: '69f5d0bc0000000035033f20', xsecToken: 'mock-xsec-token', xsecSource: 'pc_search' };
    case 'user': return { userId: 'me' };
    case 'user-notes': return { whose: 'me', whichList: 'published' };
    case 'comments': return { noteId: '69f5d0bc0000000035033f20', xsecToken: 'mock-xsec-token' };
    case 'notifications': return { tab: 'all' };
    case 'unread': return {};
    case 'like': return { noteId: '69f5d0bc0000000035033f20', xsecToken: 'mock-xsec-token', confirm: true };
    case 'favorite': return { noteId: '69f5d0bc0000000035033f20', xsecToken: 'mock-xsec-token', confirm: true };
    case 'comment-post': return { noteId: '69f5d0bc0000000035033f20', xsecToken: 'mock-xsec-token', content: 'mock comment from verifier', confirm: true };
    case 'follow': return { userId: '5c55880f0000000012004d14', confirm: true };
    case 'post-create': return { title: 'mock title', content: 'mock content body', confirm: true };
    case 'post-delete': return { noteId: '69f5d0bc0000000035033f20', xsecToken: 'mock-xsec-token', confirm: true };
    case 'comment-delete': return { noteId: '69f5d0bc0000000035033f20', commentId: 'c1', xsecToken: 'mock-xsec-token', confirm: true };
    default: return {};
  }
}

// ---------------------------------------------------------------------------
// Per-adapter verifier
// ---------------------------------------------------------------------------
async function verifyAdapter(adapter) {
  const issues = [];
  const src = fs.readFileSync(adapter.path, 'utf8');

  // Syntax check.
  try { new vm.Script(src, { filename: adapter.path }); }
  catch (e) { issues.push(`syntax error: ${e.message}`); return { adapter, ok: false, issues }; }

  // @meta check.
  const meta = extractMeta(src);
  if (!meta) { issues.push('missing @meta block'); return { adapter, ok: false, issues }; }
  if (meta._parseError) { issues.push(`@meta JSON parse error: ${meta._parseError}`); return { adapter, ok: false, issues }; }
  if (domainFilter && meta.domain !== domainFilter) {
    return { adapter, ok: true, issues: [], skipped: true, meta };
  }
  if (meta.domain !== 'social-media') {
    return { adapter, ok: true, issues: [], skipped: true, meta, skipReason: `domain=${meta.domain}, not social-media` };
  }

  // Meta-level checks.
  if (!ACCESS_TIERS.includes(meta.accessTier)) issues.push(`@meta.accessTier invalid: '${meta.accessTier}'`);
  if (!INTENTS.includes(meta.intent)) issues.push(`@meta.intent invalid: '${meta.intent}'`);
  if (WRITE_ADAPTERS.has(adapter.adapter) && meta.readOnly !== false) {
    issues.push(`write adapter must have readOnly: false (got: ${meta.readOnly})`);
  }
  if (!WRITE_ADAPTERS.has(adapter.adapter) && meta.readOnly !== true) {
    issues.push(`non-write adapter must have readOnly: true (got: ${meta.readOnly})`);
  }
  if (WRITE_ADAPTERS.has(adapter.adapter) && meta.accessTier !== 'auth_write') {
    issues.push(`write adapter must have accessTier: auth_write (got: '${meta.accessTier}')`);
  }

  // Load + invoke adapter in sandbox.
  const sandbox = {
    bb: makeMockBb(adapter.adapter),
    setTimeout, clearTimeout, setInterval, clearInterval, Promise,
    URL, JSON, Date, Math, Object, Array, String, Number, Boolean,
    Error, TypeError, console,
    module: { exports: {} },
  };
  sandbox.exports = sandbox.module.exports;
  try {
    // Append module.exports = { fnName } to surface the named function.
    const fnName = adapter.adapter === 'auth' ? 'auth'
      : adapter.adapter === 'post-detail' ? 'postDetail'
      : adapter.adapter === 'comment-post' ? 'commentPost'
      : adapter.adapter === 'user-notes' ? 'userNotes'
      : adapter.adapter === 'post-create' ? 'postCreate'
      : adapter.adapter === 'post-delete' ? 'postDelete'
      : adapter.adapter === 'comment-delete' ? 'commentDelete'
      : adapter.adapter.replace(/-./g, (m) => m[1].toUpperCase());
    const wrappedSrc = `${src}\n;module.exports = { ${fnName} };`;
    const script = new vm.Script(wrappedSrc, { filename: adapter.path });
    const module = script.runInNewContext(sandbox);
    const fn = module[fnName] || module[adapter.adapter];
    if (typeof fn !== 'function') {
      issues.push(`exported function '${fnName}' not found (or not a function)`);
      return { adapter, ok: false, issues, meta };
    }
    const args = defaultArgsFor(adapter.adapter);

    // Invoke async; allow up to 5s.
    let result;
    const invokePromise = Promise.resolve(fn(args));
    const timeoutPromise = new Promise((_, rej) => setTimeout(() => rej(new Error('adapter timeout 5s')), 5000));
    try {
      result = await Promise.race([invokePromise, timeoutPromise]);
    } catch (e) {
      issues.push(`adapter invocation error: ${e.message}`);
      return { adapter, ok: false, issues, meta };
    }

    if (!result || typeof result !== 'object') {
      issues.push(`adapter did not return an envelope object (got ${typeof result})`);
      return { adapter, ok: false, issues, meta };
    }

    // Envelope shape check.
    const shape = checkEnvelope(result, adapter.adapter);
    if (!shape.ok) issues.push(...shape.issues);

    return { adapter, ok: issues.length === 0, issues, meta, okReturns: 1, errReturns: 0, writeReceipt: WRITE_ADAPTERS.has(adapter.adapter) ? 1 : 0, returned: { ok: result.ok, authStatus: result.authStatus, hasData: result.data !== undefined } };
  } catch (e) {
    issues.push(`sandbox load error: ${e.message}`);
    return { adapter, ok: false, issues, meta };
  }
}

function checkEnvelope(env, adapterName) {
  const issues = [];
  if (env.ok !== true && env.ok !== false) issues.push('envelope missing/invalid `ok` field');
  if (!['anonymous', 'auth_read', 'auth_write'].includes(env.authStatus)) issues.push('envelope missing/invalid `authStatus`');
  if (env.ok === true) {
    if (!Array.isArray(env.recommendedNextActions)) issues.push('success envelope missing `recommendedNextActions` array');
    if (LIST_ADAPTERS.has(adapterName)) {
      if (!env.pagination) issues.push('list adapter missing `pagination`');
      if (!env.constraints) issues.push('list adapter missing `constraints`');
    }
    if (WRITE_ADAPTERS.has(adapterName)) {
      if (!env.data || typeof env.data !== 'object') issues.push('write envelope missing `data` object');
      else {
        if (!env.data.action) issues.push('write data missing `action`');
        if (!env.data.targetId && env.data.targetId !== '') issues.push('write data missing `targetId`');
        if (typeof env.data.undoable !== 'boolean') issues.push('write data missing `undoable` boolean');
      }
    }
    if (!env.data) issues.push('success envelope missing `data`');
  }
  if (env.ok === false) {
    if (!ERROR_CODES.includes(env.error) && env.error !== 'MISSING_ARG') {
      issues.push(`error code '${env.error}' not in contract 10-code enum`);
    }
    if (!env.hint) issues.push('error envelope missing `hint`');
    if (!env.action) issues.push('error envelope missing `action`');
    if (env.error && ERROR_TO_ACTION[env.error] && env.action && env.action !== ERROR_TO_ACTION[env.error]) {
      issues.push(`error '${env.error}' action='${env.action}' but contract requires '${ERROR_TO_ACTION[env.error]}'`);
    }
  }
  return { ok: issues.length === 0, issues };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
(async () => {
  let adapters = findAdapters();
  if (onlyAdapter) adapters = adapters.filter((a) => `${a.site}/${a.adapter}` === onlyAdapter);
  if (domainFilter && !onlyAdapter) {
    // Pre-filter by parsing @meta for performance.
    adapters = adapters.filter((a) => {
      try {
        const src = fs.readFileSync(a.path, 'utf8');
        const m = extractMeta(src);
        return m && m.domain === domainFilter;
      } catch (_) { return false; }
    });
  }
  const results = [];
  for (const a of adapters) {
    try { results.push(await verifyAdapter(a)); }
    catch (e) { results.push({ adapter: a, ok: false, issues: [`unexpected error: ${e.message}`] }); }
  }
  const passing = results.filter((r) => r.ok && !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;
  const failing = results.filter((r) => !r.ok).length;
  const evaluated = results.length - skipped;

  if (jsonMode) {
    console.log(JSON.stringify({ total: results.length, evaluated, passing, failing, skipped, results }, null, 2));
  } else {
    console.log(`verify-adapter-runtime-shape: ${results.length} adapters, ${skipped} skipped, ${passing} pass, ${failing} fail\n`);
    for (const r of results) {
      if (r.skipped) {
        console.log(`  \x1b[90m○\x1b[0m ${r.adapter.site}/${r.adapter.adapter}  [skipped: ${r.skipReason || 'domain mismatch'}]`);
        continue;
      }
      const tag = r.ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
      const m = r.meta ? `[${r.meta.domain}|${r.meta.accessTier}|${r.meta.intent}|ro=${r.meta.readOnly}]` : '';
      const ret = r.returned ? `{ok=${r.returned.ok},authStatus=${r.returned.authStatus},hasData=${r.returned.hasData}}` : '';
      console.log(`  ${tag} ${r.adapter.site}/${r.adapter.adapter} ${m} ${ret}`);
      for (const issue of r.issues) console.log(`      \x1b[31m- ${issue}\x1b[0m`);
    }
    console.log('');
    console.log(failing === 0 ? '\x1b[32mALL EVALUATED ADAPTERS PASS\x1b[0m' : `\x1b[31m${failing} ADAPTER(S) FAIL\x1b[0m`);
  }

  process.exit(failing === 0 ? 0 : 1);
})();
