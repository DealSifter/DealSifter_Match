// @vitest-environment jsdom
/* global process */
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MaxxisAnalysisGapResolved } from './intelligence/MaxxisAnalysisGapResolution';
import { MaxxisArvVisualCompReview } from './arvReview/MaxxisArvVisualCompReview';
import { arvReviewGuidance } from './arvReview/arvVisualCompReview';
import { localizeMaxxisValue } from './presentation/maxxisPresentationI18n';

const evaluation = {
  status: 'ARV_UNAVAILABLE', confidence: 'LOW', eligibleCompCount: 0,
  limitations: ['INSUFFICIENT_CONDITION_COMPATIBLE_COMPS'], warnings: [],
  confidenceReasons: ['INSUFFICIENT_CONDITION_COMPATIBLE_COMPS'], valuationSet: [], evidenceSummary: {},
};
const data = {
  propertyId: '00000000-0000-4000-8000-000000000001', targetCondition: 'UNKNOWN',
  targetConditionEvidenceStatus: 'UNAVAILABLE', arvEvaluation: evaluation,
  summary: { status: 'NOT_STARTED', reviewedCount: 0, totalStructuralCandidates: 2 },
  candidates: [
    { stableCompIdentifier: 'c1', address: { line1: '10 Rua A', city: 'Beverly Hills', state: 'CA' }, structuralComparabilityScore: 87, dataCompletenessScore: 72, distanceMiles: 2.5, recordedSalePrice: 1900000, recordedSaleDate: '2026-01-01', externalUrls: {} },
    { stableCompIdentifier: 'c2', address: { line1: '20 Rua B', city: 'Beverly Hills', state: 'CA' }, structuralComparabilityScore: 83, dataCompletenessScore: 69, distanceMiles: 2.7, recordedSalePrice: 2100000, recordedSaleDate: '2026-02-01', externalUrls: {} },
  ],
};
const renderArv = (props = {}) => render(<MaxxisArvVisualCompReview messageId="m1" data={data} language="pt" {...props} />);
const source = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');
afterEach(cleanup);

