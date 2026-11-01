# R-4.3 — offline report verification

The ten controls are fictional: rich/partial/sparse at L1/L2/L3 plus the
listing-only L3 case that includes a subject duplicate. Photos and the stored
OpenStreetMap base are local. Run with the network-denying runtime:

```
node --import ./scripts/r1-offline-runtime.mjs scripts/report-r43-qa.mjs
```

PDFs/PNGs are generated locally and excluded from commits. `metrics.md` and
`metrics.json` contain measured page occupancy, the <25% last-page orphan rule,
semantic/visible duplicate counts, raw ISO/internal-label checks and section order.
The existing tier-scoped completeness rule is retained; no coverage scoring or
financial-engine change is introduced here.

Sale history is separate from publisher disclosure. Sales and listing dates use
different headers; mixed tables identify Type. Subject exclusion applies to sale,
listing and rental presentation, with a counted result. It does not mutate source
evidence or engine eligibility. Mixed display selects at most five sales and three
listing references; map numbering uses that same selection. A subject marker and
legend are present only when coordinates exist. Pending indicators retain cause
and action; existing supporting sales requiring qualification are not mislabeled
as absent provider coverage. The score is numeric beside the gauge and criteria
include their existing explanations. Sources are consolidated by provider and
evidence family, preferring the newest retrieval date. Descriptions are complete,
in a smaller final block.

Normal application projection retains the property address. `Address withheld`
is introduced only by the private QA operator, before artifact persistence;
publisher contacts/owner names are excluded by default. The address regression
test uses a fictional property.

## Controlled v3 observation (no retry)

Production catalog reconfirmed UUID-only leases, primary key `(key)`. One new
RentCast sold-record request returned HTTP 200, ledger outcome ACCEPTED, billable
delta +1 (monthly total 3/30). Its cached pool contains 100 properties with valid
sale price/date transactions and coordinates. An initial operator counter read
the wrong object level; it was corrected against `latestValidSale` and
`saleTransactions`, without another provider request. ARV eligibility remains
subject to existing condition/transaction rules; acquisition is not eligibility.

Rent then failed before HTTP: the Production reservation RPC does not include
`rent_estimate`, even though the table's operation constraint includes it. The
report budget has a failed nonbillable reservation for that attempt. No second
acquisition was executed after the stop. This does not prove a successful cached
repeat; the pipeline result is FAIL. Lease acquisition for sold records succeeded.

Proposed follow-up only: add the missing operation to the existing reservation
RPC whitelist, preserving locking, monthly accounting and the configured limit.
This requires a database-function change and was NOT applied or scripted as a new
migration in this phase. No constraints, billing, financial engines or production
configuration were changed. Gemini calls: zero. Controlled PDF, metadata proof
and private receipts remain under ignored `qa/report-r2/`, outside commits.
