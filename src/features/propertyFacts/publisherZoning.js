// Only the existing sanitized property projection may supply a shared declaration.
// It is not a verified zoning record and never establishes a permitted use.
export function publisherZoning(facts){
 const fact=facts?.zoning;
 return fact?.state==='AVAILABLE'&&fact.sourceType==='USER_PROVIDED'&&fact.status==='PUBLISHER_DECLARED'&&typeof fact.value==='string'&&fact.value.trim()?fact.value:null;
}
export function withPublisherZoning(property,facts){
 const zoning=publisherZoning(facts);return zoning?{...property,publisherDeclaredZoning:zoning}:property;
}
