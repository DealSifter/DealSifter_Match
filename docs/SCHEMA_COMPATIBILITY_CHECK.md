# Code/database compatibility preflight

Production target: `cyeipfskwwisbbayyaca`. This tool reads metadata only, never property/user/cache payloads or ledger business rows. Credentials stay in the Windows credential store/process memory.

Run `node scripts/schema-compat-check` immediately before validation. It confirms the linked project and active Production target, reads the catalog with SELECT, derives current RPC arguments and value sets from the application TypeScript source, and exits nonzero for incompatibilities. Offline unit fixtures use `node scripts/schema-compat-check.mjs --catalog=scripts/fixtures/schema-compat-after.json`. No provider API is called.

`createSchemaVerifiedValidationTransport` runs this check before creating transport. Direct transport construction without a fresh in-process verified receipt fails. Orchestration checks again before invoking services/reserving quota. Receipt validity is ten minutes, with zero incompatibilities and the correct target. Missing, forged and stale receipts fail closed.

## Production audit and authorized migration

The initial audit found 12 rejections. Migration `20261101164005_expand_property_provider_operation_lists.sql` expands only the operation whitelist in the usage reservation RPC, the data-type whitelist in the cache upsert delegate, and the cache data-type CHECK. The old values remain accepted. The dry-run listed only this migration; it was applied after target/catalog/hash/pending-file checks. No business rows were written by the migration.

Final checks: 118; incompatible: 0. Function grants/security/owners and table grants/RLS/policies/column defaults unchanged: {"functionPrivilegesUnchanged":true,"tablePrivilegesRlsAndDefaultsUnchanged":true}. All other RPC definitions are unchanged. No enum exists on the audited columns; values are constrained by text CHECKs.

