/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, within, waitFor, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { Landing } from './Landing';
import { TrustStatementModal } from '../components/modals/TrustStatementModal';
import { FOOTER_INFO } from '../content/footerInfoContent';
import { setLang } from '../i18n/translations';

afterEach(() => { cleanup(); setLang('en'); });

describe('homepage institutional statement', () => {
  it.each([
    ['en', 'He that is faithful in that which is least is faithful also in much:', '— Luke 16:10 · King James Version', 'May every opportunity'],
    ['pt', 'Quem é fiel no mínimo também é fiel no muito;', '— Lucas 16:10 · Almeida Revista e Corrigida', 'Que cada oportunidade'],
    ['es', 'El que es fiel en lo muy poco, también en lo más es fiel:', '— Lucas 16:10 · Reina-Valera 1909', 'Que cada oportunidad'],
  ])('uses the selected language and a named traditional translation in %s', (language, quote, reference, principles) => {
    setLang(language); render(<TrustStatementModal onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'IN GOD WE TRUST' });
    expect(dialog.querySelector('article')).toHaveAttribute('lang', language);
    expect(within(dialog).getByText(`“${quote}”`)).toBeVisible();
    expect(within(dialog).getByText(reference)).toBeVisible();
    expect(dialog.querySelector('em').textContent).toContain(principles);
  });
  it('updates the open modal when the user changes language', () => {
    setLang('en'); render(<TrustStatementModal onClose={() => {}} />);
    act(() => setLang('pt'));
    expect(screen.getByText('— Lucas 16:10 · Almeida Revista e Corrigida')).toBeVisible();
    act(() => setLang('es'));
    expect(screen.getByText('— Lucas 16:10 · Reina-Valera 1909')).toBeVisible();
  });
  it.each([['en', 'Company'], ['pt', 'Empresa'], ['es', 'Empresa']])('adds only the last Company item in %s and preserves existing links', (language, heading) => {
    setLang(language);
    render(<Landing />);
    const column = screen.getByText(heading, { exact: true }).parentElement;
    expect(within(column).getAllByRole('button').map(button => button.textContent)).toEqual([
      ...['about', 'howItWorks', 'security', 'support'].map(key => FOOTER_INFO[language][key].title), 'IN GOD WE TRUST ✝',
    ]);
    expect(document.querySelectorAll('footer')).toHaveLength(1);
  }, 20000);

  it('opens the exact statement, traps focus, closes with Escape and X, and restores trigger focus', async () => {
    setLang('en');
    function Harness() { const [open, setOpen] = React.useState(false); return <><button onClick={() => setOpen(true)}>IN GOD WE TRUST ✝</button>{open ? <TrustStatementModal onClose={() => setOpen(false)} /> : null}</>; }
    render(<Harness />);
    const user = userEvent.setup();
    const trigger = screen.getByRole('button', { name: 'IN GOD WE TRUST ✝' });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'IN GOD WE TRUST' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByRole('heading', { name: 'IN GOD WE TRUST' })).toBeVisible();
    expect(within(dialog).getByText('“He that is faithful in that which is least is faithful also in much:”')).toBeVisible();
    expect(within(dialog).getByText('— Luke 16:10 · King James Version')).toBeVisible();
    expect(within(dialog).getByText('May every opportunity, transaction and relationship conducted through DealSifter be guided by integrity, stewardship and respect for others.').tagName).toBe('EM');
    const close = within(dialog).getByRole('button', { name: 'Close dialog' });
    await waitFor(() => expect(close).toHaveFocus());
    await user.tab(); expect(close).toHaveFocus();
    await user.tab({ shift: true }); expect(close).toHaveFocus();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument()); expect(trigger).toHaveFocus();
    await user.click(trigger); await user.click(screen.getByRole('button', { name: 'Close dialog' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument()); expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe('');
  }, 20000);
});
