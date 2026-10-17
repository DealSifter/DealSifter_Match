# Report integrity + executive evidence recovery

The implementation and its actual-PDF/content/visual checks are validated. All 11 current-source release gates passed. Code commit, push and production deployment succeeded; the production alias, source SHA and affected functions were verified. Production browser checks used the real frontend with explicitly simulated authentication/backend and zero real writes. No legitimate authenticated production user session was available.

```text
IMPLEMENTATION: PASS — implemented, locally validated and current-source release consolidation passed
ORIGINAL PRODUCTION BASELINE: 7bb7530beda8aebe810ec07660dc8fb5ad687b95
ACTUAL BASELINE: 04950e177e9c6f8237872e60369b8bd90be03b66
PRODUCTION BASELINE: 7bb7530beda8aebe810ec07660dc8fb5ad687b95
ROOT CAUSE IDENTIFIED: PASS
LEGACY REPORT BYPASS PATHS: 9
LEGACY BYPASS PATHS ELIMINATED: 9 / 9 — closed strict rendering boundary
STRICT REPORT VIEW MODEL: PASS — REPORT_PROJECTION_V3
RAW DOMAIN OBJECTS REACHING PDF: 0
RAW PROVIDER OBJECTS REACHING PDF: 0
RAW GEMINI OBJECTS REACHING PDF: 0
RAW TRANSLATION OBJECTS REACHING PDF: 0
UNKNOWN → ZERO: 0
UNAVAILABLE → ZERO: 0
FALSE $0: 0
FALSE 0%: 0
LEGACY UNTRUSTED ZERO: QUARANTINED / OMITTED
RAW INTERNAL FIELD KEYS: 0
RAW INTERNAL ENUMS: 0
RAW JSON: 0
[object Object]: 0
UNDEFINED/NaN/INFINITY: 0
annualPropertyTax LEAK: 0
propertyTaxYear LEAK: 0
MISSING CAPRATE LEAK: 0
{"translation": LEAK: 0
CONTRADICTORY PROVENANCE LABELS: 0 observed in validated output
GENERIC PRESERVED-INFORMATION DUMP PAGE: 0
STRUCTURED SECTION CONTINUATION: PASS — section-specific long-notes PDF 1 / 1
EMPTY PREMIUM SECTIONS: 0
EMPTY EXECUTIVE SUMMARY: 0 for applicable L2/L3 reports
EMPTY POSITIVE-SIGNAL PANEL: 0 — unsupported signals omitted
FULL PAGE USED ONLY FOR UNAVAILABLE MODULE: 0
DYNAMIC SECTION ASSEMBLER: PASS
PROPERTY-TYPE AWARE: PASS
STRATEGY AWARE: PASS
LAND REPORT RELEVANCE: PASS
SELL REPORT RELEVANCE: PASS
FLIP REPORT RELEVANCE: PASS — qualified saved-scenario projection tests
BUY&HOLD REPORT RELEVANCE: PASS
EXECUTIVE DEAL SNAPSHOT: PASS — applicable L2/L3 reports
EVIDENCE COVERAGE DISPLAY: PASS
ANALYSIS STATUS: PASS — evidence-qualified, not a recommendation
PRIMARY OPPORTUNITY: PASS when supported; NOT_SUPPORTED otherwise, no empty panel
PRIMARY RISK: PASS
PRIMARY DECISION BLOCKER: PASS
EXECUTIVE NARRATIVE: PASS — deterministic evidence-derived synthesis
EXECUTIVE NARRATIVE EVIDENCE REFS: PASS — 213 audited claims; 0 missing/unknown refs
UNSUPPORTED LLM CLAIMS: 0 accepted
LLM-INVENTED NUMBERS: 0 accepted
LLM VALIDATION FALLBACK: PASS — unsupported claim returns deterministic thesis
SPECIFIC POSITIVE SIGNALS: PASS when supported; NOT_APPLICABLE when none exists
SPECIFIC RISKS: PASS
SPECIFIC RECOMMENDED ACTIONS: PASS
RECOMMENDATIONS WITHOUT ACTIVE BLOCKER: 0
DUPLICATE RECOMMENDATIONS: 0
LIMITATIONS WITH EXPLAINED IMPACT: PASS
MATCH SCORE MISREPRESENTED AS DEAL QUALITY: 0
ANALYSIS CONFIDENCE SEMANTICS: PASS — separate from profile compatibility
LOW-EVIDENCE REPORT COLLAPSES: PASS — minimal 1 page; 4724 L3 2 pages
RICH-EVIDENCE REPORT EXPANDS: PASS — Honolulu L3 4 pages
4724 REGRESSION FIXTURE: PASS — PT/EN/ES at L1/L2/L3
4724 FALSE $0: 0
4724 FALSE 0%: 0
4724 RAW INTERNAL KEYS: 0
4724 RAW JSON: 0
4724 GENERIC OVERFLOW PAGE: 0
4724 EXECUTIVE SUMMARY: PASS at L2/L3; not applicable to factual L1
4724 FINAL PAGE COUNT: PT/EN/ES each L1=1, L2=2, L3=2
HONOLULU MARKET RENT FIXTURE: PASS
HONOLULU RENT COMP MAP: PASS — subject S + five numbered rentals, L3 only
HONOLULU RENT COMP TABLE: PASS — same five IDs/order as map, L3 only
GABLE LAND FIXTURE: PASS
ARV-RICH FIXTURE: PASS
BUY&HOLD FIXTURE: PASS
MINIMAL FIXTURE: PASS
GOLDEN REPORTS: PASS — 6 fixtures, 30 actual PDFs
PROHIBITED OUTPUT SCAN: PASS — 30 / 30, 0 leaks
FALSE ZERO AUDIT: PASS — 30 / 30; legitimate explicit HOA zero retains provenance
EMPTY SECTION AUDIT: PASS — 30 / 30
PDF TEXT E2E: PASS — 30 / 30 actual PDFs
PDF VISUAL QA: PASS — 18 / 18 actual L3 contact sheets plus all-PDF layout/raster checks
CONTENT CLIPPING: 0 in actual PDF line/bounds audit
FOOTER OVERLAP: 0
LOST SUBSTANTIVE CONTENT: 0 in typed-row/table/claim/note preservation audit; confirmed scenarios preserved with qualified basis
L1 INTEGRITY: PASS — factual release; no premium analytical sections
L2 INTEGRITY: PASS — strict analysis schema and PRO scope
L3 INTEGRITY: PASS
L3 EXECUTIVE WOW: PASS — hash-bound manual review of 18 actual L3 reports
MARKET RENT L2: PASS — estimate/range qualification, no rental map/table
MARKET RENT L3: PASS — estimate plus matching five-comp map/table
RENT COMP MAP: PASS — source IDs/order/bounds audited
ARV REPORT: PASS — sold evidence/condition/range qualified
REPORT RENDERER PROVIDER CALLS: 0
REPORT REOPEN PROVIDER CALLS: 0
APP PERFORMANCE REGRESSION: PASS within scoped browser checks; 0 generic-loader flashes or page errors; not an unrestricted production performance certification
SMART ENRICHMENT REGRESSION: PASS — 6 device/locale review flows, persisted full reload
ANALYTICAL INPUT REGRESSION: PASS — complete/partial private scenarios qualified; no engine migration
MARKET RENT REGRESSION: PASS
MAPVIEW HOTFIX PRESERVED: PASS — source isolation plus 10 navigation transitions and 2 photo-to-feed handoffs
CAMERA CALLBACK AFTER UNMOUNT: 0 observed page errors in lifecycle/navigation checks; hotfix source preserved
ZOOM CALLBACK AFTER UNMOUNT: 0 observed page errors, including zoom-in-flight navigation; hotfix source preserved
NOI ENGINE MIGRATED: NO — projection-only preservation of existing private results
CAP RATE ENGINE MIGRATED: NO
CASH FLOW ENGINE MIGRATED: NO
COC/DSCR/ROI MIGRATED: NO
MIGRATION: NONE
TARGETED REPORT TESTS: PASS — 453 / 453 assertions from 18 files, extracted from the current 2613-test full run; not a second execution
GOLDEN PDF TESTS: PASS — 30 / 30; additional structured-notes continuation 1 / 1
REPORT E2E TESTS: PASS — 30 actual PDFs + 6 review cases + 10 MapView transitions + 2 photo handoffs
FULL TESTS: PASS — 2613 / 2613, 247 files, 0 skipped, final source 6e5451a485ae5bdef64c3615e203f4b3ae2e72446b9c1c968e8ff77ceee60c15
TYPECHECK NEW/MODIFIED: PASS — contracts/report configs on final 6e5451 source
NEW TYPECHECK ERRORS: 0
LEGACY TYPECHECK DELTA: 0 — Deno baseline 37, current 37
LINT: PASS — 0 warnings on final 6e5451 source
BUILD: PASS — actual modern + legacy isolated build revalidated without rebuilding; 0 production/config/public input changes, 100% tested asset bytes identical
NEW DENO ERRORS: 0 — affected closure maxxis-chat + presentation-translate
LIVE RENTCAST CALLS IN AUTOMATED TESTS: 0 — mocked/denied transports
LIVE GIS CALLS IN AUTOMATED TESTS: 0 — mocked/denied transports
AUTHENTICATED PRODUCTION SMOKE: BLOCKED — no legitimate real user session available
COMMIT: 3be3a484aef2567badae1bb50b833873b3e9fc59
PUSH: PASS — code commit pushed
PRODUCTION DEPLOY: YES — alias READY, source SHA verified; maxxis-chat v89 + presentation-translate v5 ACTIVE with JWT verification preserved
PRODUCTION SHA: 3be3a484aef2567badae1bb50b833873b3e9fc59
QA ARTIFACTS: qa/report-integrity-final/ ; qa/report-integrity/root-cause-analysis.md
NEXT PHASE: ONLY AFTER THIS PASS — FINANCIAL ANALYTICAL ENGINES — NOI + CAP RATE + OPERATING CASH FLOW
RELEASE BLOCKED BY: NONE for validated implementation/deployment; authenticated real-user production smoke remains separately BLOCKED
FINAL: REPORT INTEGRITY + EXECUTIVE WOW RECOVERY VALIDATED
```

