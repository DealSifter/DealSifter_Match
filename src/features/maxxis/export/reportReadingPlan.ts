import type { ContentBlock } from './reportContentPlan';
import type { ReportRow, ReportViewModel } from './reportIntegrityTypes';

export const READING_SECTIONS = [1, 2, 3, 4, 5, 6] as const;
export type ReadingSection = typeof READING_SECTIONS[number];
const key = (text: string) => text.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
const finance = /\b(?:NOI|ROI|cap\s*rate|cash.flow|cash.on.cash)\b|taxa de capitalização|fluxo de caixa|tasa de capitalización/i;
const valid = (row: ReportRow) => !['UNAVAILABLE', 'CONFLICTED', 'NOT_APPLICABLE'].includes(row.state || '') && !/^(?:—|unavailable|não disponível|no disponible)$/i.test(row.value);

export function readingSectionTitle(section: ReadingSection, locale: string): string {
  const titles = {
    en: ['Property overview and records', 'Pending inputs and next steps', 'Market and valuation', 'Finances', 'Investor profile and risk', 'Sources and dates'],
    pt: ['Visão geral e registro do imóvel', 'Pendências e próximos passos', 'Mercado e avaliação', 'Finanças', 'Perfil do investidor e risco', 'Fontes e data'],
    es: ['Resumen y registro del inmueble', 'Datos pendientes y próximos pasos', 'Mercado y valoración', 'Finanzas', 'Perfil del inversor y riesgo', 'Fuentes y fechas'],
  };
  return (titles[locale as keyof typeof titles] || titles.en)[section - 1];
}

/** Stable assertion identities, independent of a particular generated sentence. */
export function semanticAssertionId(text: string): string {
  if (/profile|perfil|compatib/i.test(text) && /not|unavailable|unknown|não|sin |no |ausent|missing|unconfigured|configur/i.test(text)) return 'SEM_PERFIL';
  if (/external|extern|provider|provedor|fuente|source|registro público/i.test(text) && /no |not |none|nenhum|não|sin |missing|unavailable|insuf/i.test(text)) return 'SEM_DADO_EXTERNO';
  if (/valu|ARV|market evidence|evidências de mercado|evidencia de mercado|discount|desconto|margem|return|retorno/i.test(text) && /not|no |não|sem |sin |unavailable|unknown|insuf|unconfirmed|limit|uncertain/i.test(text)) return 'SEM_EVIDENCIA_VALUATION';
  if (/condition|condição|condición|rehab|reforma/i.test(text) && /not|no |não|sem |sin |unconfirmed|unknown|unavailable|pending/i.test(text)) return 'CONDICAO_PENDENTE';
  return 'ASSERTION:' + key(text).replace(/[^\p{L}\p{N}]+/gu, '_');
}

