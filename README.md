# MES Power Engineering — TV Dashboards

## Architecture

| Component | Location | Purpose |
|-----------|----------|---------|
| Cloudflare Worker | `mes-api.mes-bot.workers.dev` | API proxy — fetches from simPRO + SharePoint |
| GitHub Pages | `mes-bot-maker.github.io/mes-dashboards/` | Hosts the dashboard HTML files |
| GitHub Repo | `github.com/mes-bot-maker/mes-dashboards` | Source for dashboards |

---

## Dashboards

| Dashboard | URL | File |
|-----------|-----|------|
| BD Dashboard | `/bd/` | `bd/index.html` |
| Quotes Pipeline | `/quotes/` | `quotes/index.html` |
| Projects (TODO) | `/projects/` | `projects/index.html` |

---

## Worker Endpoints

| Endpoint | Returns |
|----------|---------|
| `/api/all` | quotes + targets (parallel, no leads — keeps fast) |
| `/api/quotes` | Quotes from 2024-01-01, cols: ID,Name,Stage,Total,DateIssued,DateApproved,DueDate,IsClosed |
| `/api/jobs` | Jobs from 2026-01-01, cols: ID,ConvertedFromQuote,DateIssued |
| `/api/leads` | Leads from 2026-01-01, cols: ID,LeadName,Stage,DateCreated |
| `/api/targets` | Targets from SharePoint MES sheet (falls back to hardcoded if SP fails) |

---

## Cloudflare Environment Variables

Go to: Workers → mes-api → Settings → Variables & Secrets

| Name | Type | Value / Notes |
|------|------|---------------|
| `SIMPRO_BASE_URL` | Text | `https://mes-power.simprosuite.com` |
| `SIMPRO_API_KEY` | Secret | simPRO API key |
| `AZURE_CLIENT_ID` | Text | Azure app client ID |
| `AZURE_TENANT_ID` | Text | Azure tenant ID |
| `AZURE_CLIENT_SECRET` | Secret | Azure app secret |
| `SP_DRIVE_ID` | Text | `b!lqS9e4ABZEG8zi3gJ_wIpiQ6SCO-alRNodHfLjoj1fV1igdVlSgxRJ9wvEbU93fF` |
| `SP_ITEM_ID` | Text | `01RTE6GZ65M3IYZ63CSJCLOGCRJINH6OQN` |
| `SP_SHEET_NAME` | Text | `MES` |

---

## SharePoint Targets File

**File:** `2026 Sales Targets North.xlsx`
**Location:** Commercial site → Shared Documents/Targets (DO NOT DELETE)/
**Sheet:** `MES`

Structure the worker expects:
- Header row: `Market | Annual Target | Jan-26 | Feb-26 | ... | Dec-26`
- Sector rows: EV Hubs, 33kV Connections, BESS, C&I Connections etc
- Total row: blank | £9,000,000 | £360,000 | £630,000 | ...

---

## Key Logic Decisions

### Won Definition
**Won = Quote has a job raised against it** (job appears in `/api/jobs` with `ConvertedFromQuote.ID` matching quote ID)
- Grouped by **job DateIssued** (when job was raised, NOT quote DateApproved)
- Matches Power BI: Jan £383K, Feb £177K, Mar £124K, Apr £98K — YTD ~£750K
- `JobNo` column rejected by simPRO REST API (422) — use jobs endpoint instead

### Archived Quotes
**Archived = IsClosed=true AND not in jobsLookup (no job raised)**
- Excluded from: Top 8, Due This Week/Month, Open Pipeline, By Stage, This Year filter

### Auto Refresh
Both dashboards auto-refresh every 5 minutes via setInterval — no manual refresh needed on TV.

### Year Filters
All year filters use `new Date().getFullYear()` — auto-updates at new year.

---

## CORS Fix (CRITICAL)
Worker CORS must always be `CORS.headers` not `CORS`:
```js
const CORS = { headers: { 'Access-Control-Allow-Origin': '*', ... } };
return new Response(null, { status: 204, headers: CORS.headers });
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: CORS.headers }); }
```
If dashboards show "Failed to fetch" — check this first.

---

## simPRO Details
- **Company ID:** 2
- **Base URL:** `https://mes-power.simprosuite.com`
- **Tugger Integration ID:** 4782

---

## GitHub Upload Process
1. Go to `github.com/mes-bot-maker/mes-dashboards`
2. Navigate to the file (e.g. `bd/index.html`)
3. Click pencil → Select All → Paste → Commit

---

## TODO
- [ ] Add SP_DRIVE_ID, SP_ITEM_ID, SP_SHEET_NAME to Cloudflare variables
- [ ] Verify SharePoint targets loading live (currently using hardcoded fallback £9M)
- [ ] Build Projects dashboard

