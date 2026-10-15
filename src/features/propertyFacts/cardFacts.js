import {resolveAnalysisPropertyType} from '../../../supabase/functions/_shared/maxxis/canonicalFactSemantics.ts';
import {publisherLotCandidate} from '../../../supabase/functions/_shared/parcel-evidence-consensus/adapters.ts';
import {optionalPropertyNumber} from '../../lib/optionalPropertyNumber';
import {factCopy,factValue} from './copy';
export function buildPropertyCardFacts(property,facts={},language='en'){
 const type=facts.propertyType?.state==='AVAILABLE'?facts.propertyType.value:property.type;
 const copy=factCopy(language),land=resolveAnalysisPropertyType({...property,type})==='LAND';
 const lot=publisherLotCandidate(property.lot??null),area=typeof lot.value==='number'?lot.unit==='ACRES'?lot.value*43560:lot.value:null;
 const original={lotArea:{value:area,unit:'SQFT'},buildingArea:{value:optionalPropertyNumber(property.sqft)},rehab:{value:optionalPropertyNumber(property.rehab)},beds:{value:optionalPropertyNumber(property.beds)},baths:{value:optionalPropertyNumber(property.baths)},apn:{value:property.assessorId??property.apn??null},zoning:{value:property.zoning??null},propertyTax:{value:optionalPropertyNumber(property.propertyTax)},assessedValue:{value:optionalPropertyNumber(property.assessedValue)},subdivision:{value:property.subdivision??null}};
 const current={...original,...facts};
 const make=field=>({field,label:factValue(current[field],field,language),sub:copy.fields[field],conflict:current[field]?.state==='CONFLICTED',confirmed:current[field]?.status==='PUBLIC_RECORD'&&current[field]?.state==='AVAILABLE'});
 if(land){const priority=['lotArea','apn','zoning','propertyTax','assessedValue','subdivision'];const available=priority.filter(field=>current[field]?.state==='CONFLICTED'||current[field]?.value!=null);return [...available,...priority.filter(field=>!available.includes(field))].slice(0,4).map(make);}
 const beds=current.beds,baths=current.baths;
 const rooms={field:beds?.state==='CONFLICTED'?'beds':'baths',label:beds?.state==='CONFLICTED'||baths?.state==='CONFLICTED'?copy.conflict:`${beds?.value??'—'} bd / ${baths?.value??'—'} ba`,sub:language==='pt'?'Quartos / Banheiros':language==='es'?'Habitaciones / Baños':'Beds / Baths',conflict:beds?.state==='CONFLICTED'||baths?.state==='CONFLICTED'};
 const priority=['buildingArea','lotArea','rehab','yearBuilt','apn','propertyTax','assessedValue'];const available=priority.filter(field=>current[field]?.state==='CONFLICTED'||current[field]?.value!=null);return [rooms,...[...available,...priority.filter(field=>!available.includes(field))].slice(0,3).map(make)];
}
