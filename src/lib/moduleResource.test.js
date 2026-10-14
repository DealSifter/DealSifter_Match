import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createModuleResource, canPrefetchModule } from './moduleResource';
import { isModuleLoadError } from './moduleLoadError';

const module = { default: () => null };
const transport = () => new TypeError('Failed to fetch dynamically imported module');
describe('module transport and single-flight recovery', () => {
  it('shares prefetch and foreground work, then caches only a valid loaded module', async () => {
    let finish; const importer=vi.fn(()=>new Promise(resolve=>{finish=resolve;}));
    const resource=createModuleResource(importer); const prefetch=resource.preload(); const load=resource.load();
    expect(importer).toHaveBeenCalledOnce(); finish(module); await prefetch; expect(await load).toBe(module);
    expect(await resource.load()).toBe(module); expect(importer).toHaveBeenCalledOnce();
  });
  it('uses exactly two bounded backoffs for transient failures', async () => {
    const importer=vi.fn().mockRejectedValueOnce(transport()).mockRejectedValueOnce(transport()).mockResolvedValue(module);
    const wait=vi.fn().mockResolvedValue(); const report=vi.fn();
    expect(await createModuleResource(importer,{wait,report}).load()).toBe(module);
    expect(wait.mock.calls).toEqual([[250],[750]]); expect(report).not.toHaveBeenCalled(); expect(importer).toHaveBeenCalledTimes(3);
  });
  it('reports a persistent transport failure once and allows an explicit retry', async () => {
    const importer=vi.fn().mockRejectedValue(transport()); const report=vi.fn();
    const resource=createModuleResource(importer,{wait:async()=>{},report});
    expect(await resource.preload()).toBeUndefined(); expect(importer).toHaveBeenCalledTimes(3); expect(report).toHaveBeenCalledOnce();
    importer.mockResolvedValue(module); resource.reset(); expect(await resource.load()).toBe(module);
  });
  it('does not repeat downloads while offline', async () => {
    const importer=vi.fn().mockRejectedValue(transport()); const wait=vi.fn();
    await expect(createModuleResource(importer,{online:()=>false,wait}).load()).rejects.toThrow('dynamically');
    expect(importer).toHaveBeenCalledOnce(); expect(wait).not.toHaveBeenCalled();
  });
  it('does not retry a failed stylesheet as JS-only and render an unstyled module',async()=>{
    const importer=vi.fn().mockRejectedValue(new Error('Unable to preload CSS for /assets/module.css'));const wait=vi.fn();
    await expect(createModuleResource(importer,{wait}).load()).rejects.toThrow('Unable to preload CSS');
    expect(importer).toHaveBeenCalledOnce();expect(wait).not.toHaveBeenCalled();
  });
  it('preserves programming errors without relabeling or retries', async () => {
    const error=new TypeError('Cannot read properties of undefined'); const importer=vi.fn().mockRejectedValue(error);
    await expect(createModuleResource(importer).load()).rejects.toBe(error); expect(importer).toHaveBeenCalledOnce();
  });
  it('rejects an invalid export without hanging Suspense or entering a retry loop', async () => {
    const importer=vi.fn().mockResolvedValue({});
    await expect(createModuleResource(importer).load()).rejects.toThrow('MODULE_DEFAULT_EXPORT_MISSING'); expect(importer).toHaveBeenCalledOnce();
  });
  it('does not let an old failed prefetch erase a new retry', async () => {
    let fail; const importer=vi.fn().mockImplementationOnce(()=>new Promise((_,reject)=>{fail=reject;})).mockResolvedValue(module);
    const report=vi.fn(); const resource=createModuleResource(importer,{report}); const previous=resource.preload();
    resource.reset(); expect(await resource.load()).toBe(module); fail(transport()); await previous;
    expect(await resource.load()).toBe(module); expect(importer).toHaveBeenCalledTimes(2); expect(report).not.toHaveBeenCalled();
  });
  it.each(['ChunkLoadError: Loading chunk 12 failed','Importing a module script failed.','Unable to preload CSS for /assets/module.css','error loading dynamically imported module'])('recognizes supported transport errors: %s', message => {
    expect(isModuleLoadError(new Error(message))).toBe(true);
  });
  it.each([{saveData:true},{effectiveType:'2g'},{effectiveType:'slow-2g'}])('avoids speculative loading on a constrained connection: %s', connection => {
    expect(canPrefetchModule(connection)).toBe(false);
  });
  it('permits intent-only prefetch on normal connections', () => {
    expect(canPrefetchModule({effectiveType:'4g'})).toBe(true); expect(canPrefetchModule(null)).toBe(true);
  });
});

describe('hosting route/cache contract', () => {
  const config=JSON.parse(readFileSync(new URL('../../vercel.json',import.meta.url),'utf8'));
  const spa=new RegExp(`^${config.rewrites.find(rule=>rule.destination==='/index.html').source}$`);
  it.each(['/assets/missing.js','/assets/old-module.css','/assets/map.png'])('does not rewrite a missing asset into cacheable HTML: %s', path => { expect(spa.test(path)).toBe(false); });
  it.each(['/','/dashboard','/map','/matches','/auth/callback'])('preserves SPA navigation/deep links: %s', path => { expect(spa.test(path)).toBe(true); });
  it('keeps immutable real assets and explicitly prevents HTML route caching', () => {
    const assets=config.headers.find(rule=>rule.source==='/assets/(.*)'); expect(assets.headers.find(header=>header.key==='Cache-Control').value).toContain('immutable');
    const html=config.headers.find(rule=>rule.source===config.rewrites[0].source); expect(html.headers.find(header=>header.key==='Cache-Control').value).toContain('no-store');
  });
});
