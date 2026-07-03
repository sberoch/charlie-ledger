# License Import — Prod Runbook

How to run the historical license import (`apps/api/src/scripts/import-licenses.ts`,
ADR-0008) against the production database, and how to do the needs-review round trip
when Charlie returns track names. Commands are fish-shell, run from the repo root
unless noted. Secrets are read from `infra/docker/.env.production` (gitignored — keep
it in sync with the VPS copy).

> **Before running ANY script here:** `pnpm --filter @workspace/shared build`.
> `@workspace/shared` resolves to its built `dist/` at runtime while types come from
> `src/` — a stale dist typechecks green but silently misbehaves (the first prod run
> corrupted 30 usage arrays and 8 end dates this way; `repair-license-import.ts`
> fixed it, and both scripts now abort on a stale dist).

## Prerequisites (once)

- The deploy including migration 0012 is live (enum values exist in prod).
- Prod is seeded (`pnpm --filter api db:seed:prod` on the VPS — see §VPS notes).
- The real track catalog (~244 tracks) is loaded in prod **via the app UI**
  (Tracks → import, `Charlie Foltz Production Library 2026 Metadata.csv`).
  The script aborts if the catalog has fewer than 100 tracks.

## 1. Tunnel to prod postgres

Prod postgres publishes no ports; tunnel through the VPS to the container:

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

# Must print ~244 (the real catalog), not 0 or 20 (empty / mock):
psql $DATABASE_URL -t -A -c "select count(*) from track;"
```

## 3. Run the import

```fish
cd apps/api
pnpm import:licenses -- "$HOME/Downloads/License Data 2020-2026 - License Sales Data 2020-2026(1).csv" \
  --out ~/foltz-import-out
```

First-run expectation: **173 imported, 80 needs review, 0 skipped**. One
transaction — any failure rolls back everything, so a failed run can simply be
re-run. Already-imported rows are always skipped (idempotent), so re-running is
never destructive.

Outputs in `~/foltz-import-out/`:

- `needs-review.csv` — send to Charlie; he fills the **track_name** column with the
  exact catalog track title (the `candidates` column lists options for multi-track
  rows). Rows left blank simply never import.
- `match-audit.csv` — every row→track match, for spot-checking.

## 4. Close the tunnel

```fish
pkill -f "15432:172.18.0.2"   # match the IP you tunneled to
```

## 5. The round trip (when Charlie returns the CSV)

1. If he named tracks that don't exist yet, **create them in the app first**
   (the import never creates tracks — a completion must match an existing track,
   case-insensitively, or the row stays in review).
2. Re-open the tunnel (§1–2), then re-run with his file:

```fish
cd apps/api
pnpm import:licenses -- "$HOME/Downloads/License Data 2020-2026 - License Sales Data 2020-2026(1).csv" \
  --completions ~/Downloads/<charlies-filled-file>.csv \
  --out ~/foltz-import-out
```

Everything already imported is skipped; only resolved rows import. A fresh
`needs-review.csv` is emitted with whatever still isn't resolvable — repeat as
completions trickle in.

## Post-import follow-ups (Charlie, in the app)

- Un-mark **paid** on the few still-open 2026 invoices (invoice → clear paid date).
- Categorize the ~100 brands sitting in "Uncategorized".
- Link renewal chains (license → Renewed →) — the dashboard renewal rate reads
  near-zero until he does.
- The 04/2026 CG "World's on Fire" broadcast license got **no** royalty reminder
  (the import fires no reminder rules) — chase that registration manually.

## VPS notes

- SSH: `ssh -i ~/.ssh/id_charlie root@134.209.112.87`, repo checkout at `~/ledger`.
- Prod compose: `docker compose -f infra/docker/docker-compose.yml --env-file infra/docker/.env.production ...`
- The import can also run **on the VPS** from `~/ledger` (it has a full checkout):
  same commands, with `DATABASE_URL` built from the container IP as above.
- nginx fronts everything: `ledger.charliefoltz.com → 127.0.0.1:3000`,
  `api-ledger.charliefoltz.com → 127.0.0.1:5000`. A 502 after a redeploy usually
  means a vhost proxies to a stale container IP instead of the loopback port.
