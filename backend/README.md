# Woreda-Zonal RMS — Backend

Node.js (ES modules, `"type": "module"`) + Express + PostgreSQL.

## Setup
```bash
cp .env.example .env        # set DATABASE_URL and JWT_SECRET
npm install
npm run migrate             # applies db/schema.sql (+ db/migrations/*.sql), tracked in schema_migrations
npm run seed                # sample zone/woreda/department + admin (admin@rms.local / ChangeMe123!)
npm run dev                 # http://localhost:5000/api/v1/health
```
Change the seeded admin password immediately.

## API (all under `/api/v1`, Bearer JWT except `/auth/login`)
| Prefix | Purpose |
|---|---|
| `/auth` | login, me, change-password, notifications |
| `/users` | user admin, `reference-data` (zones/woredas/departments/teams) |
| `/reference` | read-only zones → woredas, departments → teams |
| `/templates` | report_templates (JSON schema) + `/versions` (report_version / report_formats tree) |
| `/reports` | draft → submit → review (start_review / approve / reject); `/plans/:id` |
| `/rankings` | `/teams` (score, compute, list), `/woredas` (manual rank by Plan Expert) |
| `/support-requests` | create, assign, status, 1–5 feedback |
| `/imports` | Excel upload (multipart field `file` + woreda_id, team_id, report_version_id) |
| `/report-formats` | report formats per template: Zonal Expert / Team Leader create + edit drafts and submit; Zonal Dept Head approves/rejects (`/:id/review`) |
| `/plans` | `GET` plans visible to the caller; `POST /plans/cascade` (Zonal Expert) cascades an annual plan from an approved format to woredas in their zone; `POST /plans/:id/review` (Woreda Dept Head) accepts or rejects a cascaded plan |

## Excel import layout
Sheet **Plan**: `node_code | value | remarks`. Sheet **Monthly** (optional): `node_code | month | year | value | percentage`.
Imports are all-or-nothing: any row error rolls back and returns the row messages.

## Ranking formula
`score = 0.4·timeliness + 0.3·accuracy + 0.3·quality` (weights in `rankingEngineService.js`).
Timeliness: on time by the 5th of the month after the period = 100, −10 per late day. Accuracy: approved ÷ total reports.
Quality: average expert score from `team_feedback`.

## Security
Helmet, CORS whitelist (`CORS_ORIGINS`), parameterized queries only, login rate-limit, bcrypt(12), audit logging to `activity_logs`.

## Schema migrations (`db/migrations/`)
`npm run migrate` applies `db/schema.sql` once, then every `db/migrations/*.sql` file in filename order, each tracked by name in `schema_migrations` so re-running is always safe.

**`0001_report_format_hash_restructure.sql`** restructures the reporting hierarchy to:
`report_versions (1)──<(N) report_templates (1)──<(N) report_formats`, with `report_formats (1)──<(N) plans` and `report_formats (1)──<(N) reports`. It also adds a `row_hash VARCHAR(64)` column plus an auto-hashing `BEFORE INSERT OR UPDATE` trigger (`fn_set_row_hash`, SHA-256 via `pgcrypto`) to `report_formats`, `plans`, and `reports`, so tampering with a stored row's content is detectable.

