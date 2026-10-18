const positive=value=>typeof value==='number'&&Number.isFinite(value)&&value>0?value:null;
const number=value=>typeof value==='number'&&Number.isFinite(value)?value:null;
export function projectMarketRentReport(evidence,property={},level=3,financialEvidence=null){
  const resolved=financialEvidence?.inputs?.providerMarketRentEstimate;
  if(resolved){
    if(resolved.analyticalUsability!=='ESTIMATED_PROVIDER'||resolved.sourceClass!=='PROVIDER_ESTIMATE'
      ||resolved.cadence!=='MONTHLY'||!positive(resolved.value)||resolved.source?.sourceFamily!=='RENTCAST')return null;
    if(evidence?.rent!==resolved.value)evidence={provider:'rentcast',evidenceType:'rent_estimate',status:'AVAILABLE',rent:resolved.value,
      rangeLow:resolved.source.metadata?.rangeLow,rangeHigh:resolved.source.metadata?.rangeHigh,
      subjectProperty:resolved.source.metadata?.subjectProperty,scope:resolved.source.metadata?.scope,
      queryFingerprint:resolved.source.metadata?.requestFingerprint,retrievedAt:resolved.source.retrievedAt,freshness:resolved.source.freshness};
  }
  if(!evidence||evidence.provider!=='rentcast'||evidence.evidenceType!=='rent_estimate'||evidence.status!=='AVAILABLE'||!positive(evidence.rent))return null;
  if(level<2)return null;
  const common={monthlyRentEstimate:evidence.rent,currency:'USD',cadence:'MONTHLY',source:'RentCast',evidenceClass:'PROVIDER_ESTIMATE',scope:evidence.scope??'PROPERTY'};
  if(level===2)return Object.freeze(common);
  const subject=evidence.subjectProperty??{},sqft=positive(subject.livingAreaSqft),beds=positive(subject.bedrooms);
  const seen=new Set();
  const reportRentalComparables=(Array.isArray(evidence.comparables)?evidence.comparables:[]).filter(comp=>{
    if(!positive(comp.price))return false;
    const id=String(comp.listingId??comp.address??'').trim();if(!id||seen.has(id))return false;seen.add(id);return true;
  }).slice(0,5).map((comp,index)=>Object.freeze({
    number:index+1,id:String(comp.listingId??comp.address),address:String(comp.address??''),monthlyRent:comp.price,
    bedrooms:number(comp.bedrooms),bathrooms:number(comp.bathrooms),livingAreaSqft:positive(comp.livingAreaSqft),
    latitude:number(comp.latitude),longitude:number(comp.longitude),distanceMiles:number(comp.distanceMiles),daysOld:number(comp.daysOld),
    providerCorrelation:number(comp.providerCorrelation),propertyType:comp.propertyType??null,
  }));
  return Object.freeze({...common,rangeLow:number(evidence.rangeLow)!=null&&evidence.rangeLow>=0&&evidence.rangeLow<=evidence.rent?evidence.rangeLow:null,
    rangeHigh:positive(evidence.rangeHigh)&&evidence.rangeHigh>=evidence.rent?evidence.rangeHigh:null,retrievedAt:evidence.retrievedAt??null,
    requestFingerprint:evidence.queryFingerprint??null,freshness:evidence.freshness??null,
    subject:Object.freeze({propertyType:subject.propertyType??null,bedrooms:number(subject.bedrooms),bathrooms:number(subject.bathrooms),livingAreaSqft:sqft,
      latitude:number(subject.latitude)??number(property.latitude??property.lat),longitude:number(subject.longitude)??number(property.longitude??property.lng)}),
    rentPerSqft:sqft?{value:evidence.rent/sqft,evidenceClass:'CALCULATED'}:null,
    rentPerBedroom:beds?{value:evidence.rent/beds,evidenceClass:'CALCULATED'}:null,
    reportRentalComparables:Object.freeze(reportRentalComparables),
    missingCoordinateCompIds:reportRentalComparables.filter(comp=>!reportMapCoordinate(comp)).map(comp=>comp.id)});
}
export function reportMapCoordinate(point){return point?.latitude!=null&&point?.longitude!=null&&Number.isFinite(point.latitude)&&Number.isFinite(point.longitude)&&Math.abs(point.latitude)<=85.05112878&&Math.abs(point.longitude)<=180;}
export function rentalReportMapPoints(view){
  if(!view?.reportRentalComparables?.length)return [];
  return [{...view.subject,id:'subject',marker:'S',markerTone:'#15384f'},
    ...view.reportRentalComparables.map(comp=>({...comp,marker:String(comp.number),markerTone:'#0d876f'}))].filter(reportMapCoordinate);
}
export const marketRentReportCopy=language=>({
  pt:{title:'Aluguel de mercado estimado',perUnit:'por unidade',retrieved:'Consultado em',stale:'Evidência antiga mantida como referência.',monthly:'por mês',range:'Faixa estimada',perSqft:'por sqft',perBed:'por quarto',comps:'Comparáveis de aluguel',subject:'Imóvel analisado',qualification:'Estimativa do RentCast, não aluguel contratual atual.',noComps:'Detalhes dos comparáveis de aluguel indisponíveis.',distance:'Distância',correlation:'Similaridade',age:'Idade',days:'dias',missing:'Comparáveis sem coordenadas não foram plotados.',calculated:'Indicadores unitários calculados; não são valores registrados pelo provedor.'},
  en:{title:'Estimated Monthly Rent',perUnit:'per unit',retrieved:'Retrieved on',stale:'Older evidence retained as a reference.',monthly:'per month',range:'Estimated range',perSqft:'per sqft',perBed:'per bedroom',comps:'Comparable Rentals',subject:'Subject Property',qualification:'RentCast estimate, not current contract rent.',noComps:'Comparable rental details unavailable.',distance:'Distance',correlation:'Similarity',age:'Age',days:'days',missing:'Comparables without coordinates were not plotted.',calculated:'Unit metrics are calculated, not provider-recorded values.'},
  es:{title:'Alquiler mensual estimado',perUnit:'por unidad',retrieved:'Consultado el',stale:'Evidencia anterior conservada como referencia.',monthly:'por mes',range:'Rango estimado',perSqft:'por sqft',perBed:'por habitación',comps:'Alquileres comparables',subject:'Inmueble analizado',qualification:'Estimación de RentCast, no alquiler contractual actual.',noComps:'Detalles de alquileres comparables no disponibles.',distance:'Distancia',correlation:'Similitud',age:'Antigüedad',days:'días',missing:'No se ubicaron los comparables sin coordenadas.',calculated:'Los indicadores unitarios son calculados, no registrados por el proveedor.'},
}[language]??marketRentReportCopy('en'));
