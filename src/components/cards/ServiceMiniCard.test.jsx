// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ServiceMiniCard } from './ServiceMiniCard';
import { ActivityLine } from '../ui/ActivityLine';
import { setLang } from '../../i18n/translations';
beforeEach(() => setLang('pt-BR'));
afterEach(cleanup);
it('shows the actual service category instead of a bare zero and preserves opening the service', () => {
  const service = { title: 'Custom package', category: 'svc_photo', state: 'FL', price: 0 };
  const open = vi.fn();
  render(<ServiceMiniCard service={service} onOpen={open} />);
  expect(screen.getByText('Fotografia imobiliária')).toBeTruthy();
  expect(screen.getByText('/ FL')).toBeTruthy();
  expect(screen.getByText('Custom package')).toBeTruthy();
  expect(screen.queryByText('0')).toBeNull();
  fireEvent.click(screen.getByRole('button'));
  expect(open).toHaveBeenCalledExactlyOnceWith(service);
});
it('does not round a real service price under $1,000 down to $0K', () => {
  setLang('en-US');
  render(<ServiceMiniCard service={{ title: 'Inspection package', category: 'svc_inspection', price: 125 }} />);
  expect(screen.getByText('$125.00')).toBeTruthy();
  expect(screen.queryByText('$0K')).toBeNull();
});
it('keeps locality in a separate trailing element after all activities', () => {
  render(<ActivityLine values={['ff', 'gc']} location="FL" language="pt-BR" />);
  const locality = screen.getByText('/ FL');
  expect(locality.previousElementSibling.textContent).toBe('Reforma e revenda · Empreiteiro geral');
  expect(locality.parentElement.title).toBe('Reforma e revenda · Empreiteiro geral / FL');
});
