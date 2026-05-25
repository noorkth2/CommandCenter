import React from 'react';

/**
 * Top-level Error Boundary — catches any unhandled React render errors
 * and shows a visible error panel instead of a blank/black screen.
 * In production, this is critical for diagnosing silent crashes.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] React render error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo?.componentStack);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          background: '#0e0e10',
          color: '#e8e6f0',
          padding: '40px',
          height: '100vh',
          fontFamily: 'monospace',
          boxSizing: 'border-box',
          overflowY: 'auto',
        }}>
          <div style={{
            maxWidth: '700px',
            margin: '0 auto',
            border: '1px solid rgba(232,93,74,0.3)',
            borderRadius: '10px',
            padding: '28px',
            background: 'rgba(232,93,74,0.05)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <span style={{ fontSize: '20px' }}>⚠️</span>
              <h2 style={{ margin: 0, color: '#e85d4a', fontSize: '16px', fontWeight: 600 }}>
                Application Error
              </h2>
            </div>
            <p style={{ color: '#8a8799', fontSize: '12px', marginBottom: '16px', lineHeight: '1.6' }}>
              The application encountered an unexpected error and could not render. 
              Press <strong style={{ color: '#e8e6f0' }}>F12</strong> to open DevTools and see the full error trace.
            </p>
            <pre style={{
              color: '#e85d4a',
              fontSize: '11px',
              background: '#16161a',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '6px',
              padding: '14px',
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              marginBottom: '12px',
            }}>
              {this.state.error?.toString()}
            </pre>
            {this.state.errorInfo?.componentStack && (
              <details>
                <summary style={{ color: '#5a5870', fontSize: '11px', cursor: 'pointer', marginBottom: '8px' }}>
                  Component Stack
                </summary>
                <pre style={{
                  color: '#5a5870',
                  fontSize: '10px',
                  background: '#16161a',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '6px',
                  padding: '12px',
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: '16px',
                padding: '8px 16px',
                background: 'rgba(91,106,248,0.15)',
                border: '1px solid rgba(91,106,248,0.3)',
                borderRadius: '6px',
                color: '#5b6af8',
                fontSize: '12px',
                cursor: 'pointer',
                fontFamily: 'monospace',
              }}
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
