import React from 'react';
import { MaxxisCanonicalReportPreview } from './MaxxisCanonicalReportPreview';

// Compatibility entry: every report preview uses the actual exported PDF pages.
export function MaxxisDealIntelligenceReportPreview(props) {
  return <MaxxisCanonicalReportPreview {...props} />;
}
