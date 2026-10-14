import { readFile,writeFile } from 'node:fs/promises';
if(!process.argv.includes('--live'))throw new Error('EXPLICIT_READ_ONLY_AUDIT_REQUIRED');
const dir='qa/public-parcel-intelligence/coverage';const inventory=JSON.parse(await readFile(`${dir}/county-inventory.json`,'utf8'));
const cases=[
 ['us-oh-ogrip-public-parcels','39','https://services2.arcgis.com/MlJ0G8iWUyC7jAmu/arcgis/rest/services/OhioStatewidePacels_full_view/FeatureServer/0','County','OBJECTID','StateParcelID'],
 ['us-ar-agiso-state-parcels','05','https://gis.arkansas.gov/arcgis/rest/services/FEATURESERVICES/Planning_Cadastre/FeatureServer/6','countyfips','objectid','parcelid'],
];
const rows=[];
for(const [sourceId,state,url,field,object,apn]of cases){const row={sourceId,state,url,field,automaticActivation:false,countyInventoryValidated:false};try{
 await new Promise(resolve=>setTimeout(resolve,1600));const query=new URLSearchParams({f:'json',where:`${apn} IS NOT NULL AND Shape__Area > 0`,groupByFieldsForStatistics:field,outStatistics:JSON.stringify([{statisticType:'count',onStatisticField:object,outStatisticFieldName:'parcel_count'}]),returnGeometry:'false',resultRecordCount:'300'});
 const response=await fetch(`${url}/query?${query}`,{redirect:'error',signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error(`HTTP_${response.status}`);const data=await response.json();if(data.error)throw new Error(`ARCGIS_${data.error.code}`);if(data.exceededTransferLimit)throw new Error('INCOMPLETE_COUNTY_INVENTORY');
 row.counties=(data.features||[]).map(({attributes})=>{
   const value=String(attributes[field]??'').trim();const names=inventory.counties.filter(county=>county.STATE===state);
   const match=names.find(county=>county.GEOID===value||county.COUNTY===value.padStart(3,'0')||county.NAME.replace(/ County$/,'').toLowerCase()===value.replace(/ County$/,'').toLowerCase());
   return {value,parcelCount:Number(attributes.parcel_count),countyFips:match?.GEOID||null};
 }).filter(county=>county.parcelCount>0);
 if(!row.counties.length||row.counties.some(county=>!county.countyFips))throw new Error('UNMAPPED_COUNTY_OR_EMPTY_INVENTORY');row.countyInventoryValidated=true;
 }catch(error){row.error=error.message;}rows.push(row);console.log(JSON.stringify({sourceId,validated:row.countyInventoryValidated,counties:row.counties?.length,error:row.error}));await writeFile(`${dir}/county-source-inventories.json`,JSON.stringify({observedAt:new Date().toISOString(),authority:'Official source aggregate geometry-positive APN counts mapped to Census FIPS',results:rows},null,2)+'\n');}
