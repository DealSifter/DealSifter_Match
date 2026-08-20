# Privacy-safe Product Analytics

Taxonomy version 1 lives in `src/domain/analytics/productEvents.js`; all product events pass through `trackProductEvent`. Transport reuses the authenticated `track_app_event` RPC and `app_events` table, so no new vendor or browser tracker is introduced.

The Maxxis deal funnel is: property viewed → Deal Copilot opened → provider suggested → unlock started/completed → message sent → provider reply received. Session/auth, profile completion, interest, search, message draft, next action and workflow completion are also defined.

Only allowlisted low-cardinality metadata and technical identifiers are accepted. Email, phone, WhatsApp, address, chat body, full prompts/profile payloads, contact data and payment/Stripe secrets are rejected. A 30-minute action key prevents rerender/realtime duplicates. Delivery failures return `false` and never interrupt product behavior.

