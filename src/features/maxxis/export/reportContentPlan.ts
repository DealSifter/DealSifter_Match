import type { ReportViewModel, ReportSection, ReportRow, ReportMapPoint } from './reportIntegrityTypes';
import { evidenceAbsenceCopy } from '../../../../supabase/functions/_shared/maxxis/evidenceAbsence';
import { buildReportReadingPlan, type ReadingSection } from './reportReadingPlan';

export const REPORT_INTERNAL_JARGON = /\b(?:SOLD|AVM|gates?|structural candidates|normalized)\b|not requested in this flow/i;
export const REPORT_RAW_ISO = /\b\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z?)?\b/g;
export const REPORT_INTERNAL_LABELS = /(?:Limitation and impact|Next verification|Reason|Unlocks)\s*:/gi;
export function readableReportDate(value: string, locale = 'en'): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es-ES' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date);
}
export function reportCompletion(facts: { externalAccepted: boolean; hasValue: boolean; mainArv: boolean; calculatedFinancials: boolean; blocking: boolean }): NonNullable<ReportViewModel['completion']> {
  if (!facts.externalAccepted || !facts.hasValue) return 'PRELIMINARY';
  return facts.mainArv && facts.calculatedFinancials && !facts.blocking ? 'COMPLETE' : 'PARTIAL';
}
export const contentKey = (text: string) => text.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
export function reportReaderText(value: string, locale = 'en'): string {
  const pt = locale === 'pt', es = locale === 'es';
  return value.replace(REPORT_RAW_ISO, date => readableReportDate(date, locale))
    .replace(/(?:Limitation and impact|Next verification|Reason|Unlocks|Limitação e impacto|Próxima verificação|Motivo|Desbloqueia|Limitación e impacto|Habilita)\s*:\s*/gi, '')
    .replace(/not requested in this flow/gi, pt ? 'Não consultado neste relatório' : es ? 'No consultado en este informe' : 'Not consulted for this report')
    .replace(/structural candidates/gi, pt ? 'vendas em análise' : es ? 'ventas en revisión' : 'sales under review')
    .replace(/\bSOLDs?\b/gi, pt ? 'vendas registradas' : es ? 'ventas registradas' : 'recorded sales')
    .replace(/\bAVM\b/gi, pt ? 'estimativa automatizada' : es ? 'estimación automatizada' : 'automated estimate')
    .replace(/\bgates?\b/gi, pt ? 'critérios de verificação' : es ? 'criterios de verificación' : 'verification criteria')
    .replace(/\bnormalized\b/gi, pt ? 'organizados' : es ? 'organizados' : 'organized').replace(/…/g, '.');
}
export interface ContentBlock {
  range?: { low: string; high: string; estimate: string; position: number };
  comparison?: { label: string; value: number; text: string }[];
  hero?: { value: string; note?: string };
  readingSection?: ReadingSection; assertionIds?: string[]; afterText?: string; textSize?: number;
  id: string; title: string; kind: 'overview' | 'text' | 'facts' | 'table' | 'map' | 'photos' | 'disclaimer';
  text?: string; rows?: ReportRow[]; columns?: string[]; table?: string[][]; photos?: string[];
  map?: { points: ReportMapPoint[]; caption: string; sourceId?: string }; score?: number;
}
const empty = (text: string) => !text || /^(?:—|-|unavailable|não disponível|no disponible|unknown|não informado|not provided)$/i.test(text.trim());
const point = (p: ReportMapPoint) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && Math.abs(p.latitude) <= 85 && Math.abs(p.longitude) <= 180;

