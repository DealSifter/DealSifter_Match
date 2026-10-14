// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useFeatureFlagSnapshot } from './useFeatureFlagSnapshot';
import { isFeatureEnabled, fetchFeatureFlagsWithRetry } from '../services/featureFlagService';
vi.mock('../services/featureFlagService',async original=>({...await original(),fetchFeatureFlagsWithRetry:vi.fn()}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
const allowed={source:'server',flags:{public_parcel_intelligence:true},environment:'production'};
const denied={source:'server',flags:{public_parcel_intelligence:false},environment:'production'};
describe('account-scoped permission snapshots',()=>{
  it('never presents the previous account grant while the new account is loading',async()=>{
    let finish;fetchFeatureFlagsWithRetry.mockResolvedValueOnce(allowed).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
    const {result,rerender}=renderHook(({owner})=>useFeatureFlagSnapshot(owner),{initialProps:{owner:'account-a'}});
    await waitFor(()=>expect(isFeatureEnabled(result.current.snapshot,'public_parcel_intelligence')).toBe(true));
    rerender({owner:'account-b'});expect(isFeatureEnabled(result.current.snapshot,'public_parcel_intelligence')).toBe(false);
    await waitFor(()=>expect(finish).toBeTypeOf('function'));await act(async()=>finish(denied));
    expect(result.current.owner).toBe('account-b');expect(isFeatureEnabled(result.current.snapshot,'public_parcel_intelligence')).toBe(false);
  });
  it('ignores a late allowed result from a previous authenticated account',async()=>{
    let finish;fetchFeatureFlagsWithRetry.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;})).mockResolvedValueOnce(denied);
    const {result,rerender}=renderHook(({owner})=>useFeatureFlagSnapshot(owner),{initialProps:{owner:'account-a'}});
    await waitFor(()=>expect(finish).toBeTypeOf('function'));rerender({owner:'account-b'});
    await waitFor(()=>expect(result.current.phase).toBe('ready'));await act(async()=>finish(allowed));
    expect(isFeatureEnabled(result.current.snapshot,'public_parcel_intelligence')).toBe(false);
  });
  it('retains a confirmed same-account grant during a pending check, then honors revocation',async()=>{
    let finish;fetchFeatureFlagsWithRetry.mockResolvedValueOnce(allowed).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
    const {result}=renderHook(()=>useFeatureFlagSnapshot('account-a'));
    await waitFor(()=>expect(result.current.phase).toBe('ready'));
    act(()=>{void result.current.refresh();});expect(result.current.phase).toBe('pending');expect(isFeatureEnabled(result.current.snapshot,'public_parcel_intelligence')).toBe(true);
    await waitFor(()=>expect(finish).toBeTypeOf('function'));await act(async()=>finish(denied));
    expect(isFeatureEnabled(result.current.snapshot,'public_parcel_intelligence')).toBe(false);
  });
});
