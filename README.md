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
