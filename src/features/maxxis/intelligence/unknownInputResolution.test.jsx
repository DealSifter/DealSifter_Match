/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { MaxxisAnalysisGapResolution } from './MaxxisAnalysisGapResolution';
import { buildReportPreflight, mergeConfirmedCompletion } from '../../../../supabase/functions/_shared/maxxis/reportCompletion';
import { applyUnknownChoice } from '../../../../supabase/functions/_shared/maxxis/unknownInputResolution';
import { buildMaxxisReportSchema } from '../../../domain/maxxis/maxxisReportSchema';
import { renderMaxxisReportPdf } from '../export/maxxisReportPdf';
import { resolveReportExportEntitlement } from '../export/reportExportEntitlement';
const propertyId='11111111-1111-4111-8111-111111111111', userId='fixture', now='2026-11-09T12:00:00Z';
const property={id:propertyId,address:'1200 Fictional Avenue',city:'Example City',state:'FL',zip:'00000',type:'SFR',objective:'Flip',price:200000};
function fixture(extra={}) {
  const a=mergeConfirmedCompletion({propertyId,userId,now,revision:1,patch:{scenarioStrategy:'FLIP',purchasePrice:200000,exitValue:300000,rehab:30000,acquisitionCosts:5000,...extra}});
  const assumptions=applyUnknownChoice(a,['holdingCosts','financingCosts','sellingCosts'],now,2);
  const p=buildReportPreflight({propertyId,userId,property,revision:2,targetCondition:'AS_IS',reportType:'DEAL_INTELLIGENCE',dealAssumptions:assumptions});
  return {p,assumptions,message:{id:'original-report',data:{propertyId,reportType:'DEAL_INTELLIGENCE',expectedRevision:2,reportPreflight:p}}};
}
afterEach(cleanup);
describe('R3.1 inline alternatives and actual PDF, offline',()=>{
  it('T2: no defensible estimate offers partial and manual, without enum labels',async()=>{
    const {message}=fixture(),onResolve=vi.fn();render(<MaxxisAnalysisGapResolution language="pt" message={message} onResolve={onResolve} onDecline={vi.fn()}/>);
    expect(screen.queryByRole('button',{name:'Estimar e continuar'})).not.toBeInTheDocument();
    expect(screen.queryByText(/USD \/ ONE_TIME/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button',{name:'Continuar com dados parciais'}));
    expect(onResolve).toHaveBeenCalledWith(message,{completionPartialAccepted:true});
  });
  it('T1: estimate preview cannot save until separate explicit confirmation',async()=>{
    const {message}=fixture({exitValue:300000,sellingCostPercent:6}),onResolve=vi.fn();
    render(<MaxxisAnalysisGapResolution message={message} onResolve={onResolve} onDecline={vi.fn()}/>);
    await userEvent.click(screen.getByRole('button',{name:'Estimate and continue'}));
    expect(onResolve).not.toHaveBeenCalled();expect(screen.getByText(/not yet adopted/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button',{name:'Confirm displayed estimates and continue'}));
    expect(onResolve).toHaveBeenCalledWith(message,{acceptEstimateFields:['sellingCosts']});
  });
  it('T7: restored UNKNOWN offers alternatives again; manual entry uses ordinary confirmed input flow',async()=>{
    const {message}=fixture({holdingCosts:1000,financingCosts:0});
    const onResolve=vi.fn(); render(<MaxxisAnalysisGapResolution message={JSON.parse(JSON.stringify(message))} onResolve={onResolve} onDecline={vi.fn()}/>);
    await userEvent.click(screen.getByRole('button',{name:'Enter values manually'}));
    await userEvent.type(screen.getByRole('spinbutton'),'18000');
    await userEvent.click(screen.getByRole('button',{name:'Confirm the values above'}));
    expect(onResolve).toHaveBeenCalledWith(expect.anything(),{completionInputs:{sellingCosts:18000}});
  });
  it('T8: actual partial PDF does not fabricate financial outputs and keeps confirmed estimate methodology',async()=>{
    const {p}=fixture({exitValue:300000,sellingCostPercent:6});
    const estimate=p.unknownResolution.candidates.sellingCosts;
    const confirmed=mergeConfirmedCompletion({existing:fixture({sellingCostPercent:6}).assumptions,propertyId,userId,now,revision:3,patch:{sellingCosts:estimate.value}});
    confirmed.r3Completion.inputs.sellingCosts={...confirmed.r3Completion.inputs.sellingCosts,origin:'SYSTEM_ASSUMPTION',estimate:{...estimate,confirmed:true}};
    const after=buildReportPreflight({propertyId,userId,property,revision:3,targetCondition:'AS_IS',reportType:'DEAL_INTELLIGENCE',dealAssumptions:confirmed,partialAccepted:true});
    expect(after.canGenerate).toBe(true);expect(after.scenario.calculatedOutputs.ROI).toBeNull();
    const schema=buildMaxxisReportSchema({reportType:'DEAL_INTELLIGENCE',property,dealIntelligence:{activeScenario:after.scenario,propertyEvidence:{status:'UNAVAILABLE'},valuationIntelligence:{status:'ARV_UNAVAILABLE',reason:'NO_COVERAGE'},comparableEvidence:{used:[],support:[],excluded:[]},provenance:{property:'USER_PROVIDED'}}});
    const rendered=await renderMaxxisReportPdf({schema,language:'en',exportEntitlement:resolveReportExportEntitlement({plan:'enterprise',reportType:'DEAL_INTELLIGENCE',channel:'PDF'})});
    expect(rendered.state,JSON.stringify(rendered.validation)).toBe('RENDERED');
    expect(rendered.document.strictViewModel.completion).not.toBe('COMPLETE');
    const values=Object.entries(rendered.document.strictViewModel.values);
    expect(values.some(([k,v])=>k.endsWith(':output:ROI')&&v.numericValue!==null)).toBe(false);
    expect(values.find(([k])=>k.endsWith(':input:sellingCosts'))?.[1].source).toMatch(/illustrative system estimate.*exit price/);
    expect(rendered.document.layoutAudit.lines.some(line=>/illustrative system estimate|confirmed private exit price/.test(line.text||''))).toBe(true);
    expect(rendered.document.layoutAudit.lines.filter(l=>l.overflowX||l.overflowY)).toHaveLength(0);
  });
});
