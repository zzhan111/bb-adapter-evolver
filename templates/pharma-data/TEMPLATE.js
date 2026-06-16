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

  if (!keyword && keyword !== '') {
    return {
      success: false,
      error: 'MISSING_ARG',
      hint: 'keyword is required (even if empty string for unfiltered list)',
      action: ''
    };
  }

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
  // NOTE: Replace '.table-class' and '.col-selector' with actual selectors from fixture inspection.
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
  // NOTE: Replace '.detail-table' with actual selector from fixture inspection.
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

  // Detect soft_vip redaction
  const redactedFields = [];
  for (const [key, value] of Object.entries(fields)) {
    if (value === '查看') {
      redactedFields.push(key);
      fields[key] = '';
    }
  }
  const recordAuthStatus = redactedFields.length > 0 ? 'soft_vip' : 'public';

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
      authStatus: recordAuthStatus,
      vipGatedFields: redactedFields,
      scrapedAt: new Date().toISOString(),
    },
    recommendedNextActions: [],
  };
}
