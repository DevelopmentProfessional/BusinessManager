import React, { useState } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { runAppSync } from '../../services/appSync';

export default function PageLayout({ title, error, children }) {
  const rawBuildStamp = typeof __APP_BUILD_TIMESTAMP__ === 'string' ? __APP_BUILD_TIMESTAMP__ : '';
  const buildStamp = rawBuildStamp
    ? rawBuildStamp.replace('T', ' ').replace(/:\d\d\.\d{3}Z$/, 'Z')
    : 'unknown';

  const [syncLoading, setSyncLoading] = useState(false);

  const handleSync = async () => {
    setSyncLoading(true);
    try {
      await runAppSync();
    } finally {
      setSyncLoading(false);
    }
  };

  return (
    <div className="d-flex flex-column overflow-hidden bg-body" style={{ height: '100dvh' }}>
      <div className="flex-shrink-0 border-bottom p-2 bg-body d-flex align-items-center justify-content-between gap-2" style={{ zIndex: 5 }}>
        <h1 className="h4 mb-0 fw-bold text-body-emphasis">{title}</h1>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
          onClick={handleSync}
          disabled={syncLoading}
          title="Sync app"
          aria-label="Sync app"
          style={{ minHeight: '2.5rem' }}
        >
          <ArrowPathIcon className={syncLoading ? 'animate-spin' : ''} style={{ width: 18, height: 18 }} />
          <span style={{ fontSize: '0.65rem', lineHeight: 1 }}>{buildStamp}</span>
        </button>
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
