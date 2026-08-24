import React from 'react';

function titleize(code) {
  return String(code || '')
    .replace(/_[0-9a-f]{8}-[0-9a-f-]{27,}$/i, '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatCheckpoint(value, language) {
  const timestamp = Date.parse(String(value || ''));
  if (!Number.isFinite(timestamp)) return '';
  try {
    return new Intl.DateTimeFormat(language === 'pt' ? 'pt-BR' : language === 'es' ? 'es' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toISOString();
  }
}

function CodeList({ items = [], emptyLabel = '' }) {
  if (!items.length) return emptyLabel ? <span>{emptyLabel}</span> : null;
  return (
    <ul className="maxxis-memory-list">
      {items.map((item) => (
        <li key={typeof item === 'string' ? item : `${item.category}-${item.code}`}>
          {titleize(typeof item === 'string' ? item : item.code)}
        </li>
      ))}
    </ul>
  );
}

export function MaxxisDealMemoryCard({ message, language = 'en', onConfirmForget, onCancelForget }) {
  const data = message?.data || {};
  if (message?.type === 'deal_memory_forget_confirmation') {
    return (
      <section className="maxxis-memory-card maxxis-memory-confirmation" data-testid="maxxis-memory-forget-confirmation" aria-label={data.title}>
        <strong>{data.title}</strong>
        <span>{data.body}</span>
        <div className="maxxis-memory-actions">
          <button type="button" className="maxxis-memory-forget" data-testid="maxxis-memory-forget-confirm" onClick={() => onConfirmForget?.(message)}>
            {data.confirmLabel}
          </button>
          <button type="button" className="maxxis-memory-keep" data-testid="maxxis-memory-forget-cancel" onClick={() => onCancelForget?.(message)}>
            {data.cancelLabel}
          </button>
        </div>
      </section>
    );
  }
  if (message?.type !== 'deal_memory_recall') return null;
  const labels = data.labels || {};
  return (
    <section className="maxxis-memory-card" data-testid="maxxis-memory-recall" data-freshness={data.freshness || 'missing'} aria-label={message.content}>
      {data.lastReviewedAt ? (
        <div>
          <strong>{labels.previous}</strong>
          <span>{formatCheckpoint(data.lastReviewedAt, language)}</span>
          <small>{titleize(data.freshness)}</small>
        </div>
      ) : null}
      {data.whatWasOpenCodes?.length ? (
        <div data-testid="maxxis-memory-previous-open">
          <strong>{labels.open}</strong>
          <CodeList items={data.whatWasOpenCodes} />
        </div>
      ) : null}
      <div data-testid="maxxis-memory-changes">
        <strong>{labels.changed}</strong>
        <CodeList items={data.whatChanged || []} emptyLabel={data.noMeaningfulChanges ? labels.noChanges : ''} />
      </div>
      {data.currentOpenCodes?.length ? (
        <div data-testid="maxxis-memory-current-open">
          <strong>{labels.stillOpen || labels.open}</strong>
          <CodeList items={data.currentOpenCodes} />
        </div>
      ) : null}
      {data.currentNextStepCode ? (
        <div data-testid="maxxis-memory-next-step">
          <strong>{labels.next}</strong>
          <span>{titleize(data.currentNextStepCode)}</span>
        </div>
      ) : null}
    </section>
  );
}

export default MaxxisDealMemoryCard;
