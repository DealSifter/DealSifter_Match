# Existing persistent cache, not a new subsystem

SupabaseSupplementalEvidenceCache retains existing rent_estimate_evidence JSONB/RPC
and 72h TTL. Migration NONE. Fingerprint includes normalized address, property ID,
type/beds/baths/sqft overrides (or omissions), automatic lookup, filters, provider /
endpoint version and property/unit scope. Address-only legacy entries cannot satisfy
this request contract. One normalized latest family entry/property is retained.

Fresh matching cache is returned without provider acquisition; stale matching data
is qualified during cache-only reads and may refresh only under existing permitted
explicit intent. Cache miss is not provider no-data. Unknown/corrupt/changed inputs
do not become current evidence. Persistent normalized failure markers use the
existing 60s provider availability backoff, preventing concurrent retry storms.
Successful no-result responses retain the existing rent-family TTL unless represented
by a temporary failed attempt. No raw historical payload accumulation.

SupabasePropertySingleFlight coordinates independent Edge isolates, with cache
recheck under lease. Current subject is rechecked before request and before storage.
No shared cache contains private investor assumptions, authorization denials or
user budget state.
