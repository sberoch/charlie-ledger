# How library-focused sync composers operate as a business

Research memo, 2026-07-13. Purpose: understand the business model of composers who work primarily
with production music libraries (vs. composers who license their catalog directly), to inform
outreach positioning for foltz-ledger.

## TL;DR

- **The library, not the composer, is the licensing business.** In library deals the composer hands
  the track to the library; the library registers it (usually as publisher), pitches it, negotiates
  with the end client, issues the sync license, and invoices the client. The composer never sees the
  end client's paperwork. APM, for example, states the client "is never responsible for paying the
  artists directly" ([Music Gateway on APM](https://www.musicgateway.com/blog/music-business/apm-music-review),
  [APM licensing](https://www.apmmusic.com/licensing)).
- **Composer income = (a) optional upfront/work-for-hire fee, (b) a contractual share of sync fees
  the library collects (commonly ~50/50), and (c) backend performance royalties paid by their PRO
  (ASCAP/BMI/SESAC/PRS) — the "writer's share," which flows PRO → composer, never through the
  library** ([That Pitch](https://thatpitch.com/blog/how-production-music-library-contracts-work/),
  [Sound on Sound](https://www.soundonsound.com/music-business/all-about-library-music-part-2),
  [PMA Composer FAQ](https://pmamusic.com/composer-artist-faq/)).
- **Exclusive deals** assign control (often copyright/publishing itself, frequently work-for-hire)
  to one library; **non-exclusive deals** let the composer place the same track in many libraries,
  historically via **re-titling**, a practice the PMA and most major buyers now reject
  ([PMA on retitling](https://pmamusic.com/retitling/)).
- **What a library composer still tracks personally:** which track is in which library and under
  what terms (exclusivity conflicts are career-damaging), PRO work registrations and cue-sheet
  follow-up, metadata delivery to each library, and reconciling royalty statements from multiple
  PROs and libraries against known placements — plus Schedule C / self-employment taxes on 1099
  royalty income.
- **For foltz-ledger:** the "licenses I issue" and "invoices I send" features are largely irrelevant
  to this prospect; the track catalog, exclusivity tracking, and royalty-payment tracking map
  directly onto real pains — if reframed around *library placements* and *statement reconciliation*
  instead of *deals the composer closes*.

## 1. Copyright ownership and who handles licensing

Production music (a.k.a. library or stock music) is music owned end-to-end by libraries precisely so
it can be licensed in one stop. Unlike mainstream publishers, "production music libraries own all of
the copyrights of their music... virtually all music created for music libraries is done on a
work-for-hire basis," so the library can license without asking the composer
([Wikipedia: Production music](https://en.wikipedia.org/wiki/Production_music)).

- **Work-for-hire / assignment in exclusive deals.** Under US copyright law, when a track is a
  commissioned work-for-hire the library "becomes the initial author and owner of the copyright"
  ([That Pitch](https://thatpitch.com/blog/how-production-music-library-contracts-work/); see also
  [Songtrust on work-for-hire](https://help.songtrust.com/knowledge/what-does-it-mean-when-a-song-is-a-work-for-hire)).
  Even where the deal is framed as exclusive representation rather than WFH, exclusive libraries
  typically take "ownership of the publishing share, and occasionally the master rights," register
  the work at the PRO under their publishing entity, and control "all licensing and usage"
  ([Music Library Report](https://musiclibraryreport.com/composer-tips/exclusive-non-exclusive-music-libraries/)).
  UK/international exclusive publishing deals commonly assign copyright "for the life of copyright"
  ([Sound on Sound](https://www.soundonsound.com/music-business/all-about-library-music-part-2)).
- **Non-exclusive deals** leave the underlying composition and master copyright with the composer;
  the library merely holds a license to represent and exploit the track
  ([That Pitch](https://thatpitch.com/blog/how-production-music-library-contracts-work/)).
- **In every variant, the library faces the client.** The library negotiates terms, issues the sync
  license (single-use, blanket, or subscription), and collects the fee. APM: clients license from
  the catalog and are "never responsible for paying the artists directly"
  ([Music Gateway](https://www.musicgateway.com/blog/music-business/apm-music-review),
  [APM licensing](https://www.apmmusic.com/licensing)). The composer is not a party to the
  end-client license and does not invoice the client.

## 2. Money flow

Three streams, none of which involve the composer invoicing a film/TV/ad client:

1. **Upfront fee (sometimes).** Some libraries — more common in the US — pay a per-track
   work-for-hire fee (reportedly $1,000+ at major US libraries), often in exchange for the composer
   waiving future sync-fee shares
   ([Sound on Sound](https://www.soundonsound.com/music-business/all-about-library-music-part-2),
   [Wikipedia](https://en.wikipedia.org/wiki/Production_music)).
2. **Sync-fee share paid out by the library.** The library invoices the client, collects the sync
   fee, and remits the composer's contractual share on a statement — commonly 50/50, sometimes
   60/40 or 70/30 in the composer's favor, and at some publishers as low as 25% to the composer
   ([That Pitch](https://thatpitch.com/blog/how-production-music-library-contracts-work/),
   [Sound on Sound](https://www.soundonsound.com/music-business/all-about-library-music-part-2)).
   APM says it gives composers "about half of all licensing fees"
   ([Music Gateway](https://www.musicgateway.com/blog/music-business/apm-music-review)). Some
   contracts also let the library recoup recording costs or "marketing offsets" before paying out
   ([Sound on Sound](https://www.soundonsound.com/music-business/all-about-library-music-part-2)).
3. **Backend performance royalties direct from the PRO.** When the production airs, broadcasters
   pay the PROs, which split performance income 50% writer's share / 50% publisher's share. The
   composer keeps 100% of the writer's share and is paid directly by ASCAP/BMI/SESAC/PRS; the
   library collects the publisher's share. Libraries "are generally NOT responsible for collecting
   or distributing performance royalties directly to you"
   ([Sync Songwriter](https://syncsongwriter.com/blog/sync-fee-royalties-explained),
   [That Pitch](https://thatpitch.com/blog/performance-royalties-vs-sync-fees-explained/),
   [PMA Composer FAQ](https://pmamusic.com/composer-artist-faq/)). For a network TV placement,
   backend royalties can equal or exceed the sync fee over a series' run
   ([Sync Songwriter](https://syncsongwriter.com/blog/sync-fee-royalties-explained)). PRO money also
   arrives late — typically 12–18 months after the performance quarter
   ([Trolley](https://trolley.com/learning-center/navigating-the-complex-world-of-music-royalties-understanding-irs-taxation-for-music-payouts/)).

Even the PMA's own composer FAQ concedes that "most composers, artists, and producers that create
production music never really understand how exactly their payments are calculated"
([PMA Composer FAQ](https://pmamusic.com/composer-artist-faq/)) — the payout depends on usage type,
length, ratings, and where it aired, which is exactly why statement reconciliation is a real chore.

## 3. Exclusive vs. non-exclusive deals, and re-titling

- **Exclusive:** one library has the sole right to pitch, license, and administer the track, usually
  registering it at the PRO under the library's publishing entity; the composer can't pitch it
  elsewhere or license it directly. Upside: premium pricing, broadcaster relationships, cleaner
  metadata; downside: loss of control, often for the life of copyright
  ([Music Library Report](https://musiclibraryreport.com/composer-tips/exclusive-non-exclusive-music-libraries/),
  [Sound on Sound](https://www.soundonsound.com/music-business/all-about-library-music-part-2)).
  Reversion/termination clauses matter: already-granted licenses survive, and unlicensed tracks
  revert after a "pipeline period"
  ([That Pitch](https://thatpitch.com/blog/how-production-music-library-contracts-work/)).
- **Non-exclusive:** the composer keeps ownership and can place the same track in multiple
  libraries, pitch directly, or sell from their own site
  ([Music Library Report](https://musiclibraryreport.com/composer-tips/exclusive-non-exclusive-music-libraries/)).
- **Re-titling:** the historical mechanism that made non-exclusivity workable — each library
  registers the same audio at the PRO under a different title with itself as publisher (e.g.
  "I Love You_XYZ"), so each can claim publisher's share on its own placements
  ([PMA](https://pmamusic.com/retitling/)). The PMA documents the fallout: multiple parties claiming
  the same work, audio fingerprinting (TuneSat, Soundmouse, BMAT) unable to link a detection to a
  unique title, misrouted royalties, foreign societies refusing non-exclusive catalogs, and major
  studios declaring they "will only work with music companies that represent their content
  exclusively" ([PMA](https://pmamusic.com/retitling/),
  [MUSCO Sound, "The Retitling Trap"](https://www.michaelmusco.com/2026/06/the-retitling-trap.html)).
- **Path dependence:** a track placed non-exclusively is effectively poisoned for future exclusive
  deals — "no reputable exclusive library is going to acquire a track that already exists in other
  permutations in the marketplace"
  ([Music Library Report forum](https://musiclibraryreport.com/forums/topic/exclusive-vs-non-exclusive-strategy/)).
  This is why composers must track, per track, exactly which libraries hold it and under what terms.

## 4. What a library composer still personally administers

Publishers/libraries handle client licensing and collection, but "composers must track where music
is placed and monitor earnings statements, particularly with multiple libraries"
([Sound on Sound](https://www.soundonsound.com/music-business/all-about-library-music-part-2)).
Concretely:

- **Catalog-to-library mapping and exclusivity conflicts.** Which track is in which library,
  exclusive or not, retitled as what, signed when, with what reversion terms. Getting this wrong —
  submitting an already-placed track to an exclusive library — creates registration conflicts and
  reputational damage
  ([Music Library Report](https://musiclibraryreport.com/composer-tips/exclusive-non-exclusive-music-libraries/),
  [PMA](https://pmamusic.com/retitling/)).
- **PRO membership and work registrations.** The composer must belong to a PRO before signing with
  libraries so tracks "can be registered correctly" ([PMA FAQ](https://pmamusic.com/composer-artist-faq/)).
  A registration by either writer or publisher credits both, but in exclusive deals the library
  registers under its entity and in non-exclusive deals registration often falls to the composer —
  so the composer must verify every work actually got registered, with correct splits and spellings
  ([Orfium cue sheet guide](https://www.orfium.com/cue-sheets/cue-sheets-guide-tv-film-music-licensing/),
  [Music Library Report](https://musiclibraryreport.com/composer-tips/exclusive-non-exclusive-music-libraries/)).
- **Cue sheets.** Filed by the production company, not the composer — but cue sheets are "the only
  way PROs can keep track of when your music is used," so composers chase confirmations and verify
  titles/timings/splits, because errors silently kill backend royalties
  ([ReelCrafter](https://www.reelcrafter.com/blog/everything-you-need-to-know-about-cue-sheets-and-music-royalties),
  [ASCAP Cue Sheet Corner](https://www.ascap.com/help/royalties-and-payment/cue-sheets)).
- **Metadata delivery.** Each library wants tracks delivered with its own metadata schema (titles,
  alt mixes/stems, mood/genre tags, PRO/IPI info); embedded metadata errors propagate into cue
  sheets and statements
  ([ReelCrafter](https://www.reelcrafter.com/blog/everything-you-need-to-know-about-cue-sheets-and-music-royalties),
  [Orfium](https://www.orfium.com/cue-sheets/cue-sheets-guide-tv-film-music-licensing/)).
- **Statement reconciliation across many payers.** Quarterly PRO statements (possibly from more than
  one society plus foreign sub-collections), plus per-library sync-share statements, must be
  cross-checked against known placements and detections (e.g. TuneSat); "rights owners end up having
  to decipher their royalty statements to ensure all of their activity, as reported on cue sheets,
  has been accounted for," and things break "when cue sheets, registrations, licensing records...
  and royalty statements no longer point toward the same work"
  ([Orfium](https://www.orfium.com/cue-sheets/cue-sheets-guide-tv-film-music-licensing/),
  [MUSCO Sound](https://www.michaelmusco.com/2026/06/the-retitling-trap.html)).
- **Taxes.** Royalty and fee income for a working composer is ordinary Schedule C income subject to
  self-employment tax; each PRO and library issuing over the threshold sends a 1099 (PRO royalties
  typically on 1099-MISC box 2), and the 12–18 month PRO payment lag complicates year-to-year
  attribution
  ([1-800Accountant](https://1800accountant.com/blog/income-taxes-for-music-streaming-royalties),
  [Trolley](https://trolley.com/learning-center/navigating-the-complex-world-of-music-royalties-understanding-irs-taxation-for-music-payouts/),
  [Songtrust](https://blog.songtrust.com/songwriters-dont-let-tax-day-leave-you-singing-the-blues)).

## Implications for foltz-ledger

The prospect is right that their model differs — but only half of the product is about the model
they lack.

**Features that are irrelevant (or nearly so) for a library-focused composer:**

- **Sync licenses issued to clients (with exclusivity terms and expiry reminders).** The library
  issues the license and holds the client relationship; the composer never issues one. Expiry
  reminders on client licenses have no one to remind.
- **Invoices sent to clients.** The library invoices; the composer at most invoices a library for a
  work-for-hire fee, which is a trivial, occasional event, not a workflow.

**Features that map directly, possibly with reframing:**

- **Track catalog → multi-library placement tracking.** The catalog is still the composer's core
  asset inventory. The needed pivot: per track, record *which library holds it*, exclusive vs.
  non-exclusive, retitled name and library-side ID, signing date, and reversion/pipeline terms. The
  existing exclusivity model is the seed of the killer feature here: **exclusivity-conflict
  detection** ("this track is already in an exclusive deal — don't submit it to library X"), since a
  mistake there is close to irreversible.
- **Royalty payments received → multi-payer statement aggregation.** This is the strongest existing
  fit. A library composer's income is a stream of PRO distributions (possibly several societies) and
  library sync-share statements arriving on different cadences with a 12–18 month lag. Aggregating
  them per track/per payer and reconciling against expected placements (did the cue sheet for that
  airing ever show up as money?) is precisely the pain the sources describe.

**What such a composer needs tracked that foltz-ledger doesn't model today:**

- Library agreements as first-class entities (terms, splits, exclusivity scope, reversion dates —
  reversion reminders are the library-world analogue of license-expiry reminders).
- PRO work registrations per track (registered? by whom? under which title(s)?) and cue-sheet
  follow-up status per placement.
- Retitle aliases: one recording, N titles across libraries and PRO registrations.
- Writer-share income reconciliation: expected vs. received per placement, per PRO, per quarter.

**Outreach framing:** "You don't issue licenses or invoices — your libraries do. But you're the only
person who knows which of your 400 tracks sit in which libraries under which titles, whether the
exclusive deal you're about to sign conflicts with a 2019 non-exclusive placement, and whether the
BMI statement that just arrived actually contains the episodes you know aired." That set of problems
is adjacent to the current product, not identical to it.

## Source list

- [Wikipedia — Production music](https://en.wikipedia.org/wiki/Production_music)
- [PMA — Composer/Artist FAQ](https://pmamusic.com/composer-artist-faq/)
- [PMA — Retitling](https://pmamusic.com/retitling/)
- [That Pitch — How Production Music Library Contracts Work](https://thatpitch.com/blog/how-production-music-library-contracts-work/)
- [That Pitch — Performance Royalties vs Sync Fees Explained](https://thatpitch.com/blog/performance-royalties-vs-sync-fees-explained/)
- [Sound on Sound — All About Library Music: Part 2](https://www.soundonsound.com/music-business/all-about-library-music-part-2)
- [Music Library Report — Exclusive, Non-Exclusive and Semi-Exclusive Music Libraries (+ Retitling)](https://musiclibraryreport.com/composer-tips/exclusive-non-exclusive-music-libraries/)
- [Music Library Report forum — Exclusive vs. Non-Exclusive Strategy](https://musiclibraryreport.com/forums/topic/exclusive-vs-non-exclusive-strategy/)
- [Sync Songwriter — Sync Fee & Sync Royalties Explained](https://syncsongwriter.com/blog/sync-fee-royalties-explained)
- [APM Music — Licensing](https://www.apmmusic.com/licensing)
- [Music Gateway — APM Music review](https://www.musicgateway.com/blog/music-business/apm-music-review)
- [Songtrust — What Does it Mean When a Song is a "Work For Hire"?](https://help.songtrust.com/knowledge/what-does-it-mean-when-a-song-is-a-work-for-hire)
- [ReelCrafter — Everything you need to know about cue sheets and music royalties](https://www.reelcrafter.com/blog/everything-you-need-to-know-about-cue-sheets-and-music-royalties)
- [ASCAP — Cue Sheet Corner](https://www.ascap.com/help/royalties-and-payment/cue-sheets)
- [Orfium — Top 20 Cue Sheet Questions Answered](https://www.orfium.com/cue-sheets/cue-sheets-guide-tv-film-music-licensing/)
- [MUSCO Sound — The Retitling Trap](https://www.michaelmusco.com/2026/06/the-retitling-trap.html)
- [1-800Accountant — Income Taxes for Music Streaming & Royalties](https://1800accountant.com/blog/income-taxes-for-music-streaming-royalties)
- [Trolley — Understanding IRS Taxation for Music Royalties](https://trolley.com/learning-center/navigating-the-complex-world-of-music-royalties-understanding-irs-taxation-for-music-payouts/)
- [Songtrust blog — Songwriters: Don't Let Tax Day Leave You Singing The Blues](https://blog.songtrust.com/songwriters-dont-let-tax-day-leave-you-singing-the-blues)
