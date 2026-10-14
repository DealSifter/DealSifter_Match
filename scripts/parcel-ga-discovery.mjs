import { mkdir, writeFile } from 'node:fs/promises';

if(!process.argv.includes('--live')||process.env.NODE_ENV==='production')throw new Error('LOCAL_EXPLICIT_SOURCE_AUDIT_ONLY');
const directory='qa/public-parcel-intelligence/coverage';await mkdir(directory,{recursive:true});
const requests=[];const plain=value=>String(value||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const wait=()=>new Promise(resolve=>setTimeout(resolve,1500));
async function json(url){await wait();const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error(`HTTP_${response.status}`);const body=await response.text();if(body.length>3000000)throw new Error('METADATA_TOO_LARGE');const data=JSON.parse(body);if(data.error)throw new Error(`ARCGIS_${data.error.code}`);return data;}
const queries={FL:'owner:FloridaGIO cadastral',TX:'owner:TNRIS parcels',OH:'owner:ogrip_agol parcels',PA:'owner:pasda parcels',AR:'"Statewide Parcels" Arkansas',CA:'"Los Angeles" parcels owner:CountyofLA',GA:'"Parcels" "Fulton"',MI:'"Parcels" "Wayne"'};
for(const [state,q]of Object.entries(queries)){
 const row={state,query:q,automaticActivation:false,candidates:[]};
 try{const result=await json('https://www.arcgis.com/sharing/rest/search?'+new URLSearchParams({f:'json',q:`${q} AND (type:"Feature Service" OR type:"Map Service")`,num:'6'}));row.total=result.total;
 for(const item of result.results||[]){const entry={itemId:item.id,title:item.title,owner:item.owner,url:item.url,itemUrl:`https://www.arcgis.com/home/item.html?id=${item.id}`,authorityVerified:false};
 try{const detail=await json(`https://www.arcgis.com/sharing/rest/content/items/${item.id}?f=json`);entry.licenseInfo=plain(detail.licenseInfo).slice(0,4000);entry.attribution=plain(detail.accessInformation).slice(0,1500);entry.description=plain(detail.description).slice(0,1800);
 const url=new URL(item.url);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||!/(?:arcgis\.com|\.gov|\.us|\.edu)$/.test(url.hostname)||!/\/(?:FeatureServer|MapServer)(?:\/\d+)?$/.test(url.pathname))throw new Error('CANDIDATE_METADATA_URL_NOT_ALLOWED');
 const schema=await json(url.href+'?f=json');entry.layers=schema.layers?.map(layer=>({id:layer.id,name:layer.name}));entry.fields=schema.fields?.map(field=>({name:field.name,alias:field.alias,type:field.type}));entry.geometryType=schema.geometryType;entry.serviceItemId=schema.serviceItemId;entry.copyrightText=plain(schema.copyrightText).slice(0,1200);
 }catch(error){entry.error=error.message;}row.candidates.push(entry);}
 }catch(error){row.error=error.message;}requests.push(row);console.log(JSON.stringify({state,candidates:row.candidates.length,error:row.error}));
 await writeFile(`${directory}/official-discovery.json`,JSON.stringify({observedAt:new Date().toISOString(),metadataOnly:true,automaticActivation:false,paidCalls:0,results:requests},null,2)+'\n');
}
