import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../ui/Icon';
import { getLang } from '../../i18n/translations';
import { C } from '../../theme/colors';
import { MAXXIS_WIDGET_POSITION_KEY } from '../../lib/localStoragePolicy';
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
    exportAnalysisPdf: 'Export analysis PDF',
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
    exportAnalysisPdf: 'Exportar PDF da analise',
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
    exportAnalysisPdf: 'Exportar PDF del analisis',
    scope: 'Maxxis ayuda con uso de la app, Tax Deeds, Wholesale y flujos de DealSifter.',
  },
};

const ACTION_DEFINITIONS = {
  feed: {
    en: 'Open Feed',
    pt: 'Abrir Feed',
    es: 'Abrir Feed',
  },
  mapview: {
    en: 'Open MapView',
    pt: 'Abrir MapView',
    es: 'Abrir MapView',
  },
  matches: {
    en: 'Open Matches',
    pt: 'Abrir Matches',
    es: 'Abrir Matches',
  },
  pricing: {
    en: 'Open Pricing',
    pt: 'Abrir Pricing',
    es: 'Abrir Pricing',
  },
  onboarding: {
    en: 'Create or edit cards',
    pt: 'Criar ou editar cards',
    es: 'Crear o editar cards',
  },
  settings: {
    en: 'Open Settings',
    pt: 'Abrir Configuracoes',
    es: 'Abrir Configuracion',
  },
  profile: {
    en: 'Open Profile',
    pt: 'Abrir Perfil',
    es: 'Abrir Perfil',
  },
  notifications: {
    en: 'Open Notifications',
    pt: 'Abrir Notificacoes',
    es: 'Abrir Notificaciones',
  },
  support: {
    en: 'Open Support Chat',
    pt: 'Abrir Suporte',
    es: 'Abrir Soporte',
  },
  admin: {
    en: 'Open Admin System',
    pt: 'Abrir Adm.System',
    es: 'Abrir Adm.System',
  },
};

const ACTION_TOKEN_RE = /\[\[action:([a-z0-9_-]+)\|([^\]]{1,90})\]\]/gi;

function getUiLang() {
  const lang = String(getLang?.() || 'en').slice(0, 2).toLowerCase();
  return ['en', 'pt', 'es'].includes(lang) ? lang : 'en';
}

function normalizeActionId(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/_/g, '-');
  if (normalized === 'map' || normalized === 'map-view') return 'mapview';
  if (normalized === 'new-card' || normalized === 'cards' || normalized === 'onboard') return 'onboarding';
  if (normalized === 'preferences' || normalized === 'privacy' || normalized === 'payments') return 'settings';
  return ACTION_DEFINITIONS[normalized] ? normalized : null;
}

function getActionLabel(actionId, label, language) {
  const cleanLabel = String(label || '').replace(/\s+/g, ' ').trim();
  if (cleanLabel) return cleanLabel.slice(0, 90);
  return ACTION_DEFINITIONS[actionId]?.[language] || ACTION_DEFINITIONS[actionId]?.en || 'Open';
}

function parseActionContent(content, language) {
  const actions = [];
  const text = String(content || '').replace(ACTION_TOKEN_RE, (_match, rawAction, rawLabel) => {
    const actionId = normalizeActionId(rawAction);
    if (actionId) {
      actions.push({
        id: actionId,
        label: getActionLabel(actionId, rawLabel, language),
      });
    }
    return '';
  }).replace(/\n{3,}/g, '\n\n').trim();

  const dedupedActions = [];
  const seen = new Set();
  actions.forEach((action) => {
    if (!action?.id || seen.has(action.id)) return;
    seen.add(action.id);
    dedupedActions.push(action);
  });

  return { text, actions: dedupedActions.slice(0, 3) };
}

function stripActionTokens(content) {
  return String(content || '').replace(ACTION_TOKEN_RE, '').replace(/\s+/g, ' ').trim();
}

function formatTime(date) {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(date);
  } catch {
    return '';
  }
}

function getViewportBounds() {
  if (typeof window === 'undefined') return { width: 0, height: 0 };
  return {
    width: window.innerWidth || document.documentElement?.clientWidth || 0,
    height: window.innerHeight || document.documentElement?.clientHeight || 0,
  };
}

