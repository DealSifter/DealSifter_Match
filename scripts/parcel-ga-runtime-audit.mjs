import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
if(!process.argv.includes('--live')||process.env.NODE_ENV==='production')throw new Error('LOCAL_APPROVED_SOURCE_VALIDATION_ONLY');
const directory='qa/public-parcel-intelligence/coverage';await mkdir(directory,{recursive:true});
const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true},appType:'custom'});
const cases=[['us-oh-ogrip-public-parcels','39049',39.9612,-82.9988],['us-oh-ogrip-public-parcels','39061',39.1031,-84.512],['us-ar-agiso-state-parcels','05119',34.7465,-92.2896],['us-ar-agiso-state-parcels','05007',36.3729,-94.2088],['us-ga-johns-creek-public-parcels','13121',34.0289,-84.1986],['us-fl-fgio-state-parcels','12105',28.0395,-81.9498],['us-fl-fgio-state-parcels','12095',28.5383,-81.3792],
 ['us-nc-nconemap-parcels','37183',35.7796,-78.6382],['us-ma-massgis-parcels','25017',42.3736,-71.1097],['us-nj-njogis-parcels','34021',40.2206,-74.7597],['us-ut-salt-lake-parcels','49035',40.7608,-111.891]];
const filter=process.argv.find(argument=>argument.startsWith('--sources='))?.slice(10).split(',');
const rows=filter?await readFile(`${directory}/runtime-source-validation.json`,'utf8').then(JSON.parse).then(data=>data.results,()=>[]):[];
try{
 const {PARCEL_SOURCES,licenseCleared}=await server.ssrLoadModule('/supabase/functions/_shared/public-parcel/registry.ts');
 const {ArcGISParcelAdapter}=await server.ssrLoadModule('/supabase/functions/_shared/public-parcel/arcgis.ts');
 const {geometryContains}=await server.ssrLoadModule('/supabase/functions/_shared/public-parcel/geometry.ts');
 const {PublicCountyResolver}=await server.ssrLoadModule('/supabase/functions/_shared/public-parcel/county.ts');
 const {contextualLensBounds}=await server.ssrLoadModule('/supabase/functions/_shared/public-parcel/lens.ts');
 const county=new PublicCountyResolver();
 for(const [id,fips,lat,lng]of cases.filter(([id])=>!filter||filter.includes(id))){const source=PARCEL_SOURCES.find(row=>row.sourceId===id);if(!licenseCleared(source))throw new Error('LICENSE_REQUIRED_BEFORE_RECORD_QUERY');const row={sourceId:id,countyFips:fips,automaticActivation:false,pass:false,observedAt:new Date().toISOString()};
 try{await new Promise(resolve=>setTimeout(resolve,1600));const adapter=new ArcGISParcelAdapter(source);const metadata=await adapter.inspect();row.geometryType=metadata.geometryType;row.mappedFields=Object.fromEntries(Object.entries(source.fieldMapping).map(([field,name])=>[field,metadata.fields.some(item=>item.name===name)]));
 const seeds=await adapter.queryByBounds([lng-.0015,lat-.0012,lng+.0015,lat+.0012]);const seed=seeds.parcels.find(parcel=>parcel.geometry&&parcel.apn);if(!seed)throw new Error('NO_GEOMETRY_APN_SEED');
 const ring=seed.geometry.type==='Polygon'?seed.geometry.coordinates[0]:seed.geometry.coordinates[0][0];const xs=ring.map(point=>point[0]);const ys=ring.map(point=>point[1]);const controls=[];
 for(let x=1;x<10;x++)for(let y=1;y<10;y++)controls.push({lng:Math.min(...xs)+(Math.max(...xs)-Math.min(...xs))*x/10,lat:Math.min(...ys)+(Math.max(...ys)-Math.min(...ys))*y/10});
 const point=controls.find(point=>geometryContains(seed.geometry,point));if(!point)throw new Error('INTERIOR_POINT_REQUIRED');
 row.spatialCounty=await county.resolve(point);if(row.spatialCounty.length!==1||row.spatialCounty[0]!==fips)throw new Error('CONTROL_COUNTY_CONFLICT');
 await new Promise(resolve=>setTimeout(resolve,1600));const subject=await adapter.queryByPoint(point);row.subjectGeometry=subject.parcels.some(parcel=>geometryContains(parcel.geometry,point));
 await new Promise(resolve=>setTimeout(resolve,1600));const apn=await adapter.queryByAPN(seed.apn);row.apnMatches=apn.parcels.some(parcel=>parcel.apn===seed.apn&&parcel.geometry);
 await new Promise(resolve=>setTimeout(resolve,1600));const neighbors=await adapter.queryByBounds(contextualLensBounds(point));row.neighborCount=neighbors.parcels.length;row.exceededLimit=neighbors.exceededLimit;row.point=point;
 row.fieldValueAvailability=Object.fromEntries(['apn','assessorAcres','gisAcres','geometryCalculatedAcres','ownerName','assessedValue','propertyTax','zoning'].map(field=>[field,seed[field]!==null&&seed[field]!==undefined]));row.pass=row.subjectGeometry&&row.apnMatches&&row.neighborCount>0&&Object.values(row.mappedFields).every(Boolean);
 }catch(error){row.error=error.message;}const index=rows.findIndex(previous=>previous.sourceId===id&&previous.countyFips===fips);if(index>=0)rows[index]=row;else rows.push(row);console.log(JSON.stringify({sourceId:id,fips,pass:row.pass,error:row.error}));await writeFile(`${directory}/runtime-source-validation.json`,JSON.stringify({observedAt:new Date().toISOString(),paidCalls:0,productionUserSession:false,automaticActivation:false,results:rows},null,2)+'\n');}
}finally{await server.close();}
