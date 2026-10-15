const fields={lotArea:'lot',buildingArea:'sqft',propertyType:'type',beds:'beds',baths:'baths'};
export function overlayEffectiveDraft(draft,snapshot,baseline={}){
 const next={...draft},original={...baseline};
 for(const [field,key] of Object.entries(fields)){
  const row=snapshot?.rows?.[field];if(row?.decision?.action!=='ACCEPT_EXTERNAL_VALUE'||row.effective?.state!=='AVAILABLE')continue;
  let value=row.effective.value;if(field==='lotArea'&&row.effective.unit==='SQFT')value=`${value} sqft`;
  if(field==='propertyType'&&value==='LAND')value='Land';
  if(['beds','baths'].includes(field))value=String(value);
  next[key]=value;original[key]=value;
 }
 return {draft:next,baseline:original};
}
export function publisherEditValue(key,draft,property,baseline){
 return Object.hasOwn(baseline,key)&&String(draft[key])===String(baseline[key])?property[key]:draft[key];
}