function clampWidgetPosition(position) {
  const { width, height } = getViewportBounds();
  if (!width || !height || !position) return null;
  const size = width <= 767 ? 58 : 62;
  const margin = 8;
  return {
    x: Math.min(Math.max(Number(position.x) || margin, margin), Math.max(margin, width - size - margin)),
    y: Math.min(Math.max(Number(position.y) || margin, margin), Math.max(margin, height - size - margin)),
  };
}

function readStoredWidgetPosition() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(MAXXIS_WIDGET_POSITION_KEY);
    if (!raw) return null;
    return clampWidgetPosition(JSON.parse(raw));
  } catch {
    return null;
  }
}

function MessageBubble({ message, language, onAction, onExportAnalysisPdf, exportAnalysisLabel }) {
  const isUser = message.role === 'user';
  const { text, actions } = isUser
    ? { text: String(message.content || ''), actions: [] }
    : parseActionContent(message.content, language);
  return (
    <div className={`maxxis-message ${isUser ? 'maxxis-message-user' : 'maxxis-message-assistant'} ${message.error ? 'maxxis-message-error' : ''}`}>
      {text ? (
        <div className="maxxis-message-body">
          {String(text || '').split('\n').map((line, index, arr) => (
            <React.Fragment key={`${message.id}-line-${index}`}>
              {line}
              {index < arr.length - 1 ? <br /> : null}
            </React.Fragment>
          ))}
        </div>
      ) : null}
      {actions.length ? (
        <div className="maxxis-action-links" aria-label="Maxxis navigation actions">
          {actions.map((action) => (
            <button
              type="button"
              key={`${message.id}-${action.id}`}
              className="maxxis-action-link"
              onClick={() => onAction?.(action.id)}
            >
              <span>{action.label}</span>
              <Icon name="arrowRight" size={13} color="currentColor" strokeWidth={2.1} />
            </button>
          ))}
        </div>
      ) : null}
      {message.analysisExport ? (
        <div className="maxxis-action-links" aria-label="Maxxis analysis export">
          <button
            type="button"
            className="maxxis-action-link maxxis-analysis-export"
            onClick={() => onExportAnalysisPdf?.(message.analysisExport, message.content)}
          >
            <span>{exportAnalysisLabel}</span>
            <Icon name="doc" size={13} color="currentColor" strokeWidth={2.1} />
          </button>
        </div>
      ) : null}
      <div className="maxxis-message-meta">{formatTime(message.createdAt)}</div>
    </div>
  );
}

