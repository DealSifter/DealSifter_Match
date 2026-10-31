import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createCanvas, DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';
import { r4Fixtures, R4_TIME } from './report-r4-fixtures.mjs';
Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
// The previous-renderer baseline was captured before R4 and must not be overwritten.
if (process.argv.includes('--baseline')) throw Error('R4_BASELINE_ALREADY_CAPTURED: use qa/report-r4/before-sparse-L3.pdf');
const baseline = false;
const root = fileURLToPath(new URL('../', import.meta.url)), out = new URL('../qa/report-r4/', import.meta.url);
await mkdir(out, { recursive: true });
const runtime = new URL('../.tmp-codex/report-r4/runtime.mjs', import.meta.url);
await mkdir(new URL('.', runtime), { recursive: true });
await build({ stdin: { contents: [
  "export { buildMaxxisReportSchema } from './src/domain/maxxis/maxxisReportSchema.js';",
  "export { renderMaxxisReportPdf } from './src/features/maxxis/export/maxxisReportPdf.js';",
  "export { resolveReportExportEntitlement } from './src/features/maxxis/export/reportExportEntitlement.js';",
].join('\n'), resolveDir: root, loader: 'js' }, outfile: fileURLToPath(runtime), bundle: true, platform: 'node', format: 'esm', packages: 'external',
  define: { 'import.meta.env': '{}' }, loader: { '.png': 'dataurl', '.ttf': 'dataurl' } });
const { buildMaxxisReportSchema, renderMaxxisReportPdf, resolveReportExportEntitlement } = await import(runtime.href + '?at=' + Date.now());
const photo = 'data:image/jpeg;base64,' + (await readFile(new URL('../src/assets/maxxis/report-previews/sample-property-photo.jpg', import.meta.url))).toString('base64');
const photo2 = 'data:image/jpeg;base64,' + (await readFile(new URL('../qa/report-template/sample-photos/gallery-1.jpg', import.meta.url))).toString('base64');
const fixtures = r4Fixtures([photo, photo2]);
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const metrics = [];
for (const fixture of fixtures) for (const [type, plan, level] of [['PROPERTY_RELEASE', 'free', 'L1'], ['MAXXIS_ANALYSIS', 'pro', 'L2'], ['DEAL_INTELLIGENCE', 'enterprise', 'L3']]) {
  if (baseline && (fixture.id !== 'sparse' || level !== 'L3')) continue;
  const name = baseline ? 'before-sparse-L3' : `${fixture.id}-${level}`;
  const schema = buildMaxxisReportSchema({ reportType: type, ...fixture.input });
  const result = await renderMaxxisReportPdf({ schema, language: 'en', generatedAt: R4_TIME,
    exportEntitlement: resolveReportExportEntitlement({ plan, reportType: type, channel: 'PDF' }) });
  if (result.state !== 'RENDERED') throw Error(name + ':' + JSON.stringify(result.validation || result.state));
  await writeFile(new URL(`${name}.pdf`, out), result.document.binary);
  const loading = pdfjs.getDocument({ data: result.document.binary.slice(), useSystemFonts: true });
  const pdf = await loading.promise, empty = [], text = [];
  for (let number = 1; number <= pdf.numPages; number++) {
    const page = await pdf.getPage(number), viewport = page.getViewport({ scale: 1.4 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height)), ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    await writeFile(new URL(`${name}-page-${number}.png`, out), await canvas.encode('png'));
    text.push((await page.getTextContent()).items.map(item => item.str || '').join(' '));
    const boxes = result.document.layoutAudit.sections.filter(section => section.page === number).map(s => s.bounds);
    // Free body area, measured from actual content blocks; excludes the common header/footer.
    const ys = [...new Set([130, 790, ...boxes.flatMap(b => [Math.max(130,b.y),Math.min(790,b.bottom)])])].sort((a,b)=>a-b);
    let occupied = 0;
    for (let i=1;i<ys.length;i++) {
      const lo=ys[i-1],hi=ys[i],intervals=boxes.filter(b=>b.y<=lo&&b.bottom>=hi).map(b=>[Math.max(26,b.x),Math.min(569.28,b.right)]).sort((a,b)=>a[0]-b[0]);
      let width=0,end=26;for(const[a,b]of intervals){width+=Math.max(0,b-Math.max(a,end));end=Math.max(end,b);}occupied+=width*(hi-lo);
    }
    empty.push(Number((100 * (1 - occupied / (660*543.28))).toFixed(1)));
  }
  await loading.destroy();
  const actualText = text.join('\n'), audit = result.document.layoutAudit;
  const keys = audit.sections.map(s => s.sectionId).filter(key => !/^(header|footer)/.test(key));
  const visibleBlockKeys = audit.sections.map(section => audit.lines.filter(line => line.page === section.page && line.sectionId === section.sectionId).map(line => line.text).join(' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
  const row = { fixture: name, pages: result.document.pageCount, emptyBodyPercent: empty,
    duplicateBlocks: Math.max(keys.length - new Set(keys).size, visibleBlockKeys.length - new Set(visibleBlockKeys).size), ellipses: (actualText.match(/…/g) || []).length,
    jargon: (actualText.match(/\b(?:SOLD|AVM|gates?|structural candidates|normalized)\b|not requested in this flow/gi) || []).length,
    pii: /Fictional Publisher|publisher@example\.invalid/.test(actualText), maps: audit.maps.length };
  metrics.push(row); console.log(JSON.stringify(row));
  await writeFile(new URL(`${name}-layout.json`, out), JSON.stringify(audit.sections.map(s=>({id:s.sectionId,page:s.page,bounds:s.bounds})),null,2)+'\n');
  if (!baseline && (row.duplicateBlocks || row.ellipses || row.jargon || row.pii || row.maps > 1 || level === 'L1' && row.pages !== 1 || level === 'L2' && row.pages > 3 || fixture.id === 'sparse' && row.pages > 3 || empty.slice(0,-1).some(percent=>percent>=25))) throw Error('R4_ACCEPTANCE_FAILED:' + name);
}
await writeFile(new URL(baseline ? 'before-metrics.json' : 'metrics.json', out), JSON.stringify({ areaDefinition: 'Unused two-dimensional body area, union of measured content boxes; header/footer excluded.', metrics }, null, 2) + '\n');
