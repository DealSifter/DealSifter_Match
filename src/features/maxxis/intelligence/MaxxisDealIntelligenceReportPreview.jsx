import React, { useEffect, useRef, useState } from 'react';
import { BarChart3, Camera, CheckCircle, FileText, Home, MapPin, Target } from 'lucide-react';
import officialDealSifterLogo from '../../../assets/maxxis/report-official-logo.png';
import { buildStrictReportViewModel, validateReportViewModel } from '../export/reportIntegrityViewModel.ts';
import { prepareReportAssets } from '../export/reportPreparedAssets.ts';
import { comparableMapViewport } from '../export/comparableMapGeometry.ts';

const COPY = {
  en: { open: 'Open investor report experience', hint: 'Click to explore', level: 'Level', property: 'Property Overview',
    executive: 'Executive Deal Snapshot', coverage: 'Evidence coverage', opportunity: 'Strongest supported signal',
    risk: 'Primary uncertainty', next: 'Next verification', photos: 'Property Photos', location: 'Location Map', notes: 'Publisher notes',
    invalid: 'This report cannot be displayed safely. Generate it again.', map: 'Coordinate-derived relative view — not a cadastral map.' },
  pt: { open: 'Abrir relatório do investidor', hint: 'Clique para explorar', level: 'Nível', property: 'Visão geral do imóvel',
    executive: 'Síntese executiva do negócio', coverage: 'Cobertura das evidências', opportunity: 'Sinal mais bem sustentado',
    risk: 'Principal incerteza', next: 'Próxima verificação', photos: 'Fotos do imóvel', location: 'Localização', notes: 'Notas do publicador',
    invalid: 'Este relatório não pode ser exibido com segurança. Gere-o novamente.', map: 'Visão relativa por coordenadas — não é mapa cadastral.' },
  es: { open: 'Abrir informe del inversor', hint: 'Haga clic para explorar', level: 'Nivel', property: 'Resumen de la propiedad',
    executive: 'Síntesis ejecutiva del negocio', coverage: 'Cobertura de evidencia', opportunity: 'Señal mejor sustentada',
    risk: 'Principal incertidumbre', next: 'Próxima verificación', photos: 'Fotos del inmueble', location: 'Ubicación', notes: 'Notas del publicador',
    invalid: 'Este informe no puede mostrarse de forma segura. Genérelo de nuevo.', map: 'Vista relativa por coordenadas — no es mapa catastral.' },
};

const reportProfiler = (id, phase, actualDuration, baseDuration, startTime, commitTime) => {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function' || typeof CustomEvent !== 'function') return;
  window.dispatchEvent(new CustomEvent('dealsifter:maxxis-performance', { detail: { stage: 'inline_report_react_commit', id, phase, actualDuration, baseDuration, startTime, commitTime } }));
};

function SectionTitle({ icon: Icon = FileText, children }) {
  return <h3 className="maxxis-v2-section-title"><span>{React.createElement(Icon, { 'aria-hidden': true, size: 16 })}</span>{children}</h3>;
}

function SafeRows({ rows }) {
  if (!rows?.length) return null;
  return <dl>{rows.map((row, index) => <div key={`${row.label}-${index}`}><dt>{row.label}</dt>
    <dd>{row.value}{row.source ? <small>{row.source}</small> : null}</dd></div>)}</dl>;
}

function ReportHeader({ view, copy, level }) {
  return <header className="maxxis-v2-header">
    <div className="maxxis-v2-brand"><img src={officialDealSifterLogo} alt="DealSifter Match" /><small>{view.header.subtitle}</small></div>
    <div><strong>{view.header.product}</strong><small>{copy.property}</small></div>
    <span className={`is-level-${level}`}>{level === 3 ? 'ENTERPRISE' : level === 2 ? 'PRO' : 'FREE'}</span>
  </header>;
}

