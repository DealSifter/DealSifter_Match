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
  it('starts with canonical stacked actions and no selection',()=>{const html=renderToStaticMarkup(<ReportExperienceSelector plan="free" language="en"/>);expect(html.match(/PROPERTY RELEASE/g)).toHaveLength(4);expect(html).toContain('Download to device');expect(html).toContain('Send by email');expect(html).toContain('AI-powered property analysis');expect(html).not.toContain('is-selected')});
  it('keeps info preview independent from actions',()=>{const action=vi.fn();renderToStaticMarkup(<ReportExperienceSelector onBasicDownload={action}/>);expect(source).toContain("onInfo={()=>setPreview('PROPERTY_RELEASE')}");expect(action).not.toHaveBeenCalled()});
  it('uses the favicon brand in the first Maxxis action and omits only its information button',()=>{
    const html=renderToStaticMarkup(<ReportExperienceSelector language="en"/>);
    expect(source).toContain("import brandLogoAsset from '../../../assets/logo.png'");
    expect(source).toContain('asset={brandLogoAsset}');
    expect(html.match(/report-info-button/g)).toHaveLength(2);
  });
  it('renders intelligence report avatars at 150 percent across responsive sizes',()=>{
    expect(css).toContain('.report-action-stack.is-intelligence .report-action-main img');
    expect(css).toMatch(/\.is-intelligence \.report-action-main img\s*\{\s*width:\s*104px;\s*height:\s*104px;/);
    expect(css).toMatch(/\.is-intelligence \.report-action-main img\s*\{\s*width:\s*84px;\s*height:\s*84px;/);
    expect(css).toMatch(/\.is-intelligence \.report-action-main img\s*\{\s*width:\s*72px;\s*height:\s*72px;/);
  });
  it('defines canonical intelligence selection and 3/5 access resolver',()=>{expect(source).toContain("['MAXXIS_ANALYSIS','DEAL_INTELLIGENCE']");expect(source).toContain('access.nuggetCost');expect(source).toContain('DEAL INTELLIGENCE REPORT')});
  it('groups renderer-generated preview pages into 1, 3 and 6 page carousels',()=>{
    expect(source.match(/property-release-page-[1]\.png/g)).toHaveLength(1);
    expect(source.match(/maxxis-analysis-page-[1-3]\.png/g)).toHaveLength(3);
    expect(source.match(/deal-intelligence-page-[1-6]\.png/g)).toHaveLength(6);
    expect(source).toContain('PROPERTY_RELEASE:Object.freeze([propertyReleasePage1])');
    expect(source).toContain('MAXXIS_ANALYSIS:Object.freeze([maxxisAnalysisPage1,maxxisAnalysisPage2,maxxisAnalysisPage3])');
    expect(source).toContain('DEAL_INTELLIGENCE:Object.freeze([dealIntelligencePage1,dealIntelligencePage2,dealIntelligencePage3,dealIntelligencePage4,dealIntelligencePage5,dealIntelligencePage6])');
  });
  it('uses pages exported by the production renderer instead of independent design mockups',()=>{
    expect(source).toContain('src={pages[page]}');
    expect(source).not.toContain('Sample subject property');
    expect(source).not.toContain('Controlled commercial preview');
    expect(source).not.toContain('PAGE_CONTENT');
    expect(css).toContain('object-fit: contain');
    expect(css).toContain('@media (max-width: 767px)');
  });
  it('supports arrows, keyboard and mobile swipe navigation',()=>{
    expect(source).toContain("event.key==='ArrowLeft'");
    expect(source).toContain("event.key==='ArrowRight'");
    expect(source).toContain('onTouchStart');
    expect(source).toContain('onTouchEnd');
  });
  it('uses a standardized Back button inside preview instead of a competing close icon',()=>{expect(source).toContain('backLabel={t.back}');expect(source).toContain('report-selector-button is-secondary');expect(source).not.toContain('report-preview-close')});
  it('fits simple report states and enables scrolling only after additional export fields are selected',()=>{
    expect(modalSource).toContain('scrollable = true');
    expect(modalSource).toContain('showCloseButton = true');
    expect(portfolioSource).toContain("exportMode ? 'is-scrollable' : 'is-fitted'");
    expect(portfolioSource).toContain('scrollable={Boolean(exportMode)}');
    expect(portfolioSource).toContain('showCloseButton={false}');
    expect(css).toContain('.report-export-modal.is-scrollable');
    expect(css).toContain('.report-export-modal.is-fitted > div');
    expect(css).toContain('@media (min-width: 768px) and (max-width: 1180px) and (max-height: 850px)');
    expect(css).toContain('@media (max-width: 430px) and (max-height: 720px)');
  });
  it('keeps mobile preview width inside the popup content box',()=>{
    expect(css).toMatch(/\.report-preview-overlay\s*\{[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*0;/);
    expect(css).toContain('width: min(100%, 45dvh)');
    expect(css).not.toContain('width:min(88vw,520px)');
  });
  it('uses real theme tokens and overlays carousel arrows on the report image',()=>{
    expect(css).toContain('background: var(--card, #fff)');
    expect(css).toContain('[data-theme="dark"] .report-action-main');
    expect(source).toContain('report-preview-arrow is-previous');
    expect(source).toContain('report-preview-arrow is-next');
    expect(source).not.toContain('report-preview-controls');
    expect(portfolioSource).toContain('className="report-export-panel"');
    expect(css).toContain('.report-export-panel:has(.report-preview-overlay)');
  });
  it('moves Cancel and Continue into the shared top action bar',()=>{
    expect(source).toContain('className="report-selector-actions"');
    expect(portfolioSource).toContain('onContinue={handleConfirmEmailExport}');
    expect(portfolioSource).toContain('continueDisabled={!exportMode}');
  });
  it('lays unlocked portfolio property facts out in two columns',()=>{
    expect(portfolioSource).toContain('data-testid="matches-property-detail-grid"');
    expect(portfolioSource).toContain('gridTemplateColumns:"repeat(2, minmax(0, 1fr))"');
  });
});
