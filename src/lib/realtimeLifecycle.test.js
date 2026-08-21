import { describe, expect, it, vi } from 'vitest';
import { createRealtimeLifecycle, createRealtimeTopic } from './realtimeLifecycle';

describe('realtimeLifecycle', () => {
  it('creates collision-resistant topics for simultaneous account channels', () => {
    const first = createRealtimeTopic('chat', 'user-a');
    const second = createRealtimeTopic('chat', 'user-a');
    expect(first).toContain('chat-user-a-');
    expect(second).not.toBe(first);
  });

  it('suppresses late callbacks after logout and removes the channel once', () => {
    const removeChannel = vi.fn();
    const subscribe = vi.fn();
    const callback = vi.fn();
    const lifecycle = createRealtimeLifecycle({ removeChannel });
    const guarded = lifecycle.guard(callback);
    const channel = { subscribe };

    lifecycle.subscribe(channel);
    guarded('before-cleanup');
    lifecycle.dispose();
    lifecycle.dispose();
    guarded('after-cleanup');

    expect(subscribe).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('before-cleanup');
    expect(removeChannel).toHaveBeenCalledOnce();
    expect(removeChannel).toHaveBeenCalledWith(channel);
    expect(lifecycle.isActive()).toBe(false);
  });

  it('replaces an earlier channel without leaking a duplicate subscription', () => {
    const removeChannel = vi.fn();
    const lifecycle = createRealtimeLifecycle({ removeChannel });
    const first = { subscribe: vi.fn() };
    const second = { subscribe: vi.fn() };

    lifecycle.subscribe(first);
    lifecycle.subscribe(second);

    expect(removeChannel).toHaveBeenNthCalledWith(1, first);
    expect(first.subscribe).toHaveBeenCalledOnce();
    expect(second.subscribe).toHaveBeenCalledOnce();

    lifecycle.dispose();
    expect(removeChannel).toHaveBeenNthCalledWith(2, second);
  });
});