| Value / argument set | Sender | Before | Rejected by / checked at | After |
|---|---|---|---|---|
| rentcast | UsageGuard | accepted | external_provider_usage.provider | accepted |
| property_lookup | UsageGuard.reserve | accepted | external_provider_usage.operation | accepted |
| property_value_avm | UsageGuard.reserve | accepted | external_provider_usage.operation | accepted |
| property_sold_search | UsageGuard.reserve | accepted | external_provider_usage.operation | accepted |
| sale_listings | UsageGuard.reserve | accepted | external_provider_usage.operation | accepted |
| rent_estimate | UsageGuard.reserve | accepted | external_provider_usage.operation | accepted |
| rental_listings | UsageGuard.reserve | accepted | external_provider_usage.operation | accepted |
| market_data | UsageGuard.reserve | accepted | external_provider_usage.operation | accepted |
| rentcast | Evidence caches | accepted | property_intelligence_cache.provider | accepted |
| property_record | Record/AVM/sold/supplemental caches | accepted | property_intelligence_cache.data_type | accepted |
| property_value_avm | Record/AVM/sold/supplemental caches | accepted | property_intelligence_cache.data_type | accepted |
| property_sold_record_pool | Record/AVM/sold/supplemental caches | accepted | property_intelligence_cache.data_type | accepted |
| sale_listing_evidence | Record/AVM/sold/supplemental caches | REJECTED | property_intelligence_cache.property_intelligence_cache_data_type_check | accepted |
| rent_estimate_evidence | Record/AVM/sold/supplemental caches | REJECTED | property_intelligence_cache.property_intelligence_cache_data_type_check | accepted |
| rental_listing_evidence | Record/AVM/sold/supplemental caches | REJECTED | property_intelligence_cache.property_intelligence_cache_data_type_check | accepted |
| market_evidence | Record/AVM/sold/supplemental caches | REJECTED | property_intelligence_cache.property_intelligence_cache_data_type_check | accepted |
| property_sold_record_pool_exit_sfr | Record/AVM/sold/supplemental caches | accepted | property_intelligence_cache.data_type | accepted |
| property_sold_record_pool_exit_townhouse | Record/AVM/sold/supplemental caches | accepted | property_intelligence_cache.data_type | accepted |
| property_sold_record_pool_exit_condo | Record/AVM/sold/supplemental caches | accepted | property_intelligence_cache.data_type | accepted |
| reserved | Reservation/finalization RPCs | accepted | external_provider_usage.status | accepted |
| succeeded | Reservation/finalization RPCs | accepted | external_provider_usage.status | accepted |
| failed | Reservation/finalization RPCs | accepted | external_provider_usage.status | accepted |
| user | providerTrace | accepted | external_provider_usage.origin | accepted |
| test | providerTrace | accepted | external_provider_usage.origin | accepted |
| validation | providerTrace | accepted | external_provider_usage.origin | accepted |
| system | providerTrace | accepted | external_provider_usage.origin | accepted |
| ACCEPTED | providerTrace | accepted | external_provider_usage.evidence_outcome | accepted |
| IDENTITY_REJECTED | providerTrace | accepted | external_provider_usage.evidence_outcome | accepted |
| NOT_FOUND | providerTrace | accepted | external_provider_usage.evidence_outcome | accepted |
| EMPTY | providerTrace | accepted | external_provider_usage.evidence_outcome | accepted |
| reserved | Reservation/finalization RPCs | accepted | maxxis_provider_budget_usage.status | accepted |
| succeeded | Reservation/finalization RPCs | accepted | maxxis_provider_budget_usage.status | accepted |
| failed | Reservation/finalization RPCs | accepted | maxxis_provider_budget_usage.status | accepted |
| user | providerTrace | accepted | maxxis_provider_budget_usage.origin | accepted |
| test | providerTrace | accepted | maxxis_provider_budget_usage.origin | accepted |
| validation | providerTrace | accepted | maxxis_provider_budget_usage.origin | accepted |
| system | providerTrace | accepted | maxxis_provider_budget_usage.origin | accepted |
| ACCEPTED | providerTrace | accepted | maxxis_provider_budget_usage.evidence_outcome | accepted |
| IDENTITY_REJECTED | providerTrace | accepted | maxxis_provider_budget_usage.evidence_outcome | accepted |
| NOT_FOUND | providerTrace | accepted | maxxis_provider_budget_usage.evidence_outcome | accepted |
| EMPTY | providerTrace | accepted | maxxis_provider_budget_usage.evidence_outcome | accepted |
| PRO | ProviderBudget (FREE blocked in app) | accepted | maxxis_provider_budget_usage.plan | accepted |
| ENTERPRISE | ProviderBudget (FREE blocked in app) | accepted | maxxis_provider_budget_usage.plan | accepted |
| chat | ProviderBudget | accepted | maxxis_provider_budget_usage.bucket | accepted |
| report | ProviderBudget | accepted | maxxis_provider_budget_usage.bucket | accepted |
| rentcast | UsageGuard | accepted | ds_reserve_external_provider_usage | accepted |
| property_lookup | UsageGuard.reserve | accepted | ds_reserve_external_provider_usage | accepted |
| property_value_avm | UsageGuard.reserve | accepted | ds_reserve_external_provider_usage | accepted |
| property_sold_search | UsageGuard.reserve | accepted | ds_reserve_external_provider_usage | accepted |
| sale_listings | UsageGuard.reserve | REJECTED | ds_reserve_external_provider_usage(text,text,uuid,uuid,integer) | accepted |
| rent_estimate | UsageGuard.reserve | REJECTED | ds_reserve_external_provider_usage(text,text,uuid,uuid,integer) | accepted |
| rental_listings | UsageGuard.reserve | REJECTED | ds_reserve_external_provider_usage(text,text,uuid,uuid,integer) | accepted |
| market_data | UsageGuard.reserve | REJECTED | ds_reserve_external_provider_usage(text,text,uuid,uuid,integer) | accepted |
| rentcast | Evidence caches | accepted | ds_upsert_property_intelligence_cache | accepted |
| property_record | Evidence caches (including delegate overload) | accepted | ds_upsert_property_intelligence_cache | accepted |
| property_value_avm | Evidence caches (including delegate overload) | accepted | ds_upsert_property_intelligence_cache | accepted |
| property_sold_record_pool | Evidence caches (including delegate overload) | accepted | ds_upsert_property_intelligence_cache | accepted |
| sale_listing_evidence | Evidence caches (including delegate overload) | REJECTED | ds_upsert_property_intelligence_cache(uuid,text,text,text,smallint,jsonb,timestamp with time zone,timestamp with time zone) | accepted |
| rent_estimate_evidence | Evidence caches (including delegate overload) | REJECTED | ds_upsert_property_intelligence_cache(uuid,text,text,text,smallint,jsonb,timestamp with time zone,timestamp with time zone) | accepted |
| rental_listing_evidence | Evidence caches (including delegate overload) | REJECTED | ds_upsert_property_intelligence_cache(uuid,text,text,text,smallint,jsonb,timestamp with time zone,timestamp with time zone) | accepted |
| market_evidence | Evidence caches (including delegate overload) | REJECTED | ds_upsert_property_intelligence_cache(uuid,text,text,text,smallint,jsonb,timestamp with time zone,timestamp with time zone) | accepted |
| property_sold_record_pool_exit_sfr | Evidence caches (including delegate overload) | accepted | ds_upsert_property_intelligence_cache | accepted |
| property_sold_record_pool_exit_townhouse | Evidence caches (including delegate overload) | accepted | ds_upsert_property_intelligence_cache | accepted |
| property_sold_record_pool_exit_condo | Evidence caches (including delegate overload) | accepted | ds_upsert_property_intelligence_cache | accepted |
| user | providerTrace | accepted | ds_annotate_provider_attempt | accepted |
| test | providerTrace | accepted | ds_annotate_provider_attempt | accepted |
| validation | providerTrace | accepted | ds_annotate_provider_attempt | accepted |
| system | providerTrace | accepted | ds_annotate_provider_attempt | accepted |
| ACCEPTED | providerTrace | accepted | ds_annotate_provider_attempt | accepted |
| IDENTITY_REJECTED | providerTrace | accepted | ds_annotate_provider_attempt | accepted |
| NOT_FOUND | providerTrace | accepted | ds_annotate_provider_attempt | accepted |
| EMPTY | providerTrace | accepted | ds_annotate_provider_attempt | accepted |
| PRO | ProviderBudget | accepted | ds_reserve_maxxis_provider_budget | accepted |
| ENTERPRISE | ProviderBudget | accepted | ds_reserve_maxxis_provider_budget | accepted |
| chat | ProviderBudget | accepted | ds_reserve_maxxis_provider_budget | accepted |
| report | ProviderBudget | accepted | ds_reserve_maxxis_provider_budget | accepted |
| p_provider, p_operation, p_property_id, p_user_id, p_hard_limit | supabase/functions/_shared/property-data/usageGuard.ts | accepted | ds_reserve_external_provider_usage:ARGUMENTS | accepted |
| p_usage_id, p_billable_success, p_http_status, p_error_code | supabase/functions/_shared/property-data/usageGuard.ts | accepted | ds_finalize_external_provider_usage:ARGUMENTS | accepted |
| p_user_id, p_property_id, p_plan, p_bucket, p_total_budget, p_chat_percent | supabase/functions/_shared/property-data/providerBudget.ts | accepted | ds_reserve_maxxis_provider_budget:ARGUMENTS | accepted |
| p_reservation_id, p_billable_success | supabase/functions/_shared/property-data/providerBudget.ts | accepted | ds_finalize_maxxis_provider_budget:ARGUMENTS | accepted |
| p_usage_id, p_budget_usage_id, p_request_id, p_report_id, p_origin, p_evidence_outcome | supabase/functions/_shared/property-data/providerTrace.ts | accepted | ds_annotate_provider_attempt:ARGUMENTS | accepted |
| p_property_id, p_provider, p_data_type, p_schema_version | supabase/functions/_shared/property-data/cache.ts | accepted | ds_get_retained_property_intelligence_cache:ARGUMENTS | accepted |
| p_property_id, p_provider, p_data_type, p_schema_version | supabase/functions/_shared/property-data/cache.ts | accepted | ds_get_property_intelligence_cache:ARGUMENTS | accepted |
| p_address_fingerprint, p_property_id, p_provider, p_provider_property_id, p_data_type, p_schema_version, p_payload, p_retrieved_at, p_expires_at | supabase/functions/_shared/property-data/cache.ts | accepted | ds_upsert_property_intelligence_cache:ARGUMENTS | accepted |
| p_property_id, p_provider, p_data_type, p_schema_version | supabase/functions/_shared/property-data/valuationCache.ts | accepted | ds_get_retained_property_intelligence_cache:ARGUMENTS | accepted |
| p_property_id, p_provider, p_data_type, p_schema_version | supabase/functions/_shared/property-data/valuationCache.ts | accepted | ds_get_property_intelligence_cache:ARGUMENTS | accepted |
| p_address_fingerprint, p_property_id, p_provider, p_provider_property_id, p_data_type, p_schema_version, p_payload, p_retrieved_at, p_expires_at | supabase/functions/_shared/property-data/valuationCache.ts | accepted | ds_upsert_property_intelligence_cache:ARGUMENTS | accepted |
| p_property_id, p_provider, p_data_type, p_schema_version | supabase/functions/_shared/property-data/soldCache.ts | accepted | ds_get_retained_property_intelligence_cache:ARGUMENTS | accepted |
| p_property_id, p_provider, p_data_type, p_schema_version | supabase/functions/_shared/property-data/soldCache.ts | accepted | ds_get_property_intelligence_cache:ARGUMENTS | accepted |
| p_address_fingerprint, p_property_id, p_provider, p_provider_property_id, p_data_type, p_schema_version, p_payload, p_retrieved_at, p_expires_at | supabase/functions/_shared/property-data/soldCache.ts | accepted | ds_upsert_property_intelligence_cache:ARGUMENTS | accepted |
| p_property_id, p_provider, p_data_type, p_schema_version | supabase/functions/_shared/property-data/supplementalEvidenceCache.ts | accepted | ds_get_retained_property_intelligence_cache:ARGUMENTS | accepted |
| p_property_id, p_provider, p_data_type, p_schema_version | supabase/functions/_shared/property-data/supplementalEvidenceCache.ts | accepted | ds_get_property_intelligence_cache:ARGUMENTS | accepted |
| p_address_fingerprint, p_property_id, p_provider, p_provider_property_id, p_data_type, p_schema_version, p_payload, p_retrieved_at, p_expires_at | supabase/functions/_shared/property-data/supplementalEvidenceCache.ts | accepted | ds_upsert_property_intelligence_cache:ARGUMENTS | accepted |
| p_key, p_token | supabase/functions/_shared/property-data/singleFlight.ts | accepted | ds_acquire_property_evidence_lease:ARGUMENTS | accepted |
| p_key, p_token | supabase/functions/_shared/property-data/singleFlight.ts | accepted | ds_release_property_evidence_lease:ARGUMENTS | accepted |
| UUID v5 / original property UUID | SupabasePropertySingleFlight | accepted | property_evidence_leases.key | accepted |
| SHA-256: 64 lowercase hex | Evidence cache identities | accepted | property_intelligence_cache.address_fingerprint | accepted |
| 1..45; effective guard unchanged | UsageGuard | accepted | ds_reserve_external_provider_usage:HARD_LIMIT | accepted |
| FREE blocked before reservation | ProviderBudget | accepted | Application plan gate | accepted |
| PROVIDER_DISABLED | PropertyDataErrorCode | accepted | external_provider_usage.error_code | accepted |
| PROVIDER_NOT_CONFIGURED | PropertyDataErrorCode | accepted | external_provider_usage.error_code | accepted |
| INVALID_PROPERTY_LOOKUP | PropertyDataErrorCode | accepted | external_provider_usage.error_code | accepted |
| MONTHLY_PROVIDER_LIMIT_REACHED | PropertyDataErrorCode | accepted | external_provider_usage.error_code | accepted |
| PLAN_PROVIDER_BUDGET_EXHAUSTED | PropertyDataErrorCode | accepted | external_provider_usage.error_code | accepted |
| PROVIDER_TIMEOUT | PropertyDataErrorCode | accepted | external_provider_usage.error_code | accepted |
| PROVIDER_NETWORK_ERROR | PropertyDataErrorCode | accepted | external_provider_usage.error_code | accepted |
| PROVIDER_AUTH_ERROR | PropertyDataErrorCode | accepted | external_provider_usage.error_code | accepted |
| PROVIDER_SUBSCRIPTION_ERROR | PropertyDataErrorCode | accepted | external_provider_usage.error_code | accepted |
| PROVIDER_RATE_LIMIT | PropertyDataErrorCode | accepted | external_provider_usage.error_code | accepted |
| PROVIDER_UPSTREAM_ERROR | PropertyDataErrorCode | accepted | external_provider_usage.error_code | accepted |
| PROPERTY_NOT_FOUND | PropertyDataErrorCode | accepted | external_provider_usage.error_code | accepted |
| PROPERTY_EVIDENCE_CACHE_MISS | PropertyDataErrorCode | accepted | external_provider_usage.error_code | accepted |
| PROPERTY_EVIDENCE_CACHE_INVALID | PropertyDataErrorCode | accepted | external_provider_usage.error_code | accepted |
| ADDRESS_MISMATCH | PropertyDataErrorCode | accepted | external_provider_usage.error_code | accepted |
| ADDRESS_CONFIRMATION_REQUIRED | PropertyDataErrorCode | accepted | external_provider_usage.error_code | accepted |
| INVALID_PROVIDER_RESPONSE | PropertyDataErrorCode | accepted | external_provider_usage.error_code | accepted |
| positive schema version 1 | Evidence caches | accepted | property_intelligence_cache.schema_version | accepted |
| HTTP status NULL or 100..599 | UsageGuard finalization | accepted | external_provider_usage.http_status | accepted |

