# Demo Import — Prod Runbook

How to run the demo sales import (`apps/api/src/scripts/import-demos.ts`,
ADR-0011, CONTEXT.md "Demo import") against the production database, and how
to do the needs-review round trip. Commands are fish-shell, run from the repo
root unless noted. Secrets are read from `infra/docker/.env.production`
(gitignored — keep it in sync with the VPS copy).

> **Before running ANY script here:** `pnpm --filter @workspace/shared build`.
> `@workspace/shared` resolves to its built `dist/` at runtime while types come
> from `src/` — a stale dist typechecks green but silently misbehaves (this
> corrupted the first prod license import; all import scripts abort on a
> stale dist).

Source file: `Demo Sales Data 2020-2026.csv` (QuickBooks "Sales by
Product/Service Detail", "Demo" product group) — **364 data rows,
$118,141.37 total**. Like the WFH export it has no Brand column (only the
paying music house); unlike it there is **no Track dimension at all** — Demos
reference no Track, so there is no matcher and no track_name completion
column. The Brand for every row is curated in the script's `CURATED` table;
2 rows are `null` and round-trip through needs-review.

## Prerequisites (once)

- The license import (ADR-0008) has already run — payers and most brands
  exist. The script aborts if the payer table has fewer than 10 payers
  (empty/mock DB guard). It does **not** need the track catalog.
- Order relative to the WFH import: **demos run first** (grilled 2026-07-14);
  the pending WFH prod run follows independently. Only invoice-number
  interleaving is affected — cosmetic.

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

# Must print a real payer count (dozens), not 0 or a handful (empty / mock):
psql $DATABASE_URL -t -A -c "select count(*) from payer;"
# Demos existing before the import (Charlie may have created post-launch ones):
psql $DATABASE_URL -t -A -c "select count(*) from demo;"
```

## 3. Run the import

```fish
cd apps/api
pnpm import:demos -- "$HOME/Downloads/Charlie Exports/Demo Sales Data 2020-2026.csv" \
  --out ~/foltz-demo-out
```

First-run expectation: **362 imported, 2 needs review, 0 skipped** — the
inverse of WFH: demo descriptions mostly *are* the brand name, so nearly
everything imports directly. One transaction — any failure rolls back
everything; already-imported rows are always skipped (idempotent), so
re-running is never destructive.

Outputs in `~/foltz-demo-out/`:

- `needs-review.csv` — send to Charlie. He fills **brand_name** for the 2
  rows: the 2020 "Yessian Demos" $1,150 lump and 2024's "Squarespace Edit -
  Infiniti" (ambiguous between two brands). Rows left blank simply never
  import.
- `match-audit.csv` — every imported row's payer/brand/fee, for spot-checks.
  Worth scanning the three same-invoice inferences (1093|Vocalist Demo →
  Bath and Body Works, 1587|Additional Edits → Lincoln, 1591|Vocal Demo →
  Kraft) and the spelling normalizations (see the script's curation-policy
  comment).

## 4. Close the tunnel

```fish
pkill -f "15432:172.18.0.2"   # match the IP you tunneled to
```

## 5. The round trip (when Charlie returns the CSV)

Re-open the tunnel (§1–2), then re-run with his file (brands are created on
the fly under "Uncategorized" — nothing to pre-create, unlike tracks):

```fish
cd apps/api
pnpm import:demos -- "$HOME/Downloads/Charlie Exports/Demo Sales Data 2020-2026.csv" \
  --completions ~/Downloads/<charlies-filled-file>.csv \
  --out ~/foltz-demo-out
```

Everything already imported is skipped; only resolved rows import. When done,
Σ imported fees must equal **$118,141.37**.

## Post-import follow-ups (Charlie, in the app)

- Un-mark **paid** on any demo invoice not actually paid yet — plausible
  candidates are only the May–June 2026 tail (the file was exported
  2026-06-19; e.g. the 06/16 WhatsApp row).
- Categorize new brands sitting in "Uncategorized" (~150 new consumer brands).
- The dashboard's **Ready to reuse** panel now lists every imported demo,
  oldest first — expected (ADR-0011). Convert or ignore at leisure; if the
  flood is unworkable, that's a dashboard product change to raise, not a data
  fix.

## VPS notes

Same as the license import runbook (`docs/license-import-runbook.md` §VPS
notes): SSH `ssh -i ~/.ssh/id_charlie root@134.209.112.87`, checkout at
`~/ledger`, or run the import on the VPS directly with `DATABASE_URL` built
from the container IP.
