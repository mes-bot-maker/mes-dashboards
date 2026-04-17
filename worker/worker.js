const CORS = { headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } };
const TARGETS_FALLBACK = {
  annual: 6750000,
  monthly: { 1: 270000, 2: 472500, 3: 607500, 4: 675000, 5: 742500, 6: 810000, 7: 675000, 8: 472500, 9: 675000, 10: 675000, 11: 472500, 12: 202500 },
  sectors: { 'EV Hubs': 2000000, '33kV Connections': 2000000, 'BESS': 750000, 'C&I Connections': 750000, 'Residential Connections': 250000, 'BoP (Private Network)': 500000, 'Small Works': 300000, 'O&M Contracts': 100000, 'Faults': 100000 }
};

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
      if (url.pathname === '/api/quotes')    return await handleQuotes(env);
      if (url.pathname === '/api/leads')     return await handleLeads(env);
      if (url.pathname === '/api/customers') return await handleCustomers(env);
      if (url.pathname === '/api/users')     return await handleUsers(env);
      if (url.pathname === '/api/targets')   return await handleTargets(env);
      if (url.pathname === '/api/all')       return await handleAll(env);
      return json({ error: 'Not found' }, 404);
    } catch (e) { return json({ error: e.message }, 500); }
  }
};

async function simproGet(env, path) {
  const res = await fetch(env.SIMPRO_BASE_URL + '/api/v1.0/companies/2' + path, {
    headers: { 'Authorization': 'Bearer ' + env.SIMPRO_API_KEY, 'Content-Type': 'application/json' }
  });
  if (!res.ok) { const b = await res.text().catch(() => ''); throw new Error('simPRO ' + res.status + ': ' + path + ' ' + b.slice(0, 300)); }
  return res.json();
}

async function getGraphToken(env) {
  const p = new URLSearchParams({ grant_type: 'client_credentials', client_id: env.AZURE_CLIENT_ID, client_secret: env.AZURE_CLIENT_SECRET, scope: 'https://graph.microsoft.com/.default' });
  const r = await fetch('https://login.microsoftonline.com/' + env.AZURE_TENANT_ID + '/oauth2/v2.0/token', { method: 'POST', body: p });
  if (!r.ok) throw new Error('Azure token ' + r.status);
  return (await r.json()).access_token;
}

async function handleQuotes(env) {
  const cols = 'ID,Name,Stage,Total,DateIssued,DateApproved,DueDate,IsClosed,Job';
  return json(await simproGet(env, '/quotes/?dateFrom=2025-01-01&columns=' + cols + '&pageSize=250&page=1'));
}

async function handleLeads(env) {
  const cols = 'ID,Name,Stage,Total,DateIssued,DateApproved,DueDate,IsClosed';
  return json(await simproGet(env, '/leads/?dateFrom=2025-01-01&columns=' + cols + '&pageSize=250&page=1'));
}

async function handleCustomers(env) { return json(await simproGet(env, '/customers/?columns=ID,CompanyName&pageSize=250')); }
async function handleUsers(env) { return json(await simproGet(env, '/staff/?columns=ID,Name&pageSize=250&page=1')); }

async function handleTargets(env) {
  try {
    const token = await getGraphToken(env);
    const r = await fetch('https://graph.microsoft.com/v1.0/drives/' + env.SP_DRIVE_ID + '/items/' + env.SP_ITEM_ID + '/workbook/worksheets/Targets/usedRange', { headers: { Authorization: 'Bearer ' + token } });
    if (!r.ok) throw new Error('Graph ' + r.status);
    const rows = (await r.json()).values || [];
    const monthly = {}, sectors = {}; let annual = 0;
    for (const row of rows) {
      if (!row[0] || !row[1]) continue;
      const label = String(row[0]).trim(), val = Number(row[1]);
      if (isNaN(val)) continue;
      const m = label.match(/^Month\s*(\d+)$/i);
      if (m) { monthly[parseInt(m[1])] = val; continue; }
      if (/^Annual/i.test(label)) { annual = val; continue; }
      sectors[label] = val;
    }
    if (!annual && !Object.keys(monthly).length) throw new Error('empty');
    return json({ annual, monthly, sectors });
  } catch (e) { console.error('Targets fallback:', e.message); return json(TARGETS_FALLBACK); }
}

async function handleAll(env) {
  const [qr, tr, lr] = await Promise.allSettled([handleQuotes(env), handleTargets(env), handleLeads(env)]);
  const quotes = qr.status === 'fulfilled' ? await qr.value.clone().json() : { error: qr.reason?.message };
  const targets = tr.status === 'fulfilled' ? await tr.value.clone().json() : TARGETS_FALLBACK;
  const leads = (lr.status === 'fulfilled' && lr.value) ? await lr.value.clone().json() : [];
  return json({ quotes, targets, leads, fetchedAt: new Date().toISOString() });
}

function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: CORS }); }
