import { describe, expect, it } from 'vitest';
import { InMemoryProviderBudgetManager, providerBudgetLimits, readProviderBudgetConfig } from './providerBudget.ts';

describe('Maxxis provider capability budget', () => {
  it('splits a PRO fixture budget 20/80', () => {
    expect(providerBudgetLimits({ total: 5, chatPercent: 20 })).toEqual({ chat: 1, report: 4 });
  });

  it('does not allow chat to borrow the report reserve', async () => {
    const manager = new InMemoryProviderBudgetManager('chat', { total: 5, chatPercent: 20 });
    const first = await manager.reserve();
    await manager.finalize(first, true);
    await expect(manager.reserve()).rejects.toThrow('PLAN_PROVIDER_BUDGET_EXHAUSTED');
    expect(manager.snapshot()).toMatchObject({ chat: 1, report: 0 });
  });

  it('charges only successful provider work and keeps report capacity independent', async () => {
    const chat = new InMemoryProviderBudgetManager('chat', { total: 5, chatPercent: 20 });
    const failed = await chat.reserve();
    await chat.finalize(failed, false);
    expect(chat.snapshot()).toMatchObject({ chat: 0 });
    const report = new InMemoryProviderBudgetManager('report', { total: 5, chatPercent: 20 });
    for (let index = 0; index < 4; index += 1) {
      const reservation = await report.reserve();
      await report.finalize(reservation, true);
    }
    await expect(report.reserve()).rejects.toThrow('PLAN_PROVIDER_BUDGET_EXHAUSTED');
  });

  it('uses centralized configurable production values', () => {
    const env = (name: string) => ({ MAXXIS_PRO_PROVIDER_BUDGET: '15', MAXXIS_PRO_CHAT_PERCENT: '20' })[name];
    expect(readProviderBudgetConfig('PRO', env)).toEqual({ total: 15, chatPercent: 20 });
    expect(readProviderBudgetConfig('FREE', env)).toEqual({ total: 0, chatPercent: 0 });
  });
});
