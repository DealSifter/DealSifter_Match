import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readMaxxisReportForDelivery } from './maxxisReportService';
const m = vi.hoisted(() => ({ auth: vi.fn(), from: vi.fn(), rpc: vi.fn(), select: vi.fn(), eq: vi.fn(), is: vi.fn(), maybeSingle: vi.fn() }));
vi.mock('../lib/supabaseClient', () => ({ supabase: { auth: { getUser: m.auth }, from: m.from, rpc: m.rpc } }));
beforeEach(() => {
  vi.resetAllMocks(); m.auth.mockResolvedValue({ data: { user: { id: 'a' } } });
  const chain = { select: m.select, eq: m.eq, is: m.is, maybeSingle: m.maybeSingle };
  for (const fn of [m.from, m.select, m.eq, m.is]) fn.mockReturnValue(chain);
  m.maybeSingle.mockResolvedValue({ data: { id: 'report-a', user_id: 'a', property_id: 'property-a', capability: 'DEAL_INTELLIGENCE', report_payload: {} } });
  m.rpc.mockResolvedValue({ data: true });
});
describe('R3.2 backend-authorized delivery reads', () => {
  it('requires real auth, owner-filtered RLS read and existing property-access RPC', async () => {
    const value = await readMaxxisReportForDelivery('report-a', 'a');
    expect(value.userId).toBe('a'); expect(m.eq).toHaveBeenCalledWith('user_id', 'a'); expect(m.eq).toHaveBeenCalledWith('id', 'report-a');
    expect(m.is).toHaveBeenCalledWith('deleted_at', null);
    expect(m.rpc).toHaveBeenCalledExactlyOnceWith('ds_has_maxxis_analysis_context_access', { p_property_id: 'property-a' });
  });
  it('rejects an account change before reading reports', async () => {
    await expect(readMaxxisReportForDelivery('report-a', 'b')).rejects.toThrow('UNAUTHORIZED'); expect(m.from).not.toHaveBeenCalled();
  });
  it('rejects missing/deleted/foreign rows hidden by RLS', async () => {
    m.maybeSingle.mockResolvedValue({ data: null });
    await expect(readMaxxisReportForDelivery('report-a', 'a')).rejects.toThrow('UNAVAILABLE'); expect(m.rpc).not.toHaveBeenCalled();
  });
  it('rejects denied backend property access', async () => {
    m.rpc.mockResolvedValue({ data: false });
    await expect(readMaxxisReportForDelivery('report-a', 'a')).rejects.toThrow('UNAUTHORIZED');
  });
});
