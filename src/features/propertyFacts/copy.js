import {factCopy as sharedCopy,factSource as sharedSource,factValue as sharedValue} from '../../../supabase/functions/_shared/property-fact-reconciliation/presentation.js';
export {PROPERTY_FACT_COPY} from '../../../supabase/functions/_shared/property-fact-reconciliation/presentation.js';
// useLang returns a display locale (pt-BR/en-US/es-ES), not the shared base-language key.
const baseLanguage=language=>typeof language==='string'?language.toLowerCase().split(/[-_]/)[0]:'en';
const inlineCopy={
 pt:{back:'Voltar à edição',yourData:'Seu cadastro',warningLabel:'Há dados divergentes para revisar',newFacts:n=>`${n} novos dados`,neutralTitle:'Novos dados disponíveis',conflictsTitle:'Dados divergentes',refreshError:'Não foi possível buscar dados mais recentes. Os dados salvos continuam disponíveis.',bulk:'Selecionar complementos',sources:'Sobre as fontes'},
 en:{back:'Back to editing',yourData:'Your listing',warningLabel:'Conflicting facts need review',newFacts:n=>`${n} new facts`,neutralTitle:'New facts available',conflictsTitle:'Conflicting facts',refreshError:'Newer facts could not be retrieved. Saved facts remain available.',bulk:'Select additions',sources:'About the sources'},
 es:{back:'Volver a la edición',yourData:'Su registro',warningLabel:'Hay datos divergentes para revisar',newFacts:n=>`${n} datos nuevos`,neutralTitle:'Nuevos datos disponibles',conflictsTitle:'Datos divergentes',refreshError:'No se pudieron consultar datos más recientes. Los datos guardados siguen disponibles.',bulk:'Seleccionar datos nuevos',sources:'Sobre las fuentes'},
};
export const factCopy=language=>({...sharedCopy(baseLanguage(language)),...(inlineCopy[baseLanguage(language)]||inlineCopy.en)});
const sourceNames={pt:{PUBLIC_PARCEL_GIS:'GIS público',PUBLIC_ASSESSOR:'Assessor público',PUBLIC_TAX:'Registro fiscal público',PUBLIC_ZONING:'Zoneamento público'},en:{PUBLIC_PARCEL_GIS:'Public GIS',PUBLIC_ASSESSOR:'Public assessor',PUBLIC_TAX:'Public tax record',PUBLIC_ZONING:'Public zoning'},es:{PUBLIC_PARCEL_GIS:'GIS público',PUBLIC_ASSESSOR:'Asesor público',PUBLIC_TAX:'Registro fiscal público',PUBLIC_ZONING:'Zonificación pública'}};
export const factSource=(source,language)=>(sourceNames[baseLanguage(language)]||sourceNames.en)[source]||sharedSource(source,baseLanguage(language));
export const factValue=(fact,field,language)=>sharedValue(fact,field,baseLanguage(language));
