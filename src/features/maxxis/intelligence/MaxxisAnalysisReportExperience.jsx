import React from 'react';
import { MaxxisDealIntelligenceReportPreview } from './MaxxisDealIntelligenceReportPreview';

function MaxxisAnalysisReportExperienceView({ report, reportSchema = null, language = 'en' }) {
  if (!report || report.type !== 'maxxis_analysis_report') return null;
  // The old inline summary/highlights were a second, unvalidated report path.
  // Delegate the entire analytical experience to the same strict projection.
  return <section className="maxxis-analysis-report"><MaxxisDealIntelligenceReportPreview schema={reportSchema} language={language} /></section>;
}

const sameReportExperience = (previous, next) => previous.report === next.report
  && previous.reportSchema === next.reportSchema
  && previous.language === next.language
  && previous.generatedAt === next.generatedAt
  && previous.exportEntitlements?.PDF?.allowed === next.exportEntitlements?.PDF?.allowed
  && previous.exportEntitlements?.PDF?.state === next.exportEntitlements?.PDF?.state;

const MemoizedMaxxisAnalysisReportExperience = React.memo(MaxxisAnalysisReportExperienceView, sameReportExperience);

export function MaxxisAnalysisReportExperience(props) {
  return <MemoizedMaxxisAnalysisReportExperience {...props} />;
}
