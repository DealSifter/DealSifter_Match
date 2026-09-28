import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Bath,
  BedDouble,
  Brain,
  Camera,
  CheckCircle,
  DollarSign,
  FileText,
  Home,
  ListChecks,
  Map,
  MapPin,
  Maximize,
  Target,
  TrendingUp,
  User,
  Wrench,
} from "lucide-react";
import officialDealSifterLogo from "../../../assets/maxxis/report-official-logo.png";
import { resolveComparableMap } from "../export/maxxisReportPdf";
import { explainMaxxisEvidenceState } from "./maxxisUserFacingEvidence";
import { localizeMaxxisValue } from "../presentation/maxxisPresentationI18n";

const COPY = {
  en: {
    language: "en",
    open: "Open investor report experience",
    release: "Investor-ready property release",
    tagline: "Real Data. Smarter Decisions.",
    reportFree: "Property Release",
    reportPro: "Maxxis Analysis Report",
    reportDeal: "Maxxis Deal Intelligence Report",
    property: "Property Overview",
    owner: "Ownership & Public Record",
    characteristics: "Property Characteristics",
    land: "Land & Tax Information",
    photos: "Property Photos",
    location: "Location Map",
    notes: "Notes",
    cma: "Comparative Market Analysis",
    relative: "Relative distance view — not geographic coordinates",
    valuation: "Valuation Intelligence",
    providerEstimate: "Provider estimate (not DealSifter ARV)",
    spread: "Potential Spread",
    roi: "Projected ROI Range",
    rental: "Rental Intelligence",
    price: "Price Analysis",
    distribution: "Value Distribution",
    fitRisk: "Investment Fit & Risk Analysis",
    profile: "Investor Profile",
    compatibility: "Profile Compatibility",
    evidence: "Evidence Summary",
    insights: "Key Insights & Verification",
    positive: "Positive Signals",
    missing: "Missing Information",
    considerations: "Considerations",
    steps: "Recommended Verification Steps",
    powered: "Powered by MAXXIS AI",
    conclusion: "Segmented Conclusion",
    topics: "Main Topics",
    questions: "Questions",
    actions: "Recommended Actions",
    confidence: "Maxxis Analysis Confidence",
    contributors: "Positive contributors",
    limitations: "Limitations",
    perspective: "Investor Perspective",
    unknown: "UNKNOWN",
    unavailable: "Unavailable",
    scenario: "Scenario-based",
    beds: "Beds", baths: "Baths", livingArea: "Living area", capRate: "Cap rate", ownerLabel: "Owner", ownerOccupied: "Owner occupied", ownershipRecord: "Ownership record", latestSale: "Latest sale", saleDate: "Sale date", allowedContacts: "Allowed contacts", title: "Title", priceLabel: "Price", strategy: "Strategy", range: "Range", yearBuilt: "Year built", bedsBaths: "Beds / Baths", rehab: "Rehab", county: "County", lotSize: "Lot size", assessedValue: "Assessed value", propertyTax: "Property tax", source: "Source", address: "Address", salePrice: "Sale Price", distance: "Distance", similarity: "Similarity", status: "Status", confidenceLabel: "Confidence", compsLabel: "Comps", method: "Method", estimatedArv: "Estimated ARV Range", estimatedRent: "Estimated rent", rentalYield: "Rental yield", reportedCapRate: "Reported cap rate", listPrice: "List price", marketRange: "Market range", priceSqft: "Price / sqft", subjectComparison: "Subject comparison", riskAnalysis: "Risk Analysis", matchDisclaimer: "Match Score represents profile compatibility, not investment quality.", evidenceLabel: "Evidence", profileFit: "Profile fit", valuationLabel: "Valuation", executiveSummary: "MAXXIS EXECUTIVE SUMMARY", confidenceDisclaimer: "Analysis completeness and reliability — not property quality.", notAvailable: "Not available", level: "LEVEL", mapAttribution: "© OpenStreetMap contributors",
    noExternal: "Property records only — no external comparable images.",
    disclaimer:
      "This report provides evidence-based investment analysis only and does not constitute appraisal, financial advice, or recommendation to buy or sell.",
  },
  pt: {
    language: "pt",
    open: "Abrir experiência do relatório do investidor",
    release: "Relatório de imóvel pronto para investidores",
    tagline: "Dados reais. Decisões mais inteligentes.",
    reportFree: "Relatório do Imóvel",
    reportPro: "Relatório de Análise Maxxis",
    reportDeal: "Relatório Maxxis de Inteligência do Negócio",
    property: "Visão Geral do Imóvel",
    owner: "Propriedade e Registro Público",
    characteristics: "Características do Imóvel",
    land: "Terreno e Dados Fiscais",
    photos: "Fotos do Imóvel",
    location: "Mapa de Localização",
    notes: "Notas",
    cma: "Análise Comparativa de Mercado",
    relative:
      "Visão de distância relativa — não representa coordenadas geográficas",
    valuation: "Inteligência de Avaliação",
    providerEstimate: "Estimativa do provedor (não é o ARV DealSifter)",
    spread: "Margem Potencial",
    roi: "Faixa de ROI Projetado",
    rental: "Inteligência de Locação",
    price: "Análise de Preço",
    distribution: "Distribuição de Valor",
    fitRisk: "Aderência e Análise de Risco",
    profile: "Perfil do Investidor",
    compatibility: "Compatibilidade com o Perfil",
    evidence: "Resumo das Evidências",
    insights: "Insights e Verificação",
    positive: "Sinais Positivos",
    missing: "Informações Ausentes",
    considerations: "Considerações",
    steps: "Etapas Recomendadas de Verificação",
    powered: "Tecnologia MAXXIS AI",
    conclusion: "Conclusão Segmentada",
    topics: "Tópicos Principais",
    questions: "Perguntas",
    actions: "Ações Recomendadas",
    confidence: "Confiança da Análise Maxxis",
    contributors: "Contribuições positivas",
    limitations: "Limitações",
    perspective: "Perspectiva do Investidor",
    unknown: "DESCONHECIDO",
    unavailable: "Indisponível",
    scenario: "Baseado em cenários",
    beds: "Quartos", baths: "Banheiros", livingArea: "Área útil", capRate: "Cap rate", ownerLabel: "Proprietário", ownerOccupied: "Ocupado pelo proprietário", ownershipRecord: "Registro de propriedade", latestSale: "Última venda", saleDate: "Data da venda", allowedContacts: "Contatos permitidos", title: "Título", priceLabel: "Preço", strategy: "Estratégia", range: "Faixa", yearBuilt: "Ano de construção", bedsBaths: "Quartos / Banheiros", rehab: "Reforma", county: "Condado", lotSize: "Área do lote", assessedValue: "Valor fiscal", propertyTax: "Imposto predial", source: "Fonte", address: "Endereço", salePrice: "Preço de venda", distance: "Distância", similarity: "Similaridade", status: "Status", confidenceLabel: "Confiança", compsLabel: "Comparáveis", method: "Método", estimatedArv: "Faixa estimada de ARV", estimatedRent: "Aluguel estimado", rentalYield: "Rendimento do aluguel", reportedCapRate: "Cap rate informado", listPrice: "Preço anunciado", marketRange: "Faixa de mercado", priceSqft: "Preço / sqft", subjectComparison: "Comparação do imóvel", riskAnalysis: "Análise de riscos", matchDisclaimer: "A pontuação representa aderência ao perfil, não a qualidade do investimento.", evidenceLabel: "Evidência", profileFit: "Aderência ao perfil", valuationLabel: "Avaliação", executiveSummary: "RESUMO EXECUTIVO MAXXIS", confidenceDisclaimer: "Completude e confiabilidade da análise — não é qualidade do imóvel.", notAvailable: "Indisponível", level: "NÍVEL", mapAttribution: "© Colaboradores do OpenStreetMap",
    noExternal:
      "Somente registros dos imóveis — sem imagens externas de comparáveis.",
    disclaimer:
      "Este relatório fornece apenas análise de investimento baseada em evidências e não constitui avaliação oficial, aconselhamento financeiro ou recomendação de compra ou venda.",
  },
  es: {
    language: "es",
    open: "Abrir experiencia del informe del inversor",
    release: "Informe de propiedad listo para inversores",
    tagline: "Datos reales. Decisiones más inteligentes.",
    reportFree: "Informe de la Propiedad",
    reportPro: "Informe de Análisis Maxxis",
    reportDeal: "Informe Maxxis de Inteligencia del Negocio",
    property: "Resumen de la Propiedad",
    owner: "Titularidad y Registro Público",
    characteristics: "Características de la Propiedad",
    land: "Terreno y Datos Fiscales",
    photos: "Fotos de la Propiedad",
    location: "Mapa de Ubicación",
    notes: "Notas",
    cma: "Análisis Comparativo de Mercado",
    relative:
      "Vista de distancia relativa — no representa coordenadas geográficas",
    valuation: "Inteligencia de Valoración",
    providerEstimate: "Estimación del proveedor (no es ARV DealSifter)",
    spread: "Margen Potencial",
    roi: "Rango de ROI Proyectado",
    rental: "Inteligencia de Alquiler",
    price: "Análisis de Precio",
    distribution: "Distribución de Valor",
    fitRisk: "Alineación y Análisis de Riesgo",
    profile: "Perfil del Inversor",
    compatibility: "Compatibilidad con el Perfil",
    evidence: "Resumen de Evidencias",
    insights: "Insights y Verificación",
    positive: "Señales Positivos",
    missing: "Información Faltante",
    considerations: "Consideraciones",
    steps: "Pasos Recomendados de Verificación",
    powered: "Tecnología MAXXIS AI",
    conclusion: "Conclusión Segmentada",
    topics: "Temas Principales",
    questions: "Preguntas",
    actions: "Acciones Recomendadas",
    confidence: "Confianza del Análisis Maxxis",
    contributors: "Contribuciones positivas",
    limitations: "Limitaciones",
    perspective: "Perspectiva del Inversor",
    unknown: "DESCONOCIDO",
    unavailable: "No disponible",
    scenario: "Basado en escenarios",
    beds: "Habitaciones", baths: "Baños", livingArea: "Superficie", capRate: "Cap rate", ownerLabel: "Propietario", ownerOccupied: "Ocupada por propietario", ownershipRecord: "Registro de titularidad", latestSale: "Última venta", saleDate: "Fecha de venta", allowedContacts: "Contactos permitidos", title: "Título", priceLabel: "Precio", strategy: "Estrategia", range: "Rango", yearBuilt: "Año de construcción", bedsBaths: "Hab. / Baños", rehab: "Reforma", county: "Condado", lotSize: "Superficie del lote", assessedValue: "Valor fiscal", propertyTax: "Impuesto predial", source: "Fuente", address: "Dirección", salePrice: "Precio de venta", distance: "Distancia", similarity: "Similitud", status: "Estado", confidenceLabel: "Confianza", compsLabel: "Comparables", method: "Método", estimatedArv: "Rango ARV estimado", estimatedRent: "Alquiler estimado", rentalYield: "Rendimiento del alquiler", reportedCapRate: "Cap rate informado", listPrice: "Precio anunciado", marketRange: "Rango de mercado", priceSqft: "Precio / sqft", subjectComparison: "Comparación de la propiedad", riskAnalysis: "Análisis de riesgos", matchDisclaimer: "La puntuación representa afinidad con el perfil, no la calidad de la inversión.", evidenceLabel: "Evidencia", profileFit: "Afinidad con el perfil", valuationLabel: "Valoración", executiveSummary: "RESUMEN EJECUTIVO MAXXIS", confidenceDisclaimer: "Integridad y fiabilidad del análisis; no es la calidad del inmueble.", notAvailable: "No disponible", level: "NIVEL", mapAttribution: "© Colaboradores de OpenStreetMap",
    noExternal:
      "Solo registros de propiedades — sin imágenes externas de comparables.",
    disclaimer:
      "Este informe ofrece únicamente análisis de inversión basado en evidencia y no constituye tasación, asesoramiento financiero ni recomendación de compra o venta.",
  },
};

