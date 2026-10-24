# Woreda-Zonal Report Management System

A role-based web system for collecting reports from **woredas** up to their **zone**. The zone sets annual targets first and cascades them down to each woreda; woredas then file reports against the plan they accepted, and the zone reviews, scores and ranks them.

Everything is scoped by the signed-in user's **zone, department and team**.

## Features

- **Reference data and users**: zones, woredas, departments, teams and users, with nine roles.
- **Annual report versions and templates**: one template per team under each version.
- **Report formats**: a numbered outline (`1.` → `1.1.` → `1.1.1.`) of items, each with a title and a measurement. Draft → pending approval → approved or rejected. Approved formats can be previewed as a table, downloaded as Excel or CSV, and printed.
- **Annual plan, zone first**: the Zonal Expert sets the zone plan, then plans each woreda. Woreda totals must add up to the zone plan, and each parent item must equal the sum of its sub-items. Cascading notifies the woreda and locks its plan.
- **Plan acceptance**: the Woreda Department Head accepts a cascaded plan (which locks it) or rejects it with a reason, sending it back to the zone to revise and cascade again.
- **Reports based on the plan**: a woreda can only file a report against a plan it has accepted. The entry form shows only the planned items with their targets, and the server validates every entry.
- **Review workflow**: draft → awaiting woreda plan expert → approved by woreda → (woreda submits) → in review → approved or rejected, with notifications.
- **Scoring and rankings**: team scores (`0.4·timeliness + 0.3·accuracy + 0.3·quality`) and manual woreda ranking.
- **Excel import**, **support requests** with feedback, an **audit log**, and **tamper-evident rows** (SHA-256 `row_hash` on formats, plans and reports).

## Roles

| Level | Roles |
|---|---|
| System | `admin` |
| Zone | `zonal_dept_head`, `zonal_expert`, `zonal_plan_expert`, `zonal_team_leader` |
| Woreda | `woreda_dept_head`, `woreda_team_leader`, `woreda_expert`, `woreda_plan_expert` |

## How it works

1. **Admin** sets up zones, woredas, departments, teams and users, and creates the annual report versions.
2. **Zonal Dept Head** approves report versions and report formats.
3. **Zonal Plan Expert** creates a report template for each team under a version.
4. **Zonal Expert** builds the report format; the Dept Head approves it.
5. **Zonal Expert** makes the annual plan: the zone plan first, then each woreda from a dropdown. Cascading notifies the woreda and locks its plan.
6. **Woreda Dept Head** accepts or rejects the cascaded plan.
7. **Woreda team members** file reports against the accepted plan and submit them to their **Woreda Plan Expert**.
8. **Woreda Plan Expert** approves each team report (or sends it back). When the last team report of the woreda for that month is approved, the woreda has **submitted** and all its reports reach the zone together.
9. **Zonal Expert** reviews, approves or rejects the submitted reports. Team scoring and rankings sit alongside this.

The zone sees each month as **one reporting period**; "Show woredas" lists every woreda, whether it has submitted, and where each team's report stands.

## Tech stack

| Part | Stack |
|---|---|
| Backend | Node.js 18+ (ES modules), Express, PostgreSQL, JWT (Passport), Zod, ExcelJS / SheetJS |
| Frontend | React 18, Vite, Tailwind CSS, React Router, Axios |
| Security | Helmet, CORS whitelist, parameterized queries, login rate limiting, bcrypt, audit logging |

## Getting started

**Requirements:** Node.js 18 or newer and a running PostgreSQL database.

### 1. Backend

```bash
cd backend
cp .env.example .env        # set DATABASE_URL and JWT_SECRET
npm install
npm run migrate             # applies db/schema.sql and db/migrations/*.sql
npm run seed                # sample zone, woreda, department and an admin user
npm run dev                 # http://localhost:5000/api/v1/health
```

The seeded admin is `admin@rms.local` / `ChangeMe123!` (set in `.env` as `ADMIN_EMAIL` / `ADMIN_PASSWORD`). **Change this password immediately.**

### 2. Frontend

```bash
cd frontend
cp .env.example .env        # VITE_API_URL=http://localhost:5000/api/v1
npm install
npm run dev                 # http://localhost:5173
```

Run the backend first, then the frontend.

## Configuration

Backend `.env`:

| Variable | Purpose |
|---|---|
| `PORT` | API port (default `5000`) |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Long random string used to sign tokens |
| `JWT_EXPIRES_IN` | Token lifetime (default `8h`) |
| `CORS_ORIGINS` | Allowed frontend origins (default `http://localhost:5173`) |
| `UPLOAD_DIR`, `MAX_UPLOAD_MB` | Excel import uploads |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Admin created by `npm run seed` |

Frontend `.env`: `VITE_API_URL` is the API base URL.

## Project structure

```
backend/
  db/            schema.sql, migrations/, migrate.js, seed.js
  src/
    controllers/ routes/ models/ middlewares/ services/
    utils/       validators, scope rules, plan checks, format tree helpers
frontend/
  src/
    pages/       dashboards, formats, plans, reports, rankings, admin
    components/  layout, common, formats, plans, reports
    services/    API clients       hooks/ context/ utils/
```

## API

All endpoints are under `/api/v1` and need a Bearer JWT except `/auth/login`. The main groups are `/auth`, `/users`, `/reference`, `/templates`, `/report-formats`, `/plans`, `/reports`, `/rankings`, `/support-requests` and `/imports`. The full endpoint table, plan consistency rules and migration notes are in [`backend/README.md`](backend/README.md).

## Status and roadmap

Done: setup and users, formats, zone-first annual planning, woreda plan acceptance, reports filed and validated against the accepted plan, review, rankings.

Not built yet, in rough order:

- Plan versus actual: compare reported figures with the plan on the zone side.
- Woreda downloads: let woreda users download and print a format.
- Report scoping: narrow zonal experts to their own team's reports (they currently see every team's reports in their zone).
- Quarterly and half-year *plans* as their own cascade (monthly plans and monthly reporting periods exist; quarter/half/annual reports are summed from the months).
- Old role names: update any users created as `plan_expert` or `team_leader`.

## Contributing

Issues and pull requests are welcome. Please keep the plan consistency helpers in `backend/src/utils/planChecks.js` and `frontend/src/utils/planChecks.js` in step.

## License

No license has been chosen yet. Add a `LICENSE` file before publishing if you want others to be able to use the code.
