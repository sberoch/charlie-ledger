# Grant scope is freeform terms text, not structured fields

Real invoices carry the licensing **grant scope** — cut counts, use/territory
language, airdate-anchored term wording (see Charlie's Xfinity invoice). We
capture this as a single optional freeform `terms` text column on **License**
and **Demo**, snapshotted into the invoice's `description` at issue (and
re-snapshotted on void & reissue). When `terms` is empty the description falls
back to an auto-composed line (License: `track × brand · usage · exclusivity`;
Demo: `brand ("working name")`). `terms` is distinct from the existing private
`notes` field, which never appears on the invoice.

We deliberately do **not** model cuts, territories, or quantity/rate as
structured fields. The grant scope is legal prose that varies per deal; forcing
it into columns would be lossy, and the business always bills a single license
or demo (qty 1, rate = amount), so a Qty/Rate breakdown carries no information.
The invoice line item is therefore `TYPE · DESCRIPTION · AMOUNT`.

## Consequences

- Grant scope is not queryable/reportable as structured data — by design. A
  future need for, say, territory-based reporting would require new structured
  fields, additively, alongside `terms`.
- A long `terms` block pushes the totals down the page; the fixed single-page
  layout (PDF layout v1) assumes scope text stays within reason.
