# Historical License Import — Implementation Spec

> Status: **IMPLEMENTED** (2026-07-03) — `apps/api/src/scripts/import-licenses.ts`, run via
> `pnpm import:licenses -- <source.csv> [--completions <needs-review.csv>] [--out <dir>]`.
> Charlie's answers: `docs/answers.md` (to `docs/questions.md`). Design decisions: ADR-0008.
> Verified against the real catalog: 253 rows → 174 imported (incl. 1 via a test completion),
> 79 in needs-review awaiting Charlie's track names; idempotent re-run imports 0.
> This is a one-off backfill **script** (no UI/button), idempotent and transactional.

## Source data

File: `~/Downloads/License Data 2020-2026 - License Sales Data 2020-2026(1).csv`
(QuickBooks "Sales by Product/Service Detail" export.)

- Header is on **row 5** (0-indexed 4). A "License" section header row precedes the data.
- Data rows: lines where col `Transaction type` == `License` and the date col is non-empty.
- **253 license rows**, Oct 2020 → Jun 2026.
- Columns (0-indexed): `[0]`(blank section) `[1]`Transaction date (MM/DD/YYYY) `[2]`type
  `[3]`Num `[4]`Customer full name `[5]`Brand `[6]`Track `[7]`Usage `[8]`Term
  `[9]`Exclusivity `[10]`Quantity `[11]`Sales price `[12]`Amount `[13]`Balance.

### Data realities (from analysis — re-verify with the parser snippet at bottom)
- **Customer (col 4)**: only **16 distinct**, all real music-house/agency names
  (MAPS ×83, Sounds Delicious ×59, The Elements Music + Sound ×16, Woolly Music ×16,
  Overcoast ×16, Gareth Smith (Personal) ×13, Terrorbird ×11, Yessian Music ×10,
  Swell Music ×9, TINY LION ×7, Songs For Film and TV ×5, Marmoset ×2, …). These are the **payers**.
- **Brand (col 5)**: **102 distinct**, incl. 6 literally named "Unknown".
- **Num (col 3)**: 23 values reused across 66 rows (e.g. 1067 ×3 = three different
  tracks/brands/amounts). Historical multi-line invoices — we cannot represent them.
- **Usage (col 7)**: always populated (no blanks). Cleaned distinct:
  Digital Media 114, All Media 36, Social Media 26, "Digital Media, Internal" 25,
  Internal 17, Film/ TV Show 9, Broadcast 7, "Digital Media, Social Media" 7, Radio 4,
  plus typos "All media" 2 / "Digial Media" 2 and a few 3-way combos. Comma = multi-value.
- **Term (col 8)**: **130 blank (51%)**. Non-blank: 1 year 50, 6 months 37, Perpetual 13,
  3 months 5, 2 years 5, 2 months 2, 1 month 2, 5 years 2, and one-offs 6 weeks / 13 weeks /
  1 day, plus combo "6 months, Perpetual" ×1.
- **Exclusivity (col 9)**: **231 blank (91%)**. Full Exclusive 8, Nonexclusive 4,
  "Category Exclusive: <Fast Food|Automotive|Tech|Hemophilia|Discount Retail|Car Companies|
  Computers|Online Job Search…>" 8 (1 each), Exclusive 1, WFH Buyout 1.