const OPEN_HINT = Object.freeze({
  en: "CLICK TO VIEW",
  pt: "CLIQUE PARA VER",
  es: "CLIC PARA VER",
});

const list = (value) => (Array.isArray(value) ? value : []);
const available = (section) => (section?.available ? section.data : null);
const text = (value, unknown) =>
  value === null || value === undefined || value === ""
    ? unknown
    : String(value);
const money = (value, unknown) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number === 0) return unknown;
  return number < 0
    ? `-$${Math.abs(number).toLocaleString("en-US")}`
    : `$${number.toLocaleString("en-US")}`;
};
const percent = (value, unknown) =>
  Number.isFinite(Number(value))
    ? `${Number(value).toLocaleString("en-US")}%`
    : unknown;
const evidenceText = (value, fallback, language = "en") =>
  explainMaxxisEvidenceState(value || fallback, language);
const KEY_LABELS = Object.freeze({
  pt: { totalComparableRecords: "Registros comparáveis", sampleSize: "Total de registros", usedCount: "Usados na análise", supportingCount: "Registros de apoio", salePriceLow: "Menor preço de venda", salePriceHigh: "Maior preço de venda", usedComparables: "Usados na análise", averageSalePrice: "Preço médio de venda", averageSimilarity: "Similaridade média", averageDistance: "Distância média", verifiedRecords: "Registros verificados", userProvided: "Informado pelo usuário", calculated: "Calculado", estimated: "Estimado", unknown: "Desconhecido", conflicts: "Conflitos", location: "Localização", priceRange: "Faixa de preço", propertyType: "Tipo de imóvel", strategy: "Estratégia" },
  es: { totalComparableRecords: "Registros comparables", sampleSize: "Total de registros", usedCount: "Usados en el análisis", supportingCount: "Registros de apoyo", salePriceLow: "Menor precio de venta", salePriceHigh: "Mayor precio de venta", usedComparables: "Usados en el análisis", averageSalePrice: "Precio medio de venta", averageSimilarity: "Similitud media", averageDistance: "Distancia media", verifiedRecords: "Registros verificados", userProvided: "Informado por el usuario", calculated: "Calculado", estimated: "Estimado", unknown: "Desconocido", conflicts: "Conflictos" },
});

