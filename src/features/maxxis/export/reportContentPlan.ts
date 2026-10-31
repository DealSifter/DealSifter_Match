import type { ReportViewModel, ReportSection, ReportRow, ReportMapPoint } from './reportIntegrityTypes';
import { evidenceAbsenceCopy } from '../../../../supabase/functions/_shared/maxxis/evidenceAbsence';

export const REPORT_INTERNAL_JARGON = /\b(?:SOLD|AVM|gates?|structural candidates|normalized)\b|not requested in this flow/i;
export const contentKey = (text: string) => text.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
export function reportReaderText(value: string, locale = 'en'): string {
  const pt = locale === 'pt', es = locale === 'es';
  return value.replace(/not requested in this flow/gi, pt ? 'Não consultado neste relatório' : es ? 'No consultado en este informe' : 'Not consulted for this report')
    .replace(/structural candidates/gi, pt ? 'vendas em análise' : es ? 'ventas en revisión' : 'sales under review')
    .replace(/\bSOLDs?\b/gi, pt ? 'vendas registradas' : es ? 'ventas registradas' : 'recorded sales')
    .replace(/\bAVM\b/gi, pt ? 'estimativa automatizada' : es ? 'estimación automatizada' : 'automated estimate')
    .replace(/\bgates?\b/gi, pt ? 'critérios de verificação' : es ? 'criterios de verificación' : 'verification criteria')
    .replace(/\bnormalized\b/gi, pt ? 'organizados' : es ? 'organizados' : 'organized').replace(/…/g, '.');
}
export interface ContentBlock {
  id: string; title: string; kind: 'overview' | 'text' | 'facts' | 'table' | 'map' | 'photos' | 'disclaimer';
  text?: string; rows?: ReportRow[]; columns?: string[]; table?: string[][]; photos?: string[];
  map?: { points: ReportMapPoint[]; caption: string; sourceId?: string }; score?: number;
}
const empty = (text: string) => !text || /^(?:—|-|unavailable|não disponível|no disponible|unknown|não informado|not provided)$/i.test(text.trim());
const point = (p: ReportMapPoint) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && Math.abs(p.latitude) <= 85 && Math.abs(p.longitude) <= 180;

