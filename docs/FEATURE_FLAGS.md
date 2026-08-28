# Feature Flags and Controlled Rollout

`feature-flags` is the server authority. It resolves a committed fallback definition plus optional server secret `FEATURE_FLAGS_JSON`. Unknown or malformed flags fail closed in the client.

The neutral `platform_readiness_probe` is enabled only in development/staging. `maxxis_deal_memory` is also development/staging-only while Deal Memory & Continuity is validated; it remains off in production. `maxxis_proactive_insights` is enabled for 100% of production accounts and remains user-controllable through Maxxis preferences; its runtime still applies cooldown, dedupe, session limits, sensitive-surface suppression and never executes an action automatically. Future flags (`maxxis_next_generation`, `new_feed_experience`, `advanced_deal_analysis`, `experimental_provider_flow`) remain off. Percentage cohorts use a deterministic hash of user ID and flag name. Client-supplied overrides are accepted only in development/staging; production additionally requires an authenticated admin and cannot be enabled through query strings or localStorage.

`maxxis_deal_memory` stores only an account-and-property-scoped, allowlisted UX snapshot in local storage. It is limited to 4 KB per deal, 100 deals per account and 90 days. It is cleared on logout/account transition, never authorizes an operation, and never stores property payloads, message bodies, contact data, prompts, Gemini responses or chat history. Cross-device continuity would require a separately reviewed backend schema, retention and RLS design.

Rollout flags control planned exposure. Security kill switches from Phase 5C stop risky/costly operations during incidents and remain independent. Flag errors fail closed and do not block the application.

