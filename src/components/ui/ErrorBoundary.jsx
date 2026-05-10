import React from 'react';

// Global error reporter — sends to Sentry/external service when configured.
// Replace this stub with a real integration (e.g. Sentry.captureException).
const reportError = (error, info) => {
  if (typeof window.__DS_REPORT_ERROR === 'function') {
    try { window.__DS_REPORT_ERROR(error, info); } catch { /* no-op */ }
  }
};

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    reportError(error, errorInfo);
    // Sanitized production log — no PII
    if (import.meta.env.PROD) {
      console.error('[ErrorBoundary]', error?.message || 'Unknown error');
    } else {
      console.error('[ErrorBoundary]', error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      const isDev = import.meta.env.DEV;
      return (
        <div style={{
          padding: '40px 24px',
          color: 'var(--t1, #e0e0e0)',
          background: 'var(--bg, #0f0f1a)',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          gap: 16,
        }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>⚠️</div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Algo deu errado</h2>
          <p style={{
            color: 'var(--t2, #999)',
            fontSize: 14,
            maxWidth: 400,
            lineHeight: '1.5',
            margin: 0,
          }}>
            Ocorreu um erro inesperado. Você pode tentar recarregar a página ou voltar ao início.
          </p>
          {isDev && this.state.error && (
            <details style={{
              color: 'var(--t3, #666)',
              fontSize: 12,
              whiteSpace: 'pre-wrap',
              textAlign: 'left',
              maxWidth: 600,
              width: '100%',
              border: '1px solid var(--border, #333)',
              borderRadius: 10,
              padding: 12,
              background: 'var(--card, #1a1a2e)',
            }}>
              <summary style={{ cursor: 'pointer', fontWeight: 700, marginBottom: 8 }}>Detalhes do erro (dev)</summary>
              <div>{String(this.state.error)}</div>
              {this.state.errorInfo?.componentStack && (
                <div style={{ marginTop: 8, fontSize: 11, opacity: 0.7 }}>{this.state.errorInfo.componentStack}</div>
              )}
            </details>
          )}
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button
              onClick={this.handleReset}
              style={{
                padding: '10px 20px',
                borderRadius: 10,
                background: 'transparent',
                border: '1px solid var(--border, #333)',
                color: 'var(--t1, #e0e0e0)',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Tentar novamente
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 20px',
                borderRadius: 10,
                background: 'var(--accent, #7c5cfc)',
                border: 'none',
                color: '#fff',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Recarregar página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
