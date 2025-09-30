import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { documentsAPI } from '../services/api';

// Simple utility to load the OnlyOffice script once
function loadOnlyOfficeScript(onlyofficeUrl) {
  const url = `${onlyofficeUrl.replace(/\/+$/, '')}/web-apps/apps/api/documents/api.js`;
  return new Promise((resolve, reject) => {
    if (window.DocsAPI) return resolve(window.DocsAPI);
    // Check if script already in DOM
    const existing = Array.from(document.getElementsByTagName('script')).find(s => s.src === url);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.DocsAPI));
      existing.addEventListener('error', () => reject(new Error('Failed to load OnlyOffice script')));
      return;
    }
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.onload = () => resolve(window.DocsAPI);
    script.onerror = () => reject(new Error('Failed to load OnlyOffice script'));
    document.head.appendChild(script);
  });
}

export default function OnlyOfficeEditor({ documentId }) {
  const containerId = useMemo(() => `onlyoffice-editor-${documentId}-${Math.random().toString(36).slice(2)}`, [documentId]);
  const editorRef = useRef(null);
  const connectorRef = useRef(null);
  const initializedRef = useRef(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [docType, setDocType] = useState(null);
  const [saving, setSaving] = useState(false);

  const ONLYOFFICE_URL = (import.meta.env.VITE_ONLYOFFICE_URL || '').trim();

  useLayoutEffect(() => {
    let canceled = false;

    if (!ONLYOFFICE_URL) {
      setError('OnlyOffice server URL is not configured. Set VITE_ONLYOFFICE_URL in your environment.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    Promise.all([
      loadOnlyOfficeScript(ONLYOFFICE_URL),
      documentsAPI.onlyofficeConfig(documentId).then(r => r.data),
    ])
      .then(([DocsAPI, cfg]) => {
        if (canceled) return;
        // Ensure full-size editor
        const merged = { ...cfg, width: '100%', height: '100%' };
        setDocType(cfg?.documentType || null);
        // Inject helpful events without clobbering existing ones
        merged.events = {
          ...(cfg.events || {}),
          // Avoid triggering React re-render at a sensitive time; defer loading=false
          onReady: () => {
            // Try to create Automation API connector when editor is ready
            try {
              if (editorRef.current && typeof editorRef.current.createConnector === 'function') {
                connectorRef.current = editorRef.current.createConnector();
              }
            } catch (err) {
              console.warn('OnlyOffice connector unavailable:', err);
            }
            setTimeout(() => { if (!canceled) setLoading(false); }, 0);
          },
          onError: (e) => setError(`OnlyOffice error: ${typeof e === 'string' ? e : JSON.stringify(e)}`),
        };
        // Instantiate after DOM available in next microtask
        queueMicrotask(() => {
          try {
            if (canceled) return;
            if (initializedRef.current) return;
            editorRef.current = new DocsAPI.DocEditor(containerId, merged);
            initializedRef.current = true;
          } catch (e) {
            console.error(e);
            setError('Failed to initialize OnlyOffice editor. Check console for details.');
            setLoading(false);
          }
        });
      })
      .catch((e) => {
        if (canceled) return;
        console.error(e);
        setError(e?.message || 'Failed to load OnlyOffice editor.');
        setLoading(false);
      });

    return () => {
      canceled = true;
      try {
        if (editorRef.current && typeof editorRef.current.destroyEditor === 'function') {
          editorRef.current.destroyEditor();
        }
      } catch (e) {
        // ignore
      } finally {
        editorRef.current = null;
        connectorRef.current = null;
        initializedRef.current = false;
      }
    };
  }, [documentId, containerId, ONLYOFFICE_URL]);

  // Ribbon actions
  const hasConnector = !!connectorRef.current;
  const buttonsDisabled = loading || !hasConnector;

  const handleUndo = () => {
    try {
      connectorRef.current?.executeMethod?.('Undo');
    } catch (e) {
      console.warn('Undo not supported:', e);
    }
  };

  const handleRedo = () => {
    try {
      connectorRef.current?.executeMethod?.('Redo');
    } catch (e) {
      console.warn('Redo not supported:', e);
    }
  };

  const handleBold = () => {
    if (!hasConnector) return;
    try {
      if (docType === 'word' || docType === 'slide' || !docType) {
        // Attempt Text Document API style change
        connectorRef.current.executeMethod('ChangeTextPr', [{ b: true }]);
      } else if (docType === 'cell') {
        // Spreadsheet: attempt SetBold on selection
        connectorRef.current.executeMethod('SetBold', [true]);
      }
    } catch (e1) {
      // Fallback attempts
      try {
        connectorRef.current.executeMethod('SetBold', [true]);
      } catch (e2) {
        console.warn('Bold not supported in this document/editor:', e2);
      }
    }
  };

  const handleItalic = () => {
    if (!hasConnector) return;
    try {
      if (docType === 'word' || docType === 'slide' || !docType) {
        connectorRef.current.executeMethod('ChangeTextPr', [{ i: true }]);
      } else if (docType === 'cell') {
        connectorRef.current.executeMethod('SetItalic', [true]);
      }
    } catch (e1) {
      try {
        connectorRef.current.executeMethod('SetItalic', [true]);
      } catch (e2) {
        console.warn('Italic not supported in this document/editor:', e2);
      }
    }
  };

  const handleSave = async () => {
    if (!hasConnector || saving) return;
    setSaving(true);
    try {
      // Trigger OnlyOffice to save; backend callback will persist the file
      connectorRef.current?.executeMethod?.('Save');
      // Provide brief visual feedback even though save is async via callback
      setTimeout(() => setSaving(false), 1200);
    } catch (e) {
      console.warn('Save not supported:', e);
      setSaving(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      {error ? (
        <div className="p-4 text-sm text-red-700 bg-red-50 border border-red-200">
          {error}
        </div>
      ) : null}
      {loading && !error ? (
        <div className="p-3 text-sm text-gray-600">Loading editor…</div>
      ) : null}
      {/* UI Ribbon */}
      <div className="border-b bg-gray-50 px-2 py-1 flex items-center gap-2">
        <button
          type="button"
          className="px-2 py-1 text-sm rounded border bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Bold"
          disabled={buttonsDisabled}
          onClick={handleBold}
        >
          B
        </button>
        <button
          type="button"
          className="px-2 py-1 text-sm rounded border bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed italic"
          title="Italic"
          disabled={buttonsDisabled}
          onClick={handleItalic}
        >
          I
        </button>
        <div className="w-px h-5 bg-gray-200 mx-1" />
        <button
          type="button"
          className="px-2 py-1 text-sm rounded border bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Undo"
          disabled={buttonsDisabled}
          onClick={handleUndo}
        >
          Undo
        </button>
        <button
          type="button"
          className="px-2 py-1 text-sm rounded border bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Redo"
          disabled={buttonsDisabled}
          onClick={handleRedo}
        >
          Redo
        </button>
        <div className="w-px h-5 bg-gray-200 mx-1" />
        <button
          type="button"
          className="px-2 py-1 text-sm rounded border bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-green-700"
          title="Save"
          disabled={buttonsDisabled || saving}
          onClick={handleSave}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      <div id={containerId} className="flex-1" style={{ width: '100%', height: '100%', minHeight: 0 }} />
    </div>
  );
}
