/* @vitest-environment jsdom */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MAXXIS_TARGET_CONDITIONS,
  MaxxisAnalysisGapResolution,
  MaxxisAnalysisGapResolved,
} from './MaxxisAnalysisGapResolution';

afterEach(cleanup);

const benchmarkOptions = MAXXIS_TARGET_CONDITIONS.map((scope, index) => ({
  scope, low: 10000 + index, mid: 20000 + index, high: 30000 + index,
}));

const message = (overrides = {}) => ({
  id: 'gap-1',
  data: {
    propertyId: 'property-1',
    missingUserInputs: ['target_condition', 'rehab_budget'],
    benchmarkOptions,
    ...overrides,
  },
});

describe('Maxxis analysis gap resolution UX', () => {
  it.each(MAXXIS_TARGET_CONDITIONS)('keeps the canonical condition selectable: %s', async (condition) => {
    const user = userEvent.setup();
    render(<MaxxisAnalysisGapResolution message={message()} onResolve={vi.fn()} onDecline={vi.fn()} />);
    await user.selectOptions(screen.getByLabelText('Target condition'), condition);
    expect(screen.getByLabelText('Target condition')).toHaveValue(condition);
  });

  it('starts compact without rendering a numeric rehab field', () => {
    render(<MaxxisAnalysisGapResolution message={message()} />);
    expect(screen.queryByLabelText('Rehab amount')).toBeNull();
    expect(screen.queryByLabelText('Renovation scope (optional)')).toBeNull();
  });

  it('reveals the numeric field only after the user chooses a custom amount', async () => {
    const user = userEvent.setup();
    render(<MaxxisAnalysisGapResolution message={message()} />);
    await user.click(screen.getByRole('button', { name: 'Enter an amount' }));
    expect(screen.getByLabelText('Rehab amount')).toBeVisible();
  });

  it('submits a custom amount exactly once with user-provided provenance', async () => {
    const user = userEvent.setup();
    const onResolve = vi.fn();
    render(<MaxxisAnalysisGapResolution message={message()} onResolve={onResolve} />);
    await user.click(screen.getByRole('button', { name: 'Enter an amount' }));
    await user.type(screen.getByLabelText('Rehab amount'), '25000');
    await user.click(screen.getByRole('button', { name: 'Continue analysis' }));
    expect(onResolve).toHaveBeenCalledTimes(1);
    expect(onResolve.mock.calls[0][1]).toMatchObject({ rehabBudget: 25000, rehabSource: 'USER_PROVIDED' });
  });

  it('continues with a canonical condition when optional rehab is absent', async () => {
    const user = userEvent.setup();
    const onResolve = vi.fn();
    render(<MaxxisAnalysisGapResolution message={message()} onResolve={onResolve} />);
    await user.selectOptions(screen.getByLabelText('Target condition'), 'STANDARD_RENOVATION');
    await user.click(screen.getByRole('button', { name: 'Continue analysis' }));
    expect(onResolve).toHaveBeenCalledWith(expect.any(Object), { targetCondition: 'STANDARD_RENOVATION' });
  });

  it('submits the selected 2026 benchmark and its provenance', async () => {
    const user = userEvent.setup();
    const onResolve = vi.fn();
    render(<MaxxisAnalysisGapResolution message={message()} onResolve={onResolve} />);
    await user.click(screen.getByRole('button', { name: 'Use 2026 state reference' }));
    await user.click(screen.getByRole('button', { name: 'Continue analysis' }));
    expect(onResolve.mock.calls[0][1]).toMatchObject({ rehabBudget: 20000, rehabSource: 'USER_CURATED_REHAB_BENCHMARK_2026' });
  });

  it('updates the benchmark when the target condition changes', async () => {
    const user = userEvent.setup();
    const onResolve = vi.fn();
    render(<MaxxisAnalysisGapResolution message={message()} onResolve={onResolve} />);
    await user.selectOptions(screen.getByLabelText('Target condition'), 'FULL_RENOVATION');
    await user.click(screen.getByRole('button', { name: 'Use 2026 state reference' }));
    await user.click(screen.getByRole('button', { name: 'Continue analysis' }));
    expect(onResolve.mock.calls[0][1]).toMatchObject({ targetCondition: 'FULL_RENOVATION', rehabBudget: 20003 });
  });

  it('continues without rehab through the explicit decline path', async () => {
    const user = userEvent.setup();
    const onDecline = vi.fn();
    render(<MaxxisAnalysisGapResolution message={message()} onDecline={onDecline} />);
    await user.click(screen.getByRole('button', { name: 'Continue without rehab' }));
    await user.click(screen.getByRole('button', { name: 'Continue analysis' }));
    expect(onDecline).toHaveBeenCalledWith(expect.any(Object), ['rehab_budget']);
  });

  it('declines every requested field from the global limitations action', async () => {
    const user = userEvent.setup();
    const onDecline = vi.fn();
    render(<MaxxisAnalysisGapResolution message={message()} onDecline={onDecline} />);
    await user.click(screen.getByRole('button', { name: 'Continue with limitations' }));
    expect(onDecline).toHaveBeenCalledWith(expect.any(Object), ['target_condition', 'rehab_budget']);
  });

  it('reveals and submits optional scope details only on request', async () => {
    const user = userEvent.setup();
    const onResolve = vi.fn();
    render(<MaxxisAnalysisGapResolution message={message({ missingUserInputs: ['target_condition'] })} onResolve={onResolve} />);
    await user.click(screen.getByRole('button', { name: 'Add renovation details' }));
    await user.type(screen.getByLabelText('Renovation scope (optional)'), 'Kitchen and roof');
    await user.click(screen.getByRole('button', { name: 'Continue analysis' }));
    expect(onResolve.mock.calls[0][1]).toMatchObject({ renovationScope: 'Kitchen and roof' });
  });

  it('disables every mutating control while a save is in flight', () => {
    render(<MaxxisAnalysisGapResolution message={message()} busy />);
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Continue with limitations' })).toBeDisabled();
    expect(screen.getByLabelText('Target condition')).toBeDisabled();
  });

  it('keeps an existing rehab amount without forcing it into an input', async () => {
    const user = userEvent.setup();
    const onResolve = vi.fn();
    render(<MaxxisAnalysisGapResolution message={message({ currentRehab: 45000 })} onResolve={onResolve} />);
    expect(screen.getByText(/Current rehab: \$45,000/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Continue analysis' }));
    expect(onResolve.mock.calls[0][1]).not.toHaveProperty('rehabBudget');
  });

  it('collapses resolved information and exposes an accessible edit action', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const resolvedMessage = message({ resolution: { status: 'resolved', values: { targetCondition: 'TURN_KEY', rehabBudget: 12000 }, declinedFields: [] } });
    render(<MaxxisAnalysisGapResolved message={resolvedMessage} language="pt" onEdit={onEdit} />);
    expect(screen.getByText('✓ Condição alvo: Pronto para uso')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Alterar' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
