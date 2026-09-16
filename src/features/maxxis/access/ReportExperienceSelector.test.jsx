import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ReportExperienceSelector } from './ReportExperienceSelector';
const source=readFileSync(new URL('./ReportExperienceSelector.jsx',import.meta.url),'utf8');
const css=readFileSync(new URL('./ReportExperienceSelector.css',import.meta.url),'utf8');
const modalSource=readFileSync(new URL('../../../components/ui/Modal.jsx',import.meta.url),'utf8');
const portfolioSource=readFileSync(new URL('../../../components/matches/MatchesPortfolio.jsx',import.meta.url),'utf8');
describe('Report Experience Selector',()=>{
  it('starts with approved stacked actions and no selection',()=>{const html=renderToStaticMarkup(<ReportExperienceSelector plan="free" language="en"/>);expect(html.match(/BASIC PROPERTY RELEASE/g)).toHaveLength(4);expect(html).toContain('Download to device');expect(html).toContain('Send by email');expect(html).toContain('AI-powered property analysis');expect(html).not.toContain('is-selected')});
  it('keeps info preview independent from actions',()=>{const action=vi.fn();renderToStaticMarkup(<ReportExperienceSelector onBasicDownload={action}/>);expect(source).toContain("onInfo={()=>setPreview('PROPERTY_RELEASE')}");expect(action).not.toHaveBeenCalled()});
  it('defines canonical intelligence selection and 3/5 access resolver',()=>{expect(source).toContain("['MAXXIS_ANALYSIS','DEAL_INTELLIGENCE']");expect(source).toContain('access.nuggetCost');expect(source).toContain('DEAL INTELLIGENCE REPORT')});
  it('groups the approved preview images into 1, 3 and 6 page carousels',()=>{
    expect(source.match(/Basic Release\.png/g)).toHaveLength(1);
    expect(source.match(/Maxxis Analisys/g)).toHaveLength(3);
    expect(source.match(/Deal Inteligence/g)).toHaveLength(6);
    expect(source).toContain('PROPERTY_RELEASE:Object.freeze([propertyReleasePage1])');
    expect(source).toContain('MAXXIS_ANALYSIS:Object.freeze([maxxisAnalysisPage1,maxxisAnalysisPage2,maxxisAnalysisPage3])');
    expect(source).toContain('DEAL_INTELLIGENCE:Object.freeze([dealIntelligencePage1,dealIntelligencePage2,dealIntelligencePage3,dealIntelligencePage4,dealIntelligencePage5,dealIntelligencePage6])');
  });
  it('uses the supplied pages instead of the old generic commercial placeholder',()=>{
    expect(source).toContain('src={pages[page]}');
    expect(source).not.toContain('Sample subject property');
    expect(source).not.toContain('Controlled commercial preview');
    expect(source).not.toContain('PAGE_CONTENT');
    expect(css).toContain('object-fit:contain');
    expect(css).toContain('@media(max-width:767px)');
  });
  it('supports arrows, keyboard and mobile swipe navigation',()=>{
    expect(source).toContain("event.key==='ArrowLeft'");
    expect(source).toContain("event.key==='ArrowRight'");
    expect(source).toContain('onTouchStart');
    expect(source).toContain('onTouchEnd');
  });
  it('uses Back inside preview instead of a competing close icon',()=>{expect(source).toContain('← {t.back}');expect(source).not.toContain('report-preview-close')});
  it('keeps the report popup fitted and non-scrollable across supported devices',()=>{
    expect(modalSource).toContain('scrollable = true');
    expect(modalSource).toContain('showCloseButton = true');
    expect(portfolioSource).toContain('contentClassName="report-export-modal"');
    expect(portfolioSource).toContain('scrollable={false}');
    expect(portfolioSource).toContain('showCloseButton={false}');
    expect(css).toContain('@media(min-width:768px) and (max-width:1180px) and (max-height:850px)');
    expect(css).toContain('@media(max-width:430px) and (max-height:720px)');
  });
});