## Grants before and after

| Object | Before | After |
|---|---|---|
| ds_acquire_property_evidence_lease(text,uuid) | `{postgres=X/postgres,service_role=X/postgres}` | `{postgres=X/postgres,service_role=X/postgres}` |
| ds_annotate_provider_attempt(uuid,uuid,uuid,uuid,text,text) | `{postgres=X/postgres,service_role=X/postgres}` | `{postgres=X/postgres,service_role=X/postgres}` |
| ds_finalize_external_provider_usage(uuid,boolean,integer,text) | `{postgres=X/postgres,service_role=X/postgres}` | `{postgres=X/postgres,service_role=X/postgres}` |
| ds_finalize_maxxis_provider_budget(uuid,boolean) | `{postgres=X/postgres,service_role=X/postgres}` | `{postgres=X/postgres,service_role=X/postgres}` |
| ds_get_property_intelligence_cache(uuid,text,text,smallint) | `{postgres=X/postgres,service_role=X/postgres}` | `{postgres=X/postgres,service_role=X/postgres}` |
| ds_get_retained_property_intelligence_cache(uuid,text,text,smallint) | `{postgres=X/postgres,service_role=X/postgres}` | `{postgres=X/postgres,service_role=X/postgres}` |
| ds_release_property_evidence_lease(text,uuid) | `{postgres=X/postgres,service_role=X/postgres}` | `{postgres=X/postgres,service_role=X/postgres}` |
| ds_reserve_external_provider_usage(text,text,uuid,uuid,integer) | `{postgres=X/postgres,service_role=X/postgres}` | `{postgres=X/postgres,service_role=X/postgres}` |
| ds_reserve_maxxis_provider_budget(uuid,uuid,text,text,integer,integer) | `{postgres=X/postgres,service_role=X/postgres}` | `{postgres=X/postgres,service_role=X/postgres}` |
| ds_upsert_property_intelligence_cache(uuid,text,text,text,smallint,jsonb,timestamp with time zone,timestamp with time zone,text) | `{postgres=X/postgres,service_role=X/postgres}` | `{postgres=X/postgres,service_role=X/postgres}` |
| ds_upsert_property_intelligence_cache(uuid,text,text,text,smallint,jsonb,timestamp with time zone,timestamp with time zone) | `{postgres=X/postgres,service_role=X/postgres}` | `{postgres=X/postgres,service_role=X/postgres}` |
| external_provider_usage | `{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}` | `{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}` |
| maxxis_provider_budget_usage | `{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}` | `{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}` |
| property_evidence_leases | `{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}` | `{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}` |
| property_intelligence_cache | `{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}` | `{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}` |

The schema-only fixtures preserve constraints, FK/UNIQUE/PK definitions, column types/defaults, function definitions and permissions for regression tests. They contain no business rows or credentials. The UUID lease mapper and fingerprint shape remain unchanged. Cache schema version 1 and nullable HTTP/error/outcome fields are checked against the existing contract. Provider budgets, pricing, nuggets, Stripe, Auth and financial engines were not modified.