/** Geometry is the same pure ARV/rental framing used by PDF. No tiles, URLs or I/O. */
function SafeCoordinateMap({ map, title }) {
  if (!map?.points.length) return null;
  const viewport = comparableMapViewport(map.points, 900, 330, 65);
  return <figure className="maxxis-v2-info-card"><SectionTitle icon={MapPin}>{title}</SectionTitle>
    <div className="maxxis-v2-comparable-map"><svg viewBox="0 0 900 330" width="100%" height="100%" role="img" aria-label={map.caption}>
      <rect width="900" height="330" fill="#edf4f4" />
      {[150, 300, 450, 600, 750].map(x => <path key={`x-${x}`} d={`M${x} 0V330`} stroke="#d7e5e5" />)}
      {[82.5, 165, 247.5].map(y => <path key={`y-${y}`} d={`M0 ${y}H900`} stroke="#d7e5e5" />)}
      {viewport.world.map(({ x, y, item }) => <g key={item.id} transform={`translate(${x - viewport.left} ${y - viewport.top})`} data-report-map-marker={item.marker}>
        <circle r={item.marker === 'S' ? 19 : 16} fill={item.marker === 'S' ? '#15384f' : '#0d876f'} stroke="#fff" strokeWidth="3" />
        <text textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize="15" fontWeight="700">{item.marker}</text>
      </g>)}
    </svg></div><figcaption>{map.caption}</figcaption>
  </figure>;
}

function ExecutiveSnapshot({ executive, copy }) {
  if (!executive) return null;
  return <section className="maxxis-v2-info-card is-narrative" data-report-section="EXECUTIVE_SNAPSHOT">
    <SectionTitle icon={Target}>{copy.executive}</SectionTitle>
    <span className="maxxis-v2-badge is-navy">{executive.status}</span><p>{executive.thesis.text}</p>
    <div className="maxxis-v2-comp-stats" aria-label={copy.coverage}>{executive.coverage.map(row =>
      <span key={row.label}><small>{row.label}</small><b>{row.value}</b></span>)}</div>
    <SafeRows rows={[
      ...(executive.opportunity ? [{ label: copy.opportunity, value: executive.opportunity.text }] : []),
      ...(executive.risk ? [{ label: copy.risk, value: executive.risk.text }] : []),
      ...(executive.blocker ? [{ label: copy.next, value: executive.blocker.text }] : []),
    ]} />
  </section>;
}

