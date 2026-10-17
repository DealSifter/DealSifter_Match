# Strict report display boundary

The implemented contract is `ReportViewModel` / `REPORT_PROJECTION_V3`, defined in `src/features/maxxis/export/reportIntegrityTypes.ts`. `reportIntegrityViewModel.ts` is the single domain-to-display adapter. Authorized legacy schemas remain inputs to this adapter, not to drawing components.

## Mandatory path

Authorized schema → `buildStrictReportViewModel` → `validateReportViewModel` → safe drawing → `validateRenderedReportText` → artifact. The PDF and DOM preview use the same strict projection. Invalid input/view models fail closed rather than rendering backend diagnostics. The L2 experience delegates its old independent raw summary/highlight route to the strict preview.

The renderer receives localized safe primitives: property identity, formatted ReportRows, evidence-linked ReportClaims, section-specific tables, coordinate-only map points, qualified hero/range values and prepared raster data URIs. It does not receive provider payloads, canonical objects, Gemini objects, translation objects or generic raw key/value bags.

## Fact resolution and provenance

The adapter reads explicit canonical field paths first, then authorized evidence rows and scoped property fallback. Numeric/text/percentage units have explicit conversion and state rules. Unknown/conflicted/not-applicable evidence cannot become a known scalar through presence or number coercion. Every analytical datum registers an evidence/calculation/reference ID. Human labels and source qualifications are selected from deterministic supported concepts; missing mappings are diagnostics, not raw display labels.

## Dynamic content

ReportSection admits only narrative/list/facts/comparables/notes/market content, localized title, priority, evidenceRefs and SAME_SECTION continuation. Sections must be substantive before assembly: a meaningful claim, supported row/hero, real table or specific limitation. They sort by analytical relevance rather than filling a fixed number of pages. The PDF renderer reflows them and retains section identity on continuation; the DOM preview displays the same sections without pretending they are six printed pages.

L1 remains factual, L2 concise and L3 evidence/strategy-driven. Market Rent is a point estimate for L2 and qualified range/subject/unit metrics plus max-five same-dataset table/map for L3. ARV requires valid deterministic output and eligible sold evidence. LAND does not inherit residential bedroom/rehab/rental requirements. Unsupported market evidence becomes a compact, specific blocker, not an empty market page.

## Assets and side effects

`reportPreparedAssets.ts` separates authorized photo preparation from projection/drawing. It caches prepared raster data URIs and exposes a pure read. Inline preparation starts only after opening the details experience; export preparation is explicit. `comparableMapGeometry.ts` is pure shared ARV/rental framing; strict rendering uses coordinate geometry without tile/provider acquisition. Stored PDF reopen remains a binary-storage workflow.

## Validation

View-model integrity checks source-linked claims/rows, illegal zeros, section emptiness, duplicate actions/sections, invalid map coordinates, internal output tokens and unsupported input versions. Actual generated PDF text is independently extracted/scanned in `scripts/report-integrity-qa.mjs`, with source hashes, binary hashes, page rasters and geometric layout checks. Neither a typed schema nor lower-layer test count replaces actual artifact validation.
