# Legacy report bypass inventory

Exactly nine independently testable bypass classes were identified at the baseline. Counts identify architectural classes, not the number of lines or every call site.

| ID | Bypass | Baseline source/functions | Required closed boundary |
| --- | --- | --- | --- |
| B01 | Preformatted narrative infers zero from null | dealThesis.ts money, decimal, buildDealThesis | Known finite inputs only; provider positive; unsupported preformatted legacy claims cannot become report evidence. |
| B02 | Raw/stored financial zero printed without proof | propertyDetails.ts normalizePropertyDetails; maxxisReportSchema.js existingMetrics; PDF propertyHero/renderComparables | ReportValue explicit state plus positive estimate/zero provenance; Cap Rate needs explicit declaration or valid deterministic basis. |
| B03 | Internal field names turned into prose | maxxisDealIntelligenceReport.js limitations; PDF renderInsights | Exhaustive localized field/blocker registry; unknown concepts omitted with diagnostics. |
| B04 | Missing enum humanized and printed | dealIntelligenceContext.ts limitations; maxxisReportConfidencePersona.js localizeMissingItem | Confidence limitations projected from safe blocker IDs, never raw reason tokens. |
| B05 | Localization fallback returns unknown raw text | PDF displayValue/reportNarrative; maxxisUserFacingEvidence.js; maxxisStructuredAnalysis.ts explainMaxxisInternalState; dealThesis.ts gapAction | Explicit user-facing concepts localized before layout; no enum/key/raw fallback. |
| B06 | Gemini/translation wrapper becomes notes text | presentation-translate/index.ts; chatTranslation.js; reportNarrativePresentation.js | Shared strict string/exact-envelope parser on acquisition and old-cache read; safe-source fallback. |
| B07 | Domain/provider objects cross report DTO | maxxisReportSchema.js PROPERTY_KEYS, levelData, presentation; generic String helpers | A closed ReportEvidencePacket → ReportViewModel; renderer accepts safe primitives only. |
| B08 | Fixed pages and non-null empty sections | maxxisReportSchema.js section/pagesFor; PDF listPanel/renderInsights/renderValuation | Applicability + substantive content assembler; no empty premium boxes/full unavailable pages. |
| B09 | Generic overflow dumping ground | PDF renderContainedText/renderContainedBulletList/final continuation assembly; reportContentPriority.js | Structured section-specific continuation; preserve useful facts without pooling arbitrary strings. |

## Important negative findings

`JSON.stringify` in transport/cache keys/diagnostics is not by itself a presentation leak. The observed translation JSON can arrive as a string, so eliminating object stringification alone is insufficient. Existing canonical finite-positive AVM guards are valuable but cannot retract a false numeric claim already embedded in narrative. Existing FinancialEvidenceStack validation must be consumed by the report boundary, not assumed effective merely because its tests pass.

Stored PDFs are immutable historical artifacts for this phase. New output must flow through the corrected boundary; provider acquisitions, RLS, entitlement, saved reports, private scenario scope and financial calculation methodology are outside this bypass-remediation scope.
