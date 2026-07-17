# WFH Import — Prod Runbook

How to run the work-for-hire sales import (`apps/api/src/scripts/import-wfh.ts`,
ADR-0010, CONTEXT.md "WFH import") against the production database, and how to
do the needs-review round trip when Charlie returns brand/track names. Commands
are fish-shell, run from the repo root unless noted. Secrets are read from
`infra/docker/.env.production` (gitignored — keep it in sync with the VPS copy).

> **Before running ANY script here:** `pnpm --filter @workspace/shared build`.
> `@workspace/shared` resolves to its built `dist/` at runtime while types come
> from `src/` — a stale dist typechecks green but silently misbehaves (this
> corrupted the first prod license import; both import scripts abort on a
> stale dist).

Source file: `WFH Sales Data 2020-2026.csv` (QuickBooks "Sales by
Product/Service Detail", "Final" product group) — **48 data rows,
$266,337.50 total**. Unlike the license export it has no Brand / Track /
Usage / Term / Exclusivity columns; the Brand and the handful of rows whose
description states its own terms are curated in the script's `CURATED` table.
Everything else defaults to **all media / perpetual / work for hire**.

Since ADR-0013 the **track is optional**: an unambiguous catalog match (or a
track_name completion) links it; every other brand-resolved row imports
**trackless** and renders as "WFH × Brand". Only an unresolved brand blocks a
row into needs-review — no placeholder or umbrella tracks are ever created.

## Prerequisites (once)

- The license import (ADR-0008) has already run — catalog, payers, and most
  brands exist. The script aborts if the catalog has fewer than 100 tracks.
- The ADR-0013 migration (`0014_stale_king_bedlam.sql`, `track_id` DROP NOT
  NULL) is applied — deploy the current build (migrations run on API boot) or
  run `pnpm db:migrate` against prod before importing.

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
pnpm import:wfh -- "$HOME/Downloads/Charlie Exports/WFH Sales Data 2020-2026.csv" \
  --out ~/foltz-wfh-out
```

History: the first prod run (2026-07-14, pre-ADR-0013) imported only "Click
Click" (the lone auto-match) and parked 47 rows in review. Re-run expectation
after ADR-0013: **43 imported (all trackless), 4 needs review (brand only),
1 skipped (already imported)**. One transaction — any failure rolls back
everything; already-imported rows are always skipped (idempotent), so
re-running is never destructive.

Outputs in `~/foltz-wfh-out/`:

- `needs-review.csv` — send to Charlie. He fills **brand_name** where it's
  blank (4 rows: FFing Vote, Ben's Final, the A&E cue batch, the Treefort
  podcast cues); a prefilled brand_name can be corrected — his value wins
  over the curated one. **track_name is optional** (ADR-0013): filled, it
  links that catalog track at import; blank, the row imports trackless.
  Rows with no brand simply never import.
- `match-audit.csv` — every imported row's brand/track/terms, for spot-checks;
  a blank `matched_track` means the row imported trackless ("WFH × Brand").

## 4. Close the tunnel

```fish
pkill -f "15432:172.18.0.2"   # match the IP you tunneled to
```

## 5. The round trip (when Charlie returns the CSV)

1. Only **brand_name** is required. If he also named tracks, they must exist
   in the catalog first (the import never creates tracks; a completion must
   match an existing track, case-insensitively, or the row stays in review).
   Track links for **already-imported** rows can't come back through the CSV —
   idempotency skips them; he links those in the app via the license edit.
2. Re-open the tunnel (§1–2), then re-run with his file:

```fish
cd apps/api
pnpm import:wfh -- "$HOME/Downloads/Charlie Exports/WFH Sales Data 2020-2026.csv" \
  --completions ~/Downloads/<charlies-filled-file>.csv \
  --out ~/foltz-wfh-out
```

Everything already imported is skipped; only resolved rows import. A fresh
`needs-review.csv` is emitted with whatever still isn't resolvable — repeat as
completions trickle in. When done, Σ imported fees must equal **$266,337.50**.

## Post-import follow-ups (Charlie, in the app)

- Un-mark **paid** on any still-open invoice (the 03/2026 Capital One renewal
  is the only plausible candidate).
- Categorize new brands sitting in "Uncategorized".
- Link tracks on the reduced set of WFH works that did become catalog tracks
  (edit the license, pick the track — optional garnish, ADR-0013).
- Link renewal chains: "Serta (Relicense)", "Beautyrest → Beautyrest -
  Relicense 1 yr", "Speed Dial - Capital One → (Renewal)".
- The 06/2024 UPS "Guarantee Store" row's terms include broadcast usage but
  fired **no** broadcast-royalty reminder (imports fire no reminder rules) —
  chase registration manually if still relevant.

## VPS notes

Same as the license import runbook (`docs/license-import-runbook.md` §VPS
notes): SSH `ssh -i ~/.ssh/id_charlie root@134.209.112.87`, checkout at
`~/ledger`, or run the import on the VPS directly with `DATABASE_URL` built
from the container IP.
