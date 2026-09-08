# Album import runbook (one-off backfill)

Backfills `track.album_id` from Charlie's production-library ingestion sheet
("Charlie Foltz Production Library 2026 Metadata.csv", columns `ALBUM` +
`TRACKTITLE`). See CONTEXT.md "Album". Script: `apps/api/src/scripts/import-albums.ts`.

What it does:

- Trims album and title; matches titles to the catalog **case-insensitively,
  exact** (all 244 rows of the 2026 sheet match this way).
- Creates each distinct album name (pick-or-create on `lower(name)`).
- Assigns **fill-only**: a track that already carries an album is left alone and
  listed. Re-runs are no-ops.
- Tracks absent from the sheet stay **"No album"** — the custom / stub bucket, by
  design (32 on prod as of 2026-09-08: Places To Be, LOOT, "?", the license-import
  stubs…). Rows whose `ALBUM` is blank or `N/A` are skipped the same way.
- Refuses to run against a catalog under 100 tracks (guards against the local
  demo seed).

## 1. Tunnel to prod

Same as `docs/license-import-runbook.md` §1:

```fish
ssh -i ~/.ssh/id_charlie root@134.209.112.87 \
  "docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' app-prod-postgres"
ssh -i ~/.ssh/id_charlie -f -N -L 15432:<IP>:5432 root@134.209.112.87

set PW (grep '^POSTGRES_PASSWORD=' infra/docker/.env.production | cut -d= -f2)
set -x DATABASE_URL "postgresql://app:$PW@localhost:15432/app"
psql $DATABASE_URL -t -A -c "select count(*) from track;"   # ~276
```

Migration `0016_album` must already be applied (it auto-applies on deploy;
`psql $DATABASE_URL -c '\d album'` should print the table).

## 2. Dry run, then run

```fish
cd apps/api
pnpm import:albums -- "$HOME/Downloads/Charlie Foltz Production Library 2026 Metadata.csv" --dry-run
pnpm import:albums -- "$HOME/Downloads/Charlie Foltz Production Library 2026 Metadata.csv"
```

Expected on the 2026 sheet: 34 albums created, 244 tracks assigned, 0 unmatched,
32 catalog tracks left "No album".

## 3. Verify

```fish
psql $DATABASE_URL -c "select a.name, count(t.id) from album a left join track t on t.album_id = a.id group by a.name order by 2 desc;"
psql $DATABASE_URL -c "select name from track where album_id is null order by name;"
```

Then in the app: Tracks → Album filter should list the albums; Reports → Group by
Album should show Sales / Royalties / Total per album plus a "— No album" row.
