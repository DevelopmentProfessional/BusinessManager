import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { documentsAPI } from "../../services/api";

// Simple utility to load the OnlyOffice script once
function loadOnlyOfficeScript(onlyofficeUrl, timeoutMs = 10000) {
  const url = `${onlyofficeUrl.replace(/\/+$/, "")}/web-apps/apps/api/documents/api.js`;
  return new Promise((resolve, reject) => {
    if (window.DocsAPI) return resolve(window.DocsAPI);

    const existing = Array.from(document.getElementsByTagName("script")).find((s) => s.src === url);
    if (existing) {
      existing.addEventListener("load", () => resolve(window.DocsAPI));
      existing.addEventListener("error", () => reject(new Error("Failed to load OnlyOffice script")));
      return;
    }

    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        reject(new Error(`OnlyOffice script timed out after ${timeoutMs / 1000}s. Server may be starting up.`));
      }
    }, timeoutMs);

    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.onload = () => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        resolve(window.DocsAPI);
      }
    };
    script.onerror = () => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        reject(new Error("Failed to load OnlyOffice script"));
      }
    };
    document.head.appendChild(script);
  });
}

export default function Editor_OnlyOffice({ documentId }) {
  const containerId = useMemo(() => `onlyoffice-editor-${documentId}-${Math.random().toString(36).slice(2)}`, [documentId]);
  const editorRef = useRef(null);
  const connectorRef = useRef(null);
  const initializedRef = useRef(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [docType, setDocType] = useState(null);
  const [saving, setSaving] = useState(false);

  const ONLYOFFICE_URL = (import.meta.env.VITE_ONLYOFFICE_URL || "").trim();

  useLayoutEffect(() => {
    let canceled = false;

    if (!ONLYOFFICE_URL) {
      setError("OnlyOffice server URL is not configured. Set VITE_ONLYOFFICE_URL in your environment.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    Promise.all([loadOnlyOfficeScript(ONLYOFFICE_URL), documentsAPI.onlyofficeConfig(documentId).then((r) => r.data)])
      .then(([DocsAPI, cfg]) => {
        if (canceled) return;
        // Ensure full-size editor
        const merged = { ...cfg, width: "100%", height: "100%" };
        setDocType(cfg?.documentType || null);
        // Inject helpful events without clobbering existing ones
        merged.events = {
          ...(cfg.events || {}),
          // Avoid triggering React re-render at a sensitive time; defer loading=false
          onReady: () => {
            // Try to create Automation API connector when editor is ready
            try {
              if (editorRef.current && typeof editorRef.current.createConnector === "function") {
                connectorRef.current = editorRef.current.createConnector();
              }
            } catch (err) {
              console.warn("OnlyOffice connector unavailable:", err);
            }
            setTimeout(() => {
              if (!canceled) setLoading(false);
            }, 0);
          },
          onError: (e) => setError(`OnlyOffice error: ${typeof e === "string" ? e : JSON.stringify(e)}`),
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
            setError("Failed to initialize OnlyOffice editor. Check console for details.");
            setLoading(false);
          }
        });
      })
      .catch((e) => {
        if (canceled) return;
        console.error(e);
        setError(e?.message || "Failed to load OnlyOffice editor.");
        setLoading(false);
      });

    return () => {
      canceled = true;
      try {
        if (editorRef.current && typeof editorRef.current.destroyEditor === "function") {
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
      connectorRef.current?.executeMethod?.("Undo");
    } catch (e) {
      console.warn("Undo not supported:", e);
    }
  };

  const handleRedo = () => {
    try {
      connectorRef.current?.executeMethod?.("Redo");
    } catch (e) {
      console.warn("Redo not supported:", e);
    }
  };

  const handleBold = () => {
    if (!hasConnector) return;
    try {
      if (docType === "word" || docType === "slide" || !docType) {
        // Attempt Text Document API style change
        connectorRef.current.executeMethod("ChangeTextPr", [{ b: true }]);
      } else if (docType === "cell") {
        // Spreadsheet: attempt SetBold on selection
        connectorRef.current.executeMethod("SetBold", [true]);
      }
    } catch (e1) {
      // Fallback attempts
      try {
        connectorRef.current.executeMethod("SetBold", [true]);
      } catch (e2) {
        console.warn("Bold not supported in this document/editor:", e2);
      }
    }
  };

  const handleItalic = () => {
    if (!hasConnector) return;
    try {
      if (docType === "word" || docType === "slide" || !docType) {
        connectorRef.current.executeMethod("ChangeTextPr", [{ i: true }]);
      } else if (docType === "cell") {
        connectorRef.current.executeMethod("SetItalic", [true]);
      }
    } catch (e1) {
      try {
        connectorRef.current.executeMethod("SetItalic", [true]);
      } catch (e2) {
        console.warn("Italic not supported in this document/editor:", e2);
      }
    }
  };

  const handleUnderline = () => {
    if (!hasConnector) return;
    try {
      if (docType === "word" || docType === "slide" || !docType) {
        connectorRef.current.executeMethod("ChangeTextPr", [{ u: true }]);
      } else if (docType === "cell") {
        connectorRef.current.executeMethod("SetUnderline", [true]);
      }
    } catch (e1) {
      try {
        connectorRef.current.executeMethod("SetUnderline", [true]);
      } catch (e2) {
        console.warn("Underline not supported in this document/editor:", e2);
      }
    }
  };

  const handleSave = async () => {
    if (!hasConnector || saving) return;
    setSaving(true);
    try {
      // Trigger OnlyOffice to save; backend callback will persist the file
      connectorRef.current?.executeMethod?.("Save");
      // Provide brief visual feedback even though save is async via callback
      setTimeout(() => setSaving(false), 1200);
    } catch (e) {
      console.warn("Save not supported:", e);
      setSaving(false);
    }
  };

  // Show fallback UI when OnlyOffice is not configured
  if (!ONLYOFFICE_URL) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 flex flex-col h-full items-center justify-center p-1 w-full">
        <div className="max-w-md text-center">
          <div className="mb-4 text-6xl">📄</div>
          <h3 className="dark:text-gray-100 font-semibold mb-2 text-gray-900 text-lg">Document Editor Not Available</h3>
          <p className="dark:text-gray-400 mb-4 text-gray-600 text-sm">
            OnlyOffice Document Server is not configured. To enable full document editing for DOCX, XLSX, and PDF files, configure the <code className="bg-gray-200 dark:bg-gray-600 dark:text-gray-100 px-1 rounded text-gray-900">VITE_ONLYOFFICE_URL</code> environment variable.
          </p>
          <div className="bg-blue-50 border border-blue-200 dark:bg-blue-900/30 dark:border-blue-800 p-1 rounded-lg text-left">
            <h4 className="dark:text-blue-200 font-medium mb-2 text-blue-900 text-sm">Alternative Options:</h4>
            <ul className="dark:text-blue-300 space-y-1 text-blue-800 text-sm">
              <li>• Download the file, edit locally, and re-upload</li>
              <li>• Use the "Replace Content" feature in document history</li>
              <li>• View PDFs directly in the browser</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white flex flex-col h-full w-full">
      {error ? (
        <div className="bg-red-50 border border-red-200 p-1 rounded text-red-700 text-sm">
          <strong>Editor Error:</strong> {error}
        </div>
      ) : null}
      {loading && !error ? <div className="p-1 text-gray-600 text-sm">Loading editor…</div> : null}
      {/* Document container - always white background, document should not inherit dark mode */}
      <div id={containerId} className="bg-white flex-1 min-h-0" />
      {/* Footer: icon-only buttons with tooltips on hover/long-press - can have dark mode */}
      <footer className="bg-gray-50 border-gray-200 border-t dark:bg-gray-800 dark:border-gray-700 flex flex-wrap gap-1 items-center px-0 py-0 shrink-0" style={{ position: "sticky", bottom: 0, zIndex: 40 }} role="toolbar" aria-label="Editor actions">
        {/* Text Formatting */}
        <div className="ui-flex-items-gap-1">
          <button
            type="button"
            className="bg-white border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600 dark:text-gray-100 disabled:cursor-not-allowed disabled:opacity-50 font-bold hover:bg-gray-50 px-0 py-1 rounded text-gray-900 text-sm"
            title="Bold (Ctrl+B)"
            aria-label="Bold (Ctrl+B)"
            disabled={buttonsDisabled}
            onClick={handleBold}
          >
            B
          </button>
          <button
            type="button"
            className="bg-white border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600 dark:text-gray-100 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-gray-50 italic px-0 py-1 rounded text-gray-900 text-sm"
            title="Italic (Ctrl+I)"
            aria-label="Italic (Ctrl+I)"
            disabled={buttonsDisabled}
            onClick={handleItalic}
          >
            I
          </button>
          <button
            type="button"
            className="bg-white border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600 dark:text-gray-100 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-gray-50 px-0 py-1 rounded text-gray-900 text-sm underline"
            title="Underline (Ctrl+U)"
            aria-label="Underline (Ctrl+U)"
            disabled={buttonsDisabled}
            onClick={handleUnderline}
          >
            U
          </button>
        </div>

        <div className="bg-gray-300 dark:bg-gray-600 h-5 mx-1 w-px" />

        {/* History */}
        <div className="ui-flex-items-gap-1">
          <button
            type="button"
            className="bg-white border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600 dark:text-gray-100 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-gray-50 px-0 py-1 rounded text-gray-900 text-sm"
            title="Undo (Ctrl+Z)"
            aria-label="Undo (Ctrl+Z)"
            disabled={buttonsDisabled}
            onClick={handleUndo}
          >
            ↶
          </button>
          <button
            type="button"
            className="bg-white border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600 dark:text-gray-100 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-gray-50 px-0 py-1 rounded text-gray-900 text-sm"
            title="Redo (Ctrl+Y)"
            aria-label="Redo (Ctrl+Y)"
            disabled={buttonsDisabled}
            onClick={handleRedo}
          >
            ↷
          </button>
        </div>

        <div className="bg-gray-300 dark:bg-gray-600 h-5 mx-1 w-px" />

        {/* Save */}
        <button
          type="button"
          className="bg-green-600 border disabled:cursor-not-allowed disabled:opacity-50 hover:bg-green-700 px-0 py-1 rounded text-sm text-white"
          title={saving ? "Saving…" : "Save (Ctrl+S)"}
          aria-label={saving ? "Saving…" : "Save (Ctrl+S)"}
          disabled={buttonsDisabled || saving}
          onClick={handleSave}
        >
          {saving ? "⋯" : "💾"}
        </button>

        {/* Status indicator */}
        <div className="dark:text-gray-400 flex gap-2 items-center ml-auto text-gray-500 text-xs">
          {loading && <span>Loading editor...</span>}
          {!loading && hasConnector && <span className="text-green-600">● Connected</span>}
          {!loading && !hasConnector && !error && <span className="text-yellow-600">● Limited mode</span>}
        </div>
      </footer>
    </div>
  );
}
