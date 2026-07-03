import React from 'react';
import { getT } from '../../i18n/translations';

const reportError = (error, info) => {
  if (typeof window.__DS_REPORT_ERROR === 'function') {
    try { window.__DS_REPORT_ERROR(error, info); } catch { /* no-op */ }
  }
};

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, resetKey: 0 };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    const scope = this.props.scope || 'app';
    this.setState({ errorInfo });
    reportError(error, { ...errorInfo, scope });

    try {
      window.localStorage.setItem('ds_last_error_boundary', JSON.stringify({
        scope,
        message: String(error?.message || 'Unknown error').slice(0, 240),
        at: new Date().toISOString(),
      }));
    } catch {
      // Diagnostic cache is best-effort only.
    }

    if (import.meta.env.PROD) {
      console.error('[ErrorBoundary]', scope, error?.message || 'Unknown error');
    } else {
      console.error('[ErrorBoundary]', scope, error, errorInfo);
    }
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.handleReset();
    }
  }

  handleReset = () => {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      errorInfo: null,
      resetKey: prev.resetKey + 1,
    }));
  };

  render() {
    if (this.state.hasError) {
      const isDev = import.meta.env.DEV;
      const scope = this.props.scope || 'app';
      const t = getT().errorBoundary || {};

      return (
        <div style={{
          padding: '40px 24px',
          color: 'var(--t1, #e0e0e0)',
          background: 'var(--bg, #0f0f1a)',
          minHeight: this.props.compact ? '320px' : '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          gap: 16,
        }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>!</div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>{t.title || 'Something went wrong'}</h2>
          {scope !== 'app' && (
            <div style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 0,
              color: 'var(--t3, #777)',
              textTransform: 'uppercase',
            }}>
              {scope}
            </div>
          )}
          <p style={{
            color: 'var(--t2, #999)',
            fontSize: 14,
            maxWidth: 400,
            lineHeight: '1.5',
            margin: 0,
          }}>
            {t.body || 'An unexpected error occurred. You can try again or reload the page.'}
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
              <summary style={{ cursor: 'pointer', fontWeight: 700, marginBottom: 8 }}>{t.devDetails || 'Error details (dev)'}</summary>
              <div>{String(this.state.error)}</div>
              {this.state.errorInfo?.componentStack && (
                <div style={{ marginTop: 8, fontSize: 11, opacity: 0.7 }}>{this.state.errorInfo.componentStack}</div>
              )}
            </details>
          )}
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button
              type="button"
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
              {t.tryAgain || 'Try again'}
            </button>
            <button
              type="button"
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
              {t.reload || 'Reload page'}
            </button>
          </div>
        </div>
      );
    }

    return <React.Fragment key={this.state.resetKey}>{this.props.children}</React.Fragment>;
  }
}
