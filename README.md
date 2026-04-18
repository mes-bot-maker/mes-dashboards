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

# MES Power Engineering — TV Dashboards

## Architecture Overview

```
TV Browser (GitHub Pages)
  │  fetch("/api/all")   fetch("/api/quotes")
  ▼
Cloudflare Worker  ← holds all secrets securely as env variables
  │                        SIMPRO_API_KEY
  │                        SIMPRO_BASE_URL
  │                        AZURE_CLIENT_ID / SECRET / TENANT_ID
  │                        SP_DRIVE_ID / SP_ITEM_ID
  ├── simPRO REST API  (quotes, leads, customers, users)
  └── Microsoft Graph  (SharePoint Excel targets file)
```

## Live URLs

| Dashboard | URL |
|-----------|-----|
| Quotes Pipeline | https://mes-bot-maker.github.io/mes-dashboards/quotes/ |
| BD Dashboard | https://mes-bot-maker.github.io/mes-dashboards/bd/ |

## Files in this Repo

| File | Purpose |
|------|---------|
| `quotes/index.html` | Quotes & Estimating TV dashboard |
| `bd/index.html` | BD Pipeline TV dashboard |
| `worker/worker.js` | Cloudflare Worker — API proxy (deploy to Cloudflare) |
| `README.md` | This file |

---

## Key Facts for Future Claude Sessions

### simPRO
- **Company ID:** `2` (critical — not 0)
- **Base URL:** `https://mes-power.simprosuite.com`
- **API path:** `/api/v1.0/companies/2/` + endpoint
- **Auth:** Bearer token via `SIMPRO_API_KEY` env var
- **Quotes fields:** `ID, Name, Stage, Total{ExTax,Tax,IncTax}, DateIssued, DateApproved, DueDate, IsClosed`
- **Won definition:** `IsClosed === true` means a job has been raised against the quote
- **Date filter:** `dateFrom=2025-01-01` — fetches 250 quotes per page

### Cloudflare Worker
- **Worker name:** `mes-api`
- **Live URL:** `https://mes-api.mes-bot.workers.dev`
- **Account ID:** `694138cc791ff508934966d78369a2cd`
- **Edit URL:** https://dash.cloudflare.com/694138cc791ff508934966d78369a2cd/workers/services/edit/mes-api/production

#### Worker Endpoints
| Endpoint | Returns |
|----------|---------|
| `/api/quotes` | Array of 250 quotes from simPRO |
| `/api/targets` | `{annual, monthly:{1..12}, sectors:{...}}` from SharePoint |
| `/api/all` | `{quotes:[], targets:{}, fetchedAt}` — both combined |
| `/api/leads` | Leads from simPRO |
| `/api/customers` | Customers from simPRO |

#### Worker Env Vars (set in Cloudflare dashboard)
| Var | Value |
|-----|-------|
| `SIMPRO_BASE_URL` | `https://mes-power.simprosuite.com` |
| `SIMPRO_API_KEY` | *(encrypted)* |
| `AZURE_CLIENT_ID` | `a3cef2b8-d6ae-402c-9c98-af8fa8fea802` |
| `AZURE_TENANT_ID` | `18c43bd3-313f-4896-92cd-8a3b13451165` |
| `AZURE_CLIENT_SECRET` | *(encrypted)* |
| `SP_DRIVE_ID` | *(encrypted)* |
| `SP_ITEM_ID` | *(encrypted)* |

### SharePoint / Targets
- Targets come from a SharePoint Excel file
- Sheet name: `Targets`
- Row format: Column A = label, Column B = value
- Label patterns: `Month 1` through `Month 12`, `Annual`, then sector names
- Annual target: **£6,750,000**
- If SharePoint fails, worker falls back to hardcoded `TARGETS_FALLBACK`

### GitHub Pages
- Repo: https://github.com/mes-bot-maker/mes-dashboards
- Deployed from `main` branch, root `/`
- Auto-deploys ~1 min after any commit
- **No Cloudflare Pages involved** — purely GitHub Pages

---

## Dashboard Features

### Quotes Pipeline (`quotes/index.html`)
- **4 KPI cards:** Open Pipeline, Won (Closed), Active In-Progress, Avg Quote Value
- **⚠ Due This Week:** Red-highlighted table of open quotes with DueDate this week — overdue shown in red, imminent in amber
- **📅 Due This Month:** Amber table of quotes due later this month
- **By Stage:** Bar chart with count + value per stage
- **Top 8 by Value:** Highest value quotes
- **Full sortable/filterable table:** All 250 quotes, filter by stage, sort any column, search by name/ID
- **Won filter** uses `IsClosed === true` NOT Stage === Approved
- Calls `/api/all` and extracts `quotes` array
- Auto-refreshes every 5 minutes

### BD Dashboard (`bd/index.html`)
- **Year progress banner:** Annual target vs won to date vs pipeline
- **4 KPI cards:** This month target, Won this month, Win rate YTD, Open quotes value  
- **Monthly bar chart:** Target vs Won for Jan–Dec, colour-coded past/future
- **Sector breakdown:** All 9 sectors with target bars
- **Monthly table:** YTD actuals vs target with % (green ≥100%, amber ≥70%, red <70%)
- **Win rate panel:** Big % with won/active/lost/closed counts
- Calls `/api/all`
- Auto-refreshes every 5 minutes

---

