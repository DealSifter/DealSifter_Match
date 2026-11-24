// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SaveButton } from './SaveButton';
afterEach(cleanup);
describe('shared pending save reminder', () => {
  it('tracks pending edits, preserves the handler and clears after the owner confirms saving', () => {
    const save = vi.fn();
    const view = render(<SaveButton className="existing-button" onClick={save}>Save</SaveButton>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.dataset.savePending).toBe('false');
    view.rerender(<SaveButton className="existing-button" dirty onClick={save}>Save</SaveButton>);
    expect(button.classList.contains('is-dirty')).toBe(true);
    expect(button.classList.contains('existing-button')).toBe(true);
    fireEvent.click(button);
    expect(save).toHaveBeenCalledTimes(1);
    expect(button.dataset.savePending).toBe('true');
    view.rerender(<SaveButton onClick={save}>Save</SaveButton>);
    expect(button.classList.contains('is-dirty')).toBe(false);
  });
  it('keeps unsaved state through an in-flight save and prevents disabled clicks', () => {
    const save = vi.fn();
    render(<SaveButton dirty disabled onClick={save}>Saving</SaveButton>);
    const button = screen.getByRole('button', { name: 'Saving' });
    fireEvent.click(button);
    expect(save).not.toHaveBeenCalled();
    expect(button.dataset.savePending).toBe('true');
  });
});
