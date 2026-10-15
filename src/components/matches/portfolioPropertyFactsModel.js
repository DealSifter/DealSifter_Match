import { translations } from '../../i18n/translations';
import { formatCompactUsd } from '../../lib/formatMoney';
import { propertyTypeFamily, resolveAnalysisPropertyType, toKnownFiniteNumber } from '../../../supabase/functions/_shared/maxxis/canonicalFactSemantics.ts';
import { factCopy, factValue } from '../../features/propertyFacts/copy';

const missing = '—';
const present = value => value != null && String(value).trim() !== '';
const text = value => present(value) ? String(value).trim() : missing;

export function formatPortfolioArea(value, language = 'en') {
  if (!present(value)) return missing;
  const match = String(value).trim().match(/^(\d[\d.,\s]*?)\s*(sq\.?\s*ft\.?|sqft|ft²|acres?|ac|m²|m2|sqm)?$/i);
  if (!match) return missing;
  const unit = /^(ac|acre)/i.test(match[2] || '') ? 'ac' : /^(m|sqm)/i.test(match[2] || '') ? 'm²' : 'sqft';
  let numeric = match[1].replace(/\s/g, '');
  if (numeric.includes(',') && numeric.includes('.')) numeric = numeric.lastIndexOf(',') > numeric.lastIndexOf('.') ? numeric.replace(/\./g, '').replace(',', '.') : numeric.replace(/,/g, '');
  else if (typeof value !== 'number' && !(unit === 'ac' && (/^\d+\.\d+$/.test(numeric) || String(language).startsWith('pt') || String(language).startsWith('es'))) && /^\d{1,3}(?:[,.]\d{3})+$/.test(numeric)) numeric = numeric.replace(/[,.]/g, '');
  else numeric = numeric.replace(',', '.');
  const number = toKnownFiniteNumber(numeric);
  if (number == null || number < 0) return missing;
  return `${new Intl.NumberFormat(language, { maximumFractionDigits: 4 }).format(number)} ${unit}`;
}

// Each fact has one semantic ID and one display location. Summary facts cannot
// accidentally reappear in the detail grid when labels/locales change.
export function buildPortfolioPropertyFacts(item, labels = {}, language = 'en', effectiveFacts = {}) {
  const base = String(language).slice(0, 2);
  const copy = translations[base]?.matches || translations.en.matches;
  const label = id => labels[id] || copy[id] || translations.en.matches[id];
  const numeric = value => {
    const number = toKnownFiniteNumber(value);
    return number != null && number >= 0 ? new Intl.NumberFormat(language, { maximumFractionDigits: 2 }).format(number) : missing;
  };
  const money = value => toKnownFiniteNumber(value) == null ? missing : formatCompactUsd(value);
  // Display only. Never mutate the raw listing consumed by calculations/exports.
  const type = effectiveFacts.propertyType?.state==='AVAILABLE' ? effectiveFacts.propertyType.value : item.type;
  const land = propertyTypeFamily(resolveAnalysisPropertyType({...item,type})) === 'LAND';
  const capRate = toKnownFiniteNumber(item.capRate);
  const facts = [
    { id:'price', label:label('price'), value:money(item.price), location:'summary', tone:'gold' },
    { id:'capRate', label:label('capRate'), value:capRate == null || capRate < 0 ? missing : `${numeric(capRate)}%`, location:'summary', tone:'success' },
    { id:'rehab', label:label('rehab'), value:land ? 'N/A' : money(item.rehab), location:'summary', tone:'accent' },
    { id:'type', label:label('type'), value:text(item.type), location:'detail' },
    { id:'strategy', label:label('strategy'), value:text(item.objective), location:'detail' },
    ...(!land ? [
      { id:'beds', label:label('beds'), value:numeric(item.beds), location:'detail' },
      { id:'baths', label:label('baths'), value:numeric(item.baths), location:'detail' },
      { id:'buildingArea', label:label('buildingArea'), value:formatPortfolioArea(item.sqft, language), location:'detail' },
    ] : []),
    { id:'apn', label:labels.apn || 'APN', value:text(item.assessorId ?? item.apn ?? item.canonicalPropertyFacts?.parcel?.assessorId?.value), location:'detail' },
    { id:'lot', label:label('lot'), value:formatPortfolioArea(item.lot ?? item.lotSizeSqft, language), location:'detail' },
  ];
  const domains={type:'propertyType',lot:'lotArea',buildingArea:'buildingArea',apn:'apn',beds:'beds',baths:'baths'};
  const projected=facts.map(fact=>{
    const field=domains[fact.id],effective=effectiveFacts[field];
    if(!effective)return {...fact,field};
    return {...fact,field,conflict:effective.state==='CONFLICTED',value:factValue(effective,field,language)};
  });
  if(land){
    for(const field of ['zoning','propertyTax','assessedValue','subdivision']){
      const effective=effectiveFacts[field];
      if(effective?.value!=null||effective?.state==='CONFLICTED')projected.push({id:field,field,label:factCopy(language).fields[field],value:factValue(effective,field,language),conflict:effective.state==='CONFLICTED',location:'detail'});
    }
  }
  return { summary:projected.filter(fact=>fact.location==='summary'), details:projected.filter(fact=>fact.location==='detail') };
}
