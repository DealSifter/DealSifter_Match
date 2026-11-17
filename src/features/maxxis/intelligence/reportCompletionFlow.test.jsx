/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MaxxisAnalysisGapResolution } from './MaxxisAnalysisGapResolution';
import { buildReportPreflight, mergeConfirmedCompletion } from '../../../../supabase/functions/_shared/maxxis/reportCompletion';
import { parseAnalysisGapAnswer } from './analysisGapAnswer';
import { parseConversationalCompletion } from './conversationalCompletion';
import { projectSavedReportScenario } from '../export/reportSavedScenarioProjection';
import { buildMaxxisReportSchema } from '../../../domain/maxxis/maxxisReportSchema';
import { renderMaxxisReportPdf } from '../export/maxxisReportPdf';
import { resolveReportExportEntitlement } from '../export/reportExportEntitlement';
import { mkdir,writeFile } from 'node:fs/promises';

afterEach(cleanup);
const propertyId='11111111-1111-4111-8111-111111111111', userId='fixture-user';
const property={id:propertyId,type:'SFR',objective:'Buy and Hold',price:200000};
const full={rent:2000,vacancyRate:5,opexMethod:'ITEMIZED',propertyTax:2200,insurance:1600,HOA:0,maintenanceAmount:1200,managementPercent:0,utilities:0,otherOperatingExpenses:0};
const state=patch=>mergeConfirmedCompletion({patch,propertyId,userId,now:'2026-11-05T12:00:00Z',revision:1});
const build=assumptions=>buildReportPreflight({propertyId,userId,property,reportType:'DEAL_INTELLIGENCE',targetCondition:'AS_IS',dealAssumptions:assumptions,revision:1});
const message=p=>({id:'request-gap',data:{reportType:'DEAL_INTELLIGENCE',propertyId,expectedRevision:1,reportPreflight:p,missingUserInputs:p.missingUserInputs}});

