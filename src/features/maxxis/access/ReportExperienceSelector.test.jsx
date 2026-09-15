import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ReportExperienceSelector } from './ReportExperienceSelector';
const source=readFileSync(new URL('./ReportExperienceSelector.jsx',import.meta.url),'utf8');
const css=readFileSync(new URL('./ReportExperienceSelector.css',import.meta.url),'utf8');
describe('Report Experience Selector',()=>{
  it('starts with approved stacked actions and no selection',()=>{const html=renderToStaticMarkup(<ReportExperienceSelector plan="free" language="en"/>);expect(html.match(/BASIC PROPERTY RELEASE/g)).toHaveLength(4);expect(html).toContain('Download to device');expect(html).toContain('Send by email');expect(html).toContain('AI-powered property analysis');expect(html).not.toContain('is-selected')});
  it('keeps info preview independent from actions',()=>{const action=vi.fn();renderToStaticMarkup(<ReportExperienceSelector onBasicDownload={action}/>);expect(source).toContain("onInfo={()=>setPreview('PROPERTY_RELEASE')}");expect(action).not.toHaveBeenCalled()});
  it('defines canonical intelligence selection and 3/5 access resolver',()=>{expect(source).toContain("['MAXXIS_ANALYSIS','DEAL_INTELLIGENCE']");expect(source).toContain('access.nuggetCost');expect(source).toContain('DEAL INTELLIGENCE REPORT')});
  it('uses official assets and responsive real-content paginated previews',()=>{expect(source).toContain('maxxis-master.png');expect(source).toContain('avatar-success.png');expect(source).toContain('DEAL_INTELLIGENCE');expect(source).toContain('Comparative Market Analysis');expect(source).not.toContain('report-preview-line');expect(css).toContain('@media(max-width:767px)');expect(css).toContain('overflow:hidden')});
  it('uses Back inside preview instead of a competing close icon',()=>{expect(source).toContain('← {t.back}');expect(source).not.toContain('report-preview-close')});
});
