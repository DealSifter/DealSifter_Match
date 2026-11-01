# Consolidated v3 — offline lease and telemetry evidence

Production target: `cyeipfskwwisbbayyaca`. No remote operation in Parts 1–4.
The verified R-2 v2 catalog receipt records
`property_evidence_leases_key_check: CHECK (key ~ '^[0-9a-f-]{36}$')`.
The lease primary key is `key`; provider/data type are not separate uniqueness
columns. Acquire/release RPCs use that key verbatim. Reconfirm the catalog during
the authorized live stage before acquisition; no schema or RPC changes.

| Producer | Identity before database boundary | Effective lease key |
|---|---|---|
| PropertyEvidenceService | property UUID | unchanged UUID |
| ValuationEvidenceService | property UUID | unchanged UUID |
| SoldEvidenceService | `sold:<property UUID>:<query fingerprint>` | deterministic UUID v5 |
| MarketRentService | `market-rent:<property UUID>:<query fingerprint>` | deterministic UUID v5 |
| MarketRent provider rate gate | `rentcast:market-rent-rate-gate` | deterministic UUID v5 |
| SupplementalEvidenceService (sale/rental listings and market evidence) | property UUID | unchanged UUID |

All database leases pass through `SupabasePropertySingleFlight`. The fixed UUID
namespace is application owned. Acquiring and releasing use the identical mapped
key. A source record/AVM UUID is preserved. A repeated composite identity maps to
the same UUID; the domain cache is rechecked inside the acquired lease.

`INTERNAL_ERROR` distinguishes lease/database/read failures from provider failures.
Market-rent execution preserves the explicit reason and real HTTP call count.
Post-HTTP cache persistence failures are still internal and retain their call count.
The reason vocabulary is shared by chat, snapshot presentation and PDF composition.

Census and ArcGIS responses retain exact status, monotonic elapsed milliseconds,
retrieval timestamp and query-free service URL. Failed HTTP/transport/JSON attempts
are retained too; transport failures have a null HTTP status. Cache hits retain the
original acquisition receipt and do not invent a new request. Optional constructor
trace fields support report ID, request ID and origin without trusting HTTP input.
Results and signed parcel receipts carry this telemetry through verification.

## Ledger limitation — proposal only, not applied

The existing provider ledger restricts providers/operations to RentCast. Recording
Census/ArcGIS there requires a migration, prohibited by this phase. The smallest
additive design is a separate GIS attempt table with UUID primary key, provider,
query-free service identifier, HTTP status nullable, latency milliseconds,
requested_at, report_id, request_id, origin and outcome; restrict insertion to the
trusted server and apply the existing ledger access policy. No DDL or migration
was created or applied. Current persistence is in the result/signed receipt, not
the provider ledger.

Offline tests: 4 lease tests; 7 taxonomy/chat cases; 7 telemetry cases, all passed.
Live provider calls in Parts 1–4: zero.
