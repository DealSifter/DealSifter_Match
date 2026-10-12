# Parcel Lens contextual — final acceptance

IMPLEMENTATION: PASS — contextual UI implemented; authenticated production-user acceptance remains pending.

ROOT CAUSES: the previous viewport grid removed data below its zoom threshold; it lacked a contextual lifecycle and property-popup page. Native marker coordinate churn and replayed Leaflet viewport snapshots restarted popup autopan. Neighbor popup width specificity and inherited geometry-pane placement also required correction. See IMPLEMENTATION.md.

PARCEL LENS ACTIVATION: PASS — unique real containing parcel; physical property coordinates; automatic bounds fit; fixed 0.25-mile / 402.336-meter radius.

LENS PERSISTENCE AFTER ZOOM OUT: PASS — loaded principal, neighbors and circle remain; zero extra zoom-out queries. Explicit close, context/account/eligibility change and existing clear/reset flows release the lens.

MAGNIFIER ICON: PASS — visible only after a genuine unique parcel resolution; localized PT/EN/ES tooltip.

TURQUOISE GRID: PASS — solid #00cbd4; stronger principal outline, subtle fill/glow; original public geometry retained.

NEON LENS CIRCLE: PASS — fixed radius; noninteractive; below pins and native popups.

POPUP PAGE SWITCH: PASS — existing property popup reused; property/public-parcel pages; missing values localized, explicit source zero preserved, provenance and limitations visible.

NEIGHBOR PARCEL CLICK: PASS — public records without a DealSifter PIN; no cards, matches, property writes or social navigation.

ZOOM LEVEL INDICATOR: PASS — Zxx integrated into native +/- control.

QA GRID INTERNAL MODE: PASS — public_parcel_qa_grid is separate and OFF by default. Existing public_parcel_intelligence access remains restricted to the approved authenticated internal cohort; configuration unchanged. Broad public exposure DISABLED.

PROVIDER CALLS: two contextual requests per activation (point + fixed bounds); zero additional zoom-out requests; three real ArcGIS adapter HTTP calls across five locally cached browser scenarios; Census county-resolution calls were not separately counted; zero paid-provider calls. Runtime uses real approved GIS with mocked local app authentication, not production-user authentication. Source cap 120 retained with an explicit incomplete-neighborhood warning.

TARGETED TESTS: PASS — 144/144 in six files.

FULL TESTS: PASS after infrastructure retry — 1,780/1,780 assertions in 208 distinct files. Serial full run passed 1,760 assertions; one file's worker failed to start, and its 20 assertions passed in an isolated thread-worker retry. Not a single clean full-suite invocation. Original unsuccessful reports retained.

BROWSER ACCEPTANCE: PASS — five real-GIS scenarios (desktop PT light / EN dark, mobile PT dark / ES light, tablet ES dark); seven directly affected map regression cases plus one final native-camera/filter regression. An exploratory unrelated Maxxis chat-saving E2E failed and is not claimed as passing; its implementation has no diff against the baseline. See VALIDATION_NOTES.md.

TYPECHECK: PASS — contract TypeScript and both affected Deno entrypoints.

LINT: PASS — full src and affected scripts/components.

BUILD: PASS — final compiled manifest/chunks include native circle class, popupPane, control clearance, viewport-origin guard and neighbor-width correction; hashes in quality-readiness.json.

SCOPE/SECURITY: no migrations, new sources, license changes, arbitrary URL proxy, paid providers, canonical property facts, report changes or Maxxis parcel consumption. Backend dependency closure: feature-flags and public-parcel only. No production environment or cohort configuration changes.

COMMIT: PENDING_PUBLICATION.

PRODUCTION DEPLOY: PENDING_PUBLICATION.

FINAL: local acceptance complete; publish with existing internal-only access. Real-user authenticated production validation PENDING_NO_USER_SESSION; no password/token requested or fabricated.
