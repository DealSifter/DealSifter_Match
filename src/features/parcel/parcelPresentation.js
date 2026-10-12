export function parcelLabels(language = 'en') {
  const t = (pt, en, es) => language.startsWith('pt') ? pt : language.startsWith('es') ? es : en;
  return {
    boundaries: t('Limites de lotes', 'Parcel boundaries', 'Límites de parcelas'), title: t('Dados públicos da parcela', 'Public parcel data', 'Datos públicos de la parcela'),
    publicGIS: t('Dados públicos GIS', 'Public GIS data', 'Datos GIS públicos'), on: t('ON', 'ON', 'ON'), off: t('OFF', 'OFF', 'OFF'),
    close: t('Fechar dados do lote', 'Close parcel details', 'Cerrar datos de la parcela'),
    magnifier: t('Ver limites e dados da parcela', 'View parcel boundaries and public data', 'Ver límites y datos de la parcela'),
    propertyPage: t('Imóvel', 'Property', 'Inmueble'), parcelPage: t('Parcela pública', 'Public parcel', 'Parcela pública'),
    closeLens: t('Fechar lente parcelária', 'Close parcel lens', 'Cerrar lente parcelaria'),
    lens: t('Lente parcelária', 'Parcel lens', 'Lente parcelaria'), unavailable: t('Não disponível', 'Not available', 'No disponible'),
    limited: t('Vizinhos limitados pela fonte; a lente não representa todos os lotes do raio.', 'Source-limited neighbors; the lens does not represent every parcel in the radius.', 'Vecinos limitados por la fuente; la lente no representa todas las parcelas del radio.'),
    neighborUnavailable: t('Não foi possível atualizar os lotes vizinhos. O lote principal foi mantido.', 'Neighbor refresh unavailable. The principal parcel is retained.', 'No se pudieron actualizar las parcelas vecinas. Se conserva la principal.'),
    legal: t('Descrição legal', 'Legal description', 'Descripción legal'), subdivision: t('Loteamento', 'Subdivision', 'Subdivisión'),
    provenance: t('Origem dos campos', 'Field provenance', 'Origen de los campos'),
    area: t('Área da parcela', 'Parcel area', 'Área de la parcela'), assessor: t('Área do cadastro fiscal', 'Assessor acreage', 'Área del registro fiscal'),
    gis: t('Área do GIS', 'GIS acreage', 'Área del GIS'), calculated: t('Área geodésica calculada', 'Calculated geodesic area', 'Área geodésica calculada'),
    owner: t('Proprietário no registro público', 'Public record owner', 'Propietario en registro público'), assessed: t('Valor fiscal', 'Assessed value', 'Valor fiscal'),
    tax: t('Imposto predial informado', 'Reported property tax', 'Impuesto predial informado'), taxCode: t('Código fiscal', 'Tax code', 'Código fiscal'),
    zoning: t('Zoneamento informado', 'Reported zoning', 'Zonificación informada'), source: t('Fonte', 'Source', 'Fuente'), updated: t('Atualização da fonte', 'Source updated', 'Actualización de la fuente'),
    retrieved: t('Consultado em', 'Retrieved', 'Consultado'), conflict: t('Divergência nos dados de área', 'Parcel area data conflict', 'Divergencia en los datos de área'),
    stale: t('Dados em cache; a atualização da fonte está indisponível.', 'Cached data; source refresh is unavailable.', 'Datos en caché; la actualización de la fuente no está disponible.'),
    disclaimer: t('Limites baseados em registros GIS públicos. Não substituem levantamento topográfico.', 'Boundaries are based on public GIS records and are not a land survey.', 'Los límites se basan en registros GIS públicos y no sustituyen un levantamiento topográfico.'),
    relation: t('Lote da propriedade selecionada', 'Selected property parcel', 'Parcela de la propiedad seleccionada'),
    ZOOM_REQUIRED: t('Aproxime o mapa para visualizar os lotes.', 'Zoom in to view parcel boundaries.', 'Acerca el mapa para ver los límites de parcelas.'),
    NARROWER_VIEWPORT_REQUIRED: t('Aproxime mais para limitar a consulta.', 'Zoom further to limit the query.', 'Acerque más para limitar la consulta.'),
    NO_ACTIVE_PUBLIC_SOURCE: t('Dados de lote públicos não disponíveis nesta área.', 'Public parcel data is not available in this area.', 'Los datos públicos de parcelas no están disponibles en esta área.'),
    SOURCE_TEMPORARILY_UNAVAILABLE: t('Fonte GIS temporariamente indisponível.', 'GIS source temporarily unavailable.', 'Fuente GIS temporalmente no disponible.'),
    AMBIGUOUS_LOCATION: t('Localização ou parcela ambígua; confirme o condado.', 'Ambiguous location or parcel; confirm county.', 'Ubicación o parcela ambigua; confirme el condado.'),
    PARCEL_NOT_FOUND: t('Nenhuma parcela encontrada neste local.', 'No parcel found here.', 'No se encontró parcela aquí.'),
    DISABLED: t('Recurso de parcelas desativado.', 'Parcel feature disabled.', 'Función de parcelas desactivada.'),
    loading: t('Consultando GIS público…', 'Querying public GIS…', 'Consultando GIS público…'),
  };
}
export function parcelPanelRows(parcel, language = 'en', { showUnavailable = false } = {}) {
  const labels = parcelLabels(language); const locale = language.startsWith('pt') ? 'pt-BR' : language.startsWith('es') ? 'es-US' : 'en-US';
  const numeric = n => new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(n);
  const money = n => new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
  // Display the normalized backend units independently; do not recalculate acreage/sqft here.
  const area = (acres, sqft) => [acres == null ? null : `${numeric(acres)} ac`, sqft == null ? null : `${numeric(sqft)} sqft`].filter(Boolean).join(' · ') || null;
  return [
    ['APN', parcel.apn], [labels.area, area(parcel.acres, parcel.lotSqft)],
    [labels.assessor, parcel.assessorAcres == null ? null : `${numeric(parcel.assessorAcres)} acres`],
    [labels.gis, parcel.gisAcres == null ? null : `${numeric(parcel.gisAcres)} acres`],
    [labels.calculated, area(parcel.geometryCalculatedAcres, parcel.geometryCalculatedSqft)],
    [labels.owner, parcel.ownerName], [labels.assessed, parcel.assessedValue == null ? null : `${money(parcel.assessedValue)}${parcel.assessedYear ? ` · ${parcel.assessedYear}` : ''}`],
    [labels.tax, parcel.propertyTax == null ? null : `${money(parcel.propertyTax)}${parcel.propertyTaxYear ? ` · ${parcel.propertyTaxYear}` : ''}`],
    [labels.taxCode, parcel.taxCode], [labels.zoning, parcel.zoning],
    [labels.legal, parcel.legalDescription], [labels.subdivision, parcel.subdivision],
  ].filter(([, value]) => showUnavailable || value !== null && value !== undefined && value !== '')
    .map(([label, value]) => [label, value === null || value === undefined || value === '' ? labels.unavailable : value]);
}

export function parcelFieldProvenance(parcel, language = 'en') {
  const t = parcelLabels(language);
  const labels = { apn: 'APN', lotSqft: t.area, assessorAcres: t.assessor, gisAcres: t.gis, ownerName: t.owner,
    assessedValue: t.assessed, propertyTax: t.tax, taxCode: t.taxCode, zoning: t.zoning, legalDescription: t.legal, subdivision: t.subdivision };
  return Object.entries(labels).filter(([key]) => parcel[key] != null && parcel[key] !== '' && parcel.provenance?.[key]?.sourceField)
    .map(([key, label]) => [label, parcel.provenance[key].sourceField]);
}
