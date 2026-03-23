import React from 'react';

/**
 * PageErrorBoundary — catches render-phase errors in any child component tree
 * and shows a recovery UI instead of a blank white page.
 *
 * Usage:
 *   <PageErrorBoundary>
 *     <SomePage />
 *   </PageErrorBoundary>
 */
export default class PageErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[PageErrorBoundary] Render error:', error, info.componentStack);
  }

  handleReload() {
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="d-flex flex-column align-items-center justify-content-center text-center p-5" style={{ minHeight: '60vh' }}>
          <div className="mb-3" style={{ fontSize: '2.5rem' }}>⚠</div>
          <h4 className="fw-semibold mb-2">Something went wrong on this page</h4>
          <p className="text-muted small mb-1" style={{ maxWidth: 480 }}>
            An unexpected error occurred. This is usually a temporary issue.
            Try reloading or navigating back.
          </p>
          {this.state.error?.message && (
            <pre
              className="bg-light border rounded p-2 text-danger small text-start mt-2"
              style={{ maxWidth: 560, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
            >
              {this.state.error.message}
            </pre>
          )}
          <div className="d-flex gap-2 mt-3">
            <button
              className="btn btn-primary btn-sm"
              onClick={() => this.handleReload()}
            >
              Try Again
            </button>
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={() => { window.history.back(); this.handleReload(); }}
            >
              Go Back
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
