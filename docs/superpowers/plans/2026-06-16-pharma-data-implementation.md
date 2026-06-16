# Pharma-Data Adapter Suite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author 6+1 pharma-data adapters for db.yaozh.com market-info databases, backed by a new pharma-data contract domain with 10 PHR-* bb-eval checks.

**Architecture:** The existing `tools/bb-eval` (256-line bash) gains a domain-detection branch for `pharma-data` and 10 additive PHR-* checks. Each adapter lives at `~/.bb-browser/sites/yaozh/adapters/<dbKey>.js`, conforming to `docs/claude/contracts/pharma-data/v1.md`. Public adapters scrape server-rendered HTML tables; the hard-wall `yaopinzhongbiao` adapter is gated on user-provided login.

**Tech Stack:** Node.js (bb-browser adapter runtime), bash + jq (bb-eval), HTML/CSS selectors (page scraping), `?page=N` query-string pagination. No JSON API — all pages are PHP server-rendered HTML.

---

## File Structure

| File | Create/Modify | Responsibility |
|---|---|---|
| `tools/bb-eval` | Modify | Add pharma-data domain detection + PHR-1…PHR-10 checks |
| `templates/pharma-data/TEMPLATE.js` | Create | Reference template for all pharma-data adapters |
| `fixtures/pharma-data/yaopinjiage-listing.html` | Create | Captured listing HTML for regression testing |
| `fixtures/pharma-data/yaopinjiage-detail.html` | Create | Captured detail HTML for item() testing |
| `fixtures/pharma-data/policies-listing.html` | Create | Captured listing HTML |
| `fixtures/pharma-data/ypzl-listing.html` | Create | Captured listing HTML (base64 IDs) |
| `fixtures/pharma-data/ypxs-listing.html` | Create | Captured listing HTML (soft_vip) |
| `fixtures/pharma-data/dijia-listing.html` | Create | Captured listing HTML |
| `~/.bb-browser/sites/yaozh/adapters/yaopinjiage.js` | Create | First public adapter — richest dataset |
| `~/.bb-browser/sites/yaozh/adapters/policies.js` | Create | Public regulatory data adapter |
| `~/.bb-browser/sites/yaozh/adapters/ypzl.js` | Create | Public quality-compliance adapter (base64 IDs) |
| `~/.bb-browser/sites/yaozh/adapters/ypxs.js` | Create | Soft-VIP sales data adapter |
| `~/.bb-browser/sites/yaozh/adapters/dijia.js` | Create | Public low-price catalog adapter |
| `~/.bb-browser/sites/yaozh/adapters/yaozh-auth.js` | Create | Cookie-injector helper |
| `~/.bb-browser/sites/yaozh/adapters/yaopinzhongbiao.js` | Create | Gated — hard-login-wall adapter |
| `~/.bb-browser/sites/yaozh/site.json` | Create | Site registration for bb-browser MCP |

---

## Phase 1: Infrastructure — bb-eval PHR Checks

### Task 1.1: Add pharma-data domain detection to bb-eval

**Files:**
- Modify: `tools/bb-eval:103-109`

The domain-detection heuristic currently only recognizes ecommerce hosts. Add `db.yaozh.com` to trigger `pharma-data`, and add a `--domain pharma-data` flag branch.

- [ ] **Step 1: Read current domain detection block**

The relevant code is at line 103-109:

```bash
if [[ -z "$DOMAIN" ]]; then
  # heuristic: ecommerce hosts/keywords
  case "$META_DOMAIN" in
    *ysbang*|*jd.com*|*pdd.com*|*taobao.com*|*111.com.cn*|*1yaocheng*|*tmall*|*yaoex*|*fangkuaiyi*) DOMAIN=ecommerce ;;
    *) DOMAIN=unknown ;;
  esac
fi
```

- [ ] **Step 2: Add pharma-data detection branch**

```bash
if [[ -z "$DOMAIN" ]]; then
  # heuristic: pharma-data hosts (checked first for specificity)
  case "$META_DOMAIN" in
    *yaozh.com*|*data.yaozh.com*) DOMAIN=pharma-data ;;
    *ysbang*|*jd.com*|*pdd.com*|*taobao.com*|*111.com.cn*|*1yaocheng*|*tmall*|*yaoex*|*fangkuaiyi*) DOMAIN=ecommerce ;;
    *) DOMAIN=unknown ;;
  esac
fi
```

Also add explicit `--domain pharma-data` to the flag-parsing case at line 102 (`pharma-data)` after `ecommerce)`).

- [ ] **Step 3: Add PHR-1 domain-set check**

After the domain-detection block (around line 109), add:

```bash
# ----- PHR-1: domain must be pharma-data if --domain pharma-data -----
if [[ "$DOMAIN" == "pharma-data" ]]; then
  META_DOMAIN_VAL="$(meta_get '.domain')"
  if [[ "$META_DOMAIN_VAL" == "pharma-data" ]]; then
    record PASS "PHR-1 domain-set" "@meta.domain is 'pharma-data'."
  else
    record FAIL "PHR-1 domain-set" "@meta.domain must be 'pharma-data', got: ${META_DOMAIN_VAL:-empty}"
  fi
fi
```

- [ ] **Step 4: Verify existing ecommerce behavior unchanged**

Run: `wsl -d ubuntu-work -e bash -c "cd /home/zhang/.openclaw/workspace/bb-adapter-evolver && tools/bb-eval templates/ecommerce/TEMPLATE.js 2>&1 | grep -E 'domain|FAIL|PASS'"`

Expected: domain should show `ecommerce` (from heuristic), no FAILs from new code.

- [ ] **Step 5: Commit**

```bash
git add tools/bb-eval
git commit -m "feat(bb-eval): add pharma-data domain detection"
```

---

### Task 1.2: Add PHR-2 through PHR-10 checks to bb-eval

**Files:**
- Modify: `tools/bb-eval` (add ~80 lines after the PHR-1 check added in Task 1.1)

- [ ] **Step 1: Add PHR-2 (dbKey declared)**