/** Display composition only. Never calculates financial outputs or acquires evidence. */
export function composeReportContent(vm: ReportViewModel): ContentBlock[] {
  const t = (pt: string, en: string, es: string) => vm.locale === 'pt' ? pt : vm.locale === 'es' ? es : en;
  const clean = (text: string) => reportReaderText(text, vm.locale);
  const blocks: ContentBlock[] = [], keys = new Map<string, ContentBlock>(), texts = new Set<string>(), fields = new Set<string>();
  const uniqueText = (text: string) => {
    const cleaned = clean(text).trim(), key = contentKey(cleaned);
    if (!key || texts.has(key) || cleaned === vm.disclaimer) return '';
    texts.add(key); return cleaned;
  };
  const add = (block: ContentBlock) => {
    const key = contentKey(JSON.stringify({ kind: block.kind, text: block.text, rows: block.rows?.map(({ label, value }) => ({ label, value })), columns: block.columns, table: block.table, photos: block.photos, map: block.map }));
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
    const copy = reason === 'USER_INPUT_REQUIRED' ? t('Os dados necessários ainda precisam de confirmação.', 'Required inputs still need confirmation.', 'Los datos necesarios aún requieren confirmación.') : clean(evidenceAbsenceCopy(reason, vm.locale));
    const financial = ['noi', 'capRate', 'roi', 'cashFlow'].includes(key);
    const requiredAction = financial ? t('Confirme renda, despesas e a base de investimento do cenário.', 'Confirm income, expenses and the investment basis for the scenario.', 'Confirme ingresos, gastos y la base de inversión del escenario.')
      : key === 'arv' ? t('Confirme a condição do imóvel e vendas comparáveis elegíveis.', 'Confirm property condition and eligible comparable sales.', 'Confirme la condición del inmueble y ventas comparables elegibles.')
      : key === 'comparablesMap' ? t('Confirme as coordenadas dos imóveis comparáveis.', 'Confirm coordinates for the comparable properties.', 'Confirme las coordenadas de los inmuebles comparables.') : action;
    pending.set(key, { label: labels[key], reason: copy, action: reason === 'USER_INPUT_REQUIRED' ? requiredAction : t('Revise o cadastro e a disponibilidade da fonte; gere novamente após resolver a pendência.', 'Review the listing and source availability; regenerate after resolving the issue.', 'Revise el registro y la fuente; regenere después de resolver la incidencia.') });
  }
  const rawSections = vm.sections.filter(section => !/^(property-facts-|property-tax$|property-contacts$|publisher-notes$|evidence-availability$|positive-signals$|evidence-coverage$|sold-delivery$|sold-diagnostic|comparables-by-group$)/.test(section.id));
  const tableSections = rawSections.filter(section => section.table?.rows.length);
  const mapped = tableSections.find(section => section.id === 'arv-market' && section.map) || tableSections.find(section => section.map);
  for (const section of rawSections) {
    if (/readiness/.test(section.id) && section.status === 'available') continue;
    if (section.status === 'blocked' || /readiness|pending|price-positioning/.test(section.id)) {
      const correspondingIndicator = /rent/.test(section.id) ? 'marketRent' : /financial|operating/.test(section.id) ? 'noi' : /value|condition|price-position/.test(section.id) ? 'arv' : '';
      if (correspondingIndicator && pending.has(correspondingIndicator)) continue;
      if (section.id === 'value-readiness' && pending.has('arv') || section.id.includes('rent') && pending.has('marketRent')) continue;
      const reason = clean(section.text || section.rows?.map(row => `${row.label}: ${row.source || row.value}`).join(' ') || section.hero?.qualification || '');
      if (reason && ![...pending.values()].some(item => contentKey(item.reason) === contentKey(reason))) pending.set(section.id, { label: clean(section.title), reason, action });
      continue;
    }
    const paragraphs = [section.text, section.hero ? `${section.hero.label}: ${section.hero.value}\n${section.hero.qualification}` : '', ...(section.items || []).map(item => item.text)].filter(Boolean).map(text => uniqueText(text!)).filter(Boolean);
    if (paragraphs.length) add({ id: section.id, title: section.title, kind: 'text', text: paragraphs.join('\n\n') });
    if (section.rows?.length) rowGroup(`${section.id}-facts`, section.title, section.rows.filter(row => !section.gauge || row.label !== 'Match Score'));
    if (section.gauge) {
      const text = `${clean(section.gauge.label)}: ${section.gauge.value}%\n${t('O resultado total pondera vários critérios; um critério isolado pode ter nota zero sem tornar o total zero.', 'The total weights several criteria; one criterion can score zero without making the total zero.', 'El total pondera varios criterios; un criterio puede tener cero sin que el total sea cero.')}`;
      add({ id: `${section.id}-score`, title: section.title, kind: 'text', text, score: section.gauge.value });
    }
    if (section.comparison?.length) rowGroup(`${section.id}-criteria`, section.title, section.comparison.map(item => ({ label: item.label, value: item.text, evidenceRefs: [] })));
    if (section.table?.rows.length) add({ id: `${section.id}-table`, title: section.title, kind: 'table', columns: section.table.columns.map(clean), table: section.table.rows.map(row => row.map(clean)) });
  }
  const notes = vm.property.notes.map(uniqueText).filter(Boolean);
  if (notes.length) add({ id: 'property-notes', title: t('Notas do imóvel', 'Property notes', 'Notas del inmueble'), kind: 'text', text: notes.join('\n\n') });
  const subject = vm.property.locationPoint && point(vm.property.locationPoint) ? vm.property.locationPoint : null;
  if (mapped || subject) {
    const comparablePoints = mapped?.map?.points.filter(p => p.id !== 'subject' && point(p)) || [];
    const completeCoordinates = !!mapped && comparablePoints.length === mapped.table!.rows.length;
    const points = [...(subject ? [subject] : []), ...(completeCoordinates ? comparablePoints.map((p, index) => ({ ...p, marker: String(index + 1) })) : [])];
    if (points.length) add({ id: 'report-location', title: t('Localização', 'Location', 'Ubicación'), kind: 'map', map: { points, sourceId: completeCoordinates ? mapped!.id : undefined,
      caption: completeCoordinates ? t(`Marcadores 1–${comparablePoints.length}: mesmos imóveis e mesma ordem da tabela ${clean(mapped!.title)}. S: imóvel principal.`, `Markers 1–${comparablePoints.length}: the same properties and order as the ${clean(mapped!.title)} table. S: subject property.`, `Marcadores 1–${comparablePoints.length}: mismos inmuebles y orden de la tabla ${clean(mapped!.title)}. S: inmueble principal.`)
        : !mapped ? t('S: imóvel principal.', 'S: subject property.', 'S: inmueble principal.')
        : t('Somente o imóvel principal. Não há coordenadas completas para posicionar os comparáveis com segurança.', 'Subject property only. Complete coordinates are not available to safely place the comparables.', 'Solo el inmueble principal. No hay coordenadas completas para ubicar los comparables.') } });
  }
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
  const sources = vm.sourceRows || [];
  add(sources.length ? { id: 'report-sources', title: t('Fontes e data', 'Sources and dates', 'Fuentes y fechas'), kind: 'facts', rows: sources }
    : { id: 'report-sources', title: t('Fontes e data', 'Sources and dates', 'Fuentes y fechas'), kind: 'text', text: t('Nenhum dado externo foi obtido para este relatório. O nível do relatório não comprova consulta a uma fonte externa.', 'No external data was obtained for this report. The report level does not establish that an external source was queried.', 'No se obtuvieron datos externos para este informe. El nivel no acredita una consulta a una fuente externa.') });
  add({ id: 'report-disclaimer', title: t('Ressalva', 'Important qualification', 'Advertencia'), kind: 'disclaimer', text: clean(vm.disclaimer) });
  return blocks;
}

