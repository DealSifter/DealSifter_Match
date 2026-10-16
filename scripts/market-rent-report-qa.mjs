import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {createCanvas,Image,DOMMatrix,ImageData,Path2D} from '@napi-rs/canvas';
const directory='qa/rentcast-market-rent';await mkdir(directory,{recursive:true});
const receipt=JSON.parse(await readFile(`${directory}/market-rent-normalization.json`,'utf8'));
if(receipt.mockOnly!==true)throw new Error('MOCK_EVIDENCE_REQUIRED');
const evidence=receipt.data,property={id:'11111111-1111-4111-8111-111111111111',type:'SFR',address:'7081 Kalanianaole Hwy',city:'Honolulu',state:'HI',zip:'96825',latitude:21.285,longitude:-157.715,price:2100000,beds:5,baths:3,sqft:2333};
// Deterministic offline tile transport; actual ARV canvas/map implementation.
// No RentCast/GIS/geocoding/tile network requests in automated QA.
const tile=createCanvas(256,256),ctx=tile.getContext('2d');ctx.fillStyle='#eef4ef';ctx.fillRect(0,0,256,256);ctx.strokeStyle='#fff';ctx.lineWidth=8;for(let n=0;n<256;n+=48){ctx.beginPath();ctx.moveTo(n,0);ctx.lineTo(n+30,256);ctx.stroke();ctx.beginPath();ctx.moveTo(0,n);ctx.lineTo(256,n+15);ctx.stroke();}ctx.fillStyle='#93a49a';ctx.font='12px sans-serif';ctx.fillText('QA mock basemap',55,130);const tileData=tile.toDataURL('image/png');
let mockTiles=0;
class OfflineImage extends Image{set src(value){if(String(value).startsWith('https://tile.openstreetmap.org/')){mockTiles++;super.src=tileData;}else if(String(value).startsWith('data:image/'))super.src=value;else throw new Error('QA_EXTERNAL_IMAGE_FORBIDDEN');}get src(){return super.src;}}
Object.assign(globalThis,{DOMMatrix,ImageData,Path2D,Image:OfflineImage,document:{createElement:tag=>{if(tag!=='canvas')throw new Error('QA_CANVAS_ONLY');return createCanvas(1,1);}}});
const server=await createServer({root:process.cwd(),optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true},appType:'custom'});
const results=[];
try{
 const {buildMaxxisReportSchema}=await server.ssrLoadModule('/src/domain/maxxis/maxxisReportSchema.js');
 const {renderMaxxisReportPdf,resolveComparableMap,comparableMapViewport}=await server.ssrLoadModule('/src/features/maxxis/export/maxxisReportPdf.js');
 const {rentalReportMapPoints}=await server.ssrLoadModule('/src/features/maxxis/export/marketRentReport.js');
 const {resolveReportExportEntitlement}=await server.ssrLoadModule('/src/features/maxxis/export/reportExportEntitlement.js');
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 for(const language of ['pt','en','es']){
  const schema=buildMaxxisReportSchema({reportType:'DEAL_INTELLIGENCE',property,resolvedUserLocale:language,dealIntelligence:{provenance:{marketRent:'MOCK_RENTCAST_FIXTURE'},executiveDealOverview:'Synthetic fixture — not a production valuation.',propertyEvidence:{verifiedRecords:[],userProvided:[],unknown:[],conflicts:[]},valuationIntelligence:{status:'ARV_UNAVAILABLE',rentalEvidence:{rentEstimate:evidence}},comparableEvidence:{used:[],supporting:[],excluded:[]}}});
  const view=schema.presentation.marketRent,points=rentalReportMapPoints(view),viewport=comparableMapViewport(points);
  const map=await resolveComparableMap(schema,{points});if(!map)throw new Error('RENTAL_MAP_MISSING');
  await writeFile(`${directory}/rental-map-${language}.png`,Buffer.from(map.split(',')[1],'base64'));
  const result=await renderMaxxisReportPdf({schema,exportEntitlement:resolveReportExportEntitlement({plan:'enterprise',reportType:'DEAL_INTELLIGENCE',channel:'PDF'}),generatedAt:'2026-10-16T00:00:00Z',language});
  if(result.state!=='RENDERED')throw new Error(JSON.stringify({state:result.state,validation:result.validation}));
  await writeFile(`${directory}/honolulu-l3-${language}.pdf`,result.document.binary);
  const pdf=await getDocument({data:result.document.binary.slice(),useSystemFonts:true}).promise;
  const page=await pdf.getPage(7),v=page.getViewport({scale:2}),canvas=createCanvas(Math.ceil(v.width),Math.ceil(v.height));
  await page.render({canvasContext:canvas.getContext('2d'),viewport:v,canvas}).promise;
  await writeFile(`${directory}/honolulu-l3-${language}-market-rent.png`,await canvas.encode('png'));
  const text=(await page.getTextContent()).items.map(item=>item.str).join(' ');
  const boundsPass=viewport.world.every(p=>p.x-viewport.left>=viewport.padding&&p.x-viewport.left<=viewport.width-viewport.padding&&p.y-viewport.top>=viewport.padding&&p.y-viewport.top<=viewport.height-viewport.padding);
  results.push({language,pages:pdf.numPages,mapPipeline:'EXISTING_ARV_RESOLVE_COMPARABLE_MAP',subjectMarker:points[0].marker,markers:points.slice(1).map(p=>p.marker),mapTableIdMismatch:points.slice(1).filter((p,i)=>p.id!==view.reportRentalComparables[i].id).length,mapTableOrderMismatch:points.slice(1).filter((p,i)=>p.marker!==String(view.reportRentalComparables[i].number)).length,boundsPass,hasEstimate:/7[,.]820/.test(text),hasAllRows:view.reportRentalComparables.every(p=>text.includes(p.address)),missingCoordinateCompIds:view.missingCoordinateCompIds,layoutContinuationCount:result.document.layoutAudit.continuations.length});
  pdf.cleanup();
 }
 const levelControls=[];
 for(const [reportType,plan,expectedPages]of [['PROPERTY_RELEASE','free',1],['MAXXIS_ANALYSIS','pro',3]]){
  const schema=buildMaxxisReportSchema({reportType,property,resolvedUserLocale:'en',maxxisAnalysis:{executiveSummary:'Synthetic report scope control.',provenance:{fixture:'MOCK'},marketContext:{rentEstimate:evidence}},dealIntelligence:{valuationIntelligence:{rentalEvidence:{rentEstimate:evidence}}}});
  const result=await renderMaxxisReportPdf({schema,exportEntitlement:resolveReportExportEntitlement({plan,reportType,channel:'PDF'}),generatedAt:'2026-10-16T00:00:00Z',language:'en'});
  if(result.state!=='RENDERED')throw new Error(`${reportType}:${result.state}`);
  await writeFile(`${directory}/honolulu-${reportType.toLowerCase()}-scope.pdf`,result.document.binary);
  const pdf=await getDocument({data:result.document.binary.slice(),useSystemFonts:true}).promise;
  let text='';for(let n=1;n<=pdf.numPages;n++)text+=' '+(await (await pdf.getPage(n)).getTextContent()).items.map(item=>item.str).join(' ');
  levelControls.push({reportType,pages:pdf.numPages,expectedPages,hasMainMarketEstimate:/7[,.]820/.test(text),rentalMapPages:schema.pages.filter(p=>p.code==='MARKET_RENT').length,rentalCompAddressesExposed:/Mock Rental St/.test(text),rangeExposed:/5[,.]230|10[,.]410/.test(text)});pdf.cleanup();
 }
 const output={mockOnly:true,liveRentCastCalls:0,liveGISCalls:0,perCompLookups:0,realTileCalls:0,mockTiles,results,levelControls,pass:results.length===3&&results.every(r=>r.pages===7&&r.boundsPass&&r.hasEstimate&&r.hasAllRows&&r.mapTableIdMismatch===0&&r.mapTableOrderMismatch===0)&&levelControls.every(r=>r.pages===r.expectedPages&&r.rentalMapPages===0&&!r.rentalCompAddressesExposed&&!r.rangeExposed&&r.hasMainMarketEstimate===(r.reportType==='MAXXIS_ANALYSIS'))};
 await writeFile(`${directory}/rental-map-pdf-qa.json`,JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify(output));if(!output.pass)process.exitCode=1;
}finally{await server.close();}
