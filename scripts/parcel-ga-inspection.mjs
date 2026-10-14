import { mkdir, writeFile } from 'node:fs/promises';
if(!process.argv.includes('--live')||process.env.NODE_ENV==='production')throw new Error('LOCAL_EXPLICIT_METADATA_AUDIT_ONLY');
const dir='qa/public-parcel-intelligence/coverage';await mkdir(dir,{recursive:true});
const candidates=[
 ['FL','https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer',[0]],
 ['TX','https://feature.geographic.texas.gov/arcgis/rest/services/Parcels/stratmap_land_parcels_48_most_recent/MapServer',[0]],
 ['OH','https://services2.arcgis.com/MlJ0G8iWUyC7jAmu/arcgis/rest/services/OhioStatewidePacels_full_view/FeatureServer',[0]],
 ['PA','https://apps.pasda.psu.edu/arcgis/rest/services/PA_Parcels/MapServer',[1]],
 ['AR','https://gis.arkansas.gov/arcgis/rest/services/FEATURESERVICES/Planning_Cadastre/FeatureServer',[6]],
 ['GA','https://services1.arcgis.com/bqfNVPUK3HOnCFmA/arcgis/rest/services/Parcels/FeatureServer',[0]],
];
async function read(url){await new Promise(resolve=>setTimeout(resolve,1500));const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error(`HTTP_${response.status}`);const text=await response.text();if(text.length>3000000)throw new Error('METADATA_TOO_LARGE');const data=JSON.parse(text);if(data.error)throw new Error(`ARCGIS_${data.error.code}`);return data;}
const rows=[];
for(const [state,url,layers]of candidates){const row={state,url,automaticActivation:false};try{const root=await read(url+'?f=json');row.service={layers:root.layers,serviceItemId:root.serviceItemId,copyrightText:root.copyrightText,description:root.description,capabilities:root.capabilities};row.layers=[];
 for(const id of layers){const schema=await read(`${url}/${id}?f=json`);row.layers.push({id,name:schema.name,geometryType:schema.geometryType,capabilities:schema.capabilities,fields:schema.fields,supportedQueryFormats:schema.supportedQueryFormats,maxRecordCount:schema.maxRecordCount,extent:schema.extent,advancedQueryCapabilities:schema.advancedQueryCapabilities,editingInfo:schema.editingInfo});}
 if(root.serviceItemId){try{const item=await read(`https://www.arcgis.com/sharing/rest/content/items/${root.serviceItemId}?f=json`);row.terms={itemId:item.id,owner:item.owner,licenseInfo:item.licenseInfo,accessInformation:item.accessInformation,description:item.description};}catch(error){row.itemMetadataError=error.message;}}
 }catch(error){row.error=error.message;}rows.push(row);console.log(JSON.stringify({state,layers:row.layers?.map(layer=>({id:layer.id,name:layer.name,fields:layer.fields?.length})),error:row.error}));await writeFile(`${dir}/statewide-metadata.json`,JSON.stringify({observedAt:new Date().toISOString(),metadataOnly:true,results:rows},null,2)+'\n');}
// Official national denominator, including current county equivalents (e.g. CT
// planning regions). Exclude US territories, not silently using a stale count.
const inventory=await read('https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1/query?'+new URLSearchParams({f:'json',where:"STATE NOT IN ('60','66','69','72','78')",outFields:'GEOID,STATE,COUNTY,NAME',returnGeometry:'false',resultRecordCount:'4000'}));
if(inventory.exceededTransferLimit||!Array.isArray(inventory.features)||inventory.features.length<3000)throw new Error('COUNTY_DENOMINATOR_INCOMPLETE');
await writeFile(`${dir}/county-inventory.json`,JSON.stringify({observedAt:new Date().toISOString(),authority:'US Census TIGERweb',url:'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1',counties:inventory.features.map(row=>row.attributes)},null,2)+'\n');