/** Source metadata only, with no addresses, publisher details or raw payloads. */
export function reportSourceRows(schema: unknown, locale: string): ReportRow[] {
  const groups = new Map<string, Set<string>>();
  const labels: Record<string, string> = { propertyEvidence: 'Property record', valuationEvidence: 'Value evidence', comparableEvidence: 'Comparable sales', marketRent: 'Market rent',
    rentEstimate: 'Market rent', annualPropertyTax: 'Annual property tax', propertyTax: 'Annual property tax', county: 'County', zoning: 'Zoning', lotSizeSqft: 'Lot area',
    beds: 'Bedrooms', baths: 'Bathrooms', livingAreaSqft: 'Living area', assessorId: 'Parcel identifier' };
  const walk = (value: unknown, path: string[], inheritedDate = '', inheritedSource = '', depth = 0) => {
    if (!value || typeof value !== 'object' || depth > 12) return;
    const row = value as Record<string, unknown>, sourceText = String(row.provider || row.source || row.sourceType || inheritedSource);
    const source = /rentcast/i.test(sourceText) ? 'RentCast' : /GIS|ASSESSOR|PUBLIC_RECORD|PUBLIC_TAX|public record/i.test(sourceText) ? 'Public record / GIS' : inheritedSource;
    const date = typeof row.retrievedAt === 'string' ? row.retrievedAt : inheritedDate;
    if (source && !Array.isArray(value)) {
      const field = typeof row.field === 'string' && labels[row.field] ? row.field : [...path].reverse().find(key => labels[key]);
      if (field) { const key = `${source} · ${date && !Number.isNaN(Date.parse(date)) ? new Date(date).toISOString() : locale === 'pt' ? 'Data de consulta não registrada' : 'Retrieval date not recorded'}`;
        const names = groups.get(key) || new Set<string>(); names.add(labels[field]); groups.set(key, names); }
    }
    for (const [key, child] of Object.entries(row)) if (!/owner|contact|publisher|description|notes|name/i.test(key)) walk(child, [...path, key], date, source, depth + 1);
  };
  walk(schema, []);
  return [...groups].map(([source, names]) => ({ label: [...names].join(', '), value: source, evidenceRefs: ['property:identity'] }));
}
