/**
 * MES Power Engineering — Cloudflare Worker API Proxy
 *
 * Secrets to set in Cloudflare Dashboard → Worker → Settings → Variables:
 *   SIMPRO_BASE_URL   = https://mespower.simprocloud.com  (your simPRO URL, no trailing slash)
 *   SIMPRO_API_KEY    = your simPRO API key
 *   GRAPH_TOKEN       = Microsoft Graph access token (see README for how to generate)
 *
 * Endpoints this Worker exposes:
 *   GET /api/quotes    → simPRO quotes (2026 onwards)
 *   GET /api/leads     → simPRO leads (2025 onwards)
 *   GET /api/customers → simPRO customers (id + name lookup)
 *   GET /api/users     → simPRO users (id + name lookup)
 *   GET /api/targets   → monthly targets from SharePoint Excel
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

// ── SharePoint file details ───────────────────────────────────────────────────
const SP_DRIVE_ID = 'b!lqS9e4ABZEG8zi3gJ_wIpiQ6SCO-alRNodHfLjoj1fV1igdVlSgxRJ9wvEbU93fF';
const SP_ITEM_ID  = '01RTE6GZ7VGX2FDM3NABGY3YXTZMFAQQA5';

// ── Monthly targets (hardcoded from SharePoint as fallback) ───────────────────
// Update these if the spreadsheet changes significantly.
// The /api/targets endpoint tries SharePoint first, falls back to these.
const TARGETS_FALLBACK = {
  annual: 6750000,
  monthly: {
    1: 270000, 2: 472500, 3: 607500, 4: 675000,
    5: 742500, 6: 810000, 7: 675000, 8: 472500,
    9: 675000, 10: 675000, 11: 472500, 12: 202500,
  },
  sectors: {
    'EV Hubs': 2000000,
    '33kV Connections': 2000000,
    'BESS': 750000,
    'C&I Connections': 750000,
    'Residential Connections': 250000,
    'BoP (Private Network)': 500000,
    'Small Works': 300000,
    'O&M Contracts': 100000,
    'Faults': 100000,
  }
};

// ── Router ────────────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    try {
      if (url.pathname === '/api/quotes')    return await handleQuotes(env);
      if (url.pathname === '/api/leads')     return await handleLeads(env);
      if (url.pathname === '/api/customers') return await handleCustomers(env);
      if (url.pathname === '/api/users')     return await handleUsers(env);
      if (url.pathname === '/api/targets')   return await handleTargets(env);
      if (url.pathname === '/api/all')       return await handleAll(env);

      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: CORS });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS });
    }
  }
};

// ── simPRO API helper ─────────────────────────────────────────────────────────
async function simproGet(env, path) {
  const res = await fetch(`${env.SIMPRO_BASE_URL}/api/v1.0/companies/0${path}`, {
    headers: {
      'Authorization': `Bearer ${env.SIMPRO_API_KEY}`,
      'Content-Type': 'application/json',
    }
  });
  if (!res.ok) throw new Error(`simPRO ${res.status}: ${path}`);
  return res.json();
}

// Paginate through all pages of a simPRO endpoint
async function simproGetAll(env, path, pageSize = 250) {
  let page = 1, all = [], total = null;
  do {
    const sep = path.includes('?') ? '&' : '?';
    const data = await simproGet(env, `${path}${sep}pageSize=${pageSize}&page=${page}`);
    // simPRO returns array directly; total in X-Total-Results header but we check length
    if (!Array.isArray(data)) break;
    all = all.concat(data);
    if (total === null) total = all.length; // will grow
    if (data.length < pageSize) break;
    page++;
    if (page > 20) break; // safety cap
  } while (true);
  return all;
}

// ── /api/quotes ───────────────────────────────────────────────────────────────
async function handleQuotes(env) {
  // simPRO quotes endpoint — filter from 2026 onwards
  // GET /quotes/?dateFrom=2026-01-01&columns=ID,Name,Stage,Total,DateIssued,DateApproved,DueDate,Customer.ID,Salesperson.ID,IsClosed,Forecast.Percent,Job.ID
  const data = await simproGetAll(env,
    '/quotes/?dateFrom=2026-01-01&columns=ID,Name,Stage,Total,DateIssued,DateApproved,DueDate,Customer.ID,Salesperson.ID,IsClosed,Forecast.Percent,Job.ID'
  );

  const quotes = data.map(q => ({
    id:           q.ID,
    name:         q.Name,
    stage:        q.Stage,
    totalExTax:   q.Total?.ExTax ?? 0,
    dateIssued:   q.DateIssued,
    dateApproved: q.DateApproved,
    dueDate:      q.DueDate,
    customerId:   q.Customer?.ID,
    salespersonId:q.Salesperson?.ID,
    isClosed:     q.IsClosed,
    forecastPct:  q.Forecast?.Percent ?? 0,
    jobId:        q.Job?.ID ?? null,
  }));

  return new Response(JSON.stringify({ quotes }), { headers: CORS });
}

// ── /api/leads ────────────────────────────────────────────────────────────────
async function handleLeads(env) {
  const data = await simproGetAll(env,
    '/leads/?dateFrom=2025-01-01&columns=ID,Name,Stage,Customer.ID,Salesperson.ID,DateCreated,FollowUpDate,CustomFields,Status.ID'
  );

  const leads = data.map(l => ({
    id:           l.ID,
    name:         l.Name,
    stage:        l.Stage,
    customerId:   l.Customer?.ID,
    salespersonId:l.Salesperson?.ID,
    dateCreated:  l.DateCreated,
    followUpDate: l.FollowUpDate,
    statusId:     l.Status?.ID,
    customFields: l.CustomFields ?? [],
  }));

  return new Response(JSON.stringify({ leads }), { headers: CORS });
}

// ── /api/customers ────────────────────────────────────────────────────────────
async function handleCustomers(env) {
  const data = await simproGetAll(env, '/customers/?columns=ID,CompanyName,GivenName,FamilyName');
  const customers = data.map(c => ({
    id:   c.ID,
    name: c.CompanyName || `${c.GivenName ?? ''} ${c.FamilyName ?? ''}`.trim(),
  }));
  return new Response(JSON.stringify({ customers }), { headers: CORS });
}

// ── /api/users ────────────────────────────────────────────────────────────────
async function handleUsers(env) {
  const data = await simproGetAll(env, '/employees/?columns=ID,Name,IsSalesperson');
  const users = data.map(u => ({
    id:           u.ID,
    name:         u.Name,
    isSalesperson:u.IsSalesperson ?? false,
  }));
  return new Response(JSON.stringify({ users }), { headers: CORS });
}

// ── /api/targets ──────────────────────────────────────────────────────────────
async function handleTargets(env) {
  // Try to read live from SharePoint Excel via Microsoft Graph
  if (env.GRAPH_TOKEN) {
    try {
      const res = await fetch(
        `https://graph.microsoft.com/v1.0/drives/${SP_DRIVE_ID}/items/${SP_ITEM_ID}/workbook/worksheets/Sheet1/usedRange`,
        { headers: { 'Authorization': `Bearer ${env.GRAPH_TOKEN}` } }
      );
      if (res.ok) {
        const wb = await res.json();
        const targets = parseTargetsFromSheet(wb.values);
        return new Response(JSON.stringify(targets), { headers: CORS });
      }
    } catch (e) {
      console.log('SharePoint read failed, using fallback:', e.message);
    }
  }
  // Fallback to hardcoded values
  return new Response(JSON.stringify(TARGETS_FALLBACK), { headers: CORS });
}

// Parse the targets Excel sheet (values is a 2D array of cell values)
function parseTargetsFromSheet(values) {
  // The sheet layout from our read:
  // Row 0: headers — Company, Annual Target, Jan-26, Feb-26, ...
  // Row 1: MES, 6750000, 270000, 472500, ...
  // We find the MES row and extract monthly values
  const months = {};
  const sectors = {};
  let annual = TARGETS_FALLBACK.annual;

  if (!values || !values.length) return TARGETS_FALLBACK;

  // Find header row (contains "Annual Target")
  let headerRow = -1, dataRow = -1;
  for (let i = 0; i < values.length; i++) {
    const row = values[i].map(c => String(c ?? '').toLowerCase());
    if (row.some(c => c.includes('annual target'))) { headerRow = i; }
    if (headerRow > -1 && values[i][0]?.toString().toLowerCase() === 'mes') { dataRow = i; break; }
  }

  if (headerRow > -1 && dataRow > -1) {
    const headers = values[headerRow];
    const data    = values[dataRow];
    annual = parseNum(data[1]);

    // Month columns: Jan-26 = month 1, Feb-26 = month 2, etc.
    const monthNames = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    headers.forEach((h, i) => {
      const hStr = String(h ?? '').toLowerCase();
      const mIdx = monthNames.findIndex(m => hStr.startsWith(m));
      if (mIdx > -1) months[mIdx + 1] = parseNum(data[i]);
    });
  }

  // Find market sector rows (they appear after the MES monthly block)
  // Look for rows where col 0 matches known sector names
  const knownSectors = ['EV Hubs','33kV Connections','BESS','C&I Connections',
    'Residential Connections','BoP (Private Network)','Small Works','O&M Contracts','Faults'];
  values.forEach(row => {
    const name = String(row[0] ?? '').trim();
    if (knownSectors.includes(name)) {
      sectors[name] = parseNum(row[1]);
    }
  });

  return {
    annual:  annual || TARGETS_FALLBACK.annual,
    monthly: Object.keys(months).length >= 12 ? months : TARGETS_FALLBACK.monthly,
    sectors: Object.keys(sectors).length > 0  ? sectors : TARGETS_FALLBACK.sectors,
  };
}

function parseNum(v) {
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v ?? '').replace(/[£,\s]/g, ''));
  return isNaN(n) ? 0 : n;
}

// ── /api/all — fetch everything in parallel ───────────────────────────────────
async function handleAll(env) {
  const [quotes, leads, customers, users, targets] = await Promise.all([
    handleQuotes(env).then(r => r.json()),
    handleLeads(env).then(r => r.json()),
    handleCustomers(env).then(r => r.json()),
    handleUsers(env).then(r => r.json()),
    handleTargets(env).then(r => r.json()),
  ]);
  return new Response(
    JSON.stringify({ ...quotes, ...leads, ...customers, ...users, targets }),
    { headers: CORS }
  );
}
