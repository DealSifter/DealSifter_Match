# Incremental report corrections — 2026-10-18

Supersedes the cache-only rental acquisition described in the earlier recovery receipt. The approved composition is retained; this is not a redesign.

- All three first pages share the L3 composition and complete available L1 property facts. Original inline brand asset reused without recoloring; footer contains pagination only.
- Conflicted values have a yellow warning triangle and one concise legend, not repeated caveats. They are not silently adopted in calculations.
- Sales display up to five primary SOLDs plus three complementary SOLDs, and up to five FOR SALEs, ranked by existing similarity. SOLD pins yellow, FOR SALE red, complementary purple. Listing prices never become recorded sales or ARV evidence.
- Explicit L2/L3 generation uses fresh cache first, otherwise the existing authorized provider API, persistent cache, single-flight and usage guard. Background cache-only recomputations and PDF rendering remain non-billable. Report queries use the report budget bucket.
- With disputed physical measurements and a supported single-unit type, reports can query the validated address without submitting those measurements as overrides. No conflict is resolved or property fact overwritten by this lookup. Land, unknown type and multi-unit applicability gates remain.
- Full rental API results reach canonical schema, including comparable rents, addresses and map coordinates. Actual no-result, provider error, authorization and budget states are distinguished.

Verification: 175 tests across five focused files; report TypeScript and selected JavaScript lint passed. Nine generated/reopened synthetic PDFs passed geometry, first-page fact parity, content, evidence, map/table and false-zero checks. PDFs are synthetic controls, not production valuations. Source digest: `ee587773691e9f31797fdf1920e80234f7cd4e2f978d0347184ab0b8551d68bb`.

New backend modules pass Deno checking. The wider tool-registry check retains 31 existing diagnostics. A local full application build passed before the final compact-label/status-copy edits; production must build the exact committed final source before release is marked complete.

No paid provider requests, data migrations, secret changes or authenticated-user impersonation were performed during QA. Read-only production inspection found no saved rental estimate for 4724 W 26th St and 20 AVM listing-price references, not verified closed sales. The new API fallback must be exercised by an authorized live report generation; no claim of fetching the website's $970 screenshot is made.

Published runtime: `51caae59794ba507696d512042c5de2d840b8b02`, pushed to `fix/production-real-defects`. Vercel `dpl_AdYbrVZzbJzmjRvV9kqTavmd5GN6` READY with exact source SHA and public alias verified at 2026-10-18 15:34 UTC. This production build covers the final compact-label/status-copy edits as well.

Backend deployment used the immutable committed archive and exact dependency closure: `maxxis-chat` v91, `arv-visual-comp-review` v15, `property-intelligence` v15 and `property-fact-review` v7 are ACTIVE with JWT checks enabled. Feature-flags v19 and public-parcel v10 are unchanged; no configuration or secret changes. This receipt update is documentation-only, not a new runtime release.
