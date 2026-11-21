type Data = Record<string, any>;
export const reportDisplayName = (reportType: unknown) => reportType === 'DEAL_INTELLIGENCE' ? 'Enterprise' : reportType === 'MAXXIS_ANALYSIS' ? 'PRO' : 'Basic';

// User edits affect only the accompanying email, never the saved report or PDF.
export function resolveReportEmailMessage(defaults: {subject: string; body: string}, message?: unknown) {
  if (message === undefined) return defaults;
  const draft = message as {subject?: unknown; body?: unknown} | null;
  if (!draft || typeof draft.subject !== 'string' || !draft.subject.trim() || draft.subject.length > 240 ||
    /[\r\n\u0000-\u001f\u007f]/.test(draft.subject) || typeof draft.body !== 'string' || !draft.body.trim() ||
    draft.body.length > 60000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(draft.body)) throw new Error('INVALID_EMAIL_MESSAGE');
  return {subject: draft.subject.trim(), body: draft.body.replace(/\r\n|\r|\n/g, '\r\n')};
}
const text = (value: unknown) => typeof value === 'string' ? value.trim() : typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
const factPaths:Record<string,[string,string]>={
  address:['identity','address'],city:['identity','city'],state:['identity','state'],zip:['identity','zip'],
  beds:['physical','beds'],baths:['physical','baths'],sqft:['physical','livingAreaSqft'],yearBuilt:['physical','yearBuilt'],
  lotSizeSqft:['physical','lotSizeSqft'],lotSizeAcres:['physical','lotSizeAcres'],price:['financial','askingPrice'],
  rehab:['financial','rehab'],capRate:['financial','capRate'],annualPropertyTax:['tax','annualPropertyTax'],
  propertyTaxYear:['tax','propertyTaxYear'],assessedValue:['tax','assessedValue'],assessmentYear:['tax','assessmentYear'],
  assessorId:['parcel','assessorId'],zoning:['parcel','zoning'],county:['parcel','county'],legalDescription:['parcel','legalDescription'],
  subdivision:['parcel','subdivision'],latestSalePrice:['sales','lastSalePrice'],latestSaleDate:['sales','lastSaleDate'],
};
const propertyFields = [
  ['address','Endereço','Address'], ['city','Cidade','City'], ['state','Estado','State'], ['zip','ZIP','ZIP'],
  ['price','Preço anunciado (USD)','Asking price (USD)'], ['type','Tipo','Type'], ['objective','Objetivo','Objective'],
  ['dealTag','Estratégia','Strategy'], ['beds','Quartos','Bedrooms'], ['baths','Banheiros','Bathrooms'],
  ['sqft','Área habitável (sqft)','Living area (sqft)'], ['yearBuilt','Ano de construção','Year built'],
  ['lotSizeSqft','Terreno (sqft)','Lot size (sqft)'], ['lotSizeAcres','Terreno (acres)','Lot size (acres)'],
  ['county','Condado','County'], ['assessorId','APN','APN'], ['zoning','Zoneamento','Zoning'],
  ['subdivision','Subdivisão','Subdivision'], ['legalDescription','Descrição legal','Legal description'],
  ['annualPropertyTax','Imposto anual (USD)','Annual property tax (USD)'], ['propertyTaxYear','Ano fiscal','Tax year'],
  ['hoaFee','HOA informado (USD)','Reported HOA (USD)'], ['assessedValue','Valor fiscal (USD)','Assessed value (USD)'],
  ['assessmentYear','Ano da avaliação fiscal','Assessment year'], ['latestSalePrice','Última venda (USD)','Last sale (USD)'],
  ['latestSaleDate','Data da última venda','Last sale date'], ['rehab','Reforma informada (USD)','Reported rehabilitation (USD)'],
  ['capRate','Cap Rate informado','Reported Cap Rate'],
  ['latitude','Latitude','Latitude'], ['longitude','Longitude','Longitude'],
];
// Build only from the saved report. No acquisition, narrative generation or default assumptions.
export function buildReportEmailContent(schema: Data, reference: Data) {
  const property = schema.sections?.propertySummary?.data || {};
  const pt = reference.language === 'pt', es = reference.language === 'es';
  const label = (br: string, en: string, spa = en) => pt ? br : es ? spa : en;
  const fieldValue=(key:string)=>{
    const path=factPaths[key],candidate=path?property.canonicalPropertyFacts?.[path[0]]?.[path[1]]:null;
    const fact=candidate&&typeof candidate==='object'&&!Array.isArray(candidate)?candidate:null;
    const raw=property[key]??(key==='lotSizeSqft'?property.lot:undefined);
    const state=fact?.semanticState||fact?.status;
    const emptyPlaceholder=fact?.value==null&&['UNKNOWN','UNAVAILABLE','NOT_EVALUATED'].includes(state)&&!fact?.conflict&&raw!=null&&raw!=='';
    if(fact&&!emptyPlaceholder) {
      if(fact.conflict||state==='CONFLICT')return label('Dados divergentes; consulte as evidências no PDF','Conflicting data; see the PDF evidence');
      return ['UNKNOWN','UNAVAILABLE','NOT_APPLICABLE','NOT_EVALUATED'].includes(state)?'':text(fact.value);
    }
    const evidence=schema.sections?.propertyEvidence?.data;
    const aliases:Record<string,string>={beds:'bedrooms',baths:'bathrooms',sqft:'livingAreaSqft'};
    const verified=[...(Array.isArray(evidence?.verifiedRecords)?evidence.verifiedRecords:[]),...(Array.isArray(evidence?.userProvided)?evidence.userProvided:[])]
      .find((value:Data)=>value&&typeof value==='object'&&(value.field===key||Boolean(aliases[key]&&value.field===aliases[key])));
    return text(verified?.value??raw);
  };
  const level = reportDisplayName(reference.reportType);
  const address = (fieldValue('address')||text(property.title)).replace(/[\r\n]+/g,' ').slice(0,180);
  const lines = [`DealSifter · ${level}`, address, '', label('DADOS DO IMÓVEL','PROPERTY DETAILS','DATOS DEL INMUEBLE')];
  for (const [key,br,en] of propertyFields) {
    const value = fieldValue(key);
    if (value) lines.push(`${label(br,en)}: ${value}`);
  }
  for (const [key,br,en] of [['description','Descrição do anúncio','Listing description'],['notes','Notas do anúncio','Listing notes'],
    ['propertyUserNotes','Notas do usuário','User notes']]) {
    const value = text(property[key]);
    if (value) lines.push('', label(br,en), value);
  }
  // Analytical sections preserve the labels and evidence values actually saved; never serialize internal envelopes.
  const collect = (value: any, depth = 0): string[] => {
    if (depth > 4 || value == null) return [];
    if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
    if (Array.isArray(value)) return value.flatMap(item => collect(item,depth+1));
    if (typeof value !== 'object') return [];
    const result: string[] = [];
    if (typeof value.label === 'string' && (text(value.value) || text(value.text))) result.push(`${value.label}: ${text(value.value) || text(value.text)}`);
    else for (const key of ['summary','text','thesis','conclusion','explanation','description','reason','title']) {
      if (typeof value[key] === 'string') result.push(value[key]);
    }
    for (const key of ['items','rows','highlights','risks','limitations','checks','findings','recommendations']) {
      if (value[key]) result.push(...collect(value[key],depth+1));
    }
    return result;
  };
  for (const [key,br,en] of [['executiveSummary','Resumo da análise','Analysis summary'],
    ['valuationEvidence','Avaliação e evidências','Valuation and evidence'],['riskAssessment','Riscos','Risks'],
    ['limitations','Limitações','Limitations'],['verificationChecklist','Próximas verificações','Next verification steps']]) {
    const section = schema.sections?.[key];
    const values = [...new Set(collect(section?.data))];
    if (section?.available && values.length) lines.push('', label(br,en), ...values);
  }
  const photos = (Array.isArray(property.images) ? property.images : []).filter((value: unknown) =>
    typeof value === 'string' && /^https:\/\//i.test(value) && !/[\r\n]/.test(value));
  if (photos.length) lines.push('', label('FOTOS DO IMÓVEL','PROPERTY PHOTOS','FOTOS DEL INMUEBLE'), ...photos.map((url: string,index: number)=>`${index+1}. ${url}`));
  lines.push('', label('REFERÊNCIA DO RELATÓRIO','REPORT REFERENCE','REFERENCIA DEL INFORME'),
    `${label('Relatório','Report')}: ${reference.reportId}`, `${label('Imóvel','Property')}: ${reference.propertyId}`,
    `${label('Versão','Version')}: ${reference.reportVersion}`, `${label('Cenário','Scenario')}: ${reference.scenarioId || '—'}`,
    '', label('O PDF anexado contém a análise completa, suas fontes, entradas e limitações. Dados ausentes não foram inventados.',
      'The attached PDF contains the complete analysis, sources, inputs and limitations. Missing data has not been invented.'));
  return { subject: `DealSifter · ${level} · ${address || reference.propertyId}`, body: lines.join('\r\n') };
}