---

## Projects Dashboard — Design Notes

### Purpose
TV dashboard for projects team — active jobs and order book.

### Data Source
SimproJobs — open/active jobs, no date filter (rolling, may include 2024 starts).

### Proposed Panels

**Banner KPIs:**
- Total Order Book Value (all open jobs ex-tax)
- Number of Active Projects
- Jobs Started This Year
- Invoiced to Date
- Remaining to Invoice

**Main Table — Active Projects (sorted by value):**
- Job name, Customer, Value ex-tax, Date Issued, Project Manager, Stage
- No year filter — shows all rolling open jobs regardless of start date
- Exclude completed/archived

**Chart — Order Book by Month Issued:**
- Bar showing value of jobs raised per month
- Shows pipeline shape and workload history

**Invoicing Targets — Recommendation:**
- Monthly invoicing targets only work if projects team is being fed a consistent flow of new work
- Showing targets when the team is already resource-constrained is counterproductive
- Better approach: show Invoiced This Month vs Last Month (trend) rather than vs a fixed target
- If targets are wanted: needs a separate target figure agreed with projects team, stored in SharePoint

**What NOT to include:**
- Materials/stock costs or billable materials (these skew the contract value)
- Completed or archived jobs
- Quotes not yet converted to jobs

### Worker Changes Needed
New endpoint `/api/projects`:
- Fetch open jobs: Stage not in Completed/Archived
- Columns: ID, Name, Customer, DateIssued, Stage, Total_ExTax, ProjectManager
- No dateFrom filter — all time, rolling

### simPRO Fields Available (SimproJobs)
- `Name` — job name
- `DateIssued` — when raised
- `Total_ExTax` — estimated value
- `Stage` — current stage
- `ConvertedFromQuoteID` — source quote
- `ProjectManagerID` — PM
- `CustomerID` — customer
- `CompletedDate` — completion date

---

## Known Data Issues

### Billable Materials Error (Job 5098 and others)
**Problem:** Some cost centres have materials ordered through them as "billable" when they should be "non-billable" (e.g. Fuel, Cabins, Transport, Safety Fencing on job 5098 Bedesway Jarrow EV Hub R2). This causes `TotalsMaterialsCost_Actual` and `TotalsMaterialsCost_Committed` to massively exceed the `Total_ExTax` cost centre value.

Example — cost centre "Making good around substation" (job 5098):
- Client charge (Total_ExTax): £596
- Materials actual + committed: £11,643

**Why it cannot be fixed:** Cost centres are locked (`ItemsLocked: true`) once invoiced. simPRO enforces this server-side — neither the UI nor the API (PATCH) can change billable/non-billable status on locked items. The only simPRO-supported fix would be to void all invoices, correct the items, and recreate invoices — not practical with live clients.

**Impact on dashboards:** 
- `Total_ExTax` at job level is NOT affected — it reflects the original contract value agreed with the client and is correct
- `TotalsMaterialsCost_Actual/Committed` are inflated and unreliable for cost reporting
- **Projects dashboard must use `Total_ExTax` only** — never derive order book from materials costs

**Process fix needed:** Train staff to use non-billable cost centres when ordering materials that are not being passed to the client (fuel, transport, site facilities, consumables etc). This only affects cost reporting visibility — it does not affect what the client is charged.

---

## Projects Dashboard — Design Notes (Updated)

### Order Book Definition
```
Order Book Value = Sum of Total_ExTax for all Progress + Pending jobs
Remaining to Invoice = Total_ExTax - TotalsInvoicedValue per job
```

**Do NOT use:**
- TotalsMaterialsCost_Actual (inflated by billable materials error)
- TotalsMaterialsCost_Committed (same issue)
- Any derived cost figures

**Prepaid jobs:** Invoiced upfront but work not yet done — `TotalsInvoicedValue` will be high but `Total_ExTax` remains the correct contract value. These ARE still in the order book as the work commitment exists.

### Job Stages to Include
| Stage | Include? | Rationale |
|-------|----------|-----------|
| Progress | ✅ Yes | Active delivery |
| Pending | ✅ Yes | Awarded, not yet started |
| Complete | ✅ Yes | Done, may still have remaining invoice |
| Invoiced | ⚠️ Optional | Fully invoiced — technically out of order book but still open |
| Archived | ❌ No | Closed out |

### Worker Endpoint Needed
`/api/projects` — no dateFrom filter (rolling, all time):
```
Columns: ID, Name, CustomerID, DateIssued, Stage, Total_ExTax, TotalsInvoicedValue, ProjectManagerID
Filter: Stage NOT IN (Archived)
```
