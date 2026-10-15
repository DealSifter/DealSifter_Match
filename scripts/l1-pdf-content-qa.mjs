import { readFile, writeFile } from 'node:fs/promises';
import { createCanvas, DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';
Object.assign(globalThis,{DOMMatrix,ImageData,Path2D});
const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
const directory='qa/portfolio-rooms-layout',results=[];
const fixture=JSON.parse(await readFile(`${directory}/l1-property-fixture.json`,'utf8'));
for(const device of ['desktop','phone']){
 const binary=new Uint8Array(await readFile(`${directory}/l1-${device}.pdf`));
 const document=await getDocument({data:binary,isEvalSupported:false,useSystemFonts:true}).promise;
 let text='';
 for(let pageNumber=1;pageNumber<=document.numPages;pageNumber++){
  const page=await document.getPage(pageNumber);
  text+=(await page.getTextContent()).items.map(item=>item.str||'').join(' ')+'\n';
  if(device==='desktop'){
   const viewport=page.getViewport({scale:1});
   const canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));
   await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
   await writeFile(`${directory}/l1-page-${pageNumber}.png`,canvas.toBuffer('image/png'));
  }
 }
 const normalized=text.replace(/\s+/g,' ');
 const firstSentence=fixture.description.split('.')[0],lastSentence=fixture.description.split('.').filter(value=>value.trim()).at(-1).trim();
 const complete=normalized.includes(fixture.address)&&normalized.includes(firstSentence)&&normalized.includes(lastSentence);
 if(document.numPages!==2||!complete||/MAXXIS DEAL INTELLIGENCE|ARV unavailable/.test(text))throw new Error('L1_CONTENT_PARITY_FAILED');
 results.push({device,pageCount:document.numPages,addressPreserved:true,firstAndLastNotesPreserved:true,higherTierAnalysisAbsent:true});
 await document.cleanup?.();
}
await writeFile(`${directory}/l1-pdf-content.json`,JSON.stringify({results},null,2)+'\n');
console.log(JSON.stringify(results));