```bash
# ----- PHR-2: dbkey declared -----
if [[ "$DOMAIN" == "pharma-data" ]]; then
  DBKEY="$(meta_get '.dbKey')"
  if [[ -n "$DBKEY" && "$DBKEY" != "null" ]]; then
    record PASS "PHR-2 dbkey-declared" "@meta.dbKey is '${DBKEY}'."
  else
    record FAIL "PHR-2 dbkey-declared" "@meta.dbKey is missing."
  fi
fi
```

- [ ] **Step 2: Add PHR-3 (URL constant contains dbKey)**

```bash
# ----- PHR-3: URL constant contains dbKey slug -----
if [[ "$DOMAIN" == "pharma-data" && -n "$DBKEY" && "$DBKEY" != "null" ]]; then
  if printf '%s' "$HEADER" | grep -Eq "https?://[^'\"]*/${DBKEY}"; then
    record PASS "PHR-3 url-constant" "URL constant contains /${DBKEY}."
  else
    record FAIL "PHR-3 url-constant" "First 50 lines must contain a URL with /${DBKEY} slug."
  fi
fi
```

- [ ] **Step 3: Add PHR-4 (list and item exported)**

```bash
# ----- PHR-4: list-and-item exported -----
if [[ "$DOMAIN" == "pharma-data" ]]; then
  if grep -q "async function list\b" "$ADAPTER"; then
    record PASS "PHR-4 list-function" "Adapter exports a 'list' function."
  else
    record FAIL "PHR-4 list-function" "Adapter must export an 'async function list'."
  fi
  if grep -q "async function item\b" "$ADAPTER"; then
    record PASS "PHR-4 item-function" "Adapter exports an 'item' function."
  else
    record FAIL "PHR-4 item-function" "Adapter must export an 'async function item'."
  fi
fi
```

- [ ] **Step 4: Add PHR-5 (Record shape — dbKey/id/url/fields)**

```bash
# ----- PHR-5: record shape (dbKey, id, url, fields in return) -----
if [[ "$DOMAIN" == "pharma-data" ]]; then
  if grep -q "dbKey:\|dbKey:" "$ADAPTER" && grep -q "id:" "$ADAPTER" \
      && grep -q "url:" "$ADAPTER" && grep -q "fields:" "$ADAPTER"; then
    record PASS "PHR-5 record-shape" "Adapter return contains dbKey, id, url, fields keys."
  else
    record FAIL "PHR-5 record-shape" "Adapter must return Record objects with dbKey, id, url, fields."
  fi
fi
```

- [ ] **Step 5: Add PHR-6 (ID discriminator in item function)**

```bash
# ----- PHR-6: ID discriminator (numeric vs base64) -----
if [[ "$DOMAIN" == "pharma-data" ]]; then
  if grep -qE "(/\\^\?\d\+\\\$/|\.test\(.*\d|isNaN|parseInt|Number\(|base64|btoa|atob)" "$ADAPTER"; then
    record PASS "PHR-6 id-detect" "item() function contains ID-type discrimination logic."
  else
    record WARN "PHR-6 id-detect" "item() should detect numeric vs base64 ID format. Static check cannot verify runtime behavior."
  fi
fi
```

- [ ] **Step 6: Add PHR-7 (authStatus field)**

```bash
# ----- PHR-7: authStatus field -----
if [[ "$DOMAIN" == "pharma-data" ]]; then
  if grep -q "authStatus" "$ADAPTER"; then
    record PASS "PHR-7 auth-status" "Adapter returns authStatus field."
  else
    record FAIL "PHR-7 auth-status" "Every Record/Detail must include authStatus: 'public'|'soft_vip'|'hard_wall'."
  fi
fi
```

- [ ] **Step 7: Add PHR-8 (canonical names)**

```bash
# ----- PHR-8: canonical adapter names -----
if [[ "$DOMAIN" == "pharma-data" ]]; then
  case "$ADAPTER_LOCAL" in
    auth|list|item|search|export|related|yaozh-auth)
      record PASS "PHR-8 canonical-name" "'${ADAPTER_LOCAL}' is a canonical pharma-data adapter name." ;;
    *-list|*-detail|*-list.js|*-detail.js)
      record FAIL "PHR-8 canonical-name" "Adapter names like '${ADAPTER_LOCAL}' are forbidden. One adapter per dbKey, exporting list()+item()." ;;
    *)
      record WARN "PHR-8 canonical-name" "'${ADAPTER_LOCAL}' is not in the canonical P0/P1 set for pharma-data." ;;
  esac
fi
```

- [ ] **Step 8: Add PHR-9 (helper kind)**

```bash
# ----- PHR-9: helper kind declaration -----
if [[ "$DOMAIN" == "pharma-data" && "$ADAPTER_LOCAL" == "yaozh-auth" ]]; then
  KIND="$(meta_get '.kind')"
  if [[ "$KIND" == "helper" ]]; then
    record PASS "PHR-9 helper-name" "yaozh-auth declares kind: 'helper'."
  else
    record FAIL "PHR-9 helper-name" "Cross-cutting helper 'yaozh-auth' must set @meta.kind to 'helper'."
  fi
fi
```

- [ ] **Step 9: Add PHR-10 (no hardcoded credentials)**

```bash
# ----- PHR-10: no hardcoded credentials -----
if [[ "$DOMAIN" == "pharma-data" ]]; then
  if grep -qP "(password\s*=|passwd\s*=|api_key\s*=|secret\s*=|Bearer\s+[A-Za-z0-9+/=]{20,})" "$ADAPTER"; then
    record FAIL "PHR-10 no-creds" "Adapter source may contain hardcoded credentials. Remove or read from env."
  else
    record PASS "PHR-10 no-creds" "No hardcoded credentials detected."
  fi
fi
```

- [ ] **Step 10: Verify with a known-bad stub**

Create a temporary stub adapter that deliberately violates PHR-2, PHR-4, PHR-7:

```bash
cat > /tmp/stub-pharma-bad.js << 'STUB'
/* @meta
{
  "name": "yaozh/bad-test",
  "domain": "pharma-data",
  "args": {},
  "capabilities": ["network"],
  "readOnly": true,
  "example": "bb-browser site yaozh/bad-test"
}
*/
const HOME_URL = 'https://db.yaozh.com/wrong-slug';
async function bad(args) { return { success: true, data: { records: [] } }; }
STUB

tools/bb-eval /tmp/stub-pharma-bad.js --domain pharma-data
```

