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
