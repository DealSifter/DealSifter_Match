// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { lazyWithRetry } from '../../lib/lazyWithRetry';
import ErrorBoundary from './ErrorBoundary';
import { setLang } from '../../i18n/translations';
vi.mock('../../lib/observability',()=>({captureAppException:vi.fn(),scrubTelemetryValue:value=>value}));
afterEach(()=>{cleanup();vi.restoreAllMocks();setLang('en');});

describe('scoped module recovery', () => {
  it('requires explicit reload for failed CSS rather than silently losing the module styles',async()=>{
    vi.spyOn(console,'error').mockImplementation(()=>{});
    const Module=lazyWithRetry(async()=>{throw new Error('Unable to preload CSS for /assets/module.css');},'styled-module');
    render(<Module />);await screen.findByText('Unable to load this module');
    expect(screen.queryByRole('button',{name:'Try again'})).toBeNull();expect(screen.getByRole('button',{name:'Reload page'})).toBeTruthy();
  });
  it('shows loading without hiding sibling navigation; shares a prefetched result', async () => {
    let finish; const importer=vi.fn(()=>new Promise(resolve=>{finish=resolve;})); const Module=lazyWithRetry(importer,'map');
    const preload=Module.preload(); render(<><button>Navigation</button><Module /></>);
    expect(screen.getByRole('status').textContent).toBe('Loading this module…'); expect(screen.getByText('Navigation')).toBeTruthy();
    finish({default:()=> <div>Loaded module</div>}); await preload; await screen.findByText('Loaded module'); expect(importer).toHaveBeenCalledOnce();
  });
  it('recreates a rejected lazy type on manual retry without reloading the app', async () => {
    vi.spyOn(console,'error').mockImplementation(()=>{}); setLang('pt');
    const importer=vi.fn().mockRejectedValue(new Error('Importing a module script failed.')); const Module=lazyWithRetry(importer,'map');
    render(<><button>Other module</button><Module /></>);
    await screen.findByText('Não foi possível carregar este módulo',{}, {timeout:5000}); expect(importer).toHaveBeenCalledTimes(3);
    importer.mockResolvedValue({default:()=> <div>Recovered module</div>}); fireEvent.click(screen.getByRole('button',{name:'Tentar novamente'}));
    await screen.findByText('Recovered module'); expect(screen.getByText('Other module')).toBeTruthy(); expect(importer).toHaveBeenCalledTimes(4);
  });
  it('does not disguise a component runtime crash as stale cache', async () => {
    vi.spyOn(console,'error').mockImplementation(()=>{});
    const Module=lazyWithRetry(async()=>({default:()=>{throw new Error('CONTROLLED_RUNTIME_FAILURE');}}),'runtime');
    render(<><button>Other module</button><Module /></>);
    await screen.findByText('Something went wrong'); expect(screen.queryByText('Unable to load this module')).toBeNull();
    expect(screen.getByText('Other module')).toBeTruthy();
  });
  it('resets boundary state on a new key without recursively calling retry', async () => {
    vi.spyOn(console,'error').mockImplementation(()=>{}); const onRetry=vi.fn();
    function Fail(){throw new Error('CONTROLLED_BOUNDARY_FAILURE');}
    const {rerender}=render(<ErrorBoundary resetKey={0} onRetry={onRetry}><Fail /></ErrorBoundary>);
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    rerender(<ErrorBoundary resetKey={1} onRetry={onRetry}><div>New generation</div></ErrorBoundary>);
    await waitFor(()=>expect(screen.getByText('New generation')).toBeTruthy()); expect(onRetry).not.toHaveBeenCalled();
  });
});