export function MaxxisAssistant({ page = 'dashboard', onOpenSupport = null, onNavigateAction = null, propertyAnalysisRequest = null, onExportAnalysisPdf = null, enabled = true }) {
  const language = getUiLang();
  const t = COPY[language] || COPY.en;
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [widgetPosition, setWidgetPosition] = useState(readStoredWidgetPosition);
  const [dragging, setDragging] = useState(false);
  const [messages, setMessages] = useState(() => [{
    id: 'maxxis-greeting',
    role: 'assistant',
    content: getMaxxisGreeting(language),
    createdAt: new Date(),
  }]);
  const endRef = useRef(null);
  const handledAnalysisRequestsRef = useRef(new Set());
  const dragRef = useRef({
    active: false,
    moved: false,
    pointerId: null,
    offsetX: 0,
    offsetY: 0,
    startX: 0,
    startY: 0,
  });

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

  useEffect(() => {
    const handleResize = () => {
      setWidgetPosition((prev) => {
        const next = clampWidgetPosition(prev);
        if (!next) return prev;
        try {
          window.localStorage.setItem(MAXXIS_WIDGET_POSITION_KEY, JSON.stringify(next));
        } catch {
          // UI preference persistence is best-effort.
        }
        return next;
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handlePointerMove = (event) => {
      const drag = dragRef.current;
      if (!drag.active || drag.pointerId !== event.pointerId) return;
      const deltaX = Math.abs(event.clientX - drag.startX);
      const deltaY = Math.abs(event.clientY - drag.startY);
      if (deltaX > 4 || deltaY > 4) {
        drag.moved = true;
        setDragging(true);
      }
      if (!drag.moved) return;
      event.preventDefault();
      persistWidgetPosition({
        x: event.clientX - drag.offsetX,
        y: event.clientY - drag.offsetY,
      });
    };

    const handlePointerUp = (event) => {
      const drag = dragRef.current;
      if (!drag.active || drag.pointerId !== event.pointerId) return;
      dragRef.current = { ...drag, active: false };
      window.setTimeout(() => setDragging(false), 0);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, []);

  const trimmedInput = input.trim();
  const canSend = Boolean(trimmedInput && !loading);

  const historyForRequest = useMemo(
    () => messages
      .filter((item) => item.id !== 'maxxis-greeting' && !item.error)
      .map((item) => ({ role: item.role, content: stripActionTokens(item.content) })),
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

  const persistWidgetPosition = (position) => {
    const next = clampWidgetPosition(position);
    if (!next) return;
    setWidgetPosition(next);
    try {
      window.localStorage.setItem(MAXXIS_WIDGET_POSITION_KEY, JSON.stringify(next));
    } catch {
      // UI preference persistence is best-effort.
    }
  };

  const handleFabPointerDown = (event) => {
    if (open || event.button > 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      active: true,
      moved: false,
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      startX: event.clientX,
      startY: event.clientY,
    };
  };

  const handleAction = (actionId) => {
    const normalized = normalizeActionId(actionId);
    if (!normalized) return;
    setOpen(false);
    if (normalized === 'support') {
      onOpenSupport?.();
      return;
    }
    onNavigateAction?.(normalized);
  };

  const submitMessage = async (messageText, meta = {}) => {
    const cleanMessage = String(messageText || '').trim();
    if (!cleanMessage || loading) return;
    const userMessage = {
      id: `maxxis-user-${Date.now()}`,
      role: 'user',
      content: cleanMessage,
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const result = await sendMaxxisMessage({
        message: cleanMessage,
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
        analysisExport: result.unavailable ? null : (meta.analysisExport || null),
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

  const submit = async () => {
    if (!canSend) return;
    await submitMessage(trimmedInput);
  };

  useEffect(() => {
    const requestId = String(propertyAnalysisRequest?.id || '').trim();
    const prompt = String(propertyAnalysisRequest?.prompt || '').trim();
    if (!requestId || !prompt || handledAnalysisRequestsRef.current.has(requestId)) return;
    handledAnalysisRequestsRef.current.add(requestId);
    setOpen(true);
    setInput('');
    void submitMessage(prompt, {
      analysisExport: {
        requestId,
        title: propertyAnalysisRequest?.title || '',
        property: propertyAnalysisRequest?.property || null,
        onExportPdf: propertyAnalysisRequest?.onExportPdf || null,
      },
    });
  }, [propertyAnalysisRequest?.id]);

  if (!enabled) return null;

  return (
    <div className={`maxxis-shell ${open ? 'maxxis-shell-open' : ''}`}>
      {open ? (
        <section className="maxxis-panel" aria-label={t.title}>
          <header className="maxxis-header">
            <div className="maxxis-avatar" aria-hidden="true">
              <img src={maxxisLogo} alt="" draggable="false" />
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
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                language={language}
                onAction={handleAction}
                onExportAnalysisPdf={onExportAnalysisPdf}
                exportAnalysisLabel={t.exportAnalysisPdf}
              />
            ))}
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
              rows={2}
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

      {!open ? (
        <button
          type="button"
          className={`maxxis-fab ${dragging ? 'maxxis-fab-dragging' : ''}`}
          onPointerDown={handleFabPointerDown}
          onClick={(event) => {
            if (dragRef.current.moved) {
              event.preventDefault();
              dragRef.current = { ...dragRef.current, moved: false };
              return;
            }
            setOpen(true);
          }}
          aria-label={t.open}
          title={t.open}
          style={{
            '--maxxis-accent': C.accent,
            ...(widgetPosition ? {
              left: `${widgetPosition.x}px`,
              top: `${widgetPosition.y}px`,
              right: 'auto',
              bottom: 'auto',
            } : {}),
          }}
        >
          <img className="maxxis-fab-logo" src={maxxisLogo} alt="" aria-hidden="true" draggable="false" />
          <span>AI</span>
        </button>
      ) : null}
    </div>
  );
}

export default MaxxisAssistant;
