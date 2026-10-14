const keys = new Map<string,Promise<string>>();
export function parcelAuthorityBudgetKey(origin: string) {
  let key = keys.get(origin);
  if(!key){key=(async()=>{
    const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`dealsifter:public-parcel-authority:${origin}`));
    const hex=[...new Uint8Array(hash)].map(byte=>byte.toString(16).padStart(2,'0')).join('').slice(0,32);
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  })();keys.set(origin,key);}return key;
}

// Reuse the existing atomic rate-limit table/RPC: no new spatial schema. This
// budget is shared across isolates/users and contains no account/property data.
export function createParcelUpstreamFetch(consume: (subject: string,signal?: AbortSignal)=>Promise<boolean>, fetcher: typeof fetch=fetch): typeof fetch {
  return async (input,init)=>{
    const origin=new URL(input instanceof Request?input.url:String(input)).origin;
    const allowed=await consume(await parcelAuthorityBudgetKey(origin),init?.signal||undefined);
    if(!allowed)throw new Error('SOURCE_SHARED_RATE_LIMIT');
    return fetcher(input,init);
  };
}
