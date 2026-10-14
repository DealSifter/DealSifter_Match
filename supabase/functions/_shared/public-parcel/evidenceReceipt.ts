import type { ParcelEvidence, ParcelResult, ParcelSource, Point } from './types.ts';
import { PARCEL_SOURCES, productionSourceAllowed } from './registry.ts';
import { geometryContains, validPoint } from './geometry.ts';

const encoder=new TextEncoder(), TTL=7*24*3600_000;
const bytesToBase64=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const fromBase64=(value:string)=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
async function key(secret:string){return crypto.subtle.importKey('raw',encoder.encode(`dealsifter:parcel-evidence-v1:${secret}`),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
type Receipt={version:1;userId:string;point:Point;issuedAt:number;freshUntil:number;expiresAt:number;countyFips:string;parcel:ParcelEvidence};
/** Acquisition-only: no extra provider request, cache persistence or private property data. */
export async function issueParcelEvidenceReceipt(result:ParcelResult,point:Point,userId:string,secret:string,now=Date.now()){
  if(!secret||!validPoint(point)||result.ambiguity||result.status!=='COVERAGE_AVAILABLE'||!result.countyFips)return null;
  const matches=result.parcels.filter(parcel=>geometryContains(parcel.geometry,point));
  if(matches.length!==1)return null;
  const parcel=matches[0],source=PARCEL_SOURCES.find(s=>s.sourceId===parcel.source);
  if(!source||!productionSourceAllowed(source))return null;
  const fields=['apn','assessorAcres','gisAcres','lotSqft','geometryCalculatedSqft','geometryCalculatedAcres','ownerName','assessedValue','assessedYear','propertyTax','propertyTaxYear','zoning'];
  // Geometry membership is server-attested; do not transfer a potentially huge polygon or unrelated legal/contact attributes.
  const selected:Record<string,unknown>={source:parcel.source,sourceAuthority:parcel.sourceAuthority,
    sourceUrl:parcel.sourceUrl,licenseStatus:parcel.licenseStatus,licenseUrl:parcel.licenseUrl,usageNotes:parcel.usageNotes,
    retrievedAt:parcel.retrievedAt,sourceUpdatedAt:parcel.sourceUpdatedAt,evidenceStatus:parcel.evidenceStatus,
    provenance:Object.fromEntries(fields.filter(f=>parcel.provenance[f]).map(f=>[f,parcel.provenance[f]]))};
  for(const field of fields)selected[field]=(parcel as unknown as Record<string,unknown>)[field];
  const retrieved=Date.parse(parcel.retrievedAt);
  if(!Number.isFinite(retrieved)||now-retrieved>TTL||retrieved>now+60_000)return null;
  const expiry=Date.parse(result.expiresAt??'');
  const body:Receipt={version:1,userId,point,issuedAt:now,freshUntil:result.freshness==='STALE_USABLE'?now:Math.min(expiry||now,now+24*3600_000),
    expiresAt:retrieved+TTL,countyFips:result.countyFips,parcel:selected as unknown as ParcelEvidence};
  const payload=bytesToBase64(encoder.encode(JSON.stringify(body)));
  if(payload.length>20000)return null;
  return `${payload}.${bytesToBase64(new Uint8Array(await crypto.subtle.sign('HMAC',await key(secret),encoder.encode(payload))))}`;
}
/** Pure local verification; actor, selected subject, expiry, public source policy and kill switch must all match. */
export async function readParcelEvidenceReceipt(token:unknown,options:{userId:string;point:Point|null;secret:string;enabled:boolean;now?:number}):Promise<{parcel:ParcelEvidence;source:ParcelSource;countyFips:string;subjectMatch:'VERIFIED_SUBJECT';freshness:'FRESH'|'STALE_USABLE'}[]>{
  if(!options.enabled||!options.secret||!options.point||!validPoint(options.point)||typeof token!=='string'||token.length>20100)return [];
  try{
    const [payload,signature,...extra]=token.split('.');if(!payload||!signature||extra.length)return [];
    if(!await crypto.subtle.verify('HMAC',await key(options.secret),fromBase64(signature),encoder.encode(payload)))return [];
    const body=JSON.parse(new TextDecoder().decode(fromBase64(payload))) as Receipt, now=options.now??Date.now();
    if(body.version!==1||body.userId!==options.userId||!validPoint(body.point)||body.point.lat!==options.point.lat||body.point.lng!==options.point.lng
      ||!Number.isFinite(body.expiresAt)||!Number.isFinite(body.issuedAt)||body.expiresAt<now||body.issuedAt>now+60000)return [];
    const source=PARCEL_SOURCES.find(s=>s.sourceId===body.parcel.source);
    if(!source||!productionSourceAllowed(source)||![source.countyFips,...source.coverageCountyFips??[]].includes(body.countyFips))return [];
    return [{parcel:body.parcel,source,countyFips:body.countyFips,subjectMatch:'VERIFIED_SUBJECT',freshness:body.freshUntil>now?'FRESH':'STALE_USABLE'}];
  }catch{return [];}
}
