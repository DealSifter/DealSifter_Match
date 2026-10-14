import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFeatureFlagRefresh } from './featureFlagRefresh';
afterEach(()=>vi.useRealTimers());
describe('recoverable, fail-closed flag request lifecycle',()=>{
  it('shares concurrent permission checks and respects server denial without retries',async()=>{
    let finish;const fetcher=vi.fn(()=>new Promise(resolve=>{finish=resolve;}));const publish=vi.fn();const schedule=vi.fn();
    const controller=createFeatureFlagRefresh({fetcher,publish,schedule});const first=controller.refresh();const duplicate=controller.refresh();
    await Promise.resolve();expect(fetcher).toHaveBeenCalledOnce();expect(duplicate).toBe(first);
    const denied={source:'server',flags:{public_parcel_intelligence:false}};finish(denied);await first;
    expect(publish).toHaveBeenLastCalledWith(denied,'ready');expect(schedule).not.toHaveBeenCalled();
  });
  it('recovers after an initial network failure without changing server flags',async()=>{
    vi.useFakeTimers();const allowed={source:'server',flags:{public_parcel_intelligence:true}};
    const fetcher=vi.fn().mockResolvedValueOnce({source:'fallback'}).mockResolvedValue(allowed);const publish=vi.fn();
    const controller=createFeatureFlagRefresh({fetcher,publish});await controller.refresh();
    expect(publish).toHaveBeenLastCalledWith({source:'fallback'},'unavailable');
    await vi.advanceTimersByTimeAsync(2000);expect(fetcher).toHaveBeenCalledTimes(2);expect(publish).toHaveBeenLastCalledWith(allowed,'ready');
  });
  it('bounds failed background refreshes, without a request loop',async()=>{
    vi.useFakeTimers();const fetcher=vi.fn().mockResolvedValue({source:'fallback'});const controller=createFeatureFlagRefresh({fetcher,publish:vi.fn()});
    await controller.refresh();await vi.advanceTimersByTimeAsync(120000);expect(fetcher).toHaveBeenCalledTimes(4);controller.dispose();
  });
  it('cancels timers and ignores late permission results from a logged-out account',async()=>{
    let finish;const publish=vi.fn();const controller=createFeatureFlagRefresh({fetcher:()=>new Promise(resolve=>{finish=resolve;}),publish});
    const pending=controller.refresh();await Promise.resolve();controller.dispose();publish.mockClear();finish({source:'server',flags:{public_parcel_intelligence:true}});await pending;
    expect(publish).not.toHaveBeenCalled();await controller.refresh({force:true});expect(publish).not.toHaveBeenCalled();
  });
  it('rate-limits foreground events and still permits an explicit recovery action',async()=>{
    vi.useFakeTimers();const fetcher=vi.fn().mockResolvedValue({source:'server',flags:{}});const controller=createFeatureFlagRefresh({fetcher,publish:vi.fn()});
    await controller.refresh();await controller.refresh();expect(fetcher).toHaveBeenCalledOnce();await controller.refresh({force:true});expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
