import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createModuleResource, canPrefetchModule } from './moduleResource';
import { isModuleLoadError } from './moduleLoadError';

const module = { default: () => null };
const transport = () => new TypeError('Failed to fetch dynamically imported module');
afterEach(()=>vi.useRealTimers());
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
  it('reuses a physical import across resets rather than racing duplicate downloads', async () => {
    let finish; const importer=vi.fn().mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
    const report=vi.fn(); const resource=createModuleResource(importer,{report}); const previous=resource.preload();
    resource.reset(); const next=resource.load();finish(module);expect(await next).toBe(module);await previous;
    expect(await resource.load()).toBe(module); expect(importer).toHaveBeenCalledOnce(); expect(report).not.toHaveBeenCalled();
  });
  it('ends a stuck download with scoped recovery, without background retry storms',async()=>{
    vi.useFakeTimers();const importer=vi.fn(()=>new Promise(()=>{})),report=vi.fn(),wait=vi.fn();
    const resource=createModuleResource(importer,{timeoutMs:1000,report,wait});
    const failure=expect(resource.load()).rejects.toMatchObject({code:'MODULE_LOAD_TIMEOUT'});
    await vi.advanceTimersByTimeAsync(1000);await failure;
    expect(importer).toHaveBeenCalledOnce();expect(wait).not.toHaveBeenCalled();expect(report).toHaveBeenCalledOnce();
    expect(isModuleLoadError(report.mock.calls[0][0])).toBe(true);expect(vi.getTimerCount()).toBe(0);
  });
  it('can explicitly recover a timed-out import when its original request finally finishes',async()=>{
    vi.useFakeTimers();let finish;const importer=vi.fn(()=>new Promise(resolve=>{finish=resolve;}));
    const resource=createModuleResource(importer,{timeoutMs:1000});const failure=expect(resource.load()).rejects.toThrow('MODULE_LOAD_TIMEOUT');
    await vi.advanceTimersByTimeAsync(1000);await failure;resource.reset();const retry=resource.load();finish(module);
    expect(await retry).toBe(module);expect(importer).toHaveBeenCalledOnce();expect(vi.getTimerCount()).toBe(0);
  });
  it('clears the deadline when an import completes promptly',async()=>{
    vi.useFakeTimers();const report=vi.fn();expect(await createModuleResource(async()=>module,{report}).load()).toBe(module);
    expect(vi.getTimerCount()).toBe(0);await vi.advanceTimersByTimeAsync(60_000);expect(report).not.toHaveBeenCalled();
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
  const spaRule=config.routes.find(rule=>rule.dest==='/index.html');
  const spa=new RegExp(`^${spaRule.src}$`);
  it.each(['/assets/missing.js','/assets/old-module.css','/assets/map.png'])('does not rewrite a missing asset into cacheable HTML: %s', path => { expect(spa.test(path)).toBe(false); });
  it.each(['/','/dashboard','/map','/matches','/auth/callback'])('preserves SPA navigation/deep links: %s', path => { expect(spa.test(path)).toBe(true); });
  it('keeps immutable real assets and explicitly prevents HTML route caching', () => {
    const assets=config.routes.find(rule=>rule.src==='/assets/(.*)'&&rule.continue); expect(assets.headers['Cache-Control']).toContain('immutable');
    const html=config.routes.find(rule=>rule.src===spaRule.src&&rule.continue); expect(html.headers['Cache-Control']).toContain('no-store');
  });
  it('overrides immutable caching only for missing assets after filesystem lookup',()=>{
    const filesystem=config.routes.findIndex(rule=>rule.handle==='filesystem');
    const missing=config.routes.findIndex(rule=>rule.src==='/assets/(.*)'&&rule.status===404);
    const immutable=config.routes.findIndex(rule=>rule.src==='/assets/(.*)'&&rule.continue);
    expect(immutable).toBeLessThan(filesystem);expect(filesystem).toBeLessThan(missing);
    expect(config.routes[missing].headers['Cache-Control']).toContain('no-store');
    expect(config.routes[missing].continue).not.toBe(true);
    expect(missing).toBeLessThan(config.routes.indexOf(spaRule));
  });
});
