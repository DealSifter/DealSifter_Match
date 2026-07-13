import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../ui/Icon';
import { getLang } from '../../i18n/translations';
import { C } from '../../theme/colors';
import { getMaxxisGreeting, sendMaxxisMessage } from '../../services/maxxisService';
import { captureAppException } from '../../lib/observability';
import maxxisLogo from '../../assets/logo.png';
import './MaxxisAssistant.css';

const COPY = {
  en: {
    title: 'Maxxis Assistant',
    status: 'DealSifter guide',
    placeholder: 'Ask about DealSifter, Tax Deeds or Wholesale...',
    send: 'Send',
    reset: 'New conversation',
    close: 'Close',
    open: 'Open Maxxis Assistant',
    support: 'Human support',
    typing: 'Maxxis is thinking...',
    unavailable: 'I had a temporary issue. Please try again or contact human support.',
    scope: 'Maxxis can help with app usage, Tax Deeds, Wholesale and DealSifter workflows.',
  },
  pt: {
    title: 'Assistente Maxxis',
    status: 'Guia do DealSifter',
    placeholder: 'Pergunte sobre DealSifter, Tax Deeds ou Wholesale...',
    send: 'Enviar',
    reset: 'Nova conversa',
    close: 'Fechar',
    open: 'Abrir Assistente Maxxis',
    support: 'Suporte humano',
    typing: 'Maxxis esta pensando...',
    unavailable: 'Tive uma dificuldade temporaria. Tente novamente ou fale com o suporte humano.',
    scope: 'Maxxis ajuda com uso do app, Tax Deeds, Wholesale e fluxos do DealSifter.',
  },
  es: {
    title: 'Asistente Maxxis',
    status: 'Guia de DealSifter',
    placeholder: 'Pregunta sobre DealSifter, Tax Deeds o Wholesale...',
    send: 'Enviar',
    reset: 'Nueva conversacion',
    close: 'Cerrar',
    open: 'Abrir Asistente Maxxis',
    support: 'Soporte humano',
    typing: 'Maxxis esta pensando...',
    unavailable: 'Tuve un problema temporal. Intentalo otra vez o contacta soporte humano.',
    scope: 'Maxxis ayuda con uso de la app, Tax Deeds, Wholesale y flujos de DealSifter.',
  },
};

function getUiLang() {
  const lang = String(getLang?.() || 'en').slice(0, 2).toLowerCase();
  return ['en', 'pt', 'es'].includes(lang) ? lang : 'en';
}

function formatTime(date) {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(date);
  } catch {
    return '';
  }
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  return (
    <div className={`maxxis-message ${isUser ? 'maxxis-message-user' : 'maxxis-message-assistant'} ${message.error ? 'maxxis-message-error' : ''}`}>
      <div className="maxxis-message-body">
        {String(message.content || '').split('\n').map((line, index, arr) => (
          <React.Fragment key={`${message.id}-line-${index}`}>
            {line}
            {index < arr.length - 1 ? <br /> : null}
          </React.Fragment>
        ))}
      </div>
      <div className="maxxis-message-meta">{formatTime(message.createdAt)}</div>
    </div>
  );
}

export function MaxxisAssistant({ page = 'dashboard', onOpenSupport = null, enabled = true }) {
  const language = getUiLang();
  const t = COPY[language] || COPY.en;
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState(() => [{
    id: 'maxxis-greeting',
    role: 'assistant',
    content: getMaxxisGreeting(language),
    createdAt: new Date(),
  }]);
  const endRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading, open]);

  useEffect(() => {
    setMessages((prev) => {
      if (!prev.length || prev[0]?.id !== 'maxxis-greeting') return prev;
      return [{ ...prev[0], content: getMaxxisGreeting(language) }, ...prev.slice(1)];
    });
  }, [language]);

  const trimmedInput = input.trim();
  const canSend = Boolean(trimmedInput && !loading);

  const historyForRequest = useMemo(
    () => messages
      .filter((item) => item.id !== 'maxxis-greeting' && !item.error)
      .map((item) => ({ role: item.role, content: item.content })),
    [messages],
  );

  const resetConversation = () => {
    setMessages([{
      id: `maxxis-greeting-${Date.now()}`,
      role: 'assistant',
      content: getMaxxisGreeting(language),
      createdAt: new Date(),
    }]);
    setInput('');
  };

  const submit = async () => {
    if (!canSend) return;
    const userMessage = {
      id: `maxxis-user-${Date.now()}`,
      role: 'user',
      content: trimmedInput,
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const result = await sendMaxxisMessage({
        message: trimmedInput,
        history: historyForRequest,
        page,
        language,
      });
      setMessages((prev) => [...prev, {
        id: `maxxis-assistant-${Date.now()}`,
        role: 'assistant',
        content: result.answer,
        createdAt: new Date(),
        error: Boolean(result.unavailable),
      }]);
    } catch (error) {
      captureAppException(error, { area: 'maxxis_assistant', page });
      setMessages((prev) => [...prev, {
        id: `maxxis-error-${Date.now()}`,
        role: 'assistant',
        content: t.unavailable,
        createdAt: new Date(),
        error: true,
      }]);
    } finally {
      setLoading(false);
    }
  };

  if (!enabled) return null;

  return (
    <div className={`maxxis-shell ${open ? 'maxxis-shell-open' : ''}`}>
      {open ? (
        <section className="maxxis-panel" aria-label={t.title}>
          <header className="maxxis-header">
            <div className="maxxis-avatar" aria-hidden="true">
              <Icon name="chat" size={18} color="#fff" strokeWidth={2.1} />
            </div>
            <div className="maxxis-heading">
              <strong>{t.title}</strong>
              <span><i />{t.status}</span>
            </div>
            <div className="maxxis-actions">
              <button type="button" onClick={resetConversation} title={t.reset} aria-label={t.reset}>
                <Icon name="rotateCcw" size={15} color="currentColor" strokeWidth={2} />
              </button>
              <button type="button" onClick={() => setOpen(false)} title={t.close} aria-label={t.close}>
                <Icon name="close" size={15} color="currentColor" strokeWidth={2} />
              </button>
            </div>
          </header>

          <div className="maxxis-scope">{t.scope}</div>

          <div className="maxxis-messages">
            {messages.map((message) => <MessageBubble key={message.id} message={message} />)}
            {loading ? (
              <div className="maxxis-message maxxis-message-assistant">
                <div className="maxxis-typing" aria-label={t.typing}>
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            ) : null}
            <div ref={endRef} />
          </div>

          <form
            className="maxxis-input-row"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void submit();
                }
              }}
              placeholder={t.placeholder}
              rows={1}
              disabled={loading}
              maxLength={1800}
            />
            <button type="submit" disabled={!canSend} aria-label={t.send} title={t.send}>
              <Icon name="send" size={16} color="#fff" strokeWidth={2} />
              <span>{t.send}</span>
            </button>
          </form>

          <footer className="maxxis-footer">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onOpenSupport?.();
              }}
            >
              {t.support}
            </button>
          </footer>
        </section>
      ) : null}

      <button
        type="button"
        className="maxxis-fab"
        onClick={() => setOpen((value) => !value)}
        aria-label={t.open}
        title={t.open}
        style={{ '--maxxis-accent': C.accent }}
      >
        {open ? (
          <Icon name="close" size={22} color="#fff" strokeWidth={2.2} />
        ) : (
          <img className="maxxis-fab-logo" src={maxxisLogo} alt="" aria-hidden="true" />
        )}
        {!open ? <span>AI</span> : null}
      </button>
    </div>
  );
}

export default MaxxisAssistant;