## Known Issues / Next Steps
- [ ] BD dashboard `bd/index.html` may still need updating with latest `IsClosed` logic
- [ ] Consider adding pagination for quotes (currently capped at 250)
- [ ] Consider adding a sector tag to quotes so BD dashboard can show sector breakdown from real data
- [ ] Both dashboards designed for TV display — full screen works best

---

## How to Deploy Worker Changes

1. Go to https://dash.cloudflare.com/694138cc791ff508934966d78369a2cd/workers/services/edit/mes-api/production
2. Select all (Ctrl+A), delete
3. Paste contents of `worker/worker.js`
4. Click **Deploy**

**Important:** The editor has autocomplete that fires on Enter — paste is safer than typing.

## How to Deploy Dashboard Changes

1. Edit `quotes/index.html` or `bd/index.html` in GitHub
2. Commit to `main`
3. GitHub Pages auto-deploys in ~60 seconds

# MES Power Engineering — TV Dashboards

## Architecture Overview

```
TV Browser (GitHub Pages)
    │  fetch("/api/quotes")  fetch("/api/leads")  fetch("/api/targets")
    ▼
Cloudflare Worker  ← holds all secrets securely as env variables
    │                    SIMPRO_API_KEY
    │                    SIMPRO_BASE_URL
    │                    MS_GRAPH_TOKEN (for SharePoint targets)
    ├──► simPRO REST API  (quotes, leads, customers, users)
    └──► Microsoft Graph  (SharePoint Excel targets file)
```

## Files in this repo

| File | Purpose |
|------|---------|
| `quotes/index.html` | Quotes & Design Team TV dashboard |
| `bd/index.html` | BD Pipeline TV dashboard |
| `worker/worker.js` | Cloudflare Worker — API proxy (deploy to Cloudflare) |
| `README.md` | This file |

## Key facts for future Claude sessions

- **simPRO Integration ID (Tugger):** 4782
- **simPRO company:** MES Power Engineering
- **Tugger OData URL:** Available in Tugger portal under Connections
- **Targets file:** SharePoint → Commercial → Targets (DO NOT DELETE) → 2026 Sales Targets North PBI.xlsx
- **SharePoint file URI:** `file:///b!lqS9e4ABZEG8zi3gJ_wIpiQ6SCO-alRNodHfLjoj1fV1igdVlSgxRJ9wvEbU93fF/01RTE6GZ7VGX2FDM3NABGY3YXTZMFAQQA5`

## MES Monthly Targets 2026 (from SharePoint)

| Month | MES Target | Cumulative |
|-------|-----------|------------|
| Jan   | £270,000  | £270,000   |
| Feb   | £472,500  | £742,500   |
| Mar   | £607,500  | £1,350,000 |
| Apr   | £675,000  | £2,025,000 |
| May   | £742,500  | £2,767,500 |
| Jun   | £810,000  | £3,577,500 |
| Jul   | £675,000  | £4,252,500 |
| Aug   | £472,500  | £4,725,000 |
| Sep   | £675,000  | £5,400,000 |
| Oct   | £675,000  | £6,075,000 |
| Nov   | £472,500  | £6,547,500 |
| Dec   | £202,500  | £6,750,000 |
| **Annual** | **£6,750,000** | |

## Market Sector Targets 2026 (MES)

| Sector | Annual Target |
|--------|--------------|
| EV Hubs | £2,000,000 |
| 33kV Connections | £2,000,000 |
| BESS | £750,000 |
| C&I Connections | £750,000 |
| Residential Connections | £250,000 |
| BoP (Private Network) | £500,000 |
| Small Works | £300,000 |
| O&M Contracts | £100,000 |
| Faults | £100,000 |

## simPRO Key Fields

### Quotes (SimproQuotes)
- `Stage`: InProgress | Approved | Complete | Archived
- `TotalExTax`: value ex VAT
- `DateIssued`: when quote was sent
- `DateApproved`: when customer approved (= won)
- `DueDate`: quote due date
- `IsClosed`: true = closed/lost
- `ForecastPercent`: salesperson probability %
- `JobNo`: populated when converted to job

### Leads (SimproLeads)
- `Stage`: Open | Closed
- Custom Fields: 191=Market Sector, 192=Client Type, 224=How Received,
  290=Client Status, 291=Opportunity Type, 293=Estimated Value,
  294=CF Probability%, 295=Next Action, 296=Next Action Date, 297=Relationship Status

## Cloudflare Worker Endpoints

| Endpoint | Returns |
|----------|---------|
| `GET /api/quotes` | All quotes from 2026-01-01 |
| `GET /api/leads` | All leads from 2025-01-01 |
| `GET /api/targets` | Monthly targets from SharePoint Excel |
| `GET /api/customers` | Customer ID→Name lookup |
| `GET /api/users` | User ID→Name lookup |

## Setup Steps (for future reference)

1. Create Cloudflare account at cloudflare.com
2. Create Worker, paste `worker/worker.js`
3. Add secrets: SIMPRO_API_KEY, SIMPRO_BASE_URL, GRAPH_TOKEN
4. Note Worker URL (e.g. `https://mes-api.yourname.workers.dev`)
5. Paste Worker URL into both dashboard HTML files
6. Push all files to GitHub, enable Pages
7. Open dashboard URL on TV micro PC, press F11

## Data Refresh
- Tugger syncs simPRO hourly
- Dashboards auto-reload at :15 past each hour
- Targets read live from SharePoint on each load