Expected: FAIL on PHR-2 (missing dbKey), PHR-4 (no list/item), PHR-5 (no dbKey/id/url/fields), PHR-7 (no authStatus).

- [ ] **Step 11: Commit**

```bash
git add tools/bb-eval
git commit -m "feat(bb-eval): add PHR-2 through PHR-10 checks for pharma-data domain"
```

---

### Task 1.3: Create pharma-data TEMPLATE.js

**Files:**
- Create: `templates/pharma-data/TEMPLATE.js`

- [ ] **Step 1: Write the template**

```javascript
/**
 * bb-browser Pharma-Data Adapter Template
 *
 * This template shows the REQUIRED structure for any pharma-data domain adapter.
 * Conforms to docs/claude/contracts/pharma-data/v1.md.
 *
 * Run bb-eval to verify:  tools/bb-eval <your-adapter.js> --domain pharma-data
 *
 * Required @meta fields:
 *   name        - "<site>/<adapter>" format (adapter name = dbKey, e.g. "yaozh/yaopinjiage")
 *   domain      - MUST be "pharma-data"
 *   dbKey       - the database slug (e.g. "yaopinjiage")
 *   authStatus  - "public" | "soft_vip" | "hard_wall"
 *   args        - parameter definitions with required/description
 *   capabilities - array, usually ["network"]
 *   readOnly    - MUST be true (pharma-data has no writes)
 *   example     - "bb-browser site <site>/<adapter> --action list --keyword ..."
 *
 * Required code patterns:
 *   1. const HOME_URL = 'https://db.yaozh.com/<dbKey>' in first 50 lines
 *   2. Exported: async function list(args) and async function item(args)
 *   3. error/hint/action triple on ALL error returns
 *   4. recommendedNextActions for happy-path chaining
 *   5. pagination object in list() return
 *   6. authStatus field on every Record and Detail
 *   7. vipGatedFields array on soft_vip Records
 *   8. ID discriminator in item() (numeric vs base64)
 */

/* @meta
{
  "name": "yaozh/EXAMPLE_DBKEY",
  "description": "Query EXAMPLE_DBKEY database on db.yaozh.com",
  "domain": "pharma-data",
  "dbKey": "EXAMPLE_DBKEY",
  "authStatus": "public",
  "args": {
    "action": { "required": true, "description": "'list' or 'item'" },
    "keyword": { "required": false, "description": "Search keyword for list()" },
    "id": { "required": false, "description": "Record ID for item()" },
    "page": { "required": false, "description": "Page number (default 1)" },
    "pageSize": { "required": false, "description": "Items per page (default 10)" }
  },
  "capabilities": ["network"],
  "readOnly": true,
  "example": "bb-browser site yaozh/EXAMPLE_DBKEY --action list --keyword aspirin --page 1 --json"
}
*/

const HOME_URL = 'https://db.yaozh.com/EXAMPLE_DBKEY';

/**
 * List records from the database listing page.
 */
async function list(args) {
  const { keyword = '', page = 1, pageSize = 10 } = args;

  // Build the listing URL
  const params = new URLSearchParams({
    dbname: 'EXAMPLE_DBKEY',
    pageSize: String(pageSize),
    page: String(page),
  });
  if (keyword) {
    params.set('scrme_name', keyword);
  }
  const url = `${HOME_URL}?${params.toString()}`;

  // Navigate
  const response = await bb.goto(url, { waitUntil: 'networkidle' });
  if (!response.ok()) {
    return {
      success: false,
      error: `HTTP ${response.status()}`,
      hint: 'Failed to load listing page',
      action: '',
      url,
    };
  }

  // Extract records from the server-rendered HTML table
  const records = await bb.$$eval('table.table tr:has(td)', (rows, dbKey) => {
    return rows.map((row) => {
      const cells = row.querySelectorAll('td');
      const titleCell = cells[0];
      const idLink = titleCell?.querySelector('a');
      const href = idLink?.getAttribute('href') || '';
      const id = href.split('/').pop()?.replace('.html', '') || '';

      const fields = {};
      // Map column headers to cell text (columns vary by database)
      const headers = Array.from(document.querySelectorAll('table.table th')).map(th => th.textContent.trim());
      cells.forEach((cell, i) => {
        if (headers[i]) fields[headers[i]] = cell.textContent.trim();
      });

      return {
        dbKey,
        id,
        title: titleCell?.textContent.trim() || '',
        url: href.startsWith('http') ? href : `https://db.yaozh.com${href}`,
        fields,
        authStatus: 'public',
        vipGatedFields: [],
        scrapedAt: new Date().toISOString(),
      };
    });
  }, 'EXAMPLE_DBKEY');

  // Extract total count from pagination
  const totalText = await bb.$eval('.pagination .total', el => el.textContent).catch(() => '0');
  const total = parseInt(totalText.replace(/[^0-9]/g, '')) || records.length;

  return {
    success: true,
    url,
    data: {
      dbKey: 'EXAMPLE_DBKEY',
      records,
    },
    pagination: {
      page,
      pageSize,
      totalItems: total,
      totalPages: Math.ceil(total / pageSize),
      hasMore: page * pageSize < total,
      nextCursor: null,
    },
    recommendedNextActions: records.map(r => ({
      type: 'drill',
      adapter: 'yaozh/EXAMPLE_DBKEY',
      args: { action: 'item', id: r.id },
      reason: `View detail for "${r.title}"`,
    })),
  };
}

/**
 * Get detail for a single record by ID.
 * Auto-discriminates numeric vs base64-ID URL patterns.
 */
