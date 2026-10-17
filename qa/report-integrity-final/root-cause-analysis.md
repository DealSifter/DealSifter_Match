# Report integrity forensic root-cause analysis

Audit baseline: repository `04950e1`; reported/verified application production baseline `7bb7530beda8aebe810ec07660dc8fb5ad687b95`. References below identify the pre-remediation source. The audit was read-only; no live RentCast, GIS or Gemini calls were used.

## Why lower-layer PASS did not guarantee correct PDFs

The product had evidence semantics, canonical facts, effective-fact reconciliation, financial evidence resolution, report schemas and PDF tests, but no mandatory, closed, localized user-facing report boundary. The schema was a selection of domain fields and nested objects, not a safe display model. Several independent presentation paths could bypass fact usability, provenance and localization.

### Nine independent legacy bypass classes

1. **Absence was reformatted as money/percent in narrative.** `supabase/functions/_shared/maxxis/dealThesis.ts` money/decimal helpers used `Number.isFinite(Number(value))`; `null` becomes zero. `buildDealThesis` formatted missing `relationships.providerEstimate` as a truthy currency string, so contraryEvidence asserted a zero provider value. The reported-Cap-Rate branch repeated the same coercion. This false claim was already inside natural-language strings before the schema's positive AVM guard ran.
2. **Raw residential Cap Rate bypassed financial provenance.** `maxxisReportPdf.js` propertyHero and renderComparables interpolated `property.capRate`; `maxxisReportSchema.js` existingMetrics accepted the stored metric without explicit-zero proof. `propertyDetails.ts` preserved residential legacy zero. Thus a blank-origin production zero could print `0%`, independent of NOI readiness.
3. **Unknown/conflict field identifiers became display text.** `maxxisDealIntelligenceReport.js` limitations appended `${field}: UNKNOWN`; PDF renderInsights concatenated `conflict.field`. The generic evidence formatter returned text containing camelCase/colon untouched. `annualPropertyTax` and `propertyTaxYear` therefore reached output outside the otherwise-localized tax fact row.
4. **Missing enums leaked through confidence copy.** `dealIntelligenceContext.ts` emitted `MISSING_${field.toUpperCase()}`. `maxxisReportConfidencePersona.js` localizeMissingItem used `replaceAll('_', ' ')` when no label existed. The confidence panel printed `MISSING CAPRATE` without a closed display registry.
5. **Localization was fail-open.** PDF displayValue returned the raw input for unmapped concepts. `maxxisStructuredAnalysis.ts` explained unknown enums by replacing underscores, including PT/ES. `dealThesis.ts` gapLabel/gapAction humanized unknown field/unlocks tokens in English. Fallback executive narrative also contained English/status codes. Different formatters had different and incomplete maps.
6. **Translation output was not schema-validated.** `presentation-translate/index.ts` treated concatenated Gemini text parts as the translation and cached them. A model response containing serialized `{ "translation": "..." }` satisfied the frontend's mere `typeof translatedText === 'string'` check. The notes renderer printed the wrapper string. No object stringification was necessary for this production leak.
7. **The DTO carried domain objects into layout.** PROPERTY_KEYS and presentation in `maxxisReportSchema.js` retained canonical facts, provenance, provider/recent-sales/rental objects and scenarios. Generic safeText/value helpers used `String(...)`. No final boundary guaranteed field type, state, display authorization, provenance or human label. A conflict scalar could remain materially present because canonicalFactValue excluded absent states, not CONFLICT.
8. **Availability and page count were structural, not substantive.** `pagesFor` forced 1/3/6 pages (+ one Market Rent page). A non-null `{}` or `[]` counted as an available section. listPanel always drew the box and renderInsights/renderValuation always allocated the full page even with no useful positives/comparables/ARV. Page count incorrectly substituted for premium value.
9. **Overflow lost its original section/schema.** `renderContainedText`/`renderContainedBulletList` collected arbitrary strings; final PDF assembly pooled/ranked them into `preservedCanonicalContent` and a generic "Preserved information — continuation" page. Raw/duplicate data could be preserved outside the meaningful source section.

## Test gaps that accepted the defects

- Canonical/consensus/financial tests proved their own lower-layer outputs, but the PDF's raw property and narrative routes did not depend on them.
- `maxxisProductionReadiness.js` validated presence, access, ARV grouping and page caps. It did not validate a closed display schema, zero provenance, raw keys/enums/JSON, empty substantive sections, recommendation-to-blocker mapping or final rendered text.
- `maxxisReportTemplate.test.js` used a mostly populated synthetic property; it expected at least six pages and explicitly accepted a generic preserved-information continuation. Its zero assertion inspected the valuation page, not all narrative output.
- Translation tests returned clean localized strings, never a JSON envelope embedded inside translatedText, an invalid wrapper or a poisoned cache result.
- `maxxisGoldenMaster.test.js` checked existing image/artifact files and a prior summary PASS; it did not freshly generate the six adversarial golden PDFs and inspect their complete extracted text.

## Required architectural correction

At the shared report entry, convert authorized evidence into a strict ReportEvidencePacket and ReportViewModel before layout. Whitelist fields and display concepts; resolve explicit states and zero provenance; localize before rendering; reject unknown display objects/keys. Build only applicable/substantive sections, with structured continuation that retains section identity. Validate both the view model and text extracted from newly generated real PDFs. Preserve paid-provider budget, stored-PDF access and financial/ARV calculation engines.

Contained origin corrections are complementary, not the architecture: parse translations before caching, revalidate old cache payloads when reading, and correct null-to-zero coercion in dealThesis's presentation helpers. The strict report projection must still reject unsupported legacy narrative rather than trust its formatting.