describe('production UX correction acceptance', () => {
  it('1 compact Gap Resolver uses reduced field heights', () => expect(source('src/components/maxxis/MaxxisAssistant.css')).toContain('min-height: 28px'));
  it('2 compact ARV card uses the normal ARV heading', () => { renderArv(); expect(screen.getAllByText(/^ARV:/).length).toBeGreaterThan(0); expect(screen.queryByText('ARV Intelligence')).toBeNull(); });
  it('3 resolved card collapses the editor', () => { render(<MaxxisAnalysisGapResolved language="pt" message={{ data: { resolution: { values: { targetCondition: 'AS_IS' }, declinedFields: [] } } }} />); expect(screen.queryByRole('combobox')).toBeNull(); });
  it('4 condition control is clickable', async () => { const fn = vi.fn(); renderArv({ onRequestGap: fn }); await userEvent.click(screen.getByRole('button', { name: 'Confirmar condição' })); expect(fn).toHaveBeenCalledWith('m1', 'target_condition'); });
  it('5 rehab control is clickable', async () => { const fn = vi.fn(); renderArv({ onRequestGap: fn }); await userEvent.click(screen.getByRole('button', { name: 'Revisar rehab' })); expect(fn).toHaveBeenCalledWith('m1', 'rehab_budget'); });
  it('6 ARV action controls are buttons', () => { renderArv(); expect(screen.getAllByRole('button')).toHaveLength(4); });

  it('7 Portuguese session localizes analytical labels', () => expect(localizeMaxxisValue('ARV_UNAVAILABLE', 'pt')).toBe('ARV indisponível'));
  it('8 status enums are localized', () => expect(localizeMaxxisValue('NOT_STARTED', 'pt')).toBe('Ainda não iniciado'));
  it('9 provenance is localized', () => expect(localizeMaxxisValue('USER_PROVIDED', 'pt')).toBe('Informado pelo usuário'));
  it('10 supporting status is localized', () => expect(localizeMaxxisValue('SUPPORTING', 'pt')).toBe('Evidência de apoio'));
  it('11 raw enum identifiers are absent from the PT ARV card', () => { renderArv(); expect(document.body.textContent).not.toMatch(/ARV_UNAVAILABLE|NOT_STARTED|USER_PROVIDED/); expect(localizeMaxxisValue('PROVIDER_ESTIMATE_UNVALIDATED', 'pt')).toBe('Estimativa do provedor não validada'); });

  it('12 guidance explains the exact condition blocker', () => expect(arvReviewGuidance(data.summary, 'pt', evaluation, data)).toContain('condição-alvo'));
  it('13 guidance includes supporting candidate count', () => expect(arvReviewGuidance(data.summary, 'pt', evaluation, data)).toContain('2 vendas estruturalmente semelhantes'));
  it('14 guidance offers concrete next steps', () => expect(arvReviewGuidance(data.summary, 'pt', evaluation, data)).toContain('revisar o rehab'));
  it('15 condition action requests Gap Resolver', async () => { const fn = vi.fn(); renderArv({ onRequestGap: fn }); await userEvent.click(screen.getByText('Confirmar condição')); expect(fn).toHaveBeenCalledOnce(); });
  it('16 rehab action requests Gap Resolver', async () => { const fn = vi.fn(); renderArv({ onRequestGap: fn }); await userEvent.click(screen.getByText('Revisar rehab')); expect(fn).toHaveBeenCalledOnce(); });
  it('17 supporting comps can be inspected', async () => { renderArv(); await userEvent.click(screen.getByText('Comparáveis de apoio (2)')); expect(screen.getByText('10 Rua A')).toBeTruthy(); });
  it('18 continue without ARV collapses the card', async () => { renderArv(); await userEvent.click(screen.getByText('Continuar sem ARV')); expect(screen.getByText(/Continuando sem ARV/)).toBeTruthy(); expect(screen.queryByText('Confirmar condição')).toBeNull(); });

  it('19 inline report uses DOM before any PDF artifact', () => { const code = source('src/features/maxxis/intelligence/MaxxisDealIntelligenceExperience.jsx'); expect(code).toContain('MaxxisDealIntelligenceReportPreview'); expect(code).not.toContain('MaxxisCanonicalReportPreview'); });
  it('20 PDF renderer yields between every page', () => expect(source('src/features/maxxis/export/maxxisReportPdf.js')).toContain('await yieldReportRendering()'));
  it('21 long-task instrumentation records responsiveness thresholds', () => { const code = source('src/features/maxxis/performance/maxxisBrowserPerformance.js'); expect(code).toContain('longTasksOver1000Ms'); expect(code).toContain("type: 'longtask'"); });
  it('22 PDF visual renderer remains the canonical renderer', () => expect(source('src/features/maxxis/export/maxxisReportPdf.js')).toContain('renderMaxxisReportDocument'));
  it('23 PDF generation is single-flight cached', () => expect(source('src/features/maxxis/export/maxxisReportPdf.js')).toContain('reportRenderCache'));
  it('24 PDF path contains no Gemini call', () => expect(source('src/features/maxxis/export/maxxisReportPdf.js')).not.toMatch(/generative-ai|gemini/i));
  it('25 PDF path contains no provider acquisition call', () => expect(source('src/features/maxxis/export/maxxisReportPdf.js')).not.toMatch(/rentcast|fetch\s*\(/i));

  it('26 preserves five supporting comps while condition re-evaluation is in flight and after it completes', () => {
    const supporting = Array.from({ length: 5 }, (_, index) => ({ compIdentifier: `c${index + 1}`, valuationEligibility: 'SUPPORTING_ONLY' }));
    const fiveCandidates = supporting.map((item, index) => ({
      stableCompIdentifier: item.compIdentifier,
      address: { line1: `${index + 1} Apoio St`, city: 'Beverly Hills', state: 'CA' },
      structuralComparabilityScore: 85 - index,
      dataCompletenessScore: 70,
      distanceMiles: 1 + index / 10,
      recordedSalePrice: 1_900_000 + index * 10_000,
      recordedSaleDate: '2026-01-01',
      externalUrls: {},
    }));
    const canonicalData = {
      ...data,
      candidates: fiveCandidates,
      summary: { ...data.summary, totalStructuralCandidates: 5 },
      arvEvaluation: { ...evaluation, supportingCompCount: 5, valuationSet: supporting },
      compAnalysisState: { candidatesConsidered: 5, structuralCandidates: supporting,
        selected: [], supporting, excluded: [], arvEligible: [] },
    };
    const view = renderArv({ data: canonicalData, activeReviewKey: 'target' });
    expect(screen.getByText('Reavaliando os 5 comparáveis de apoio…')).toBeTruthy();
    expect(document.body.textContent).toContain('Apoio 5');
    expect(document.body.textContent).not.toContain('Apoio 0');
    view.rerender(<MaxxisArvVisualCompReview messageId="m1" data={{ ...canonicalData,
      targetCondition: 'TURN_KEY', targetConditionEvidenceStatus: 'USER_PROVIDED' }} language="pt" />);
    expect(screen.getByText('Comparáveis de apoio (5)')).toBeTruthy();
    expect(document.body.textContent).not.toContain('Não há comparáveis suficientes');
  });
});
