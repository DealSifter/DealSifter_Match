// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const api = vi.hoisted(() => ({ read: vi.fn(), authorize: vi.fn(), disconnect: vi.fn() }));
vi.mock('../../../services/reportMailboxService', () => ({ readReportMailbox: api.read, authorizeReportMailbox: api.authorize, disconnectReportMailbox: api.disconnect }));
import { GmailConnectionPanel } from './GmailConnectionPanel';
beforeEach(() => {
  vi.resetAllMocks();
  api.read.mockResolvedValue({ status: 'DISCONNECTED' });
  api.authorize.mockResolvedValue({ authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth' });
  api.disconnect.mockResolvedValue({ status: 'DISCONNECTED' });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('does not authorize automatically and requires explicit consent', async () => {
  render(<GmailConnectionPanel userId="qa-a" />);
  const button = await screen.findByRole('button', { name: 'Authorize Gmail' });
  await waitFor(() => expect(api.read).toHaveBeenCalledWith('qa-a', 'personal'));
  expect(button.disabled).toBe(true);
  expect(api.authorize).not.toHaveBeenCalled();
});
it('opens only after consent and does not claim connection before the server confirms', async () => {
  const popup = { opener: window, location: { href: '' }, close: vi.fn() };
  vi.spyOn(window, 'open').mockReturnValue(popup);
  render(<GmailConnectionPanel userId="qa-a" />);
  await waitFor(() => expect(screen.getByRole('checkbox').disabled).toBe(false));
  fireEvent.click(screen.getByRole('checkbox'));
  const button = screen.getByRole('button', { name: 'Authorize Gmail' });
  fireEvent.click(button); fireEvent.click(button);
  await waitFor(() => expect(popup.location.href).toContain('accounts.google.com'));
  expect(api.authorize).toHaveBeenCalledExactlyOnceWith('qa-a', true, 'personal');
  expect(popup.opener).toBeNull();
  expect(screen.queryByText(/Connected mailbox:/)).toBeNull();
});
it('collapses confirmed connection details and exposes management only when requested', async () => {
  api.read.mockResolvedValue({ status: 'CONNECTED', mailbox_email: 'synthetic@gmail.com' });
  render(<GmailConnectionPanel userId="qa-a" />);
  await screen.findByText('Gmail connected');
  expect(screen.queryByText('Connected mailbox: synthetic@gmail.com')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Disconnect' })).toBeNull();
  const manage = screen.getByRole('button', { name: 'Manage connection' });
  expect(manage.getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(manage);
  expect(screen.getByText('Connected mailbox: synthetic@gmail.com')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Hide details' }).getAttribute('aria-expanded')).toBe('true');
  expect(api.read).toHaveBeenCalledTimes(1);
  expect(api.authorize).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
  await waitFor(() => expect(api.disconnect).toHaveBeenCalledExactlyOnceWith('qa-a', 'personal'));
  await waitFor(() => expect(screen.queryByText(/Connected mailbox:/)).toBeNull());
});
it('shows reconnection controls when a connection check reports expiry', async () => {
  api.read.mockResolvedValueOnce({ status: 'CONNECTED', mailbox_email: 'synthetic@gmail.com' })
    .mockResolvedValueOnce({ status: 'EXPIRED' });
  render(<GmailConnectionPanel userId="qa-a" />);
  await screen.findByText('Gmail connected');
  fireEvent.click(screen.getByRole('button', { name: 'Manage connection' }));
  fireEvent.click(screen.getByRole('button', { name: 'Check connection' }));
  await screen.findByText('Mailbox not connected or authorization expired.');
  expect(screen.getByRole('checkbox')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Authorize Gmail' }).disabled).toBe(true);
  expect(screen.queryByRole('button', { name: 'Manage connection' })).toBeNull();
});
it('does not authorize if status cannot be verified', async () => {
  api.read.mockRejectedValue(new Error('endpoint unavailable'));
  render(<GmailConnectionPanel userId="qa-a" />);
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('checkbox'));
  expect(screen.getByRole('button', { name: 'Authorize Gmail' }).disabled).toBe(true);
});
it('does not call the backend if the browser blocks the authorization window', async () => {
  vi.spyOn(window, 'open').mockReturnValue(null);
  render(<GmailConnectionPanel userId="qa-a" />);
  await waitFor(() => expect(screen.getByRole('checkbox').disabled).toBe(false));
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Authorize Gmail' }));
  await screen.findByRole('alert');
  expect(api.authorize).not.toHaveBeenCalled();
});