describe('R-3 existing inline UI and snapshot integration (local)',()=>{
  it('R3-03: asks only insurance and submits the visible value as a private confirmed input',async()=>{
    const {insurance:_,...rest}=full,onResolve=vi.fn();
    render(<MaxxisAnalysisGapResolution message={message(build(state(rest)))} onResolve={onResolve} onDecline={vi.fn()}/>);
    expect(screen.getAllByRole('spinbutton')).toHaveLength(1);
    await userEvent.type(screen.getByLabelText(/Annual insurance/),'1600');
    await userEvent.click(screen.getByRole('button',{name:'Confirm the values above'}));
    expect(onResolve).toHaveBeenCalledWith(expect.anything(),{completionInputs:{insurance:1600}});
  });
  it('R3-04: 30% is an editable illustration shown only when aggregate methodology was selected',async()=>{
    const onResolve=vi.fn(),p=build(state({rent:2000,vacancyRate:5,opexMethod:'AGGREGATE_EGI'}));
    render(<MaxxisAnalysisGapResolution message={message(p)} onResolve={onResolve} onDecline={vi.fn()}/>);
    expect(onResolve).not.toHaveBeenCalled(); expect(screen.getByRole('spinbutton')).toHaveValue(30);
    expect(screen.getByText(/editable illustration only/)).toBeInTheDocument();
    await userEvent.clear(screen.getByRole('spinbutton'));await userEvent.type(screen.getByRole('spinbutton'),'25');
    await userEvent.click(screen.getByRole('button',{name:'Confirm the values above'}));
    expect(onResolve).toHaveBeenCalledWith(expect.anything(),{completionInputs:{opexPercent:25}});
  });
  it('R3-16: confirms residuals, rechecks the same report and requires explicit partial acceptance',async()=>{
    const {insurance:_,...rest}=full,existing=state(rest);let completed;
    const resolve=vi.fn((_message,values)=>{completed=mergeConfirmedCompletion({existing,patch:values.completionInputs,propertyId,userId,now:'2026-11-05T13:00:00Z',revision:2});});
    const ui=render(<MaxxisAnalysisGapResolution message={message(build(existing))} onResolve={resolve} onDecline={vi.fn()}/>);
    await userEvent.type(screen.getByRole('spinbutton'),'1600');await userEvent.click(screen.getByRole('button',{name:'Confirm the values above'}));
    const after=build(completed);expect(after.status).toBe('PARTIAL_ALLOWED');expect(after.gaps.some(g=>g.id==='insurance')).toBe(false);
    ui.unmount();const partial=vi.fn();render(<MaxxisAnalysisGapResolution message={message(after)} onResolve={partial} onDecline={vi.fn()}/>);
    expect(partial).not.toHaveBeenCalled();await userEvent.click(screen.getByRole('button',{name:'Generate with explicit limitations'}));
    expect(partial).toHaveBeenCalledWith(expect.anything(),{completionPartialAccepted:true});
  });
  it('R3-17/R3-18: chat-captured values survive serialization and project into the PDF unchanged',()=>{
    const captured=parseConversationalCompletion('My insurance is $1,600 per year and I expect $2,000 monthly rent.');
    const snapshot=build(JSON.parse(JSON.stringify(state({...full,...captured.values}))));
    const projection=projectSavedReportScenario({scenario:snapshot.scenario,locale:'en',propertyId});
    expect(Object.entries(projection.values).some(([k,v])=>k.endsWith(':input:insurance')&&v.numericValue===1600)).toBe(true);
    expect(Object.entries(projection.values).some(([k,v])=>k.endsWith(':output:NOI')&&v.numericValue===snapshot.scenario.calculatedOutputs.NOI)).toBe(true);
    expect(snapshot.scenario.calculatedOutputs.annualCashFlow).toBeNull();
  });
  it('keeps all target-condition categories and understands a scoped numeric reply without invoking AI',()=>{
    const p=build(state(Object.fromEntries(Object.entries(full).filter(([k])=>k!=='insurance'))));
    expect(parseAnalysisGapAnswer(message(p),'1600')).toEqual({action:'resolve',values:{completionInputs:{insurance:1600}}});
    const condition={data:{reportPreflight:{},missingUserInputs:['target_condition']}};
    expect(parseAnalysisGapAnswer(condition,'turn key').values.targetCondition).toBe('TURN_KEY');
    expect(parseAnalysisGapAnswer(condition,'new construction').values.targetCondition).toBe('NEW_CONSTRUCTION');
  });
  it('R3-18/R3-22/R3-24: the real PDF consumes declared insurance and engine NOI without stale absence warnings',async()=>{
    const snapshot=build(state({...full,monthlyPI:0,cashInvested:200000}));
    const schema=buildMaxxisReportSchema({reportType:'DEAL_INTELLIGENCE',property:{...property,address:'1200 Fictional Avenue',city:'Example City',state:'FL',zip:'00000'},
      dealIntelligence:{activeScenario:snapshot.scenario,propertyEvidence:{status:'UNAVAILABLE'},
        valuationIntelligence:{status:'ARV_UNAVAILABLE',reason:'NO_COVERAGE'},comparableEvidence:{used:[],support:[],excluded:[]},
        provenance:{property:'USER_PROVIDED'},limitations:['Recorded sales are unavailable.']}});
    const rendered=await renderMaxxisReportPdf({schema,language:'en',exportEntitlement:resolveReportExportEntitlement({plan:'enterprise',reportType:'DEAL_INTELLIGENCE',channel:'PDF'})});
    expect(rendered.state, JSON.stringify(rendered.validation || rendered)).toBe('RENDERED');expect(rendered.document.pageCount).toBeLessThanOrEqual(6);
    const model=rendered.document.strictViewModel;
    expect(Object.entries(model.values).some(([k,v])=>k.endsWith(':input:insurance')&&v.numericValue===1600&&v.source.includes('User declared'))).toBe(true);
    expect(Object.entries(model.values).some(([k,v])=>k.endsWith(':output:NOI')&&v.numericValue===snapshot.scenario.calculatedOutputs.NOI)).toBe(true);
    expect(model.sections.some(section=>/Insurance: applicability and amount are unconfirmed/.test(section.text||''))).toBe(false);
    expect(rendered.document.layoutAudit.lines.filter(l=>l.overflowX||l.overflowY)).toHaveLength(0);
    await mkdir('.tmp-codex/r3-completion',{recursive:true});await writeFile('.tmp-codex/r3-completion/R3-private-L3.pdf',rendered.document.binary);
  });
});
