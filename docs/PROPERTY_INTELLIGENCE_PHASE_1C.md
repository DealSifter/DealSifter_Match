# Property Intelligence — Phase 1C

## Scope

This phase adds backend-only persistence and deterministic evidence orchestration. It does not connect Property Intelligence to the UI, MapView, Maxxis, Match Score, deal metrics, entitlements, Nuggets, or monetization.

## Runtime pipeline

`properties` → `PropertyEvidenceService` → cache lookup → on miss: Usage Guard reservation → RentCast provider → normalized schema validation → cache upsert → evidence result.

Internal DealSifter data and external RentCast data are returned separately. Missing values remain `UNAVAILABLE`; neither source overwrites the other.

## Persistence and access

- `external_provider_usage` is the conservative, atomic monthly usage ledger.
- `property_intelligence_cache` stores only validated `NormalizedPropertyRecord` payloads.
- Cache key: `property_id + provider + data_type`.
- Current data type: `property_record`; schema version: `1`.
- Both stores are backend-only. `anon` and `authenticated` have no direct access; only service-role RPCs are executable.
- Abandoned usage reservations remain counted until an explicit future recovery policy exists.

## Cache TTL

`PROPERTY_RECORD_CACHE_TTL_HOURS` defaults to 168 hours and is capped at 720 hours by the application. RentCast's official documentation permits internal data storage and says individual property records are refreshed about weekly, so a seven-day TTL matches the source cadence without assuming indefinite freshness:

- https://developers.rentcast.io/reference/introduction
- https://developers.rentcast.io/reference/property-data

## Conflict policy

- Address, city, state, ZIP, and property type use deterministic normalization.
- Bedrooms, bathrooms, and year built conflict when both sources are available and differ.
- Living area and lot size conflict only when the external value differs by more than 5% from the internal value.
- Conflicts are informational (`INFO`) or material (`WARNING`). No value is selected as the winner.
- The current `properties` table has no year-built field, so internal year built remains `UNAVAILABLE` until the internal schema evolves.
- The current schema also defaults bedrooms and bathrooms to zero without recording whether zero was explicitly entered. To avoid representing an ambiguous default as evidence, non-positive internal bedroom/bathroom values remain `UNAVAILABLE` in this service.

## Controlled live validation

`runControlledPropertyEvidenceValidation` is a manual-only helper with no executable entrypoint. It refuses to run unless explicit opt-in is `true`, provider mode is `live`, and the declared environment is `local`, `development`, or `staging`. It performs two lookups for the same property and returns only sanitized metadata. With an empty cache, the expected outcome is one live request followed by one cache hit.

Before using it, all automated gates must pass, both migrations must be operational in a clearly identified non-production Supabase environment, `PROPERTY_DATA_MODE=live` must be backend-only, and a specific non-sensitive development property must be authorized. It must never be imported by automated tests, CI, Vercel builds, or frontend code.

No live validation was executed while preparing this phase because no specific safe property was authorized.
