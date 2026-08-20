# Feature Flags and Controlled Rollout

`feature-flags` is the server authority. It resolves a committed fallback definition plus optional server secret `FEATURE_FLAGS_JSON`. Unknown or malformed flags fail closed in the client.

The neutral `platform_readiness_probe` is enabled only in development/staging. Future flags (`maxxis_next_generation`, `new_feed_experience`, `advanced_deal_analysis`, `experimental_provider_flow`) remain off. Percentage cohorts use a deterministic hash of user ID and flag name. Client-supplied overrides are accepted only in development/staging; production additionally requires an authenticated admin and cannot be enabled through query strings or localStorage.

Rollout flags control planned exposure. Security kill switches from Phase 5C stop risky/costly operations during incidents and remain independent. Flag errors fail closed and do not block the application.

