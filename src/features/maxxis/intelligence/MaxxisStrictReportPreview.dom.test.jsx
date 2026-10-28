// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildMaxxisReportSchema } from '../../../domain/maxxis/maxxisReportSchema';
import * as assets from '../export/reportPreparedAssets';
import * as projection from '../export/reportIntegrityViewModel';
import { MaxxisDealIntelligenceReportPreview } from './MaxxisDealIntelligenceReportPreview';

const schema = () => buildMaxxisReportSchema({ reportType: 'DEAL_INTELLIGENCE', property: {
  id: 'owned-property', address: '4724 W 26th St', city: 'Little Rock', state: 'AR', type: 'SFR', objective: 'Sell',
  price: 90000, capRate: 0, rehab: 0, beds: 3, baths: 2, sqft: 1760,
}, dealIntelligence: { propertyEvidence: { verifiedRecords: [], userProvided: [], unknown: [], conflicts: [] },
  valuationIntelligence: { status: 'ARV_UNAVAILABLE' }, comparableEvidence: { used: [], supporting: [], excluded: [] }, provenance: {} } });

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('real strict inline preview lifecycle', () => {
  it('does not project or mount a closed browser report and memoizes an open report across parent updates', async () => {
    const prepare = vi.spyOn(assets, 'prepareReportAssets').mockResolvedValue([]);
    const build = vi.spyOn(projection, 'buildStrictReportViewModel');
    const input = schema();
    const { container, rerender } = render(<MaxxisDealIntelligenceReportPreview schema={input} language="pt" />);
    expect(container.querySelector('[data-report-page]')).toBeNull(); expect(build).not.toHaveBeenCalled();
    rerender(<MaxxisDealIntelligenceReportPreview schema={input} language="pt" />); expect(build).not.toHaveBeenCalled();
    const details = container.querySelector('details');
    await act(async () => { details.querySelector('summary').click(); });
    await waitFor(() => expect(prepare).toHaveBeenCalledOnce());
    await waitFor(() => expect(build).toHaveBeenCalledTimes(2));
    expect(container.querySelector('[data-report-page]')).not.toBeNull();
    const calls = build.mock.calls.length;
    rerender(<MaxxisDealIntelligenceReportPreview schema={input} language="pt" />); expect(build).toHaveBeenCalledTimes(calls);
    await act(async () => { details.open = false; fireEvent(details, new Event('toggle')); });
    expect(container.querySelector('[data-report-page]')).toBeNull();
  });
  it('prepares photos only after opening details and never during startup/render', async () => {
    const prepare = vi.spyOn(assets, 'prepareReportAssets').mockResolvedValue([]);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('NO_PROVIDER_CALL_ALLOWED'));
    const { container } = render(<MaxxisDealIntelligenceReportPreview schema={schema()} language="pt" />);
    const details = container.querySelector('details');
    expect(prepare).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(details.open).toBe(false);
    await act(async () => { details.open = true; fireEvent(details, new Event('toggle')); });
    await waitFor(() => expect(prepare).toHaveBeenCalled());
    expect(container.textContent).toContain('4724 W 26th St');
    expect(container.textContent).not.toMatch(/annualPropertyTax|MISSING_CAPRATE|\$\s*0|0%/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('cancels pending view refresh safely on close or unmount', async () => {
    let finish;
    const prepare = vi.spyOn(assets, 'prepareReportAssets').mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const error = vi.spyOn(console, 'error');
    const { container, unmount } = render(<MaxxisDealIntelligenceReportPreview schema={schema()} />);
    const details = container.querySelector('details');
    await act(async () => { details.open = true; fireEvent(details, new Event('toggle')); });
    await waitFor(() => expect(prepare).toHaveBeenCalled());
    unmount();
    await act(async () => { finish([]); });
    expect(error).not.toHaveBeenCalled();
  });
});
