import {factCopy as sharedCopy,factSource as sharedSource,factValue as sharedValue} from '../../../supabase/functions/_shared/property-fact-reconciliation/presentation.js';
export {PROPERTY_FACT_COPY} from '../../../supabase/functions/_shared/property-fact-reconciliation/presentation.js';
// useLang returns a display locale (pt-BR/en-US/es-ES), not the shared base-language key.
const baseLanguage=language=>typeof language==='string'?language.toLowerCase().split(/[-_]/)[0]:'en';
export const factCopy=language=>sharedCopy(baseLanguage(language));
export const factSource=(source,language)=>sharedSource(source,baseLanguage(language));
export const factValue=(fact,field,language)=>sharedValue(fact,field,baseLanguage(language));