- **Fee**: use **`Amount` (col 12)** — never empty. 3 rows are `0` (Intermix/"Playup //
  Lovesick + Uprising", Sage/"Cross Pollenate", LinkedIn/"High Fives All Around").
  `Sales price` (col 11) has 3 blanks; ignore it. `Balance` is a running cumulative
  total — NOT a per-invoice paid flag.

## Schema touchpoints (Drizzle, `apps/api/src/common/database/schema/`)

- `enums.ts` — `usageType`, `termLength`, `exclusivityTier` (edits below; needs migration).
- `license.ts` — `track` for table `license`: trackId/brandId/payerId (all NOT NULL,
  RESTRICT), `usageTypes` = `usage_type[]` NOT NULL, `exclusivityTier` NOT NULL,
  `termLength` NOT NULL, `fee` numeric(12,2), `startDate` (date) NOT NULL, `endDate` (date,
  null=perpetual), `renewedToId` (self-FK), `notes` (private), `terms` (snapshots → invoice
  description), `createdBy`.
- `invoice.ts` — auto-issued, exactly one source (license XOR demo). `number` gapless from
  `app_setting` under row lock. `billToName` NOT NULL (+ email/address) frozen from payer.
  `amount`, `description` NOT NULL, `issueDate`, `dueDate` (default issue+30), `paidDate`
  (present ⇒ Paid; null ⇒ Unpaid/Overdue), `voidedAt`. Partial-unique: ≤1 live invoice per
  license. Status is **derived**, never stored.
- `track.ts` — name is case-insensitive unique natural key.
- `payer.ts` — name case-insensitive unique; email/address nullable.
- `brand.ts` — `categoryId` **NOT NULL**, RESTRICT; name case-insensitive unique.
- `brand-category.ts` — name case-insensitive unique; created on the fly.
- Reference how the existing track import inserts (commit `3dec108`, `seed-tracks.ts`,
  `POST /tracks/import`) for the bulk-insert / onConflictDoNothing pattern and `db` usage.
- Read CONTEXT.md domain section + `docs/adr/` (ADR-0001/0002 invoice rules,
  ADR-0003 terms→description, ADR-0004 usage array).

## Decided implementation

### Enum migrations (we DO edit enums to fit the sheet)
- **usageType**: add `all_media`, `film_tv`, `radio`. **Keep** `internet` (sheet never uses
  it; dropping is a destructive no-benefit migration). "All Media" = its own single value,
  NOT exploded. Normalize typos → digital_media / all_media.
- **termLength**: add `three_months`, `two_months`, `one_month`, `five_years`, `six_weeks`,
  `thirteen_weeks`, `one_day` (keep existing six_months/one_year/two_years/three_years/perpetual).
  Compute `endDate` exactly from `startDate` + term; `perpetual` ⇒ `endDate = null`.
- **exclusivityTier**: no new values. Mapping below.

### Row → records
For each of the 253 rows (one **License** + one **Invoice** each, ignoring shared Num):

1. **Payer**: link-or-create by Customer name (16 total). email/address = **NULL** (do not
   fabricate). Dedup case-insensitively (matches `payer_name_uq`).
2. **Brand**: link-or-create by Brand name (102) under a single created
   `brand_category` named **"Uncategorized"**. The 6 "Unknown" rows → one brand "Unknown".
3. **Track**: match catalog track names against the **Track text** — word-boundary,
   case-insensitive, longer-name occurrences subsume contained shorter ones. The matcher
   **only acts when exactly one track matches** (NOT longest-match-wins: 14 rows license
   several tracks at once — see ADR-0008). **Never create tracks.** No match / several
   matches ⇒ do NOT import; write to `needs-review.csv` (with candidates pre-listed) for
   Charlie to fill `track_name`; re-run with `--completions` imports those rows. A
   completion must equal an existing track name (case-insensitive) or the row stays in
   review. Log every match (track ↔ matched text) in `match-audit.csv`.
4. **usageTypes**: split col 7 on comma, map each token to the enum (incl. new values),
   normalize typos. Always ≥1.
5. **exclusivityTier**: blank ⇒ `non_exclusive`; "Full Exclusive"⇒`full_exclusive`;
   "Nonexclusive"⇒`non_exclusive`; "Category Exclusive: X"⇒`category_exclusive` (keep "X"
   label in `terms`); "WFH Buyout"⇒`work_for_hire`; "Exclusive"⇒`full_exclusive`.
6. **termLength**: map col 8 to enum. **Blank ⇒ 1 year (Charlie's Q1 answer).**
   Combo "6 months, Perpetual" ⇒ **perpetual** (the broader read; raw kept in notes).
   Sheet variants "6 month"/"2 year" map like their plurals.
7. **fee** = `Amount` (col 12), parse "1,234.56"; `0` allowed (import normally).
8. **startDate** = transaction date (MM/DD/YYYY). **endDate** = start + term (null if perpetual).
9. **terms** (→ invoice description): full original **Track** text + category-exclusive label.
10. **notes** (private): `Imported from License Data CSV · original invoice #<Num> ·
    original term "<raw>" · original usage "<raw>"` — this is where the old Num lives.
11. **renewedToId**: leave null (no auto-linking).
12. **createdBy**: first user found in `user` table (fallback null).

### Invoice
- Auto-issue alongside the license (one per license). `number` from the gapless allocator —
  **do NOT preserve the QuickBooks Num**.
- `issueDate` = transaction date, `dueDate` = issue + 30.
- `billToName` = payer name (email/address null).
- `amount` = fee. `description` = the `terms` text (per ADR-0003 snapshot).
- **`paidDate`**: transaction date for all (treat historical as collected); affects
  cash-basis report only. Charlie un-marks the few still-open 2026 ones **in the app**
  (invoice detail → clear paid) — his planned paid/active sheet re-tagging is NOT re-read.

### Script behavior
- One **transaction**; **idempotent** — stable per-row key = hash of
  date+num+brand+track+amount, recorded in provenance; skip already-imported rows on re-run.
- Hard **prerequisite check**: real track catalog populated, else abort.
- Emits: (a) match audit log, (b) `needs-review` CSV of no-match rows.

## Resolutions (Charlie's answers in `docs/answers.md` + grilling session 2026-07-03)
- Q1: blank term ⇒ **1 year**. Unblocked.
- Q2: import all as Paid; Charlie un-marks still-open ones in-app (not via the sheet).
- Q3: old invoice numbers not preserved — confirmed fine; kept in notes.
- Q4: no-match rows go to the **needs-review CSV round trip** (Charlie fills track names).
- Q5: brand categorization is Charlie's post-import follow-up.
- Q6: exclusivity mappings confirmed. Sheet also contains "Category Exclusivity: X" —
  mapped like "Category Exclusive: X".
- "6 months, Perpetual" combo (never actually sent as a question) ⇒ **perpetual**.
- Payer abbreviations (MAPS, TINY LION) import verbatim; renameable in-app.

## Deliberate side effects (see ADR-0008)
- No broadcast-royalty reminders for imported licenses (all 8 would be born overdue).
- `renewedToId` stays null ⇒ dashboard renewal rate reads near-zero until Charlie links
  chains in-app.
- Charlie's follow-ups: fill needs-review CSV, categorize brands, un-mark unpaid 2026
  invoices, link renewals, chase the 04/2026 CG broadcast royalty registration.

## Re-run the data analysis (Python, stdlib only)
```python
import csv
from collections import Counter
f="/home/santiagoberoch/Downloads/License Data 2020-2026 - License Sales Data 2020-2026(1).csv"
rows=list(csv.reader(open(f)))
hdr=next(i for i,r in enumerate(rows) if 'Transaction date' in r)   # ==4
data=[r for r in rows[hdr+1:] if len(r)>=10 and r[1].strip() and r[2].strip()=='License']
# col indices: 3 Num, 4 Customer, 5 Brand, 6 Track, 7 Usage, 8 Term, 9 Exclusivity, 12 Amount
for idx in (7,8,9):
    print(idx, Counter(r[idx].strip() for r in data).most_common())
```
