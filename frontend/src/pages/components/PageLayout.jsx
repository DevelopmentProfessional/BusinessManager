import React from 'react';

export default function PageLayout({ title, error, children }) {
  return (
    <div className="d-flex flex-column overflow-hidden bg-body" style={{ height: 'var(--vvp-height, 100dvh)' }}>
      <div className="flex-shrink-0 border-bottom p-2 bg-body" style={{ zIndex: 5 }}>
        <h1 className="h4 mb-0 fw-bold text-body-emphasis">{title}</h1>
      </div>
      {error && (
        <div className="flex-shrink-0 alert alert-danger border-0 rounded-0 m-0 py-2">
          {error}
        </div>
      )}
      <div className="flex-grow-1 d-flex flex-column overflow-hidden">
        {children}
      </div>
    </div>
  );
}
