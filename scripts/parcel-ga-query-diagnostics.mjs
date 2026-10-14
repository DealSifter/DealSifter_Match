import { writeFile } from 'node:fs/promises';
if(!process.argv.includes('--live'))throw new Error('EXPLICIT_PUBLIC_READ_ONLY_DIAGNOSTICS_REQUIRED');
const cases=[
 ['OH_JSON','https://services2.arcgis.com/MlJ0G8iWUyC7jAmu/arcgis/rest/services/OhioStatewidePacels_full_view/FeatureServer/0','1=1',[-83.0003,39.96,-82.9973,39.9624],'StateParcelID,LocalParcelID,SitusAddressAll'],
 ['OH_COUNTY_JSON','https://services2.arcgis.com/MlJ0G8iWUyC7jAmu/arcgis/rest/services/OhioStatewidePacels_full_view/FeatureServer/0',"County = 'Franklin'",[-83.0003,39.96,-82.9973,39.9624],'StateParcelID,LocalParcelID,SitusAddressAll'],
 ['FL_JSON','https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0','1=1',[-81.9513,28.0383,-81.9483,28.0407],'STATE_PAR_,PARCEL_ID,PHY_ADDR1'],
];
const rows=[];
for(const [id,url,where,bounds,fields]of cases){await new Promise(resolve=>setTimeout(resolve,1600));const row={id,url,format:'json',timeoutMs:7500};const start=Date.now();try{
 const query=new URLSearchParams({f:'json',where,outFields:fields,returnGeometry:'true',outSR:'4326',resultRecordCount:'20',geometryType:'esriGeometryEnvelope',inSR:'4326',spatialRel:'esriSpatialRelIntersects',geometry:JSON.stringify({xmin:bounds[0],ymin:bounds[1],xmax:bounds[2],ymax:bounds[3]})});
 const response=await fetch(`${url}/query?${query}`,{redirect:'error',signal:AbortSignal.timeout(7500)});const data=await response.json();row.httpStatus=response.status;row.arcgisError=data.error?.code;row.parcelCount=data.features?.length||0;row.ringGeometry=data.features?.some(feature=>Array.isArray(feature.geometry?.rings))||false;row.exceededLimit=data.exceededTransferLimit||false;
 }catch(error){row.error=error.message;}row.durationMs=Date.now()-start;rows.push(row);console.log(JSON.stringify(row));}
await writeFile('qa/public-parcel-intelligence/coverage/query-budget-diagnostics.json',JSON.stringify({observedAt:new Date().toISOString(),automaticActivation:false,queries:rows},null,2)+'\n');