function SafeReportSection({ section }) {
  return <section className={`maxxis-v2-info-card${section.kind === 'list' || section.kind === 'narrative' ? ' is-narrative' : ''}`}
    data-report-section={section.id === 'market-rent' ? 'MARKET_RENT' : section.id}>
    <SectionTitle icon={section.map ? MapPin : section.hero ? BarChart3 : FileText}>{section.title}</SectionTitle>
    {section.hero ? <div className="maxxis-v2-arv"><div><small>{section.hero.label}</small><strong className="maxxis-v2-price">{section.hero.value}</strong><p>{section.hero.qualification}</p></div></div> : null}
    {section.range ? <div className="maxxis-v2-comp-stats"><span><small>{section.range.low}</small></span>
      <span><b>{section.range.estimate}</b></span><span><small>{section.range.high}</small></span></div> : null}
    {section.text ? <p>{section.text}</p> : null}
    <SafeRows rows={section.rows} />
    {section.items?.length ? <ul>{section.items.map((item, index) => <li key={`${section.id}-${index}`}>{item.text}</li>)}</ul> : null}
    {section.map ? <SafeCoordinateMap map={section.map} title={section.title} /> : null}
    {section.table?.rows.length ? <div className="maxxis-v2-table-wrap"><table><thead><tr>{section.table.columns.map((column, index) => <th key={`${column}-${index}`}>{column}</th>)}</tr></thead>
      <tbody>{section.table.rows.map((row, index) => <tr key={`${section.id}-${index}`} data-report-comp-number={index + 1}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div> : null}
  </section>;
}

/** Rendering below accepts only a validated ReportViewModel, not domain entities. */
function SafeReportBody({ view, copy, level }) {
  const property = view.property;
  const snapshotTexts = new Set([view.executive?.opportunity?.text, view.executive?.risk?.text, view.executive?.blocker?.text].filter(Boolean));
  const substantiveSections = view.sections.map(section => ({ ...section, items: section.items?.filter(item => !snapshotTexts.has(item.text)) }))
    .filter(section => section.text || section.items?.length || section.rows?.length || section.hero || section.table?.rows.length);
  return <article className="maxxis-v2-page" data-report-page="1" data-report-section="PROPERTY_OVERVIEW">
    <ReportHeader view={view} copy={copy} level={level} />
    <div className="maxxis-v2-page-body">
      <section className="maxxis-v2-property-hero">
        {property.photos[0] ? <img src={property.photos[0]} alt={property.title} /> : <div className="maxxis-v2-image-empty"><Home aria-hidden="true" /></div>}
        <div><h3>{property.title}</h3><span>{property.location}</span><strong className="maxxis-v2-price">{property.price}</strong>
          <div className="maxxis-v2-badges"><span className="maxxis-v2-badge">{property.type}</span><span className="maxxis-v2-badge is-navy">{property.strategy}</span></div></div>
      </section>
      {property.metrics.length ? <div className="maxxis-v2-metric-strip">{property.metrics.map(row => <span key={row.label}><CheckCircle aria-hidden="true" /><small>{row.label}</small><b>{row.value}</b></span>)}</div> : null}
      <ExecutiveSnapshot executive={view.executive} copy={copy} />
      {level === 1 && property.facts.length ? <div className="maxxis-v2-info-grid">{property.facts.map(group => <section key={group.title} className="maxxis-v2-info-card"><SectionTitle>{group.title}</SectionTitle><SafeRows rows={group.rows} /></section>)}</div> : null}
      {property.photos.length > 1 ? <section className="maxxis-v2-photo-section"><SectionTitle icon={Camera}>{copy.photos}</SectionTitle><div className="maxxis-v2-photos">{property.photos.slice(1).map((photo, index) => <img src={photo} key={photo} alt={`${property.title} · ${index + 2}`} />)}</div></section> : null}
      {level === 1 && property.locationPoint ? <SafeCoordinateMap map={{ points: [property.locationPoint], caption: copy.map }} title={copy.location} /> : null}
      {level === 1 && property.notes.length ? <section className="maxxis-v2-notes"><SectionTitle>{copy.notes}</SectionTitle>{property.notes.map((note, index) => <p key={index}>{note}</p>)}</section> : null}
      {substantiveSections.map(section => <SafeReportSection key={section.id} section={section} />)}
      <p className="maxxis-v2-disclaimer">{view.disclaimer}</p>
    </div>
  </article>;
}

function StrictReportPreview({ schema, language }) {
  const [, setAssetRevision] = useState(0);
  const active = useRef(true), request = useRef(0);
  useEffect(() => { active.current = true; return () => { active.current = false; request.current += 1; }; }, [schema]);
  const view = (() => {
    try {
      const candidate = buildStrictReportViewModel({ schema, language });
      return validateReportViewModel(candidate).valid ? candidate : null;
    } catch { return null; }
  })();
  const locale = view?.locale || (/^pt/i.test(language) ? 'pt' : /^es/i.test(language) ? 'es' : 'en');
  const copy = COPY[locale];
  if (!view) return <p role="status">{copy.invalid}</p>;
  const level = view.reportType === 'DEAL_INTELLIGENCE' ? 3 : view.reportType === 'MAXXIS_ANALYSIS' ? 2 : 1;
  const onToggle = async event => {
    const current = ++request.current;
    if (!event.currentTarget.open) return;
    await prepareReportAssets(schema).catch(() => []);
    if (active.current && current === request.current) setAssetRevision(revision => revision + 1);
  };
  return <React.Profiler id={`maxxis-inline-${view.reportType}`} onRender={reportProfiler}>
    <details className={`maxxis-report-preview maxxis-report-v2 is-${view.reportType.toLowerCase()}`} onToggle={onToggle}>
      <summary><span>{copy.open}</span><span className="maxxis-v2-open-hint"><i aria-hidden="true" />{copy.hint}</span><span className="maxxis-v2-badge is-navy">{copy.level} {level}</span></summary>
      <div className="maxxis-v2-report"><SafeReportBody view={view} copy={copy} level={level} /></div>
    </details>
  </React.Profiler>;
}

export function MaxxisDealIntelligenceReportPreview({ schema, language = 'en' }) {
  if (!schema || schema.type !== 'maxxis_report_schema') return null;
  return <StrictReportPreview schema={schema} language={language} />;
}