Key points if you're adapting this further:
- `report_version` was renamed to `report_versions`; no data was lost.
- The **old** per-field `report_formats` tree (used by the Excel-import pipeline) was renamed to `report_format_nodes` and left completely untouched — `annual_plans`/`plan_values`/`plan_monthly_values` still work against it exactly as before.
- A **new** `report_formats` table was created matching this design: one row per format revision, a JSONB `schema_definition`, and a `draft → pending_approval → approved/rejected` workflow. `Template.js` still serves the legacy node-tree methods; `ReportFormat.js` and `Plan.js` are the new models for this table and for `plans`.
- `reports.template_id` was replaced by `reports.format_id` (nullable — there's no automatic mapping from the old column to a specific new format row; backfill it, then uncomment the `SET NOT NULL` at the bottom of the migration file).
- **Not yet done:** the controllers/routes/frontend for creating/approving `report_formats` and `plans`, and for submitting a `reports` row against a `format_id` instead of a `template_id`, still need to be built — the migration and models are the foundation for that, not the full feature.

## Annual plan (Zonal Expert): zone plan first, then woredas
Two steps, in this order (`/plans`):

1. **Zone plan** — `PUT /plans/zone` `{ format_id, year, data: { "<item code>": number } }` (admin also sends `zone_id`; `GET /plans/zone?format_id&year` reads it). Stored in `zone_plans` (migration 0003), one row per format + zone + year, with the same SHA-256 `row_hash` as `plans`/`reports`.
   Blank = not planned this year; woredas can only be planned for items that are in the zone plan.
2. **Woreda plans** — `POST /plans/cascade` `{ format_id, year, submit, allocations: [{ woreda_id, data }] }` (the UI plans one woreda at a time, chosen from a combo box). Refused with 409 until the zone plan exists.
   `submit: false` saves a private draft (types and bounds only). `submit: true` cascades: it notifies the woreda dept head and locks that woreda's plan (re-cascading it → 409).

**Two consistency rules** (`utils/planChecks.js`; a copy of the hierarchy helpers is in `frontend/src/utils/planChecks.js` — keep them in step). Failures come back as `400 "The plan does not add up"` with every reason in `details`:
* **Hierarchy** — a measured item that has measured sub-items must equal their sum. "Sub-items" are the nearest measured items below it (headings in between are looked through); it is only checked when the item and its sub-items share the same measurement, never for percentages, and only once at least one sub-item has a value. Enforced on the zone plan when it is saved, and on a woreda plan when it is cascaded (drafts may be unfinished).
* **Zone totals** — for every summable item, the woredas' targets added together may never exceed the zone plan, and must equal it exactly once every woreda of the zone has a cascaded plan. This is an invariant both ways: a woreda can't be cascaded past the zone plan, and the zone plan can't be changed to below what is already cascaded, can't drop an item woredas already have, and (once every woreda is cascaded) can't change at all.
Percentages are rates: bounded 0–100, never summed. Targets are never negative. Decimal noise up to 0.005 is tolerated (0.1 + 0.2 = 0.3).

## Woreda side of the annual plan: accept or reject
### Monthly plan

A woreda's cascaded annual plan is divided across the twelve months: `POST /plans/monthly` `{ format_id, year, woreda_id, submit, months: [{ month: 1..12, data }] }` (Zonal Expert). The expert may split automatically (the UI's even split) or type the months by hand; the API only sees the numbers. Stored as twelve `plans` rows, one per month of the plan year (July → June), with `month` = the calendar month number (July = 7 … June = 6); annual plans have `month` NULL. Refused with 409 until the woreda's annual plan is cascaded. A draft is saved as-is; `submit = true` also requires each month's parents to equal the sum of their sub-items and the months to add up exactly to the annual plan (percentages are rates, not summed), then notifies the woreda Dept Head and locks the plan. `GET /plans` returns **annual** plans by default; add `?period=monthly` for the monthly rows.

### Reporting periods (monthly reports) and summaries

For a **monthly** report format the Zonal Plan Expert opens a month for their zone's woredas with an opening time and a deadline — `POST /report-windows` `{ format_id, year, month (calendar number, July = 7 … June = 6), opens_at, closes_at }` (table `report_windows`, migration `0005_report_windows.sql` — run `npm run migrate`). The woreda Dept Heads / experts / team leaders of that format are notified. A woreda can **create, edit and submit** that month's report only while the period is open (`reportController.assertWindowOpen`; otherwise 409 with the dates; the admin is not held to the clock), and only one report per woreda and month. `PUT /report-windows/:id` moves the dates (extending the deadline notifies the woredas; "close now" sets the deadline to now), `DELETE` removes a period nobody has reported in, `GET /report-windows?open=true` lists what is open for the caller (woreda users: their zone), and `GET /report-windows/:id` adds every woreda's report status (who has submitted, who is late or missed it).

Quarterly, half-year and annual reports are **not filed**: they are summed up from the monthly reports. `GET /reports/sheet?...&range=q1|q2|q3|q4|h1|h2|annual` (plan year July → June) adds up the counted monthly reports of those months — counts summed, percentages averaged — against the monthly plans of the same months (the annual plan for `annual` when no monthly plan was cascaded), and says per woreda how many of the months it has reported.

### All woredas' reports on one sheet

`GET /reports/sheet?format_id=&year=&month=|quarter=&zone_id=` (zone level users and the admin) returns every woreda of the zone — the admin: every woreda, or one zone with `zone_id` — with its target and its report for one format and period: `{ format, year, month, quarter, woredas: [{ woreda_id, name, plan: { kind: 'annual'|'monthly', data } | null, report: { id, status, data } | null }] }`. The target is the woreda's accepted annual plan, or for a monthly report that month's cascaded monthly plan. Drafts are never included. Zonal users only get formats of their own department / team. The sheet page (`/reports/sheet`) shows Plan and Report side by side per woreda, with all-woredas totals, and offers Excel / CSV / Print (`POST /plans/export`, now open to every zonal role and the admin).

### Plan tables: Excel, CSV, print

