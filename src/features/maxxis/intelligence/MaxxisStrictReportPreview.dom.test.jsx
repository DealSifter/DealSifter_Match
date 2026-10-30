// @vitest-environment jsdom
import React from 'react';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {MaxxisDealIntelligenceReportPreview} from './MaxxisDealIntelligenceReportPreview';
import {renderMaxxisReportPdfCached} from '../export/maxxisReportPdf';
import {prepareReportNarrativePresentation} from '../presentation/reportNarrativePresentation';
const pdf=vi.hoisted(()=>({getDocument:vi.fn(),GlobalWorkerOptions:{}}));
vi.mock('../export/maxxisReportPdf',()=>({renderMaxxisReportPdfCached:vi.fn()}));
vi.mock('../presentation/reportNarrativePresentation',()=>({prepareReportNarrativePresentation:vi.fn()}));
vi.mock('pdfjs-dist/legacy/build/pdf.mjs',()=>pdf);
const schema={type:'maxxis_report_schema',reportType:'DEAL_INTELLIGENCE',pages:[{page:1}]};
const entitlement={allowed:true,state:'AUTHORIZED',reportType:'DEAL_INTELLIGENCE',channel:'PDF'};
const props={schema,language:'pt',generatedAt:'2026-10-30T12:00:00Z',exportEntitlements:{PDF:entitlement}};
const binary=new Uint8Array([37,80,68,70,45,49,46,55]);
const open=async container=>act(async()=>{const details=container.querySelector('details');details.open=true;fireEvent(details,new Event('toggle'));});
beforeEach(()=>{
 vi.clearAllMocks();vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({});
 prepareReportNarrativePresentation.mockResolvedValue();renderMaxxisReportPdfCached.mockResolvedValue({state:'RENDERED',document:{binary}});
 pdf.getDocument.mockReturnValue({promise:Promise.resolve({numPages:3,getPage:async()=>({getViewport:()=>({width:600,height:840}),render:()=>({promise:Promise.resolve(),cancel:vi.fn()})})}),destroy:vi.fn()});
});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
describe('chat previews the actual PDF lazily',()=>{
 it('renders the returned PDF bytes and actual page count only after opening',async()=>{
  const {container,rerender}=render(<MaxxisDealIntelligenceReportPreview {...props}/>);
  expect(renderMaxxisReportPdfCached).not.toHaveBeenCalled();expect(prepareReportNarrativePresentation).not.toHaveBeenCalled();
  await open(container);await waitFor(()=>expect(container.querySelectorAll('canvas')).toHaveLength(3));
  expect(renderMaxxisReportPdfCached).toHaveBeenCalledWith({schema,exportEntitlement:entitlement,generatedAt:props.generatedAt,language:'pt'});
  expect(pdf.getDocument.mock.calls[0][0].data).toEqual(binary);expect(pdf.getDocument.mock.calls[0][0].data).not.toBe(binary);
  await waitFor(()=>expect(container.querySelector('details').className).toContain('is-deal_intelligence'));
  rerender(<MaxxisDealIntelligenceReportPreview {...props} exportEntitlements={{PDF:{...entitlement}}}/>);
  expect(renderMaxxisReportPdfCached).toHaveBeenCalledTimes(1);expect(container.textContent).not.toContain('maxxis-v2-page');
 });
 it.each([undefined,{...entitlement,allowed:false},{...entitlement,reportType:'MAXXIS_ANALYSIS'}])('does not render without matching access: %o',async decision=>{
  const{container}=render(<MaxxisDealIntelligenceReportPreview {...props} exportEntitlements={{PDF:decision}}/>);await open(container);
  await waitFor(()=>expect(container.textContent).toContain('o acesso a este relatório não foi confirmado'));
  expect(renderMaxxisReportPdfCached).not.toHaveBeenCalled();expect(pdf.getDocument).not.toHaveBeenCalled();
 });
 it('offers retry after a PDF error instead of substituting another design',async()=>{
  renderMaxxisReportPdfCached.mockResolvedValueOnce({state:'VALIDATION_FAILED'});
  const{container}=render(<MaxxisDealIntelligenceReportPreview {...props}/>);await open(container);
  await waitFor(()=>expect(screen.getByRole('button',{name:'Tentar novamente'})).toBeTruthy());
  fireEvent.click(screen.getByRole('button',{name:'Tentar novamente'}));await waitFor(()=>expect(container.querySelectorAll('canvas')).toHaveLength(3));
  expect(renderMaxxisReportPdfCached).toHaveBeenCalledTimes(2);
 });
 it('does not start PDF work after unmounting during asset preparation',async()=>{
  let finish;prepareReportNarrativePresentation.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
  const{container,unmount}=render(<MaxxisDealIntelligenceReportPreview {...props}/>);await open(container);unmount();
  await act(async()=>finish());expect(renderMaxxisReportPdfCached).not.toHaveBeenCalled();
 });
});