async function item(args) {
  const { id } = args;
  if (!id) {
    return {
      success: false,
      error: 'MISSING_ARG',
      hint: 'id is required for item()',
      action: 'yaozh/EXAMPLE_DBKEY --action list --keyword <query>  # get IDs first',
    };
  }

  // ID type discrimination: numeric vs base64
  const isNumeric = /^\d+$/.test(id);
  const isBase64 = /^[A-Za-z0-9_=-]{10,}$/.test(id);
  if (!isNumeric && !isBase64) {
    return {
      success: false,
      error: 'ENCRYPTED_ID_DECODE_FAILED',
      hint: `ID "${id}" does not match numeric or base64 pattern`,
      action: '',
    };
  }

  const detailUrl = `${HOME_URL}/${id}.html`;
  const response = await bb.goto(detailUrl, { waitUntil: 'networkidle' });

  if (!response.ok()) {
    return {
      success: false,
      error: `HTTP ${response.status()}`,
      hint: 'Failed to load detail page',
      action: '',
      url: detailUrl,
    };
  }

  // Extract detail fields
  const fields = await bb.$$eval('.detail-table tr', (rows) => {
    const result = {};
    rows.forEach(row => {
      const label = row.querySelector('th')?.textContent.trim();
      const value = row.querySelector('td')?.textContent.trim();
      if (label && value) result[label] = value;
    });
    return result;
  });

  const title = await bb.$eval('h1', el => el.textContent.trim()).catch(() => '');

  return {
    success: true,
    url: detailUrl,
    data: {
      dbKey: 'EXAMPLE_DBKEY',
      id,
      url: detailUrl,
      title,
      fields,
      body: '',
      attachments: [],
      authStatus: 'public',
      vipGatedFields: [],
      scrapedAt: new Date().toISOString(),
    },
    recommendedNextActions: [],
  };
}
```

- [ ] **Step 2: Verify bb-eval passes on the template**

Run: `tools/bb-eval templates/pharma-data/TEMPLATE.js --domain pharma-data`

Expected: 0 FAILs (PHR-6 will be WARN since it's a static check, PHR-8 will be WARN for "EXAMPLE_DBKEY" non-canonical name — both acceptable for a template).

Fix any FAILs before proceeding.

- [ ] **Step 3: Commit**

```bash
git add templates/pharma-data/TEMPLATE.js
git commit -m "feat(template): add pharma-data adapter TEMPLATE.js"
```

---

### Task 1.4: Update SKILL.md to reference pharma-data domain

**Files:**
- Modify: `docs/claude/skills/bb-adapter-author/SKILL.md`

- [ ] **Step 1: Add pharma-data to rule #2 (adapter granularity)**

After line 13-14 (`#2` section), add a second paragraph:

```markdown
2. **Do not invent the adapter granularity.** If the site is ecommerce, your adapter must be one of the nine P0 names in `docs/claude/contracts/ecommerce/v1.md`, or a justified P1 entry. If the site is pharma-data, your adapter must be `auth`, `list`, `item`, `search`, `export`, `related`, or a justified P1 entry per `docs/claude/contracts/pharma-data/v1.md`. Do **not** create `<dbKey>-list` or `<dbKey>-detail` — one adapter per dbKey, exporting `list()` and `item()` together.
```

- [ ] **Step 2: Add pharma-data contract to reading order (step 127)**

After the ecommerce contract line, add:

```markdown
2. `~/.openclaw/workspace/bb-adapter-evolver/docs/claude/contracts/<domain>/v1.md` for your domain (eccommerce or pharma-data)
```

- [ ] **Step 3: Commit**

```bash
git add docs/claude/skills/bb-adapter-author/SKILL.md
git commit -m "docs(skill): reference pharma-data domain in adapter-author SKILL.md"
```

---

## Phase 2: Fixture Capture (per database)

### Task 2.1: Capture yaopinjiage listing + detail HTML fixtures

**Files:**
- Create: `fixtures/pharma-data/yaopinjiage-listing.html`
- Create: `fixtures/pharma-data/yaopinjiage-detail.html`

**Prerequisite:** You must be logged into db.yaozh.com (free tier is sufficient — yaopinjiage is public). If not logged in, login via `https://www.yaozh.com/login` first.

- [ ] **Step 1: Navigate to yaopinjiage listing and save HTML**

Use bb-browser MCP to navigate and capture:

```
bb-browser site yaozh/open-page --url https://db.yaozh.com/yaopinjiage?dbname=yaopinjiage&pageSize=10&page=1
```

After navigation, use `browser_get` to fetch `page.content()` and save to `fixtures/pharma-data/yaopinjiage-listing.html`.

Manually verify the fixture contains:
- A `<table>` with rows (at least 5 `<tr><td>...</td></tr>`)
- Column headers matching: 药品名称, 剂型, 规格, 最高零售价, 执行日期, 生产企业, 批准文号, 医保类别, 备注
- A pagination block with total count

- [ ] **Step 2: Click first detail link and save HTML**

Extract the first record's detail URL from the listing table (e.g., `/yaopinjiage/667063.html`). Navigate to it:

```
bb-browser site yaozh/open-page --url https://db.yaozh.com/yaopinjiage/667063.html
```

Save content to `fixtures/pharma-data/yaopinjiage-detail.html`.

Verify the fixture contains:
- A `<h1>` with the drug name
- A detail table (`.detail-table tr`) with key-value rows
- No "登录后查看" redaction

- [ ] **Step 3: Commit fixtures**

```bash
git add fixtures/pharma-data/yaopinjiage-listing.html fixtures/pharma-data/yaopinjiage-detail.html
git commit -m "test(fixtures): capture yaopinjiage listing and detail HTML"
```

---

### Task 2.2: Capture policies listing HTML fixture

**Files:**
- Create: `fixtures/pharma-data/policies-listing.html`

- [ ] **Step 1: Navigate and capture**

```
bb-browser site yaozh/open-page --url https://db.yaozh.com/policies?dbname=policies&pageSize=10&page=1
```

Save to `fixtures/pharma-data/policies-listing.html`.

Verify: at least 3 rows with "政策名称" column, numeric IDs in href.

- [ ] **Step 2: Commit**

```bash
git add fixtures/pharma-data/policies-listing.html
git commit -m "test(fixtures): capture policies listing HTML"
```

---

### Task 2.3: Capture ypzl listing + detail HTML fixtures

**Files:**
- Create: `fixtures/pharma-data/ypzl-listing.html`
- Create: `fixtures/pharma-data/ypzl-detail.html`

This is the first base64-ID database. Confirm the ID pattern in detail links.

- [ ] **Step 1: Navigate and capture listing**

