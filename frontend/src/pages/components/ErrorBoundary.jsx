import React from "react";

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

  componentDidCatch() {}

  handleReload() {
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="align-items-center d-flex flex-column justify-content-center p-1 text-center" style={{ minHeight: "60vh" }}>
          <div className="mb-3" style={{ fontSize: "2.5rem" }}>
            ⚠
          </div>
          <h4 className="fw-semibold mb-2">Something went wrong on this page</h4>
          <p className="mb-1 small text-muted" style={{ maxWidth: 480 }}>
            An unexpected error occurred. This is usually a temporary issue. Try reloading or navigating back.
          </p>
          {this.state.error?.message && (
            <pre className="bg-light border mt-2 p-0 rounded small text-danger text-start" style={{ maxWidth: 560, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {this.state.error.message}
            </pre>
          )}
          <div className="d-flex gap-2 mt-3">
            <button className="btn btn-primary btn-sm" onClick={() => this.handleReload()}>
              Retry
            </button>
            <button
              className="btn ui-btn-outline-secondary-sm"
              onClick={() => {
                window.history.back();
                this.handleReload();
              }}
            >
              Back
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
