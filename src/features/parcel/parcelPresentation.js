export function parcelLabels(language = 'en') {
  const t = (pt, en, es) => language.startsWith('pt') ? pt : language.startsWith('es') ? es : en;
  return {
    boundaries: t('Limites de parcelas', 'Parcel Boundaries', 'Límites de parcelas'), title: t('Dados públicos da parcela', 'Public parcel data', 'Datos públicos de la parcela'),
    area: t('Área da parcela', 'Parcel area', 'Área de la parcela'), assessor: t('Área do cadastro fiscal', 'Assessor acreage', 'Área del registro fiscal'),
    gis: t('Área do GIS', 'GIS acreage', 'Área del GIS'), calculated: t('Área geodésica calculada', 'Calculated geodesic area', 'Área geodésica calculada'),
    owner: t('Proprietário no registro público', 'Public record owner', 'Propietario en registro público'), assessed: t('Valor fiscal', 'Assessed value', 'Valor fiscal'),
    tax: t('Imposto predial informado', 'Reported property tax', 'Impuesto predial informado'), taxCode: t('Código fiscal', 'Tax code', 'Código fiscal'),
    zoning: t('Zoneamento informado', 'Reported zoning', 'Zonificación informada'), source: t('Fonte', 'Source', 'Fuente'), updated: t('Atualização da fonte', 'Source updated', 'Actualización de la fuente'),
    retrieved: t('Consultado em', 'Retrieved', 'Consultado'), conflict: t('Conflito nos dados da parcela', 'Parcel data conflict', 'Conflicto en datos de parcela'),
    stale: t('Cache desatualizado utilizável', 'Stale usable cache', 'Caché desactualizada utilizable'),
    disclaimer: t('Limite baseado em GIS público; não é levantamento topográfico.', 'Public GIS boundary, not a professional survey.', 'Límite de GIS público; no es levantamiento topográfico.'),
    relation: t('Contém o PIN selecionado; os dados do imóvel não foram alterados.', 'Contains selected PIN; property facts are unchanged.', 'Contiene el PIN seleccionado; no se alteraron datos del inmueble.'),
    ZOOM_REQUIRED: t('Aproxime para visualizar parcelas (zoom 16+).', 'Zoom in to view parcels (16+).', 'Acerque para ver parcelas (zoom 16+).'),
    NARROWER_VIEWPORT_REQUIRED: t('Aproxime mais para limitar a consulta.', 'Zoom further to limit the query.', 'Acerque más para limitar la consulta.'),
    NO_ACTIVE_PUBLIC_SOURCE: t('Sem fonte pública ativa e aprovada neste condado.', 'No active approved public source in this county.', 'Sin fuente pública activa y aprobada en este condado.'),
    SOURCE_TEMPORARILY_UNAVAILABLE: t('Fonte GIS temporariamente indisponível.', 'GIS source temporarily unavailable.', 'Fuente GIS temporalmente no disponible.'),
    AMBIGUOUS_LOCATION: t('Localização ou parcela ambígua; confirme o condado.', 'Ambiguous location or parcel; confirm county.', 'Ubicación o parcela ambigua; confirme el condado.'),
    PARCEL_NOT_FOUND: t('Nenhuma parcela encontrada neste local.', 'No parcel found here.', 'No se encontró parcela aquí.'),
    DISABLED: t('Recurso de parcelas desativado.', 'Parcel feature disabled.', 'Función de parcelas desactivada.'),
    loading: t('Consultando GIS público…', 'Querying public GIS…', 'Consultando GIS público…'),
  };
}
export function parcelPanelRows(parcel, language = 'en') {
  const labels = parcelLabels(language); const locale = language.startsWith('pt') ? 'pt-BR' : language.startsWith('es') ? 'es-US' : 'en-US';
  const numeric = n => new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(n);
  const money = n => new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
  return [
    ['APN', parcel.apn], [labels.area, parcel.acres == null ? null : `${numeric(parcel.acres)} acres`],
    [labels.assessor, parcel.assessorAcres == null ? null : `${numeric(parcel.assessorAcres)} acres`],
    [labels.gis, parcel.gisAcres == null ? null : `${numeric(parcel.gisAcres)} acres`],
    [labels.calculated, parcel.geometryCalculatedAcres == null ? null : `${numeric(parcel.geometryCalculatedAcres)} acres`],
    [labels.owner, parcel.ownerName], [labels.assessed, parcel.assessedValue == null ? null : `${money(parcel.assessedValue)}${parcel.assessedYear ? ` · ${parcel.assessedYear}` : ''}`],
    [labels.tax, parcel.propertyTax == null ? null : `${money(parcel.propertyTax)}${parcel.propertyTaxYear ? ` · ${parcel.propertyTaxYear}` : ''}`],
    [labels.taxCode, parcel.taxCode], [labels.zoning, parcel.zoning],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '');
}
