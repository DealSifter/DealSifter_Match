# LAND runtime and action routing validation

Baseline: `a02951fe06db81b27a75ec9995ec5e93165ab592`.

Scope: canonical LAND assumptions, property-scoped optional gaps, deterministic market explanation, typed comparable/report handoffs and localized visible action labels. Existing valuation formulas, SOLD eligibility, entitlements, provider budgets, report geometry and avatar behavior are unchanged. No migration.

The Gable/Droad regression fixtures are synthetic and use the existing sold-record mapper and valuation engines. Their values are not assertions about production evidence coverage. The minimal report fixture contains English source limitations; that screenshot is not a production report-localization audit. New market/action labels are separately tested in PT/EN/ES. Network-intercepted browser tests do not authenticate to production or call paid providers.

Execution: 64 targeted tests passed; real Chromium flows A–E passed with four captures; frontend contract typecheck and lint passed; production build passed (existing large-chunk warnings remain). The full run encountered two PDF-render timeouts and three worker-start timeouts under resource contention. All five affected files then passed in isolation (65 tests), with original assertions unchanged. `verification.json` combines the full run and successful retries by exact test-file path and refuses success if any test is failed/skipped or any required retry is missing.

`targeted-tests.json`, `full-tests.json` and `browser-e2e.json` contain actual execution results. The four PNG captures document the real React component using intercepted/cache-only responses. `backend-dependency-closure.json` includes both transitive shared imports and directly modified edge entrypoints: `maxxis-chat` and `maxxis-analysis-inputs`. The frontend also requires publication because action dispatch, response normalization, scoped routing and report handoff changed.

Portable changed backend modules pass Deno checking. The aggregate edge check retains 38 baseline errors; the additional market-response error was corrected by explicitly typing the new response at its HTTP boundary without changing unrelated edge contracts.

Production validation must distinguish deployment availability from authenticated behavior. An HTTP 200/CORS response and a rejected anonymous private RPC do not prove the following authenticated flows:

1. Financing gap followed by an unrelated valuation explanation.
2. Property switch from Droad to Gable without gap inheritance.
3. R2 + one SFH persisted and reused on the next construction question.
4. LAND value reference with actual qualifying cached evidence, or an explicit evidence limitation and asking $/acre.
5. Comparable evidence opens inside Maxxis, with no social Matches navigation.
6. L3 generation succeeds with analytical gaps displayed as limitations and no internal English prompt in the transcript.
7. Resolved zoning/unit gaps do not reappear in proactive guidance.

Until a configured authorized test session is available, authenticated production smoke remains NOT_VERIFIED and overall implementation status is PARTIAL. No account creation, credential extraction, entitlement bypass, paid-provider calls or financial mutations are authorized by this validation.

Production source revision: `15fa6974c257dc0be90ed08cc1df7c362b13064a`. Vercel deployment `dpl_EM1b9CjsWd2CJ5PpUkSRddZMHWbs` is READY, aliased to `https://dealsiftermatch.vercel.app`, with matching commit metadata. Supabase `maxxis-chat` version 78 and `maxxis-analysis-inputs` version 9 are ACTIVE. Unrelated provider-message/workflow versions remain 14/12. Frontend/health/CORS return 200; the anonymous private canonical RPC returns 401 / 42501. These are availability/privacy checks, not authenticated flow proof.

Post-deployment receipts are committed separately without changing application or backend source. The production application SHA remains the source revision above.
