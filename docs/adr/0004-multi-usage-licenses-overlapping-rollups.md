# A License grants many Usage Types; usage rollups overlap by design

A **License** now grants its Track across **one or more Usage Types** (e.g. one
A24 deal covering `broadcast` *and* `social_media`), not exactly one. The set is
stored as a Postgres enum array (`usage_type[]`) on `license` — a single column,
normalised on write to a deduped, canonically-ordered, non-empty array. We chose
the array over a `license_usage_type` junction table because nothing aggregates
usage in SQL — every rollup already loads licenses into JS and groups in memory —
so a junction would buy `GROUP BY` we don't use at the cost of joins and
multi-row write churn, for a single-user, ~300-track ledger.

The consequential decision is how a multi-usage fee lands in a **by-usage
rollup** (the Sales Report's `usage_type` grouping and the dashboard's License-mix
widget). A License is still **one fee on one invoice**; only its usage membership
is plural. We count the **full fee toward each Usage Type in the set** (fan-out),
rather than splitting the fee across usages or grouping by the usage *combination*.

The alternatives, and why not:

- **Split/allocate** (fee ÷ N usages) keeps rows summing to the grand total, but
  manufactures a per-usage number Charlie never agreed to. The whole point of a
  by-usage view is "which **media** earn" — a fabricated split answers a question
  with a lie.
- **Combination buckets** (group by the set, e.g. "Broadcast + Social Media")
  keep a clean partition but scatter each medium across many combo rows, so
  "how much did broadcast earn?" — the only reason the grouping exists — becomes
  unanswerable.

Fan-out is the only option that answers the question honestly. Its cost is that
the per-usage **amounts overlap**: each is the full fee of every license that
touches that medium, so they cannot be summed against revenue.

Two surfaces consume this, and they ask different questions, so they present it
differently — both honest, on different denominators:

- The **Sales Report** (cash basis) shows the *absolute overlapping dollars* —
  "broadcast **earned** $X". So `Σ usage rows > grand total`: the grand total
  stays the true Σ of paid invoices, and only the usage rows double-count. The
  Report (CSV + PDF + web) carries a note saying so.
- The **dashboard License-mix donut** asks a *proportional* question — "what's my
  usage mix". A donut must partition to 100%, so its `share` is normalised
  against the **usage-weighted total** (Σ of all media weights), NOT revenue.
  The slices then sum to exactly 100% and read as "share of the fee-weighted
  usage mix"; the legend's `amount` still shows the absolute (overlapping) fee
  weight. This is a valid partition because the denominator is the same
  fanned-out quantity as the numerator — it is emphatically *not* "% of revenue".

Brand / Payer / Track groupings are unaffected — each invoice has exactly one of
those, so they stay clean partitions everywhere.

## Consequences

- The `usage_type` grouping is the **one** Report grouping where the footer total
  ≠ Σ rows. The Report (CSV and PDF) must carry a note explaining the overlap, or
  it reads as a broken total.
- "Similar Past Licenses" (pricing reference) matches on usage by **overlap**
  (shares ≥1 medium), not exact-set equality — exact equality returns an empty
  band the moment bundles vary, killing the feature on a small dataset. The
  summary is a rough anchor, not a precise comparable set.
- The licenses **list filter** stays single-valued and matches by **contains**
  (the License's set includes the chosen medium).
- **Out of scope, deliberately:** exclusivity stays License-level (no per-usage
  exclusivity); the exclusivity-collision warning is usage-independent and
  untouched; Demos carry no Usage Type. A future per-usage-exclusivity need would
  be a separate, larger model change.
- Existing invoice `description` snapshots are frozen and unchanged; only newly
  composed fallback lines render the comma-joined set.
