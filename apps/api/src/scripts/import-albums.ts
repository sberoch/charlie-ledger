import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isNull, sql } from 'drizzle-orm';
import { db } from '../common/database/db';
import { album, track } from '../common/database/schema';

/**
 * One-off album backfill from Charlie's production-library ingestion sheet
 * (CONTEXT.md "Album"; docs/album-import-runbook.md).
 *
 *   pnpm import:albums -- <metadata.csv> [--dry-run] [--allow-small-catalog]
 *
 * Reads TRACKTITLE + ALBUM, matches titles to the catalog case-insensitively
 * (exact, trimmed — every row of the 2026 sheet matches this way), creates
 * each distinct album name (trimmed, pick-or-create by lower(name)) and
 * assigns it FILL-ONLY: a track that already carries an album is left alone
 * and reported. Tracks absent from the sheet stay "No album" — that is the
 * custom-written / stub bucket, by design. Idempotent: a re-run finds nothing
 * left to fill.
 */

// ── CSV (RFC 4180: quoted fields, embedded commas, "" escapes) ──────────────

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--');
  const dryRun = args.includes('--dry-run');
  // The <100-track guard keeps a stray run off the local demo seed; the flag
  // is for exercising the script against that seed on purpose.
  const allowSmall = args.includes('--allow-small-catalog');
  const file = args.find((a) => !a.startsWith('--'));
  if (!file) {
    console.error('usage: pnpm import:albums -- <metadata.csv> [--dry-run]');
    process.exit(1);
  }

  const text = readFileSync(resolve(file), 'utf8').replace(/^\uFEFF/, '');
  const [header, ...rows] = parseCsv(text).filter((r) =>
    r.some((c) => c.trim() !== ''),
  );
  const col = (name: string) => {
    const i = header.findIndex((h) => h.trim().toUpperCase() === name);
    if (i < 0) throw new Error(`Missing column ${name}`);
    return i;
  };
  const TITLE = col('TRACKTITLE');
  const ALBUM = col('ALBUM');

  // title(lower) → album name; a title appearing twice must agree.
  const wanted = new Map<string, { title: string; album: string }>();
  let blankAlbum = 0;
  for (const r of rows) {
    const title = (r[TITLE] ?? '').trim();
    const albumName = (r[ALBUM] ?? '').trim();
    if (!title) continue;
    if (!albumName || /^n\/?a$/i.test(albumName)) {
      blankAlbum++;
      continue;
    }
    const prev = wanted.get(title.toLowerCase());
    if (prev && prev.album.toLowerCase() !== albumName.toLowerCase())
      throw new Error(
        `"${title}" listed under two albums: "${prev.album}" / "${albumName}"`,
      );
    wanted.set(title.toLowerCase(), { title, album: albumName });
  }

  const catalog = await db
    .select({ id: track.id, name: track.name, albumId: track.albumId })
    .from(track);
  if (catalog.length < 100 && !allowSmall)
    throw new Error(
      `Catalog has ${catalog.length} tracks — is DATABASE_URL pointed at prod?`,
    );
  const byName = new Map(catalog.map((t) => [t.name.toLowerCase(), t]));

  const existingAlbums = await db
    .select({ id: album.id, name: album.name })
    .from(album);
  const albumIdByName = new Map(
    existingAlbums.map((a) => [a.name.toLowerCase(), a.id]),
  );

  const toCreate = new Map<string, string>(); // lower → display name
  const assign: Array<{ trackId: string; title: string; album: string }> = [];
  const keep: Array<{ title: string; album: string }> = [];
  const unmatched: string[] = [];
  for (const { title, album: albumName } of wanted.values()) {
    const t = byName.get(title.toLowerCase());
    if (!t) {
      unmatched.push(title);
      continue;
    }
    if (t.albumId) {
      keep.push({ title: t.name, album: albumName });
      continue;
    }
    const key = albumName.toLowerCase();
    if (!albumIdByName.has(key) && !toCreate.has(key))
      toCreate.set(key, albumName);
    assign.push({ trackId: t.id, title: t.name, album: albumName });
  }
  const untouched = catalog.filter(
    (t) => !wanted.has(t.name.toLowerCase()) && !t.albumId,
  );

  console.log(
    `sheet rows with an album: ${wanted.size} (blank/N/A: ${blankAlbum})`,
  );
  console.log(`catalog tracks: ${catalog.length}`);
  console.log(`albums to create: ${toCreate.size}`);
  for (const name of toCreate.values()) console.log(`   + ${name}`);
  console.log(`tracks to assign: ${assign.length}`);
  console.log(`tracks already carrying an album (left alone): ${keep.length}`);
  for (const k of keep)
    console.log(`   = ${k.title} (sheet says "${k.album}")`);
  console.log(`sheet titles not in catalog: ${unmatched.length}`);
  for (const u of unmatched) console.log(`   ? ${u}`);
  console.log(
    `album-less catalog tracks not in sheet → stay "No album": ${untouched.length}`,
  );
  for (const u of untouched) console.log(`   - ${u.name}`);

  if (dryRun) {
    console.log('\n--dry-run: nothing written');
    return;
  }

  await db.transaction(async (tx) => {
    for (const [key, name] of toCreate) {
      await tx.insert(album).values({ name }).onConflictDoNothing();
      const row = await tx.query.album.findFirst({
        where: sql`lower(${album.name}) = lower(${name})`,
      });
      if (!row) throw new Error(`Album create failed: ${name}`);
      albumIdByName.set(key, row.id);
    }
    for (const a of assign) {
      const albumId = albumIdByName.get(a.album.toLowerCase());
      if (!albumId) throw new Error(`No album id for ${a.album}`);
      // Fill-only, re-checked at write time in case the catalog moved.
      await tx
        .update(track)
        .set({ albumId })
        .where(sql`${track.id} = ${a.trackId} and ${isNull(track.albumId)}`);
    }
  });

  const [{ count }] = (
    await db.execute<{ count: string }>(
      sql`select count(*) from ${track} where ${track.albumId} is not null`,
    )
  ).rows;
  const [{ albums }] = (
    await db.execute<{ albums: string }>(
      sql`select count(*) as albums from ${album}`,
    )
  ).rows;
  console.log(
    `\n✓ done — ${count} tracks now carry an album across ${albums} albums`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
