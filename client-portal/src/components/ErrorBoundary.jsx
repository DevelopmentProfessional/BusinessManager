import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, errorMessage: '' }
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unexpected client portal error.',
    }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Client portal error boundary caught an error:', error, errorInfo)
  }

  handleReload = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        await Promise.all(registrations.map((registration) => registration.unregister()))
      }
      if ('caches' in window) {
        const cacheKeys = await caches.keys()
        await Promise.all(cacheKeys.map((key) => caches.delete(key)))
      }
    } catch (error) {
      console.warn('Failed to clear client portal caches during recovery.', error)
    }

    window.location.reload()
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div className="min-h-screen bg-gray-50 d-flex align-items-center justify-content-center px-4">
        <div className="bg-white shadow-sm rounded-4 border border-gray-200 p-4 p-md-5 text-center" style={{ maxWidth: 520, width: '100%' }}>
          <h1 className="h4 fw-bold text-dark mb-2">Client Portal Failed To Load</h1>
          <p className="text-muted mb-3">
            The app hit a startup error. This is usually caused by stale cached files after a deployment.
          </p>
          <div className="small text-danger bg-red-50 border border-red-200 rounded-3 p-3 mb-3 text-break">
            {this.state.errorMessage}
          </div>
          <button type="button" className="btn btn-primary" onClick={this.handleReload}>
            Clear Cached App And Reload
          </button>
        </div>
      </div>
    )
  }
}