The complete matrix is 18 L3 PDFs (six fixtures × PT/EN/ES) and 12 L1/L2 PDFs (4724 and Honolulu × two levels × three locales). Structured-notes continuation is an additional PDF, not a substitution for any matrix member. All automated fixtures are synthetic. The report boundary keeps publisher declarations and private assumptions qualified; it does not turn them into official verification or current contracted income.

Evidence is retained in `full/tests.json` and the raw Vitest output, `golden-report-validation.json`, each `golden-*-validation.json`, `pdf-text-e2e.json`, `false-zero-audit.json`, `prohibited-output-scan.json`, `empty-section-audit.json`, `manual-visual-review.json`, `structured-notes/`, `browser-validation.json` and `financial-engine-isolation.json`. The first full run (2594/2604 with ten failures) remains under `full/initial-run/`; resource timeouts were distinguished from the single obsolete L2 fixture, which was updated without restoring a raw report bypass. The final full run is the separately preserved 2613/2613 receipt.

`targeted/tests.json` identifies the 453 assertions in 18 report-related files within that same final full-suite JSON; it is a source-bound subset, not a claim of a second completed test run. The redundant post-full pipeline was stopped after its final static checks passed, while its repeated targeted stage was still running. `incremental-validation.json` records all 858 current source hashes matching the successful full run and the sole test-only difference from the actual built/browser-tested source. There were no production application, configuration or public-input changes. `build.json` revalidates the existing real successful build without claiming a rebuild, and `browser/identical-build-revalidation.json` binds the prior six review cases, ten navigation transitions and two photo handoffs to identical built asset bytes. Original build/source/targeted receipts remain preserved.

`quality-gates.json` records PASS for all 11 gates on source digest `6e5451a485ae5bdef64c3615e203f4b3ae2e72446b9c1c968e8ff77ceee60c15`. Deno comparison remains 37 pre-existing diagnostics before and after, with zero new diagnostics. A local technical PASS does not imply a production deploy or a real-user authenticated production smoke.

`production-validation.json` separately records production PASS for deployment `dpl_DWaWJRnrL3NSUd32J8VDqypMC1ac`, alias `https://dealsiftermatch.vercel.app` and code SHA `3be3a484aef2567badae1bb50b833873b3e9fc59`. Schema/RLS, feature flags and secrets remained unchanged; no migration or real backend write occurred. The six production review cases passed in the original unchanged harness, as did the production navigation/photo checks. The first production attempt's transient 23px-versus-24px icon measurement is retained in `browser/production-initial-attempt.json`; the isolated original ES case and one complete original six-case retry passed without modifying any assertion. `browser/browser-production.json` has SHA256 `104d5506626ad513bab85144cfd9dfdf79d949e848d9c570334c9458d293b773`. These are real-production-frontend checks with simulated authentication/backend, not an authenticated real-user smoke.