/** Display-only reconciliation. No financial calculation and no evidence acquisition. */
export function buildReportReadingPlan(vm: ReportViewModel, raw: ContentBlock[]): ContentBlock[] {
  const t = (pt: string, en: string, es: string) => vm.locale === 'pt' ? pt : vm.locale === 'es' ? es : en;
  const result: ContentBlock[] = [], assertions = new Map<string, string>();
  const add = (block: ContentBlock, section: ReadingSection) => result.push({ ...block, readingSection: section });
  const assert = (id: string, text: string) => { if (text.trim() && !assertions.has(id)) assertions.set(id, text.trim()); };
  const profileConfigured = vm.sections.some(section => section.id === 'profile-fit' || section.id === 'investor-profile' && !!section.rows?.length);
  const pending = raw.find(block => block.id === 'report-pending');
  const pendingRows = pending?.table || [];
  const absentExternal = vm.completionBasis?.externalAccepted === false;
  const absentValue = vm.reportType === 'DEAL_INTELLIGENCE' && vm.completionBasis?.hasValue === false;
  if (absentExternal && vm.reportType === 'DEAL_INTELLIGENCE') assert('SEM_DADO_EXTERNO', t('Nenhum registro externo foi aceito para esta análise.', 'No external property record was accepted for this analysis.', 'No se aceptó un registro externo para este análisis.'));
  if (absentValue) assert('SEM_EVIDENCIA_VALUATION', t('As evidências disponíveis não sustentam uma conclusão de valor ou retorno.', 'Available evidence does not support a value or return conclusion.', 'La evidencia disponible no sustenta una conclusión de valor o rentabilidad.'));
  if (!profileConfigured && vm.reportType !== 'PROPERTY_RELEASE') assert('SEM_PERFIL', t('Perfil do investidor e compatibilidade: perfil não configurado.', 'Investor profile and compatibility: profile not configured.', 'Perfil del inversor y compatibilidad: perfil no configurado.'));

  const deferredFinance: ReportRow[] = [];
  const financeKeys = new Set<string>();
  const financeRow = (row: ReportRow): ReportRow => {
    const evidence = Object.values(vm.values).find(value => value.evidenceRefs.some(ref => row.evidenceRefs.includes(ref)));
    const computed = /calcul|cálcul|cálculo/i.test(row.source || evidence?.source || '') || row.evidenceRefs.some(ref => /calculation:|:output:/.test(ref));
    const source = computed ? t('calculado a partir das entradas mostradas', 'calculated from the inputs shown', 'calculado a partir de las entradas mostradas')
      : t('informado pelo publicador', 'reported by the publisher', 'informado por el publicador');
    return { ...row, value: `${row.value} · ${source}`, source };
  };
  const collectFinance = (row: ReportRow) => {
    const id = key(row.label + ':' + row.value);
    if (!valid(row) || financeKeys.has(id)) return;
    financeKeys.add(id); deferredFinance.push(financeRow(row));
  };
  const overview = raw.find(block => block.id === 'property-overview')!;
  const dimensions = vm.property.metrics.filter(row => valid(row) && !finance.test(row.label)).map(row => `${row.label}: ${row.value}`).join(' · ');
  add({ ...overview, photos: [...new Set(vm.property.photos.filter(photo => photo.startsWith('data:image/')))], text: [vm.property.address, vm.property.location, vm.property.price, vm.property.type, vm.property.strategy, dimensions].filter(Boolean).join('\n') }, 1);

  const profiles: ContentBlock[] = [];
  for (const block of raw) {
    if (['property-overview', 'property-metrics', 'property-photos', 'report-pending', 'next-actions', 'report-sources', 'report-disclaimer'].includes(block.id)) continue;
    if (['executive-thesis', 'opportunity-readiness', 'decision-blockers', 'profile-readiness'].includes(block.id)) {
      const sentences = (block.text || '').split(/(?<=[.!?])\s+|\n\n/).filter(Boolean);
      for (const sentence of sentences) {
        const id = semanticAssertionId(sentence);
        if (id === 'SEM_PERFIL' || id === 'SEM_EVIDENCIA_VALUATION' || id === 'SEM_DADO_EXTERNO' || block.id !== 'executive-thesis') assert(id, sentence);
      }
      // Generic generated summaries that merely repeat the overview or its missing
      // evidence are represented by the overview and the one limitation registry.
      if (block.id === 'executive-thesis' && sentences.length && !sentences.some(text => /\b(?:no |not |partial|limited)|não|sem |sin |insuf|unavailable|unknown|asking|residence|reported property/i.test(text))) add(block, 1);
      continue;
    }
    if (/^(?:investor-profile|profile-fit|profile-criteria)/.test(block.id)) {
      if (profileConfigured) profiles.push(block);
      continue;
    }
    const rows = block.rows?.filter(row => {
      if (finance.test(row.label)) { collectFinance(row); return false; }
      return true;
    });
    const prepared = { ...block, ...(block.rows ? { rows } : {}) };
    if (block.rows?.length && !rows?.length && !block.text && !block.table && block.score === undefined) continue;
    const section: ReadingSection = /rent|arv|sold-reference|comparable|listing-reference|land-market|report-location/.test(block.id) ? 3
      : /operating|financial|scenario|strategy-cost|acquisition/.test(block.id) ? 4
      : /risk|profile/.test(block.id) ? 5 : 1;
    if (section === 4 && prepared.rows) prepared.rows = prepared.rows.map(financeRow);
    add(prepared, section);
  }

  // An existing engine-projected NOI can live in values rather than property facts.
  for (const [name, value] of Object.entries(vm.values)) if (/^(?:noi|capRate|roi|cashFlow)$/.test(name) && value.numericValue !== null && ['VALUE', 'EXPLICIT_ZERO', 'PROVISIONAL'].includes(value.state)) {
    const label = name === 'noi' ? 'NOI' : name === 'capRate' ? 'Cap rate' : name === 'roi' ? 'ROI' : t('Fluxo de caixa', 'Cash flow', 'Flujo de caja');
    if (!deferredFinance.some(row => key(row.label).replace(/\s/g, '') === key(label).replace(/\s/g, ''))) collectFinance({ label, value: value.text, evidenceRefs: value.evidenceRefs, source: value.source, state: value.state });
  }
  if (deferredFinance.length) add({ id: 'financial-indicators', title: t('Indicadores financeiros e origem', 'Financial indicators and origin', 'Indicadores financieros y origen'), kind: 'facts', rows: deferredFinance }, 4);

  const actionRows: string[][] = [];
  const actionKeys = new Set<string>();
  for (const [labels, reason, action] of pendingRows) {
    const id = semanticAssertionId(reason);
    if (!assertions.has(id)) assert(id, reason);
    const actionId = key(`${labels}:${action}`);
    if (!actionKeys.has(actionId)) { actionKeys.add(actionId); actionRows.push([labels, action]); }
  }
  const additional = (vm.sections.find(section => section.id === 'next-actions')?.items || []).map(item => item.text.split('\n')[0].trim())
    .filter(text => /inspect|inspeç|inspec|lease|contract|contrato|title|título|titul|contractor|empreiteir|orçamento/i.test(text))
    .filter(text => !actionRows.some(row => key(row[1]).includes(key(text)) || key(text).includes(key(row[1]))));
  const checks = [...new Set(additional.map(text => text.replace(/^(?:Reason|Unlocks):\s*/i, '')))].slice(0, 3);
  if (assertions.size || actionRows.length || checks.length) add({ id: 'report-pending', title: t('Limitações', 'Limitations', 'Limitaciones'), kind: 'table',
    assertionIds: [...assertions.keys()], text: [...assertions.values()].join('\n'),
    columns: actionRows.length ? [t('Indicador', 'Indicator', 'Indicador'), t('Ação necessária', 'Required action', 'Acción necesaria')] : undefined,
    table: actionRows.length ? actionRows : undefined,
    afterText: checks.length ? `${t('Verificações adicionais', 'Additional checks', 'Verificaciones adicionales')}:\n${checks.join('\n')}` : undefined }, 2);

  if (profiles.length) {
    const rows = profiles.flatMap(block => block.rows || []), scoreBlock = profiles.find(block => block.score !== undefined);
    const text = profiles.map(block => block.text).filter(Boolean).filter(text => !/Match Score:/.test(text!)).join('\n');
    add({ id: 'profile-compatibility', title: t('Perfil, compatibilidade e critérios', 'Profile, compatibility and criteria', 'Perfil, compatibilidad y criterios'), kind: 'facts', rows, text: text || undefined, score: scoreBlock?.score }, 5);
  }
  const sources = raw.find(block => block.id === 'report-sources');
  if (sources?.rows?.length) add(sources, 6);
  else add({ id: 'report-sources', title: t('Fontes', 'Sources', 'Fuentes'), kind: 'text', text: t('Fontes consultadas e respectivas datas não registradas.', 'Retrieved sources and dates were not recorded.', 'No se registraron fuentes consultadas y fechas.') }, 6);
  const disclaimer = raw.find(block => block.kind === 'disclaimer');
  if (disclaimer) add(disclaimer, 6);
  const order = (block: ContentBlock) => block.id === 'property-overview' ? 0 : block.id === 'executive-thesis' ? 1 : block.id === 'property-notes' ? 2 : block.id === 'market-rent' ? 0 : /table|location/.test(block.id) ? 1 : /arv/.test(block.id) ? 2 : 3;
  return result.sort((a, b) => a.readingSection! - b.readingSection! || order(a) - order(b));
}
