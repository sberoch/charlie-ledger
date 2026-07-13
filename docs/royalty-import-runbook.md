# Royalty Import — Prod Runbook

How to run the historical royalty import (`apps/api/src/scripts/import-royalties.ts`,
ADR-0009) against the production database. Much simpler than the license import: no
track matching, no needs-review round trip — one CSV in, 74 royalty payments out.
Commands are fish-shell, run from the repo root unless noted.

> **Before running:** `pnpm --filter @workspace/shared build` (same stale-dist hazard
> as the license import — see docs/license-import-runbook.md).

## Prerequisites

- The deploy including migration **0013** (`royalty_payment` table) is live.
- Source CSV: `~/Downloads/Charlie Exports/Royalties Sales Data 2020-2026.csv`
  (QuickBooks "Sales by Product/Service Detail", accrual basis, exported 2026-06-19).

## 1. Tunnel to prod postgres

```fish
# Container IP CHANGES when a deploy recreates the container — always re-fetch it:
ssh -i ~/.ssh/id_charlie root@134.209.112.87 \
  "docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' app-prod-postgres"

# Tunnel (replace 172.18.0.2 with the IP from above):
ssh -i ~/.ssh/id_charlie -f -N -L 15432:172.18.0.2:5432 root@134.209.112.87
```

## 2. Point at prod and sanity-check

```fish
set PW (grep '^POSTGRES_PASSWORD=' infra/docker/.env.production | cut -d= -f2)
set -x DATABASE_URL "postgresql://app:$PW@localhost:15432/app"

# Must return without error (migration 0013 is live):
psql $DATABASE_URL -t -A -c "select count(*) from royalty_payment;"
```

## 3. Dry-run, then run

```fish
cd apps/api
pnpm import:royalties -- "$HOME/Downloads/Charlie Exports/Royalties Sales Data 2020-2026.csv" --dry-run
```

Expected: **74 rows, $179,593.07** (matches the QB footer to the cent), payers
BMI · American Federation of Musicians · Screen Actors Guild · Yessian Music ·
Gareth Smith (Personal). Payers already in prod (by case-insensitive name) are
reused, the rest created with empty bill-to blocks. If it looks right, drop the
flag:

```fish
pnpm import:royalties -- "$HOME/Downloads/Charlie Exports/Royalties Sales Data 2020-2026.csv"
```

One transaction — a failure rolls back everything. Idempotent by
(date, payer, description, amount): re-running skips existing rows, so it is never
destructive.

## 4. Verify + close the tunnel

```fish
psql $DATABASE_URL -c "select p.name, count(*), sum(r.amount) from royalty_payment r join payer p on p.id = r.payer_id group by p.name order by 3 desc;"
# BMI 43 · AFM 26 · Gareth Smith 2 · Yessian 1 · SAG 2 — total 179593.07

pkill -f "15432:172.18.0.2"   # match the IP you tunneled to
```

Then check the app: Royalties page lists everything month-grouped, the dashboard
shows Royalty Income $179,593.07, and a Reports pull over 2020–2026 shows the
Royalties section.

## Post-import follow-ups (Charlie, in the app — all optional)

- Link the AFM "Kia – Believer" rows (and the Yessian "Kia Accolades" one) to their
  licenses via each row's link button — context only, nothing depends on it.