const reportProfiler = (id, phase, actualDuration, baseDuration, startTime, commitTime) => {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function" || typeof CustomEvent !== "function") return;
  window.dispatchEvent(new CustomEvent("dealsifter:maxxis-performance", { detail: { stage: "inline_report_react_commit", id, phase, actualDuration, baseDuration, startTime, commitTime } }));
};
const keyLabel = (key, language = "en") => {
  const safeKey = String(key || "");
  return KEY_LABELS[language]?.[safeKey] || safeKey.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
};
const displayLabel = (value, fallback = "", language = "en") => localizeMaxxisValue(value, language, fallback);
const arvStatusText = (status, copy) => {
  if (status === "ARV_AVAILABLE")
    return copy.unavailable === "Indisponível"
      ? "ARV disponível"
      : copy.unavailable === "No disponible"
        ? "ARV disponible"
        : "ARV available";
  if (status === "ARV_LIMITED")
    return copy.unavailable === "Indisponível"
      ? "ARV limitado pelas evidências"
      : copy.unavailable === "No disponible"
        ? "ARV limitado por la evidencia"
        : "ARV limited by evidence";
  return copy.unavailable;
};

function ReportHeader({ level, subtitle, copy }) {
  const product =
    level === 3
      ? copy.reportDeal
      : level === 2
        ? copy.reportPro
        : copy.reportFree;
  return (
    <header className="maxxis-v2-header">
      <div className="maxxis-v2-brand">
        <img src={officialDealSifterLogo} alt="DealSifter Match" />
        <small>{copy.tagline}</small>
      </div>
      <div>
        <strong>{product}</strong>
        <small>{subtitle}</small>
      </div>
      <span className={`is-level-${level}`}>
        {level === 3 ? "ENTERPRISE" : level === 2 ? "PRO" : "FREE"}
      </span>
    </header>
  );
}

function ComparableMap({ schema, rows, copy }) {
  const [mapImage, setMapImage] = useState(null);
  useEffect(() => {
    let active = true;
    const renderMap = () => resolveComparableMap(schema).then((result) => {
      if (active) setMapImage(result);
    });
    const idleId = typeof window !== "undefined" && typeof window.requestIdleCallback === "function"
      ? window.requestIdleCallback(renderMap, { timeout: 1500 })
      : setTimeout(renderMap, 0);
    return () => {
      active = false;
      if (typeof window !== "undefined" && typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idleId);
      else clearTimeout(idleId);
    };
  }, [schema]);
  if (mapImage)
    return (
      <div className="maxxis-v2-comparable-map">
        <img src={mapImage} alt={copy.cma} />
        <small>{copy.mapAttribution}</small>
      </div>
    );
  return (
    <div
      className="maxxis-v2-relative-map"
      role="img"
      aria-label={copy.relative}
    >
      <span className="is-subject">S</span>
      {rows.map((item, index) => (
        <span
          key={item.compIdentifier || `${item.address}-${index}`}
          className={`is-${item.status.toLowerCase()}`}
          style={{
            "--comp-offset": `${Math.min(88, 18 + (item.distanceMiles || index + 1) * 18)}%`,
          }}
        >
          {index + 1}
        </span>
      ))}
      <small>{copy.relative}</small>
    </div>
  );
}

