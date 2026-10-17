# Vertical report pipeline map

The following map records the audited legacy route and its relationship to the separately established evidence models. It does not claim a real authenticated production PDF smoke.

| Stage | Source and function | Integrity observation |
| --- | --- | --- |
| Authorized property source | `_shared/maxxis/propertyDetails.ts`: getPropertyDetailsWithClient → RPC ds_get_public_property_details → normalizePropertyDetails | Public/privacy-sanitized row; legacy residential numeric zero remains possible. |
| Record/provider evidence | `_shared/maxxis/getPropertyEvidence.ts`, `_shared/property-data/propertyEvidenceService.ts` | Existing entitlement/cache/provider guard; do not bypass or fan out for rendering. |
| Canonical facts | `_shared/maxxis/propertyEvidenceProjection.ts`: buildCanonicalPropertyFacts, mergeVerifiedPropertyEvidenceIntoFacts | Status/provenance-bearing domain facts; not safe display primitives. |
| Parcel consensus | `_shared/maxxis/canonicalEvidenceProjection.ts`: buildConsensusAwareCanonicalReadModel | Separate additive analytical evidence projection. |
| Publisher reconciliation | `_shared/property-fact-reconciliation/model.ts`: reconcilePropertyFacts, applyFactDecisions, publicEffectiveFacts; runtime.ts runPropertyFactReview | Adopted/conflicted publisher facts must retain their decisions; do not merge private investor assumptions globally. |
| Financial evidence | `_shared/maxxis/financialEvidenceContext.ts`: buildFinancialEvidenceFromAuthorizedContext; financialEvidence.ts buildFinancialEvidenceStack; financialReadiness.ts | Current contract rent, market estimate, declared inputs and assumptions remain distinct. Legacy report assembly was not globally dependent on this layer. |
| Analytical context | `_shared/maxxis/getDealInsightContext.ts`: getDealInsightContext orchestration; dealInsightContext.ts orchestrateDealInsightContext | Joins authorized normalized cached families; intelligenceSnapshot.propertyFacts built by canonical projection. |
| Decision/thesis | `_shared/maxxis/dealDecisionContext.ts`: buildDealDecisionContext; dealThesis.ts buildDealThesis; maxxisStructuredAnalysis.ts buildMaxxisStructuredAnalysis | Presentation coercion bug could invent zero inside text before the later numeric guard. |
| L1 projection | `src/domain/maxxis/maxxisReportSchema.js`: buildPropertyOverviewModel, buildMaxxisReportSchema(PROPERTY_RELEASE); MatchesPortfolio.jsx generateReleasePdf flow | Shared property fact projection, direct capRate/notes reads in legacy renderer. |
| L2 projection | `features/maxxis/intelligence/maxxisAnalysisReport.js`: buildMaxxisAnalysisReport and response projector → buildMaxxisReportSchema(MAXXIS_ANALYSIS) | Generic observations/limitations, raw nested market fields; Market Rent point estimate only. |
| L3 projection | `features/maxxis/intelligence/maxxisDealIntelligenceReport.js`: buildMaxxisDealIntelligenceReport, projectMaxxisDealIntelligenceResponse → buildMaxxisReportSchema(DEAL_INTELLIGENCE) | Raw unknown field names, confidence fallback enums and fixed six-page structure. |
| Market Rent report submodel | `features/maxxis/export/marketRentReport.js`: projectMarketRentReport, rentalReportMapPoints | Positive estimate and max-five shared map/table dataset must be preserved, with zero acquisition in renderer. |
| Narrative localization | `features/maxxis/presentation/reportNarrativePresentation.js`: prepareReportNarrativePresentation; services/chatTranslation.js localizePresentationText; Edge presentation-translate | Original source distinct from translation; typed parser required at acquisition AND cached read. |
| Access/document metadata | `features/maxxis/export/maxxisReportRenderer.js`: renderMaxxisReportDocument; qa/maxxisProductionReadiness.js validators | Prior validator checked access and selected semantics, not a closed safe view model or full output text. |
| Shared artifact renderer | `features/maxxis/export/maxxisReportPdf.js`: renderMaxxisReportPdf, renderMaxxisReportPdfCached | All entry paths must pass the same strict boundary before page assembly/drawing. |
| Preview/export/storage | MaxxisCanonicalReportPreview.jsx, MaxxisReportExportActions.jsx, MaxxisAssistant.jsx, services/maxxisReportService.js; reports/MyMaxxisReports.jsx | Preserve ownership/pricing/storage/reopen behavior. Existing stored PDFs remain unchanged; reopening acquires no providers. |

L1 is the factual release. L2 remains concise Maxxis analysis with a Market Rent point estimate only. L3 becomes strategy/evidence-driven and retains useful ARV, LAND and Rental Comp maps/tables when supported. No NOI/Cap Rate/Cash Flow/CoC/DSCR/ROI or sold/ARV formula migration is part of this remediation.
