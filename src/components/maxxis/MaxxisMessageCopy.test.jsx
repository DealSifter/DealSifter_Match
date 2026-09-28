// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageBubble } from './MaxxisCapabilities';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Maxxis assistant response copy control', () => {
  it('copies only the assistant response text and preserves report actions', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const onAction = vi.fn();

    render(
      <MessageBubble
        language="pt"
        message={{
          id: 'analysis-with-report',
          role: 'assistant',
          type: 'deal_insight',
          content: 'Esta é a análise do imóvel.\n\nPróximo passo: validar os comparáveis.\n\n[[action:deal-intelligence|Gerar relatório exportável]]',
        }}
        onAction={onAction}
      />,
    );

    const copyButton = screen.getByRole('button', { name: 'Copiar resposta' });
    expect(screen.getByRole('button', { name: 'Gerar relatório exportável' })).toBeTruthy();

    await user.click(copyButton);

    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText).toHaveBeenCalledWith('Esta é a análise do imóvel.\n\nPróximo passo: validar os comparáveis.');
    expect(screen.getByRole('button', { name: 'Resposta copiada' })).toBeTruthy();
    expect(onAction).not.toHaveBeenCalled();
  });

  it('does not add a copy control to user messages', () => {
    render(
      <MessageBubble
        language="pt"
        message={{ id: 'user-message', role: 'user', content: 'Analise este imóvel.' }}
      />,
    );

    expect(screen.queryByTestId('maxxis-message-copy-button')).toBeNull();
  });
});
