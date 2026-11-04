import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let instances;
let render;
beforeEach(async () => {
  vi.useFakeTimers();
  vi.resetModules();
  instances = [];
  class Worker {
    terminate = vi.fn();
    messages = [];
    constructor() { instances.push(this); }
    postMessage(message) { this.messages.push(message); }
    finish(result = { state: 'RENDERED', document: { binary: new Uint8Array([37, 80, 68, 70]) } }) {
      this.onmessage({ data: { id: this.messages.at(-1).id, result } });
    }
  }
  vi.stubGlobal('Worker', Worker);
  ({ renderReportPdfInWorker: render } = await import('./reportPdfWorkerClient'));
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const advance = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

describe('PDF worker lifecycle and memory bounds', () => {
  it('serializes concurrent reports and reuses one worker without mixing results', async () => {
    const first = render({ viewModel: { id: 'a' } });
    const second = render({ viewModel: { id: 'b' } });
    await advance();
    expect(instances).toHaveLength(1);
    expect(instances[0].messages).toHaveLength(1);
    instances[0].finish({ state: 'RENDERED', id: 'a' });
    expect(await first).toMatchObject({ id: 'a' });
    await advance();
    expect(instances[0].messages[1].input.viewModel.id).toBe('b');
    instances[0].finish({ state: 'RENDERED', id: 'b' });
    expect(await second).toMatchObject({ id: 'b' });
    await vi.advanceTimersByTimeAsync(30000);
    expect(instances[0].terminate).toHaveBeenCalledOnce();
  });
  it('terminates a stuck encoder, reports a real failure and permits a fresh retry', async () => {
    const stuck = render({});
    const rejected = expect(stuck).rejects.toThrow('REPORT_PDF_WORKER_TIMEOUT');
    await vi.advanceTimersByTimeAsync(45000);
    await rejected;
    expect(instances[0].terminate).toHaveBeenCalledOnce();
    const retry = render({});
    await advance();
    expect(instances).toHaveLength(2);
    instances[1].finish();
    expect((await retry).state).toBe('RENDERED');
  });
  it.each(['onerror', 'onmessageerror'])('rejects %s without retrying on the UI thread', async event => {
    const request = render({});
    await advance();
    instances[0][event]({ message: 'private property or contact text' });
    await expect(request).rejects.toThrow(/^REPORT_PDF_WORKER_/);
    expect(instances[0].terminate).toHaveBeenCalledOnce();
  });
  it('rejects renderer errors with no private error content', async () => {
    const request = render({});
    await advance();
    instances[0].onmessage({ data: { id: instances[0].messages[0].id, error: 'private details' } });
    await expect(request).rejects.toThrow('REPORT_PDF_RENDER_FAILED');
    expect(instances[0].terminate).toHaveBeenCalledOnce();
  });
});