function Badge({ children, tone = "teal" }) {
  return <span className={`maxxis-v2-badge is-${tone}`}>{children}</span>;
}

function SectionTitle({ icon = FileText, children }) {
  return (
    <strong className="maxxis-v2-section-title">
      <span>
        {React.createElement(icon, { "aria-hidden": true, size: 16 })}
      </span>
      {children}
    </strong>
  );
}

function InfoCard({ title, rows, icon, narrative = false, copy }) {
  return (
    <section className={`maxxis-v2-info-card${narrative ? " is-narrative" : ""}`}>
      <SectionTitle icon={icon}>{title}</SectionTitle>
      <dl>
        {rows.length ? (
          rows.map(([label, value, source]) => (
            <div key={`${label}-${value}`}>
              <dt>{label}</dt>
              <dd>
                {narrative
                  ? evidenceText(value, copy?.unavailable, copy?.language)
                  : displayLabel(value, copy?.unavailable, copy?.language)}
                {source ? <small>{displayLabel(source, copy?.unavailable, copy?.language)}</small> : null}
              </dd>
            </div>
          ))
        ) : (
          <div>
            <dt>{copy?.status || "Status"}</dt>
            <dd>{copy?.notAvailable || "Not available"}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}

function ConfidenceCard({ confidence, copy }) {
  if (!confidence) return null;
  return (
    <section className="maxxis-v2-confidence">
      <div>
        <small>{copy.confidence}</small>
        <strong>{percent(confidence.score, copy.unknown)}</strong>
        <Badge
          tone={
            confidence.classification === "HIGH"
              ? "teal"
              : confidence.classification === "MODERATE"
                ? "gold"
                : "muted"
          }
        >
          {displayLabel(confidence.classification, copy.unavailable, copy.language)}
        </Badge>
        <em>{copy.confidenceDisclaimer}</em>
      </div>
      <div>
        <strong>{copy.contributors}</strong>
        {list(confidence.contributors).map((item) => (
          <span key={item}>✓ {evidenceText(item, copy.unavailable, copy.language)}</span>
        ))}
      </div>
      <div>
        <strong>{copy.limitations}</strong>
        {list(confidence.limitations).map((item) => (
          <span key={item}>⚠ {evidenceText(item, copy.unavailable, copy.language)}</span>
        ))}
      </div>
    </section>
  );
}

function PropertyOverview({ schema, copy, level, page = 1, pageCode = "PROPERTY_OVERVIEW" }) {
  const property = available(schema.sections.propertySummary) || {};
  const owner = property.owner || {};
  const images = list(property.images);
  const status = property.dealClosed
    ? "CLOSED"
    : property.published
      ? "PUBLISHED"
      : "DRAFT";
  const location = [
    property.address,
    property.city,
    property.state,
    property.zip,
  ]
    .filter(Boolean)
    .join(", ");
  const contacts = list(owner.allowedContacts)
    .map((item) => item.label || item.type || item.value)
    .filter(Boolean)
    .join(", ");
  const propertyEvidence = available(schema.sections.propertyEvidence) || {};
  const evidenceFacts = Object.fromEntries(
    [
      ...list(propertyEvidence.verifiedRecords),
      ...list(propertyEvidence.userProvided),
    ]
      .filter((item) => item?.field)
      .map((item) => [item.field, item]),
  );
  const fact = (field, fallback = null) =>
    evidenceFacts[field]?.value ?? fallback;
  const factSource = (field) =>
    evidenceFacts[field]?.sourceType || evidenceFacts[field]?.source || null;
  return (
    <article
      className="maxxis-v2-page"
      data-report-page={page}
      data-report-section={pageCode}
    >
      <ReportHeader
        level={level}
        copy={copy}
        subtitle={level === 2 ? copy.reportPro : copy.release}
      />
      <div className="maxxis-v2-page-body">
        <section className="maxxis-v2-property-hero">
          {images[0] ? (
            <img src={images[0]} alt="" />
          ) : (
            <div
              className="maxxis-v2-image-empty"
              aria-label={copy.unavailable}
            >
              ⌂
            </div>
          )}
          <div>
            <div className="maxxis-v2-badges">
              <Badge>{text(property.type, copy.unknown)}</Badge>
              <Badge tone="navy">{displayLabel(status, copy.unavailable, copy.language)}</Badge>
            </div>
            <h3>{text(property.title || property.address, copy.unknown)}</h3>
            <span>
              {text(
                [property.city, property.state].filter(Boolean).join(", "),
                copy.unknown,
              )}
            </span>
            <strong className="maxxis-v2-price">
              {money(property.price, copy.unknown)}
            </strong>
          </div>
        </section>
        <section className="maxxis-v2-metric-strip">
          <span>
            <BedDouble aria-hidden="true" />
            <small>{copy.beds}</small>
            <b>{text(property.beds, copy.unknown)}</b>
          </span>
          <span>
            <Bath aria-hidden="true" />
            <small>{copy.baths}</small>
            <b>{text(property.baths, copy.unknown)}</b>
          </span>
          <span>
            <Maximize aria-hidden="true" />
            <small>{copy.livingArea}</small>
            <b>{text(property.sqft, copy.unknown)}</b>
          </span>
          <span>
            <TrendingUp aria-hidden="true" />
            <small>{copy.capRate}</small>
            <b>
              {property.capRate === null || property.capRate === undefined
                ? copy.unknown
                : percent(property.capRate, copy.unknown)}
            </b>
          </span>
        </section>
        <div className="maxxis-v2-info-grid">
          <InfoCard
            copy={copy}
            icon={User}
            title={copy.owner}
            rows={[
              [copy.ownerLabel, text(owner.name, copy.unknown)],
              [
                copy.ownerOccupied,
                text(fact("ownerOccupied"), copy.unknown),
                factSource("ownerOccupied"),
              ],
              [
                copy.ownershipRecord,
                text(fact("ownershipRecordPresent"), copy.unknown),
                factSource("ownershipRecordPresent"),
              ],
              [
                copy.latestSale,
                money(fact("latestSalePrice"), copy.unknown),
                factSource("latestSalePrice"),
              ],
              [
                copy.saleDate,
                text(fact("latestSaleDate"), copy.unknown),
                factSource("latestSaleDate"),
              ],
              [copy.allowedContacts, text(contacts, copy.unknown)],
            ]}
          />
          <InfoCard
            copy={copy}
            icon={Home}
            title={copy.characteristics}
            rows={[
              [copy.title, text(property.title, copy.unknown)],
              [copy.priceLabel, money(property.price, copy.unknown)],
              [copy.strategy, text(property.objective, copy.unknown)],
              [
                copy.yearBuilt,
                text(fact("yearBuilt"), copy.unknown),
                factSource("yearBuilt"),
              ],
              [
                copy.bedsBaths,
                `${text(fact("bedrooms", property.beds), copy.unknown)} / ${text(fact("bathrooms", property.baths), copy.unknown)}`,
              ],
              [
                copy.livingArea,
                text(fact("livingAreaSqft", property.sqft), copy.unknown),
                factSource("livingAreaSqft"),
              ],
              [copy.rehab, money(property.rehab, copy.unknown)],
            ]}
          />
          <InfoCard
            copy={copy}
            icon={MapPin}
            title={copy.land}
            rows={[
              [copy.location, text(location, copy.unknown)],
              [
                copy.county,
                text(fact("county"), copy.unknown),
                factSource("county"),
              ],
              [
                copy.lotSize,
                text(fact("lotSizeSqft", property.lot), copy.unknown),
                factSource("lotSizeSqft"),
              ],
              [
                copy.assessedValue,
                money(fact("assessedValue"), copy.unknown),
                factSource("assessedValue"),
              ],
              [
                copy.propertyTax,
                money(fact("annualPropertyTax"), copy.unknown),
                factSource("annualPropertyTax"),
              ],
              [copy.source, text(property.source, copy.unknown)],
            ]}
          />
        </div>
        <section className="maxxis-v2-photo-section">
          <SectionTitle icon={Camera}>{copy.photos}</SectionTitle>
          {images.length ? (
            <div className="maxxis-v2-photos">
              {images.slice(0, 5).map((image, index) => (
                <img
                  key={`${image}-${index}`}
                  src={image}
                  alt={`${copy.photos} ${index + 1}`}
                />
              ))}
            </div>
          ) : (
            <p>{copy.unavailable}</p>
          )}
        </section>
        <div className="maxxis-v2-bottom-grid">
          <section className="maxxis-v2-location">
            <SectionTitle icon={Map}>{copy.location}</SectionTitle>
            <div
              role="img"
              aria-label={`${copy.location}: ${location || copy.unknown}`}
            >
              <MapPin aria-hidden="true" />
              <b>{text(location, copy.unknown)}</b>
              <small>
                {displayLabel(schema.presentation.map.status, copy.unavailable, copy.language)}
              </small>
            </div>
          </section>
          <section className="maxxis-v2-notes">
            <SectionTitle icon={FileText}>{copy.notes}</SectionTitle>
            <p>{text(property.notes || property.description, copy.unknown)}</p>
          </section>
        </div>
      </div>
    </article>
  );
}

function ComparableMarket({ schema, copy, page = 2 }) {
  const comps = available(schema.sections.comparableEvidence) || {};
  const groups = [
    ["USED", list(comps.used)],
    ["SUPPORT", list(comps.supporting)],
    ["EXCLUDED", list(comps.excluded)],
  ];
  const rows = groups.flatMap(([status, items]) =>
    items.map((item) => ({ ...item, status })),
  );
  return (
    <article
      className="maxxis-v2-page"
      data-report-page={page}
      data-report-section="COMPARATIVE_MARKET_ANALYSIS"
    >
      <ReportHeader level={3} copy={copy} subtitle={copy.cma} />
      <div className="maxxis-v2-page-body">
        <SectionTitle icon={MapPin}>{copy.cma}</SectionTitle>
        <ComparableMap schema={schema} rows={rows} copy={copy} />
        <div className="maxxis-v2-comp-stats">
          {Object.entries(schema.presentation.comparableStatistics || {})
            .filter(
              ([key, value]) => !["sourceType"].includes(key) && value !== null,
            )
            .slice(0, 6)
            .map(([key, value]) => (
              <span key={key}>
                <small>{keyLabel(key, copy.language)}</small>
                <b>
                  {key.toLowerCase().includes("percent") ||
                  key.toLowerCase().includes("similarity")
                    ? `${value}%`
                    : value}
                </b>
              </span>
            ))}
        </div>
        <div className="maxxis-v2-table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>{copy.address}</th>
                <th>{copy.salePrice}</th>
                <th>{copy.saleDate}</th>
                <th>{copy.bedsBaths}</th>
                <th>Sqft</th>
                <th>{copy.distance}</th>
                <th>{copy.similarity}</th>
                <th>{copy.status}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item, index) => (
                <tr key={item.compIdentifier || `${item.address}-${index}`}>
                  <td>{index + 1}</td>
                  <td>
                    <strong>{text(item.address, copy.unknown)}</strong>
                    <small>
                      {evidenceText(
                        item.exclusionReason || item.inclusionReason || "",
                        copy.unavailable,
                        copy.language,
                      )}
                    </small>
                  </td>
                  <td>{money(item.salePrice, copy.unknown)}</td>
                  <td>{text(item.saleDate, copy.unknown)}</td>
                  <td>
                    {text(item.beds, copy.unknown)} /{" "}
                    {text(item.baths, copy.unknown)}
                  </td>
                  <td>{text(item.sqft, copy.unknown)}</td>
                  <td>
                    {item.distanceMiles !== null &&
                    item.distanceMiles !== undefined &&
                    item.distanceMiles !== "" &&
                    Number.isFinite(Number(item.distanceMiles))
                      ? `${Number(item.distanceMiles)} mi`
                      : copy.unknown}
                  </td>
                  <td>{percent(item.similarity, copy.unknown)}</td>
                  <td>
                    <Badge
                      tone={
                        item.status === "EXCLUDED"
                          ? "muted"
                          : item.status === "SUPPORT"
                            ? "gold"
                            : "teal"
                      }
                    >
                      {displayLabel(item.status, copy.unavailable, copy.language)}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <small>{copy.noExternal}</small>
      </div>
    </article>
  );
}

function ScenarioCards({ title, values, formatter, copy }) {
  return (
    <section className="maxxis-v2-kpi-block">
      <SectionTitle icon={TrendingUp}>{title}</SectionTitle>
      <div>
        {list(values).map((item) => (
          <span key={item.scenario}>
            <small>{displayLabel(item.scenario, copy.unavailable, copy.language)}</small>
            <b>{formatter(item.value, copy.unknown)}</b>
          </span>
        ))}
      </div>
    </section>
  );
}

function ValuationPage({ schema, copy, page = 3 }) {
  const valuation = available(schema.sections.valuationEvidence) || {};
  const scenarios = schema.presentation.kpiScenarios;
  const metrics = schema.presentation.existingMetrics || {};
  const property = available(schema.sections.propertySummary) || {};
  const range = valuation.status === "ARV_UNAVAILABLE" ? null : valuation.range;
  const providerEstimate = valuation.providerEstimate;
  const chartValues = range
    ? [
        range.low,
        valuation.centralReference || (range.low + range.high) / 2,
        range.high,
      ]
    : [];
  const max = Math.max(...chartValues, 1);
  return (
    <article
      className="maxxis-v2-page"
      data-report-page={page}
      data-report-section="VALUATION_INTELLIGENCE"
    >
      <ReportHeader level={3} copy={copy} subtitle={copy.valuation} />
      <div className="maxxis-v2-page-body">
        <section className="maxxis-v2-arv">
          <div>
            <small>{copy.estimatedArv}</small>
            <strong>
              {range
                ? `${money(range.low, copy.unknown)} – ${money(range.high, copy.unknown)}`
                : copy.unavailable}
            </strong>
          </div>
          <div>
            <Badge
              tone={
                valuation.status === "ARV_AVAILABLE"
                  ? "teal"
                  : valuation.status === "ARV_LIMITED"
                    ? "gold"
                    : "muted"
              }
            >
              {arvStatusText(valuation.status, copy)}
            </Badge>
            <span>
              {copy.confidenceLabel}: <b>{displayLabel(valuation.confidence || "LOW", copy.unavailable, copy.language)}</b>
            </span>
            <span>
              {copy.compsLabel}: <b>{valuation.compsUsed || 0}</b>
            </span>
            <span>
              {copy.method}: <b>{text(valuation.methodology, copy.unknown)}</b>
            </span>
          </div>
        </section>
        {providerEstimate ? (
          <section className="maxxis-v2-provider-estimate">
            <div>
              <small>{copy.providerEstimate}</small>
              <strong>{money(providerEstimate.value, copy.unknown)}</strong>
            </div>
            <Badge tone="gold">
              {evidenceText(providerEstimate.status, copy.unknown, copy.language)}
            </Badge>
          </section>
        ) : null}
        <Badge tone="navy">{copy.scenario}</Badge>
        {scenarios?.available ? (
          <>
            <ScenarioCards
              title={copy.spread}
              values={scenarios.potentialSpread}
              formatter={money}
              copy={copy}
            />
            <ScenarioCards
              title={copy.roi}
              values={scenarios.projectedRoi}
              formatter={percent}
              copy={copy}
            />
            <small>{evidenceText(scenarios.disclaimer, copy.unknown, copy.language)}</small>
          </>
        ) : (
          <p>
            {copy.spread} / {copy.roi}: {copy.unavailable} —{" "}
            {evidenceText(scenarios?.reason, copy.unknown, copy.language)}
          </p>
        )}
        <div className="maxxis-v2-two-col">
          <InfoCard
            copy={copy}
            icon={DollarSign}
            title={copy.rental}
            rows={[
              [copy.estimatedRent, copy.unknown],
              [copy.rentalYield, copy.unknown],
              ["NOI", copy.unknown],
              [
                copy.reportedCapRate,
                metrics.capRate?.value === null
                  ? copy.unknown
                  : percent(metrics.capRate?.value, copy.unknown),
                metrics.capRate?.sourceType,
              ],
            ]}
          />
          <InfoCard
            copy={copy}
            icon={TrendingUp}
            title={copy.price}
            rows={[
              [copy.listPrice, money(property.price, copy.unknown)],
              [copy.marketRange, copy.unknown],
              [
                copy.priceSqft,
                metrics.pricePerSqft?.value === null
                  ? copy.unknown
                  : money(metrics.pricePerSqft?.value, copy.unknown),
                metrics.pricePerSqft?.sourceType,
              ],
              [copy.subjectComparison, copy.unknown],
            ]}
          />
        </div>
        <section className="maxxis-v2-chart">
          <SectionTitle icon={BarChart3}>{copy.distribution}</SectionTitle>
          {chartValues.length ? (
            <div>
              {chartValues.map((value, index) => (
                <span
                  key={`${value}-${index}`}
                  style={{ height: `${Math.max(15, (value / max) * 100)}%` }}
                >
                  <b>{money(value, copy.unknown)}</b>
                </span>
              ))}
            </div>
          ) : (
            <p>{copy.unavailable}</p>
          )}
        </section>
        {list(valuation.warnings).map((warning) => (
          <p className="maxxis-v2-warning" key={warning}>
            <AlertTriangle aria-hidden="true" size={14} />{" "}
            {evidenceText(warning, copy.unknown, copy.language)}
          </p>
        ))}
      </div>
    </article>
  );
}

function FitRiskPage({ schema, copy, page = 4, level = 3 }) {
  const fit = available(schema.sections.investmentProfile) || {};
  const risks = list(available(schema.sections.riskAssessment));
  const counts = schema.presentation.evidenceCounts || {};
  const perspective = schema.presentation.investorPerspective;
  const safeScore = Number.isFinite(Number(fit.score))
    ? Math.max(0, Math.min(100, Number(fit.score)))
    : 0;
  const criteria = list(fit.criteria).length
    ? list(fit.criteria)
    : [
        ["location", fit.targetMarket],
        ["priceRange", fit.priceRange],
        ["propertyType", fit.propertyType],
        ["strategy", fit.strategy],
      ].filter(([, criterion]) => Boolean(criterion)).map(([key, criterion]) => ({ ...criterion, key }));
  return (
    <article
      className="maxxis-v2-page"
      data-report-page={page}
      data-report-section="INVESTMENT_FIT_RISK"
    >
      <ReportHeader level={level} copy={copy} subtitle={copy.fitRisk} />
      <div className="maxxis-v2-page-body">
        <div className="maxxis-v2-two-col">
          <InfoCard
            copy={copy}
            icon={User}
            title={copy.profile}
            rows={[
              [copy.strategy, displayLabel(fit.strategy?.status, copy.unknown, copy.language)],
              [copy.marketRange, displayLabel(fit.targetMarket?.status, copy.unknown, copy.language)],
              [copy.range || "Range", displayLabel(fit.priceRange?.status, copy.unknown, copy.language)],
              [
                copy.characteristics,
                displayLabel(fit.propertyType?.status, copy.unknown, copy.language),
              ],
            ]}
          />
          <section className="maxxis-v2-score">
            <SectionTitle icon={Target}>{copy.compatibility}</SectionTitle>
            <div style={{ "--match-score": `${safeScore * 3.6}deg` }}>
              <b>{percent(fit.score, copy.unknown)}</b>
            </div>
            <small>
              {copy.matchDisclaimer}
            </small>
          </section>
        </div>
        {perspective ? (
          <section className="maxxis-v2-perspective">
            <div>
              <small>{copy.perspective}</small>
              <strong>{displayLabel(perspective.persona, copy.unavailable, copy.language)}</strong>
              <span>{evidenceText(perspective.message, copy.unavailable, copy.language)}</span>
            </div>
            <div>
              {list(perspective.priorities).map((item, index) => (
                <Badge key={item} tone={index === 0 ? "navy" : "teal"}>
                  {index + 1}. {evidenceText(item, copy.unavailable, copy.language)}
                </Badge>
              ))}
            </div>
          </section>
        ) : null}
        <section>
          <SectionTitle icon={BarChart3}>{copy.fitRisk}</SectionTitle>
          <div className="maxxis-v2-fit-bars">
            {criteria.map((criterion, criterionIndex) => {
              const score =
                criterion.score ??
                (criterion.status === "matched"
                  ? 100
                  : criterion.status === "not_matched"
                    ? 0
                    : 35);
              return (
                <div key={criterion.key || criterion.label || `criterion-${criterionIndex}`}>
                  <span>{keyLabel(criterion.key || criterion.label, copy.language)}</span>
                  <i>
                    <b
                      style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
                    />
                  </i>
                  <strong>{score}%</strong>
                </div>
              );
            })}
          </div>
        </section>
        <section>
          <SectionTitle icon={AlertTriangle}>{copy.riskAnalysis}</SectionTitle>
          <div className="maxxis-v2-risk-grid">
            {risks.length ? (
              risks.map((risk) => (
                <div key={risk.code}>
                  <Badge
                    tone={
                      risk.severity === "HIGH"
                        ? "danger"
                        : risk.severity === "MEDIUM"
                          ? "gold"
                          : "teal"
                    }
                  >
                    {displayLabel(risk.severity, copy.unavailable, copy.language)}
                  </Badge>
                  <b>{displayLabel(risk.category, copy.unavailable, copy.language)}</b>
                  <i
                    className={`is-${String(risk.severity || "medium").toLowerCase()}`}
                  >
                    <span />
                  </i>
                  <span>{evidenceText(risk.reason || risk.explanation, copy.unavailable, copy.language)}</span>
                </div>
              ))
            ) : (
              <p>{copy.unavailable}</p>
            )}
          </div>
        </section>
        <section>
          <SectionTitle icon={CheckCircle}>{copy.evidence}</SectionTitle>
          <div className="maxxis-v2-evidence-counts">
            {Object.entries(counts).map(([key, value]) => (
              <span key={key}>
                <b>{value}</b>
                <small>{keyLabel(key, copy.language)}</small>
              </span>
            ))}
          </div>
        </section>
      </div>
    </article>
  );
}

function InsightsPage({ schema, copy, page = 5, level = 3 }) {
  const executive = available(schema.sections.executiveSummary) || {};
  const observations = list(executive.observations);
  const limitations = list(available(schema.sections.limitations));
  const checks = list(available(schema.sections.verificationChecklist));
  return (
    <article
      className="maxxis-v2-page"
      data-report-page={page}
      data-report-section="KEY_INSIGHTS_VERIFICATION"
    >
      <ReportHeader level={level} copy={copy} subtitle={copy.insights} />
      <div className="maxxis-v2-page-body maxxis-v2-insight-grid">
        <InfoCard
          copy={copy}
          icon={CheckCircle}
          title={copy.positive}
          narrative
          rows={observations.map((item, index) => [
            `${index + 1}`,
            text(item.explanation || item, copy.unknown),
            item.source || item.sourceType,
          ])}
        />
        <InfoCard
          copy={copy}
          icon={AlertTriangle}
          title={copy.missing}
          narrative
          rows={limitations
            .filter((item) => /unknown|missing|unavailable|none/i.test(item))
            .map((item, index) => [`${index + 1}`, item])}
        />
        <InfoCard
          copy={copy}
          icon={Wrench}
          title={copy.considerations}
          narrative
          rows={limitations.map((item, index) => [`${index + 1}`, item])}
        />
        <InfoCard
          copy={copy}
          icon={ListChecks}
          title={copy.steps}
          narrative
          rows={checks.map((item, index) => [`${index + 1}`, item])}
        />
      </div>
    </article>
  );
}

function MaxxisAnalysisPage({ schema, copy, page = 6, level = 3 }) {
  const executive = available(schema.sections.executiveSummary) || {};
  const risks = list(available(schema.sections.riskAssessment));
  const checks = list(available(schema.sections.verificationChecklist));
  const summary = executive.summary || executive || copy.unknown;
  const summaryLines = list(
    schema.presentation.executiveSummaryIntelligence?.lines,
  );
  return (
    <article
      className="maxxis-v2-page"
      data-report-page={page}
      data-report-section="MAXXIS_AI_ANALYSIS"
    >
      <ReportHeader level={level} copy={copy} subtitle={copy.powered} />
      <div className="maxxis-v2-page-body">
        <ConfidenceCard
          confidence={schema.presentation.analysisConfidence}
          copy={copy}
        />
        <section className="maxxis-v2-ai-summary">
          <SectionTitle icon={Brain}>{copy.executiveSummary}</SectionTitle>
          {summaryLines.length ? (
            summaryLines.map((line) => (
              <span key={line}>{evidenceText(line, copy.unavailable, copy.language)}</span>
            ))
          ) : (
            <strong>{displayLabel(summary, copy.unavailable, copy.language)}</strong>
          )}
        </section>
        <div className="maxxis-v2-two-col">
          <InfoCard
            copy={copy}
            icon={Target}
            title={copy.conclusion}
            narrative
            rows={[
              [
                copy.evidenceLabel,
                displayLabel(schema.sections.propertyEvidence.sourceType, copy.unavailable, copy.language),
              ],
              [
                copy.profileFit,
                text(
                  available(schema.sections.investmentProfile)?.score,
                  copy.unknown,
                ),
              ],
              [
                copy.valuationLabel,
                displayLabel(
                  available(schema.sections.valuationEvidence)?.status,
                  copy.unavailable,
                  copy.language,
                ),
              ],
            ]}
          />
          <InfoCard
            copy={copy}
            icon={BarChart3}
            title={copy.topics}
            narrative
            rows={risks.map((risk, index) => [
              `${index + 1}`,
              `${displayLabel(risk.category, copy.unavailable, copy.language)}: ${evidenceText(risk.reason || risk.explanation, copy.unavailable, copy.language)}`,
            ])}
          />
        </div>
        <InfoCard
          copy={copy}
          icon={AlertTriangle}
          title={copy.questions}
          narrative
          rows={checks
            .slice(0, 4)
            .map((item, index) => [
              `${index + 1}`,
              `${evidenceText(item, copy.unavailable, copy.language).replace(/[.?]$/, "")}?`,
            ])}
        />
        <InfoCard
          copy={copy}
          icon={ListChecks}
          title={copy.actions}
          narrative
          rows={checks.map((item, index) => [`${index + 1}`, item])}
        />
        <p className="maxxis-v2-disclaimer">{copy.disclaimer}</p>
      </div>
    </article>
  );
}

function CanonicalReportPage({ page, schema, copy, level }) {
  if (page.code === "PROPERTY_OVERVIEW" || page.code === "EXECUTIVE_SUMMARY_PROPERTY_CONTEXT") {
    return <PropertyOverview schema={schema} copy={copy} level={level} page={page.page} pageCode={page.code} />;
  }
  if (page.code === "COMPARATIVE_MARKET_ANALYSIS") {
    return <ComparableMarket schema={schema} copy={copy} page={page.page} />;
  }
  if (page.code === "VALUATION_INTELLIGENCE") {
    return <ValuationPage schema={schema} copy={copy} page={page.page} />;
  }
  if (page.code === "INVESTMENT_FIT_RISK") {
    return <FitRiskPage schema={schema} copy={copy} page={page.page} level={level} />;
  }
  if (page.code === "KEY_INSIGHTS_NEXT_STEPS" || page.code === "KEY_INSIGHTS_VERIFICATION") {
    return <InsightsPage schema={schema} copy={copy} page={page.page} level={level} />;
  }
  if (page.code === "MAXXIS_AI_ANALYSIS") {
    return <MaxxisAnalysisPage schema={schema} copy={copy} page={page.page} level={level} />;
  }
  return null;
}

export function MaxxisDealIntelligenceReportPreview({
  schema,
  language = "en",
}) {
  if (!schema || schema.type !== "maxxis_report_schema") return null;
  const copy = COPY[language] || COPY.en;
  const level =
    schema.reportType === "DEAL_INTELLIGENCE"
      ? 3
      : schema.reportType === "MAXXIS_ANALYSIS"
        ? 2
        : 1;
  return (
    <React.Profiler id={`maxxis-inline-${schema.reportType}`} onRender={reportProfiler}>
    <details className={`maxxis-report-preview maxxis-report-v2 is-${schema.reportType.toLowerCase()}`}>
      <summary>
        <span>{copy.open}</span>
        <span className="maxxis-v2-open-hint">
          <i aria-hidden="true" />
          {OPEN_HINT[language] || OPEN_HINT.en}
        </span>
        <Badge tone="navy">{copy.level} {level}</Badge>
      </summary>
      <div className="maxxis-v2-report">
        {list(schema.pages).map((page) => (
          <CanonicalReportPage key={`${page.page}-${page.code}`} page={page} schema={schema} copy={copy} level={level} />
        ))}
      </div>
    </details>
    </React.Profiler>
  );
}
