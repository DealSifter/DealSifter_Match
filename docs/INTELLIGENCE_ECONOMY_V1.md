# Intelligence Economy v1

## Product principle

Thinking is included. Acquiring new premium intelligence may cost Nuggets. Reusing intelligence already acquired is included.

- Asking Maxxis never consumes Nuggets.
- Interpreting available property data, Match Score, deterministic metrics, or already-authorized evidence never consumes Nuggets.
- A successful Full Property Intelligence unlock is persistent for the user, property, and intelligence capability; rereading it does not create another charge.
- Entitlement is an access right. Cache is provider-data state. Cache expiry does not remove entitlement, and cache existence does not grant it.
- Access unlock and data refresh are distinct commercial operations.

## Plan access model

| Plan | Included intelligence | Full Property Intelligence | Nuggets |
| --- | --- | --- | --- |
| Free / Basic | Maxxis, Help/FAQ, profile-based Deal Insight, Match Score interpretation, available deterministic metrics, and legitimately available evidence | Explicit on-demand Nugget unlock after pricing activation | Unlock currency |
| Professional | Everything applicable from Free | Included within a monthly allowance; allowance is TBD | Overage after the included allowance |
| Enterprise | Everything applicable from Professional | Included in the normal high-volume workflow, subject to fair-use and operational safeguards | Not part of the normal Property Intelligence experience |

The current public Property Intelligence UI remains OFF. These definitions communicate and model policy; frontend labels never grant access. The backend entitlement check remains authoritative.

## Disabled configuration

- `FULL_PROPERTY_INTELLIGENCE_NUGGET_COST`: TBD / disabled
- `PRO_MONTHLY_INTELLIGENCE_ALLOWANCE`: TBD / disabled
- `ENTERPRISE_FAIR_USE_POLICY`: TBD / disabled
- Revenue-backed provider overage: disabled
- Existing provider hard stop: unchanged at 45 successful live requests per month

No UI or backend path may start a paid Full Property Intelligence unlock while its exact Nugget cost is undefined.

## Persistent entitlement and future transaction safety

The existing `property_intelligence_entitlements` record is unique by user, property, and unlock type. It is distinct from contact/property exclusivity unlocks and from cache.

A future paid acquisition must follow this order:

1. Show the exact configured Nugget price and receive explicit confirmation.
2. Check persistent entitlement; if it exists, return access with zero charge.
3. Reserve Nuggets atomically.
4. Use valid cache when available; otherwise acquire, normalize, and validate provider data within authorized limits.
5. Persist cache and grant entitlement.
6. Capture the Nugget reservation.
7. Release or roll back the reservation if acquisition or validation fails.

Provider names and internal API costs are implementation details. The commercial unit is Full Property Intelligence, not individual fields or provider access.

## Unit economics required before activation

The next decision must consider property-record, comps, AVM, rent, Gemini and infrastructure costs; cache reuse and failure rates; average properties per user; subscription prices; and target gross margin. No Nugget price, Professional allowance, Enterprise fair-use threshold, or paid provider overage may be activated before that review.