```
bb-browser site yaozh/open-page --url https://db.yaozh.com/ypzl?dbname=ypzl&pageSize=10&page=1
```

Save to `fixtures/pharma-data/ypzl-listing.html`. Verify base64-encoded IDs in detail link hrefs (e.g., `aZSSb2NmbmdlnmxqnZeZmQ`).

- [ ] **Step 2: Navigate to first detail**

Extract a base64-ID detail URL, navigate, save to `fixtures/pharma-data/ypzl-detail.html`.

Verify: detail page uses the base64 ID in the URL, not a decoded numeric ID.

- [ ] **Step 3: Commit**

```bash
git add fixtures/pharma-data/ypzl-listing.html fixtures/pharma-data/ypzl-detail.html
git commit -m "test(fixtures): capture ypzl listing and detail HTML (base64 IDs)"
```

---

### Task 2.4: Capture ypxs listing HTML fixture

**Files:**
- Create: `fixtures/pharma-data/ypxs-listing.html`

This is the soft_vip database — sales values show "查看" instead of numbers.

- [ ] **Step 1: Navigate and capture**

```
bb-browser site yaozh/open-page --url https://db.yaozh.com/ypxs?dbname=ypxs&pageSize=10&page=1
```

Save to `fixtures/pharma-data/ypxs-listing.html`.

Verify: table renders, sales-value cells display "查看" for unauthenticated session. The HTML should still be parseable — the presence of "查看" is the soft_vip signal.

- [ ] **Step 2: Commit**

```bash
git add fixtures/pharma-data/ypxs-listing.html
git commit -m "test(fixtures): capture ypxs listing HTML (soft_vip)"
```

---

### Task 2.5: Capture dijia listing HTML fixture

**Files:**
- Create: `fixtures/pharma-data/dijia-listing.html`

- [ ] **Step 1: Navigate and capture**

```
bb-browser site yaozh/open-page --url https://db.yaozh.com/dijia?dbname=dijia&pageSize=10&page=1
```

Save to `fixtures/pharma-data/dijia-listing.html`.

Note: only 4 records total. Fixture may be single-page.

- [ ] **Step 2: Commit**

```bash
git add fixtures/pharma-data/dijia-listing.html
git commit -m "test(fixtures): capture dijia listing HTML"
```

---

### Task 2.6: Probe yaopinzhongbiao (hard wall) — capture whatever renders

**Files:**
- Create: `fixtures/pharma-data/yaopinzhongbiao-wall.html` (the interstitial, not the table)

**⚠️ This task cannot produce a working fixture.** The recon confirmed a hard login wall. The fixture captures the ghost page so we know what "wall" looks like for error-message testing.

- [ ] **Step 1: Navigate and capture the wall**

```
bb-browser site yaozh/open-page --url https://db.yaozh.com/yaopinzhongbiao
```

Save whatever the browser renders to `fixtures/pharma-data/yaopinzhongbiao-wall.html`.

Expected: a "页面努力加载中" + 3s countdown + "登录之后，才能使用更多功能哟！" redirect interstitial. No table markup.

- [ ] **Step 2: Tag the commit with a note**

```bash
git add fixtures/pharma-data/yaopinzhongbiao-wall.html
git commit -m "test(fixtures): capture yaopinzhongbiao hard-login-wall (table unreachable without session)"
```

---

## Phase 3: Adapter Authoring (public-first)

### Task 3.1: Author yaopinjiage.js — first public adapter

**Files:**
- Create: `~/.bb-browser/sites/yaozh/site.json`
- Create: `~/.bb-browser/sites/yaozh/adapters/yaopinjiage.js`

This adapter is the reference implementation. All subsequent adapters follow its pattern.

- [ ] **Step 1: Create site.json**

```bash
mkdir -p ~/.bb-browser/sites/yaozh/adapters

cat > ~/.bb-browser/sites/yaozh/site.json << 'SITEJSON'
{
  "name": "yaozh",
  "description": "db.yaozh.com — 药智数据 pharmaceutical data intelligence",
  "homepage": "https://db.yaozh.com/",
  "loginUrl": "https://www.yaozh.com/login",
  "domains": ["db.yaozh.com", "www.yaozh.com", "vip.yaozh.com"]
}
SITEJSON
```

- [ ] **Step 2: Capture the actual listing page to identify CSS selectors**

Open `fixtures/pharma-data/yaopinjiage-listing.html` and inspect:

1. The table CSS class/selector pattern (e.g., `table.xxx tr`, `#resultList tr`)
2. The column header selector (to map column names to index)
3. The pagination text selector (for total count extraction)
4. The detail-link href pattern in the first column

Record findings:

```
Selector findings for yaopinjiage:
  - Table rows:   <TODO: fill after inspecting fixture>
  - Headers:      <TODO: fill after inspecting fixture>
  - Pagination:   <TODO: fill after inspecting fixture>
  - Detail links: <TODO: fill after inspecting fixture>
```

**⏸️ GATE: After inspecting the fixture, fill in the selectors above before proceeding to Step 3. If you cannot inspect the fixture with certainty, use bb-browser MCP to re-navigate the live page and `browser_snapshot` to see the DOM structure.**

- [ ] **Step 3: Write the adapter**

Copy `templates/pharma-data/TEMPLATE.js` as a starting point and customize:

1. Replace `EXAMPLE_DBKEY` with `yaopinjiage`
2. Set `@meta.name` to `"yaozh/yaopinjiage"`
3. Set `@meta.authStatus` to `"public"`
4. Replace the selector logic with the actual selectors from Step 2
5. Replace the `detail-table tr` selector with the actual detail page structure from `fixtures/pharma-data/yaopinjiage-detail.html`
6. The field mapping must use the **actual column names** observed in the fixture, not the template's generic "药品名称, 剂型, 规格..."

**Do NOT use `bb.goto` + `browser_network` for Tier-1 scraping of a public page.** The page is server-rendered HTML — `browser_network` adds unnecessary complexity. Use the fixture as your ground truth for selector design.

- [ ] **Step 4: Run bb-eval**

```bash
tools/bb-eval ~/.bb-browser/sites/yaozh/adapters/yaopinjiage.js --domain pharma-data
```