The Zonal Expert's two plan tables — **Step 2 — Woreda plans** (annual: items × zone plan × every woreda, with total, left and a status row) and the **Monthly plan** (items × July–June) — are each a single spreadsheet-style table that you type into and that can be downloaded and printed as it is shown. CSV and printing happen in the browser; Excel is built by `POST /plans/export` (`services/tableExportService.js`, exceljs), which formats the table the browser sends — `{ title, lines, columns, rows: [{ cells, depth, bold }] }` — so the file matches the screen, including a monthly plan that is not saved yet. It reads nothing from the database.

`GET /plans` for a woreda user returns only cascaded plans (never drafts) of **their own woreda**, narrowed to the department on their account — and, for Woreda Experts / Team Leaders, to their team (`woredaPlanScope` in `utils/scope.js`). A woreda user with no department sees nothing. Each row carries `template_title`, `team_name`, `format_version` for display; the outline itself comes from `GET /report-formats/:id`.

`POST /plans/:id/review` `{ action: 'approve' | 'reject', rejection_reason? }` — **Woreda Dept Head** only (admin passes), for a plan of their own woreda and department. It works only on a plan still `submitted` (409 otherwise):
* **approve** → `approved`, `approved_by` / `approved_at` set. The plan is then locked for good (re-cascading → 409).
* **reject** → `rejected`; a reason is required and is stored in `plans.rejection_reason` (migration 0004). A rejected plan no longer counts toward the zone totals, and the Zonal Expert may revise it and cascade again; the reason is kept until it is cascaded again.
The plan's author and the Zonal Experts of that team in the zone are notified. Cascading now notifies only the Woreda Dept Head(s) of the plan's own department (it used to notify every dept head in the woreda).

## Reports follow the accepted plan
A woreda report can only be created against a plan the woreda has **accepted** (`plans.status = 'approved'`, annual) for the same `format_id` and `year`; otherwise `POST /reports` → 409. Woreda users can also only file for a format of their own department (and team, for experts / team leaders).
Entries (`data`, keyed by item code) are validated on create and on every save: only items the accepted plan has a target for, numbers only, never negative, percentages 0–100; blank = not reported yet. A report saved against a format with no accepted plan can't be edited. Formats in the older section/KPI layout keep their entries unvalidated (the accepted-plan rule still applies).
In the UI, *New report* lists the woreda's accepted plans (the plan fixes format and year), and the entry form shows only the planned items, each with its target and the % achieved. Zonal reviewers see the same targets next to the woreda's figures.

## Department / team scoping (templates and report formats)
`utils/scope.js` is the single rule. A **zonal** user can only read or author report templates and formats of the department on their account;
experts and team leaders are further confined to their own **team** when the account has one (an expert with a department but no team sees the whole department).
A zonal user with no department sees nothing. Filters sent by the client (`?team_id=`, `?department_id=`) can narrow results but never widen them.
Plan experts and the dept head are department-scoped only (they work across teams); admin and woreda roles are unaffected.
Cascading an annual plan uses the same rule, so an expert can only cascade formats of their own team.

## Report format layout (hierarchy)
`report_formats.schema_definition` is a numbered outline that nests without limit — `1.` → `1.1.` → `1.1.1.` …, then `2.` — where every item has only a **title** and a **measurement**:
```json
{ "nodes": [ { "code": "1", "title": "Immunization", "measurement": "", "children": [
    { "code": "1.1", "title": "Children vaccinated", "measurement": "Persons", "children": [] } ] } ] }
```
The server validates and numbers it (`utils/formatTree.js`, iterative so depth is unbounded; sanity cap of 5,000 items) — clients never supply `code`.
A blank measurement is a heading with no value. Plan targets and report values are keyed by the item's `code` (`{ "1.1": 450 }`); a measurement of `%`/`percent` is treated as a rate (bounded 0–100, not summed when cascading).
A format is locked once approved, so codes never shift under existing data. Formats saved in the earlier section/KPI layout keep working (cascade, reports) and are shown as an outline when opened for editing.
Report *templates* (Zonal Plan Expert) still use sections / KPIs / targets.

## Downloading / printing an approved format
`GET /report-formats/:id/export?type=xlsx|csv` — **approved formats only** (409 otherwise), and subject to the same department/team visibility as opening the format.
Columns are *No. | Title | Measurement*; numbers are written with a trailing dot (`1.`, `1.1.`, `1.10.`) so Excel can't read `1.10` as the number 1.1.
CSV is UTF-8 with a BOM (Amharic opens correctly in Excel) and neutralises cells that start with `= + - @` so they can't run as formulas.
Excel (built with `exceljs`) has a title block, bold headings, indentation by depth, column widths, a frozen header, and print setup (A4, fit to width, header row repeats on every page).
On screen, an approved format is shown as this table, with **Download Excel / Download CSV / Print**; printing hides the app chrome and always prints on white, even in dark mode.
