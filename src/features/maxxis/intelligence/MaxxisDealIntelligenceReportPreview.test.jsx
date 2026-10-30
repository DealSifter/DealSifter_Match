import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect} from 'vitest';
import {MaxxisDealIntelligenceReportPreview} from './MaxxisDealIntelligenceReportPreview';
import {MaxxisAnalysisReportExperience} from './MaxxisAnalysisReportExperience';

describe('report previews use canonical PDF pages',()=>{
  it.each([['PROPERTY_RELEASE',1],['MAXXIS_ANALYSIS',2],['DEAL_INTELLIGENCE',3]])('exposes %s without building a second HTML report', (reportType,level)=>{
    const html=renderToStaticMarkup(<MaxxisDealIntelligenceReportPreview schema={{type:'maxxis_report_schema',reportType,pages:[]}}/>);
    expect(html).toContain('maxxis-canonical-preview');expect(html).toContain('Level '+level);
    expect(html).not.toContain('maxxis-v2-page');expect(html).not.toContain('<canvas');
  });
  it('does not reveal raw report narratives outside the authorized PDF',()=>{
    const html=renderToStaticMarkup(<MaxxisAnalysisReportExperience report={{type:'maxxis_analysis_report',executiveSummary:'UNVALIDATED NARRATIVE'}} reportSchema={{type:'maxxis_report_schema',reportType:'MAXXIS_ANALYSIS',pages:[]}}/>);
    expect(html).toContain('maxxis-canonical-preview');expect(html).not.toContain('UNVALIDATED NARRATIVE');
  });
  it('rejects missing and non-report schemas',()=>{
    expect(renderToStaticMarkup(<MaxxisDealIntelligenceReportPreview schema={null}/>)).toBe('');
    expect(renderToStaticMarkup(<MaxxisDealIntelligenceReportPreview schema={{type:'raw_provider_response'}}/>)).toBe('');
  });
});