/** Display composition only. Never calculates financial outputs or acquires evidence. */
function composeRawReportContent(vm: ReportViewModel): ContentBlock[] {
  const t = (pt: string, en: string, es: string) => vm.locale === 'pt' ? pt : vm.locale === 'es' ? es : en;
  const clean = (text: string) => reportReaderText(text, vm.locale);
  const blocks: ContentBlock[] = [], keys = new Map<string, ContentBlock>(), texts = new Set<string>(), fields = new Set<string>();
  const uniqueText = (text: string) => {
    const cleaned = clean(text).trim(), key = contentKey(cleaned);
    if (!key || texts.has(key) || cleaned === vm.disclaimer) return '';
    texts.add(key); return cleaned;
  };
  const add = (block: ContentBlock) => {
    const key = contentKey(JSON.stringify({ kind: block.kind, text: block.text, rows: block.rows?.map(({ label, value }) => ({ label, value })), columns: block.columns, table: block.table, photos: block.photos, map: block.map, range: block.range, comparison: block.comparison }));
    const existing = keys.get(key);
    if (existing) {
      if (block.table && existing.title !== clean(block.title)) existing.title += ` / ${clean(block.title)}`;
      return;
    }
    const prepared = { ...block, title: clean(block.title) };
    keys.set(key, prepared); blocks.push(prepared);
  };
  const photos = [...new Set(vm.property.photos.filter(photo => /^data:image\//.test(photo)))];
  const overview = [vm.property.address, vm.property.location, vm.property.price, vm.property.type, vm.property.strategy].filter(value => !empty(value));
  if (vm.reportType === 'PROPERTY_RELEASE') overview.push(vm.property.metrics.filter(row => !empty(row.value) && !['UNAVAILABLE', 'NOT_APPLICABLE', 'CONFLICTED'].includes(row.state || '')).map(row => `${row.label}: ${row.value}`).join(' · '));
  if (vm.reportType === 'PROPERTY_RELEASE') vm.property.metrics.forEach(row => fields.add(contentKey(`${clean(row.label)}:${clean(row.value)}`)));
  overview.forEach(value => texts.add(contentKey(clean(value))));
  add({ id: 'property-overview', title: t('Visão geral do imóvel', 'Property overview', 'Resumen del inmueble'), kind: 'overview', text: overview.map(clean).join('\n'), photos: photos.slice(0, 1) });
  if (vm.executive?.thesis.text) { const text = uniqueText(vm.executive.thesis.text); if (text) add({ id: 'executive-thesis', title: t('Síntese da análise', 'Analysis summary', 'Resumen del análisis'), kind: 'text', text }); }
  const rowGroup = (id: string, title: string, rows: ReportRow[]) => {
    const selected = rows.filter(row => !empty(row.value) && !['UNAVAILABLE', 'NOT_APPLICABLE', 'CONFLICTED'].includes(row.state || '')).map(row => ({ ...row, label: clean(row.label), value: clean(row.value), source: undefined }))
      .filter(row => { const key = contentKey(`${row.label}:${row.value}`); if (fields.has(key) || row.value === vm.property.price && /^(asking price|price|preço pedido|precio solicitado)$/i.test(row.label)) return false; fields.add(key); return true; });
    if (selected.length) {
      const narrative = blocks.find(block => block.id === id.replace(/-facts$/, '') && block.kind === 'text' && block.score === undefined);
      if (narrative) { narrative.kind = 'facts'; narrative.rows = selected; }
      else add({ id, title, kind: 'facts', rows: selected });
    }
  };
  if (vm.reportType !== 'PROPERTY_RELEASE') rowGroup('property-metrics', t('Características', 'Features', 'Características'), vm.property.metrics);
  for (const [index, group] of vm.property.facts.entries()) rowGroup(`property-group-${index}`, group.title, group.rows);
  if (photos.length > 1) add({ id: 'property-photos', title: t('Fotos adicionais', 'Additional photos', 'Fotos adicionales'), kind: 'photos', photos: photos.slice(1) });
  const pendingPosition = blocks.length;

  const pending = new Map<string, { label: string; reason: string; action: string }>();
  const labels: Record<string, string> = {
    propertyRecord: t('Cadastro externo', 'External property record', 'Registro externo'), valuation: t('Estimativa de valor', 'Value estimate', 'Estimación de valor'),
    recordedSales: t('Vendas comparáveis', 'Comparable sales', 'Ventas comparables'), marketRent: t('Aluguel de mercado', 'Market rent', 'Alquiler de mercado'),
    arv: 'ARV', noi: 'NOI', capRate: 'Cap rate', roi: 'ROI', cashFlow: t('Fluxo de caixa', 'Cash flow', 'Flujo de caja'),
    landInformation: t('Dados do terreno', 'Land information', 'Datos del terreno'), comparablesMap: t('Localização dos comparáveis', 'Comparable locations', 'Ubicación de comparables'),
  };
  const action = t('Confirme os dados e as fontes indicadas antes de utilizar este indicador.', 'Confirm the stated inputs and evidence before using this indicator.', 'Confirme los datos y las fuentes antes de utilizar este indicador.');
  if (vm.reportType !== 'PROPERTY_RELEASE') for (const [key, reason] of Object.entries(vm.indicatorReasons || {})) {
    if (!reason || reason === 'NOT_REQUESTED' || !labels[key]) continue;
    if (vm.reportType === 'MAXXIS_ANALYSIS' && ['arv', 'recordedSales', 'valuation', 'comparablesMap', 'roi'].includes(key)) continue;
    const copy = reason === 'INTERNAL_ERROR' ? t('Ocorreu um problema temporário em nosso sistema.', 'A temporary issue occurred on our side.', 'Se produjo un problema temporal en nuestro sistema.') : reason === 'USER_INPUT_REQUIRED' ? t('Os dados necessários ainda precisam de confirmação.', 'Required inputs still need confirmation.', 'Los datos necesarios aún requieren confirmación.') : clean(evidenceAbsenceCopy(reason, vm.locale));
    const financial = ['noi', 'capRate', 'roi', 'cashFlow'].includes(key);
    const requiredAction = financial ? t('Confirme renda, despesas e a base de investimento do cenário.', 'Confirm income, expenses and the investment basis for the scenario.', 'Confirme ingresos, gastos y la base de inversión del escenario.')
      : key === 'arv' ? t('Confirme a condição do imóvel e vendas comparáveis elegíveis.', 'Confirm the target condition of the property (Maxxis will ask in chat) so eligible sales can be evaluated.', 'Confirme la condición del inmueble y ventas comparables elegibles.')
      : key === 'comparablesMap' ? t('Confirme as coordenadas dos imóveis comparáveis.', 'Confirm coordinates for the comparable properties.', 'Confirme las coordenadas de los inmuebles comparables.') : action;
    const actions = {
      IDENTITY_MISMATCH: t('Confirme cidade, estado e ZIP.', 'Confirm city, state and ZIP.', 'Confirme ciudad, estado y ZIP.'),
      QUOTA_BLOCKED: t('Orçamento mensal de dados atingido; disponível na renovação.', 'Monthly data allowance reached; available upon renewal.', 'Presupuesto mensual agotado; disponible al renovarse.'),
      NO_COVERAGE: t('O provedor não tem registro; informe manualmente.', 'The provider has no record; supply the information manually.', 'El proveedor no tiene registro; aporte los datos manualmente.'),
      INTERNAL_ERROR: t('Gere novamente mais tarde. Nenhum dado do provedor foi perdido.', 'Regenerate later.', 'Genere más tarde. No se perdieron datos del proveedor.'),
      PROVIDER_ERROR: t('Tente novamente mais tarde.', 'Try again later.', 'Inténtelo de nuevo más tarde.'),
    };
    pending.set(key, { label: labels[key], reason: copy, action: reason === 'USER_INPUT_REQUIRED' ? requiredAction : actions[reason as keyof typeof actions] || requiredAction });
  }
  const rawSections = vm.sections.filter(section => !/^(property-facts-|property-tax$|property-contacts$|publisher-notes$|evidence-availability$|positive-signals$|evidence-coverage$|sold-delivery$|sold-diagnostic|comparables-by-group$)/.test(section.id));
  const tableSections = rawSections.filter(section => section.table?.rows.length);
  const mapped = tableSections.find(section => section.id === 'arv-market' && section.map) || tableSections.find(section => section.map);
  for (const section of rawSections) {
    // The actionable list is built from the final residual gaps below, not from
    // a historical/default verification checklist that may already be resolved.
    if (section.id === 'next-actions') continue;
    if (['profile-readiness', 'opportunity-readiness'].includes(section.id)) {
      const text = uniqueText(section.text || (section.rows || []).map(row => row.value).join(' '));
      if (text) add({ id: section.id, title: section.title, kind: 'text', text });
      continue;
    }
    if (section.id === 'strategy-cost-basis' && !(section.rows || []).some(row => !empty(row.value)
      && !['UNAVAILABLE', 'NOT_APPLICABLE', 'CONFLICTED'].includes(row.state || '')
      && !(row.value === vm.property.price && /^(asking price|price|preço pedido|precio solicitado)$/i.test(row.label))
      && !fields.has(contentKey(`${clean(row.label)}:${clean(row.value)}`)))) continue;
    if (/readiness/.test(section.id) && section.status === 'available') continue;
    if (section.status === 'blocked' || /readiness|pending|price-positioning/.test(section.id)) {
      const correspondingIndicator = /rent/.test(section.id) ? 'marketRent' : /financial|operating/.test(section.id) ? 'noi' : /value|condition|price-position/.test(section.id) ? 'arv' : '';
      if (correspondingIndicator && pending.has(correspondingIndicator)) continue;
      if (section.id === 'value-readiness' && pending.has('arv') || section.id.includes('rent') && pending.has('marketRent')) continue;
      const reason = clean(section.text || section.rows?.map(row => `${row.label}: ${row.source || row.value}`).join(' ') || section.hero?.qualification || '');
      if (reason && ![...pending.values()].some(item => contentKey(item.reason) === contentKey(reason))) pending.set(section.id, { label: clean(section.title), reason, action });
      continue;
    }
    const items = section.id === 'next-actions' ? (section.items || []).filter((item, index, all) => all.findIndex(other => contentKey(other.text.split('\n')[0]) === contentKey(item.text.split('\n')[0])) === index).slice(0, 3) : section.items || [];
    const paragraphs = [section.hero ? `${section.hero.value} · ${section.hero.label}\n${section.hero.qualification}` : '', section.text, ...items.map(item => item.text)].filter(Boolean).map(text => uniqueText(text!)).filter(Boolean);
    if (section.range && section.id === 'provider-reference') paragraphs.push(`${section.range.low} – ${section.range.high}`);
    if (paragraphs.length) add({ id: section.id, title: section.title, kind: 'text', text: paragraphs.join('\n\n'), range: section.range });
    if (section.rows?.length) rowGroup(`${section.id}-facts`, section.title, section.rows.filter(row => (!section.gauge || row.label !== 'Match Score') && !(section.id === 'market-rent' && /subject.*(?:bed|bath|area)|imóvel.*(?:quarto|banheiro|área)/i.test(row.label))).map(row=>section.id==='profile-criteria'&&row.source?{...row,value:`${row.value} · ${row.source}`}:row));
    if (section.range && !paragraphs.length) {
      const facts = blocks.find(block => block.id === `${section.id}-facts`);
      if (facts) facts.range = section.range;
      else add({ id: section.id, title: section.title, kind: 'text', range: section.range });
    }
    if (section.gauge) {
      const text = `${clean(section.gauge.label)}: ${section.gauge.value}%\n${t('O resultado total pondera vários critérios; um critério isolado pode ter nota zero sem tornar o total zero.', 'The total weights several criteria; one criterion can score zero without making the total zero.', 'El total pondera varios criterios; un criterio puede tener cero sin que el total sea cero.')}`;
      add({ id: `${section.id}-score`, title: section.title, kind: 'text', text, score: section.gauge.value });
    }
    if (section.comparison?.length) {
      const existing = blocks.find(block => block.id === section.id || block.id === `${section.id}-facts`);
      if (existing) existing.comparison = section.comparison;
      else add({ id: `${section.id}-criteria`, title: section.title, kind: 'facts', comparison: section.comparison });
    }
    if (section.table?.rows.length) add({ id: `${section.id}-table`, title: section.title, kind: 'table', columns: section.table.columns.map(clean), table: section.table.rows.map(row => row.map(clean)) });
  }
  const notes = vm.property.notes.map(uniqueText).filter(Boolean);
  if (notes.length) add({ id: 'property-notes', title: t('Notas do imóvel', 'Property notes', 'Notas del inmueble'), kind: 'text', text: notes.join('\n\n') });
  const subject = vm.property.locationPoint && point(vm.property.locationPoint) ? vm.property.locationPoint : null;
  if (mapped || subject) {
    const comparablePoints = mapped?.map?.points.filter(p => p.id !== 'subject' && point(p)) || [];
    const completeCoordinates = !!mapped && comparablePoints.length === mapped.table!.rows.length;
    const points = [...(subject ? [subject] : []), ...comparablePoints];
    if (points.length) add({ id: 'report-location', title: t('Localização', 'Location', 'Ubicación'), kind: 'map', map: { points, sourceId: comparablePoints.length ? mapped!.id : undefined,
      caption: completeCoordinates ? t(`Marcadores 1–${comparablePoints.length}: mesmos imóveis e mesma ordem da tabela ${clean(mapped!.title)}.${subject ? ' S: imóvel principal.' : ''}`, `Markers 1–${comparablePoints.length}: the same properties and order as the ${clean(mapped!.title)} table.${subject ? ' S: subject property.' : ''}`, `Marcadores 1–${comparablePoints.length}: mismos inmuebles y orden de la tabla ${clean(mapped!.title)}.${subject ? ' S: inmueble principal.' : ''}`)
        : comparablePoints.length ? t(`${comparablePoints.length} de ${mapped!.table!.rows.length} comparáveis com coordenadas. Os números correspondem às linhas da tabela; os demais não foram posicionados.`, `${comparablePoints.length} of ${mapped!.table!.rows.length} comparables have coordinates. Numbers match the table rows; the others are not plotted.`, `${comparablePoints.length} de ${mapped!.table!.rows.length} comparables con coordenadas. Los números corresponden a las filas; los demás no se ubican.`)
        : !mapped ? t('S: imóvel principal.', 'S: subject property.', 'S: inmueble principal.')
        : t('Somente o imóvel principal. Não há coordenadas completas para posicionar os comparáveis com segurança.', 'Subject property only. Complete coordinates are not available to safely place the comparables.', 'Solo el inmueble principal. No hay coordenadas completas para ubicar los comparables.') } });
  }
  for (const block of blocks) if (block.map?.points.some(point=>point.id!=='subject')) block.map.caption += t(' Cores: azul escuro = imóvel principal; amarelo/roxo = vendas registradas; vermelho = à venda; verde = aluguel.', ' Colors: navy = subject; yellow/purple = recorded sales; red = for sale; green = rentals.', ' Colores: azul oscuro = inmueble principal; amarillo/morado = ventas registradas; rojo = en venta; verde = alquiler.');
  const groupedPending = new Map<string, { labels: string[]; reason: string; action: string }>();
  for (const item of pending.values()) {
    const key = contentKey(`${item.reason}:${item.action}`), group = groupedPending.get(key) || { labels: [], reason: item.reason, action: item.action };
    if (!group.labels.includes(item.label)) group.labels.push(item.label); groupedPending.set(key, group);
  }
  if (pending.size) add({ id: 'report-pending', title: t('Pendências e próximos passos', 'Pending inputs and next steps', 'Datos pendientes y próximos pasos'), kind: 'table',
    columns: [t('Indicador', 'Indicator', 'Indicador'), t('Motivo', 'Reason', 'Motivo'), t('Ação necessária', 'Required action', 'Acción necesaria')],
    table: [...groupedPending.values()].map(item => [item.labels.join(', '), item.reason, item.action]) });
  // Put unresolved inputs beside the property context, before the analytical evidence.
  // This also keeps a large actionable table from stranding small blocks on earlier pages.
  if (pending.size) blocks.splice(pendingPosition, 0, blocks.pop()!);
  const actionKeys = new Set<string>();
  const nextChecks = [...groupedPending.values()].filter(item => {
    const key = contentKey(item.action);
    if (actionKeys.has(key)) return false;
    actionKeys.add(key); return true;
  }).slice(0, 3);
  if (nextChecks.length) add({ id: 'next-actions', title: t('Próximas verificações prioritárias', 'Prioritized next checks', 'Próximas verificaciones prioritarias'), kind: 'text', text: nextChecks.map(item => `${item.labels.join(', ')}. ${item.action}`).join('\n\n') });
  const sources = vm.sourceRows || [];
  add(sources.length ? { id: 'report-sources', title: t('Fontes e data', 'Sources and dates', 'Fuentes y fechas'), kind: 'facts', rows: sources.map(row => ({ ...row, label: clean(row.label), value: clean(row.value) })) }
    : { id: 'report-sources', title: t('Fontes e data', 'Sources and dates', 'Fuentes y fechas'), kind: 'text', text: t('Nenhum dado externo foi obtido para este relatório. O nível do relatório não comprova consulta a uma fonte externa.', 'No external data was obtained for this report. The report level does not establish that an external source was queried.', 'No se obtuvieron datos externos para este informe. El nivel no acredita una consulta a una fuente externa.') });
  add({ id: 'report-disclaimer', title: t('Ressalva', 'Important qualification', 'Advertencia'), kind: 'disclaimer', text: clean(vm.disclaimer) });
  return blocks;
}

export function composeReportContent(vm: ReportViewModel): ContentBlock[] {
  return buildReportReadingPlan(vm, composeRawReportContent(vm), text => reportReaderText(text, vm.locale));
}

/** Source metadata only, with no addresses, publisher details or raw payloads. */
export function reportSourceRows(schema: unknown, locale: string): ReportRow[] {
  const groups = new Map<string, { provider: string; family: string; date: string }>();
  const familyLabels: Record<string,string> = {property_record:'Property record',property_value_avm:'Automated value estimate / listing support',property_sold_record_pool:'Comparable sales',rent_estimate_evidence:'Market rent',sale_listing_evidence:'For-sale listings',rental_listing_evidence:'Rental listings',market_evidence:'Market statistics'};
  const families: Record<string,string> = {propertyEvidence:'property_record',valuationEvidence:'property_value_avm',valuationIntelligence:'property_value_avm',comparableEvidence:'property_sold_record_pool',providerListingReferences:'property_value_avm',activeSaleListings:'sale_listing_evidence',marketRent:'rent_estimate_evidence',rentEstimate:'rent_estimate_evidence'};
  const walk=(value:unknown,path:string[],inheritedDate='',inheritedProvider='',inheritedFamily='',depth=0)=>{
    if(!value||typeof value!=='object'||depth>12)return;
    const row=value as Record<string,unknown>;
    const sourceText=String(row.provider||row.source||row.sourceType||inheritedProvider);
    const provider=/rentcast/i.test(sourceText)?'RentCast':/census/i.test(sourceText)?'Census':/GIS|ASSESSOR|PUBLIC_RECORD|PUBLIC_TAX|public record/i.test(sourceText)?'Public record / GIS':inheritedProvider;
    const family=String(row.data_type||row.dataType||row.evidenceType||families[[...path].reverse().find(k=>families[k])||'']||inheritedFamily||'property_record');
    const date=typeof row.retrievedAt==='string'&&!Number.isNaN(Date.parse(row.retrievedAt))?row.retrievedAt:inheritedDate;
    const normalizedFamily=({rent_estimate:'rent_estimate_evidence',property_valuation:'property_value_avm',sold_record_pool:'property_sold_record_pool'} as Record<string,string>)[family]||family;
    if(provider&&!Array.isArray(value)){
      const key=provider+':'+normalizedFamily,previous=groups.get(key);
      if(!previous||Date.parse(date)>Date.parse(previous.date)||!previous.date&&!!date)groups.set(key,{provider,family:normalizedFamily,date});
    }
    for(const[key,child]of Object.entries(row))if(!/owner|contact|publisher|description|notes|name/i.test(key))walk(child,[...path,key],date,provider,families[key]||normalizedFamily,depth+1);
  };
  walk(schema,[]);
  // Older saved reports may contain sales but no source metadata. Keep that
  // family visible without inventing a provider or a retrieval timestamp.
  const sections = (schema as { sections?: Record<string, { data?: Record<string, unknown> }> })?.sections;
  const sales = sections?.comparableEvidence?.data;
  if (sales && ['used','supporting','excluded'].some(key => Array.isArray(sales[key]) && sales[key].length)
    && ![...groups.values()].some(row => row.family === 'property_sold_record_pool')) {
    groups.set('unknown:property_sold_record_pool', {provider: locale === 'pt' ? 'Provedor não registrado' : locale === 'es' ? 'Proveedor no registrado' : 'Provider not recorded',family:'property_sold_record_pool',date:''});
  }
  let missingDateShown=false;
  return [...groups.values()].sort((a,b)=>(a.provider+a.family).localeCompare(b.provider+b.family)).map(row=>({label:`${row.provider} · ${familyLabels[row.family]||row.family.replace(/_/g,' ')}`,value:row.date?readableReportDate(row.date,locale):missingDateShown?'—':(missingDateShown=true,locale==='pt'?'Data de consulta indisponível':locale==='es'?'Fecha de consulta no disponible':'Retrieval date unavailable'),evidenceRefs:['property:identity']}));
}
