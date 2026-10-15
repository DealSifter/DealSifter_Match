import {readFile,writeFile} from 'node:fs/promises';
import {DOMMatrix,ImageData,Path2D} from '@napi-rs/canvas';
Object.assign(globalThis,{DOMMatrix,ImageData,Path2D});
const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
const directory=process.env.PORTFOLIO_QA_DIRECTORY||'qa/parcel-report-apn',mode=process.argv.includes('--production')?'production':'local',results=[];
for(const device of ['desktop','phone']){
 const document=await getDocument({data:new Uint8Array(await readFile(`${directory}/${mode}-app-l1-${device}.pdf`)),isEvalSupported:false,useSystemFonts:true}).promise;
 const firstPage=await document.getPage(1),text=(await firstPage.getTextContent()).items.map(item=>item.str||'').join(' ');
 if(!text.includes('000-TEST-001'))throw new Error('PUBLIC_APN_MISSING_FROM_DOWNLOADED_PDF');
 results.push({device,pdfPages:document.numPages,publicApnPresentOnFirstPage:true,syntheticBackend:true});await document.cleanup?.();
}
await writeFile(`${directory}/${mode}-pdf-apn.json`,JSON.stringify({results,realUserSession:false},null,2)+'\n');console.log(JSON.stringify(results));
