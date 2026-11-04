// @vitest-environment jsdom
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { webcrypto } from 'node:crypto';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PortfolioDetail } from './MatchesPortfolio';
import { setLang } from '../../i18n/translations';

vi.mock('../../services/propertyIntelligenceService', () => ({ isPropertyIntelligenceId: () => true, fetchPropertyIntelligence: async () => ({ state: 'locked' }) }));
vi.mock('../../services/propertyReportParcelService', () => ({ fetchPropertyReportParcelEvidence: async () => null }));
vi.mock('../../features/maxxis/presentation/reportNarrativePresentation', async () => {
  const { prepareReportAssets } = await import('../../features/maxxis/export/reportPreparedAssets');
  return { prepareReportNarrativePresentation: schema => prepareReportAssets(schema), reportNarrativeCacheKey: () => 'test' };
});
const photo = 'data:image/jpeg;base64,' + readFileSync(resolve('src/assets/maxxis/report-previews/sample-property-photo.jpg')).toString('base64');
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('L1 portfolio button through actual PDF download', () => {
  it('downloads the real one-page PDF even if module Worker creation is blocked', async () => {
    act(() => setLang('en'));
    const Worker = vi.fn(function () { throw new DOMException('Blocked', 'SecurityError'); });
    vi.stubGlobal('Worker', Worker);
    vi.stubGlobal('crypto', { getRandomValues: bytes => webcrypto.getRandomValues(bytes) });
    const createObjectURL = vi.fn(() => 'blob:synthetic-report');
    vi.stubGlobal('URL', Object.assign(class extends URL {}, { createObjectURL, revokeObjectURL: vi.fn() }));
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      expect(this.isConnected).toBe(true);
      expect(this.download).toBe('100_Synthetic_Example_Street.pdf');
    });
    const property = { id: '00000000-0000-4000-8000-000000000001', address: '100 Synthetic Example Street', city: 'Example City', state: 'FL', zip: '00000', type: 'SFR', objective: 'Buy and Hold', price: 231000, beds: 4, baths: 2, sqft: 1780, lot: '7800', description: 'Fictional property description. '.repeat(12), images: [photo], isActive: true };
    const { container } = render(<PortfolioDetail item={property} owner={{ id: 'fixture-owner', name: 'Fixture Publisher', email: 'publisher@example.invalid', phone: '+15550100120' }} isOwnerUnlocked onBack={() => {}} />);
    fireEvent.click(container.querySelector('[data-guide="matches-export"]'));
    fireEvent.click(container.querySelector('.report-action-main'));
    fireEvent.click(container.querySelector('.report-export-panel input[type="checkbox"]'));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(clicked).toHaveBeenCalledOnce(), { timeout: 15000 });
    expect(Worker).toHaveBeenCalledOnce();
    expect(createObjectURL.mock.calls[0][0].type).toBe('application/pdf');
    expect(createObjectURL.mock.calls[0][0].size).toBeGreaterThan(1000);
    expect(screen.queryByRole('alert')).toBeNull();
  }, 30000);
});