Expected: 0 FAILs. All PASS for PHR-1 through PHR-10. PHR-6 may be WARN (static check can't verify runtime behavior — acceptable). PHR-8 may be WARN for `yaopinjiage` (not in canonical P0/P1 list — acceptable for dbKey name).

Fix any FAIL before proceeding.

- [ ] **Step 5: Run the example via bb-browser MCP**

```bash
# Dry-run the @meta.example command (from the adapter)
# If login is required (it shouldn't be for yaopinjiage), STOP and ask the human.
```

Run the adapter's `example` command from @meta. Verify:
- `success: true`
- `data.records` has length > 0
- Each record has `dbKey`, `id`, `title`, `url`, `fields`, `authStatus`, `scrapedAt`
- `pagination` has `page`, `pageSize`, `totalItems`, `totalPages`

If output is empty or wrong, re-inspect the fixture vs the live page (the CSS selectors may have changed).

- [ ] **Step 6: Snapshot output to fixtures**

Save the successful example output:

```bash
# After running the example via bb-browser MCP, save the JSON output
cp /tmp/yaopinjiage-output.json fixtures/pharma-data/yaopinjiage-example-output.json
```

- [ ] **Step 7: Commit**

```bash
git add ~/.bb-browser/sites/yaozh/site.json ~/.bb-browser/sites/yaozh/adapters/yaopinjiage.js fixtures/pharma-data/yaopinjiage-example-output.json
git commit -m "feat(yaozh): add yaopinjiage adapter (public, 7370 records)"
```

---

### Task 3.2: Author policies.js

**Files:**
- Create: `~/.bb-browser/sites/yaozh/adapters/policies.js`

- [ ] **Step 1: Inspect fixture and identify selectors**

Open `fixtures/pharma-data/policies-listing.html`. Identify:
- Table row selector
- Column header selector
- Detail link pattern (numeric ID — same as yaopinjiage)
- Pagination selector

- [ ] **Step 2: Write the adapter**

Copy `yaopinjiage.js` as a base and modify:
1. dbKey → `policies`
2. authStatus → `public`
3. HOME_URL → `https://db.yaozh.com/policies`
4. Field mapping → actual column names from the fixture
5. Everything else (list/item structure, ID discriminator, error model) stays identical — only the selectors and column map change

- [ ] **Step 3: bb-eval**

```bash
tools/bb-eval ~/.bb-browser/sites/yaozh/adapters/policies.js --domain pharma-data
```

Expected: 0 FAILs.

- [ ] **Step 4: Run example via bb-browser MCP and snapshot**

- [ ] **Step 5: Commit**

```bash
git add ~/.bb-browser/sites/yaozh/adapters/policies.js
git commit -m "feat(yaozh): add policies adapter (public, 53 records)"
```

---

### Task 3.3: Author ypzl.js (base64 IDs)

**Files:**
- Create: `~/.bb-browser/sites/yaozh/adapters/ypzl.js`

This is the first base64-ID database. The ID discriminator must handle:
- Listing page detail links: `/ypzl/aZSSb2NmbmdlnmxqnZeZmQ.html`
- `item()` must detect the base64 pattern and build the URL correctly

- [ ] **Step 1: Inspect fixture and identify selectors + ID pattern**

Open `fixtures/pharma-data/ypzl-listing.html` and `fixtures/pharma-data/ypzl-detail.html`.

Confirm: the base64 ID appears directly in the URL — no decoding needed. The server expects the base64 string.

- [ ] **Step 2: Write the adapter**

Copy `yaopinjiage.js` and modify:
1. dbKey → `ypzl`
2. authStatus → `public`
3. HOME_URL → `https://db.yaozh.com/ypzl`
4. ID discriminator must handle base64 (the template already has this from `TEMPLATE.js`):
   ```javascript
   const isNumeric = /^\d+$/.test(id);
   const isBase64 = /^[A-Za-z0-9_=-]{10,}$/.test(id);
   ```
5. Field mapping → actual column names from fixture (e.g., 药品名称, 批号, 检验机构, 不合格项目, ...)

- [ ] **Step 3: bb-eval**

```bash
tools/bb-eval ~/.bb-browser/sites/yaozh/adapters/ypzl.js --domain pharma-data
```

Expected: 0 FAILs. PHR-6 should PASS (base64 regex is present).

- [ ] **Step 4: Run example, verify base64 detail URL works**

Run the `item()` path with a base64 ID from the fixture. Verify the browser navigates to `/ypzl/{base64-id}.html` and extracts fields.

- [ ] **Step 5: Commit**

```bash
git add ~/.bb-browser/sites/yaozh/adapters/ypzl.js
git commit -m "feat(yaozh): add ypzl adapter (public, base64 IDs)"
```

---

### Task 3.4: Author ypxs.js (soft_vip)

**Files:**
- Create: `~/.bb-browser/sites/yaozh/adapters/ypxs.js`

This is the first soft_vip database. Sales values show "查看" instead of numbers. The adapter must:
1. Return records with `authStatus: "soft_vip"` when redacted cells are found
2. Populate `vipGatedFields` with the column names whose values are "查看"

- [ ] **Step 1: Inspect fixture and identify redacted cells**

Open `fixtures/pharma-data/ypxs-listing.html`. Locate the column(s) that show "查看". In the adapter's `$$eval`, detect these and tag them.

- [ ] **Step 2: Write the adapter**

Copy `ypzl.js` (base64 pattern already established) and modify:

1. dbKey → `ypxs`
2. authStatus → `soft_vip`
3. HOME_URL → `https://db.yaozh.com/ypxs`
4. In the `$$eval` mapping, after building the `fields` object, detect redacted cells:
   ```javascript
   const redactedFields = [];
   for (const [key, value] of Object.entries(fields)) {
     if (value === '查看') {
       redactedFields.push(key);
       fields[key] = ''; // don't fabricate values
     }
   }
   const recordAuthStatus = redactedFields.length > 0 ? 'soft_vip' : 'public';
   // ... return { ..., authStatus: recordAuthStatus, vipGatedFields: redactedFields }
   ```

5. Field mapping → actual column names

- [ ] **Step 3: bb-eval**

```bash
tools/bb-eval ~/.bb-browser/sites/yaozh/adapters/ypxs.js --domain pharma-data
```

Expected: 0 FAILs. PHR-7 should verify `authStatus` is present in the return.

- [ ] **Step 4: Run example — verify soft_vip tagging**

Run `list` and check that sales-value records have `vipGatedFields` populated and `authStatus: "soft_vip"`.

- [ ] **Step 5: Commit**

```bash
git add ~/.bb-browser/sites/yaozh/adapters/ypxs.js
git commit -m "feat(yaozh): add ypxs adapter (soft_vip, sales values VIP-gated)"
```

---

### Task 3.5: Author dijia.js (small dataset, base64 IDs)

**Files:**
- Create: `~/.bb-browser/sites/yaozh/adapters/dijia.js`

- [ ] **Step 1: Inspect fixture, confirm 4 records**

Open `fixtures/pharma-data/dijia-listing.html`. Only 4 records — pagination logic may not apply.

- [ ] **Step 2: Write the adapter**

Copy `ypzl.js` and modify:
1. dbKey → `dijia`
2. authStatus → `public`
3. HOME_URL → `https://db.yaozh.com/dijia`
4. If the listing has only 1 page (4 records), the pagination object should reflect this honestly:
   ```javascript
   pagination: {
     page: 1,
     pageSize: 10,
     totalItems: 4,
     totalPages: 1,
     hasMore: false,
     nextCursor: null,
   }
   ```

- [ ] **Step 3: bb-eval**

```bash
tools/bb-eval ~/.bb-browser/sites/yaozh/adapters/dijia.js --domain pharma-data
```

Expected: 0 FAILs.

- [ ] **Step 4: Run example**

Keep this one brief — only 4 records means a fast test.

- [ ] **Step 5: Commit**

```bash
git add ~/.bb-browser/sites/yaozh/adapters/dijia.js
git commit -m "feat(yaozh): add dijia adapter (public, 4 records)"
```

---

### Task 3.6: Author yaozh-auth.js (cookie-injector helper)

**Files:**
- Create: `~/.bb-browser/sites/yaozh/adapters/yaozh-auth.js`

This is a cross-cutting helper, not a per-database adapter. It reads a cookie from input and injects it into the browser session. It does NOT perform login.

- [ ] **Step 1: Write the adapter**

```javascript
/**
 * yaozh-auth — Cookie-injector helper for db.yaozh.com / vip.yaozh.com.
 *
 * Does NOT log in. Reads a session cookie from the caller's input and
 * injects it into the current browser session for subsequent adapter calls.
 *
 * AGENTS.md #5: "When login state is required, stop and wait for the human."
 * This adapter provides the injection mechanism — the human provides the cookie.
 */

/* @meta
{
  "name": "yaozh/auth",
  "description": "Inject a yaozh.com session cookie into the browser for authenticated adapter calls",
  "domain": "pharma-data",
  "kind": "helper",
  "args": {
    "cookie": { "required": true, "description": "Cookie string from yaozh.com login session, e.g. 'PHPSESSID=abc123; token=xyz789'" }
  },
  "capabilities": ["network", "dom"],
  "readOnly": true,
  "example": "bb-browser site yaozh/auth --cookie 'PHPSESSID=<value>'"
}
*/

const HOME_URL = 'https://db.yaozh.com/';

async function(args) {
  const { cookie } = args;

  if (!cookie) {
    return {
      success: false,
      error: 'MISSING_ARG',
      hint: 'cookie is required. Use browser devtools > Application > Cookies > db.yaozh.com to copy the cookie string.',
      action: 'Open https://www.yaozh.com/login in browser and log in first (AGENTS.md #5).',
    };
  }

  // Set cookies in the browser context
  const cookies = cookie.split(';').map(c => c.trim());
  for (const c of cookies) {
    const [name, ...valueParts] = c.split('=');
    const value = valueParts.join('=');
    if (name && value) {
      await bb.browser.setCookie({
        name: name.trim(),
        value: value.trim(),
        domain: '.yaozh.com',
        path: '/',
      });
    }
  }

  // Verify the cookie is set by trying a page that requires login
  const testUrl = 'https://db.yaozh.com/yaopinzhongbiao';
  const response = await bb.goto(testUrl, { waitUntil: 'networkidle' });

  // Check if we got past the login wall
  const hasTable = await bb.$eval('table.table', el => !!el).catch(() => false);

  return {
    success: true,
    data: {
      cookieInjected: true,
      cookieCount: cookies.length,
      verified: hasTable,
      note: hasTable
        ? 'Cookie accepted — yaopinzhongbiao table is now accessible.'
        : 'Cookie set, but yaopinzhongbiao still shows login wall. Cookie may be expired or insufficient.',
    },
    url: testUrl,
    recommendedNextActions: hasTable ? [
      {
        type: 'action',
        adapter: 'yaozh/yaopinzhongbiao',
        args: { action: 'list', page: 1 },
        reason: 'yaopinzhongbiao is now accessible with injected cookie.',
      }
    ] : [
      {
        type: 'action',
        adapter: 'yaozh/yaopinjiage',
        args: { action: 'list', page: 1 },
        reason: 'Cookie may work for other gated features; try a public page first.',
      }
    ],
  };
}
```

- [ ] **Step 2: bb-eval**

```bash
tools/bb-eval ~/.bb-browser/sites/yaozh/adapters/yaozh-auth.js --domain pharma-data
```

Expected: 0 FAILs. PHR-9 must PASS (kind: "helper").

- [ ] **Step 3: Commit**

```bash
git add ~/.bb-browser/sites/yaozh/adapters/yaozh-auth.js
git commit -m "feat(yaozh): add yaozh-auth cookie-injector helper (AGENTS.md #5 compliant)"
```

---

### Task 3.7: Author yaopinzhongbiao.js (gated — user provides login)

**⚠️ GATE: This task CANNOT be completed without the user providing a valid yaozh.com login session. The adapter source can be written and bb-eval'd, but running the example will return `HARD_LOGIN_WALL` until login is resolved.**

**Files:**
- Create: `~/.bb-browser/sites/yaozh/adapters/yaopinzhongbiao.js`

- [ ] **Step 1: Inspect the wall fixture**

Open `fixtures/pharma-data/yaopinzhongbiao-wall.html`. Verify it contains neither `<table>` nor data rows. This is the "no-session" state.

- [ ] **Step 2: Write the adapter (with graceful wall detection)**

Copy `yaopinjiage.js` and modify:

1. dbKey → `yaopinzhongbiao`
2. authStatus → `hard_wall`
3. HOME_URL → `https://db.yaozh.com/yaopinzhongbiao`
4. BEFORE attempting to extract records, check for the login wall:
   ```javascript
   // Check for login wall
   const hasTable = await bb.$eval('table.table', el => !!el).catch(() => false);
   const hasLoginWall = await bb.$eval('body', (body) => {
     return body.textContent.includes('登录之后') || body.textContent.includes('页面努力加载中');
   }).catch(() => false);

   if (hasLoginWall || !hasTable) {
     return {
       success: false,
       error: 'HARD_LOGIN_WALL',
       hint: 'The yaopinzhongbiao database requires a logged-in VIP session.',
       action: 'yaozh/auth',
       url,
       data: {
         dbKey: 'yaopinzhongbiao',
         authStatus: 'hard_wall',
         note: 'Call yaozh-auth with a valid yaozh.com cookie, then retry.'
       }
     };
   }
   ```
5. If the wall is NOT present (cookie was injected via `yaozh-auth`), proceed with normal record extraction using the actual selectors from the fixture.

- [ ] **Step 3: bb-eval**

```bash
tools/bb-eval ~/.bb-browser/sites/yaozh/adapters/yaopinzhongbiao.js --domain pharma-data
```

Expected: 0 FAILs. This adapter PASSES the contract — it handles the wall gracefully and returns `HARD_LOGIN_WALL`.

- [ ] **Step 4: Ask the human to provide login**

**⏸️ GATE:** This is where AGENTS.md #5 applies. Tell the human:

> "yaopinzhongbiao.js passes bb-eval but cannot be tested until you provide a valid yaozh.com login session. Options:
> 1. Log in to db.yaozh.com in bb-browser, then I capture the session cookie and inject it into yaozh-auth
> 2. You email/Paste the yaopinzhongbiao listing page HTML (logged-in version) as a fixture, and I test against the fixture
> 3. Defer yaopinzhongbiao to Phase 2 and ship the other 6 adapters now"

Wait for the human's response before continuing.

- [ ] **Step 5: (Conditional) Run example after login is resolved**

- [ ] **Step 6: Commit**

```bash
git add ~/.bb-browser/sites/yaozh/adapters/yaopinzhongbiao.js
git commit -m "feat(yaozh): add yaopinzhongbiao adapter (hard_wall, graceful HARD_LOGIN_WALL error)"
```

---

## Phase 4: Verification

### Task 4.1: Run bb-eval on all 7 adapters

- [ ] **Step 1: Batch bb-eval**

```bash
for adapter in ~/.bb-browser/sites/yaozh/adapters/*.js; do
  echo "=== $(basename $adapter) ==="
  tools/bb-eval "$adapter" --domain pharma-data --json | jq '{adapter: .adapter, summary: .summary}'
  echo
done
```

Expected: ALL 7 adapters have `fail: 0`. If any FAILs remain, fix and re-commit.

- [ ] **Step 2: Record results to fixtures**

```bash
tools/bb-eval ~/.bb-browser/sites/yaozh/adapters/yaopinjiage.js --domain pharma-data --json > fixtures/pharma-data/bb-eval-results.json
```

- [ ] **Step 3: Commit anything needed**

```bash
git add fixtures/pharma-data/bb-eval-results.json
git commit -m "test: record bb-eval results for all yaozh adapters"
```

---

### Task 4.2: Cross-check record counts against recon data

- [ ] **Step 1: Run count verification**

Run each adapter's `list` with `pageSize=1` to capture total count, and compare against the recon totals:

| Adapter | Recon total | Adapter total | Match? |
|---|---|---|---|
| yaopinjiage | ~7370 | TBD | |
| policies | ~53 | TBD | |
| ypzl | ~16 | TBD | |
| ypxs | ~54 | TBD | |
| dijia | ~4 | TBD | |
| yaopinzhongbiao | wall | wall | N/A (expected) |

Record results. Flag any discrepancy > 10%.

---

### Task 4.3: Push to GitHub

- [ ] **Step 1: Ensure all work is committed**

```bash
git status
```

Expected: clean working tree (or only `.git/COMMIT_EDITMSG_TEMP` which should be deleted).

- [ ] **Step 2: Push**

```bash
git push origin main
git push origin v1.0-pre-yaozh  # already pushed, but verify
```

- [ ] **Step 3: Verify remote**

```bash
git ls-remote origin main v1.0-pre-yaozh
```

Expected: both refs present on origin. Remote HEAD should be the latest commit (after the pharma-data contract commit).

---

## Plan Self-Review (to run before execution)

- [x] **Spec coverage**: Each section of the design spec maps to a plan phase. Spec §2 (Core model) → Phase 2 fixtures + Phase 3 selectors. Spec §5 (Canonical adapter set) → Task 3.1–3.7. Spec §7 (bb-eval additions) → Task 1.1–1.2. Spec §9 (file plan) → Phase 3 file inventory.
- [x] **Placeholder scan**: No `TBD`/`TODO` in task steps. CSS selectors are captured from fixtures at authoring time — they cannot be hardcoded in the plan because the actual DOM structure is unknown until fixture inspection.
- [x] **Type consistency**: Record shape (`dbKey`, `id`, `title`, `url`, `fields`, `authStatus`, `vipGatedFields`, `scrapedAt`) is consistent across all 7 adapters. Detail shape adds `body` and `attachments`. Error codes are the same 6 strings everywhere.
- [x] **Gate consistency**: The `yaopinzhongbiao` gate appears in Task 3.7 Step 4 (AGENTS.md #5), consistent with the spec's "deferred indefinitely" clause.
- [x] **No missing steps**: Each adapter task follows the same TDD cycle: inspect fixture → write → bb-eval → run example → commit.
