// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FeedOrderingControl } from './FeedOrderingControl';
import { setLang, translations } from '../../i18n/translations';
afterEach(cleanup);
describe('feed ordering selector', () => {
  it.each([['en-US', 'en', 'Highest match'], ['pt-BR', 'pt', 'Maior match'], ['es-ES', 'es', 'Mayor match']])('uses the selected %s language', (locale, key, hint) => {
    setLang(locale);
    const change = vi.fn();
    render(<FeedOrderingControl value="recent" onChange={change} hasPaidPlan={false} />);
    expect(screen.getByRole('option', { name: translations[key].settings.prefSortRecent }).selected).toBe(true);
    expect(screen.getByText(new RegExp(hint))).toBeTruthy();
    expect(screen.getByRole('option', { name: translations[key].settings.prefSortMyCardsFirst }).disabled).toBe(true);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'price_asc' } });
    expect(change).toHaveBeenCalledWith('price_asc');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'my_cards_first' } });
    expect(change).toHaveBeenCalledTimes(1);
  });
});
