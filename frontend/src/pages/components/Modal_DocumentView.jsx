import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
import Modal from "./Modal";
import { XMarkIcon, ArrowDownTrayIcon, PencilIcon, DocumentIcon } from "@heroicons/react/24/outline";
import { documentsAPI } from "../../services/api";
import { renderAsync } from "docx-preview";
import { isEditableType, getEditorConfig, extractHtmlFromMhtml } from "./editors/documentEditorUtils";
import { useDocumentEditor } from "./editors/useDocumentEditor";
import Editor_Toolbar from "./editors/Editor_Toolbar";

// Lazy-load editor components to reduce initial bundle
const Editor_RichText = lazy(() => import("./editors/Editor_RichText"));
const Editor_Code = lazy(() => import("./editors/Editor_Code"));

// Lazy-load heavy viewer components (xlsx, react-pdf)
const XlsxViewerLazy = lazy(() => import("./viewers/Viewer_Xlsx"));
const PDFViewerLazy = lazy(() => import("./viewers/Viewer_PDF"));

// Determine document type from content_type and filename
function getDocumentType(doc) {
  if (!doc) return "unknown";
  const ct = (doc.content_type || "").toLowerCase();
  const name = (doc.original_filename || "").toLowerCase();

  if (ct.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(name)) {
    return "image";
  }
  if (ct.includes("pdf") || name.endsWith(".pdf")) {
    return "pdf";
  }
  // Check DOCX before text/ — a .docx file may have content_type changed to text/html
  // after editing, but should still be treated as DOCX for the rich text editor
  if (ct.includes("wordprocessingml.document") || name.endsWith(".docx")) {
    return "docx";
  }
  if (ct.startsWith("text/") || ct === "application/json" || ct === "application/javascript") {
    return "text";
  }
  if (ct.includes("spreadsheetml.sheet") || name.endsWith(".xlsx")) {
    return "xlsx";
  }
  if (ct.includes("presentationml.presentation") || name.endsWith(".pptx")) {
    return "pptx";
  }
  if (ct.includes("msword") || name.endsWith(".doc")) {
    return "doc";
  }
  if (ct.includes("ms-excel") || name.endsWith(".xls")) {
    return "xls";
  }
  // Fallback text check by extension
  if (/\.(txt|csv|json|xml|html|css|js|md|py|sql|yaml|yml|sh|ts|tsx|jsx)$/i.test(name)) {
    return "text";
  }
  return "unknown";
}

// Image Viewer Component
function ImageViewer({ document, onEdit }) {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((prev) => Math.min(Math.max(0.5, prev + delta), 3));
  };

  const handleMouseDown = (e) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const resetView = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="bg-gray-50 border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700 flex items-center justify-between p-0">
        <div className="ui-flex-items-gap-2">
          <button type="button" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} className="btn btn-outline-secondary p-0">
            -
          </button>
          <span className="dark:text-gray-300 min-w-[60px] text-center text-gray-600 text-sm">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom((z) => Math.min(3, z + 0.25))} className="btn btn-outline-secondary p-0">
            +
          </button>
          <button type="button" onClick={resetView} className="btn btn-outline-secondary p-0">
            Reset
          </button>
        </div>
        {onEdit && (
          <button type="button" onClick={onEdit} className="align-items-center btn btn-primary d-flex gap-1">
            <PencilIcon className="ui-icon-4" />
            Edit Metadata
          </button>
        )}
      </div>
      <div ref={containerRef} className="bg-white cursor-move dark:bg-gray-900 flex flex-1 items-center justify-center min-h-0 overflow-hidden w-full" onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
        <img
          src={documentsAPI.fileUrl(document.id)}
          alt={document.original_filename}
          className="max-h-full max-w-full object-contain transition-transform"
          style={{
            transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
            cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "default",
          }}
          draggable={false}
        />
      </div>
    </div>
  );
}

// PDF Viewer — delegates to lazy-loaded react-pdf based viewer
function Viewer_PDF({ document, onEdit }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <div className="animate-spin border-b-2 border-primary-600 h-8 rounded-full w-8"></div>
        </div>
      }
    >
      <PDFViewerLazy document={document} onEdit={onEdit} />
    </Suspense>
  );
}

// DOCX Viewer Component (using docx-preview library)
function DocxViewer({ document, onEdit }) {
  const containerRef = useRef(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let canceled = false;
    const container = containerRef.current;

    const loadDocument = async () => {
      if (!container) return;

      try {
        setLoading(true);
        setError("");
        const res = await fetch(documentsAPI.fileUrl(document.id));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const ab = await res.arrayBuffer();
        if (canceled) return;

        container.innerHTML = "";

        try {
          await renderAsync(ab, container, undefined, {
            className: "docx",
            inWrapper: false,
          });

          // Comprehensive CSS rules now handle all responsive styling
          // Just ensure container has proper dimensions
          setLoading(false);
        } catch (renderErr) {
          // renderAsync failed — file may contain HTML or MHTML from a previous edit/save.
          // Extract HTML (stripping MHTML headers if present) and render it.
          console.warn("DOCX rendering failed, attempting HTML fallback:", renderErr);
          const decoder = new TextDecoder("utf-8");
          const raw = decoder.decode(ab);
          const html = extractHtmlFromMhtml(raw);

          if (html && html.trim().length > 0 && html.includes("<")) {
            // Successfully extracted HTML from MHTML
            try {
              container.innerHTML = html;
            } catch (innerErr) {
              console.error("Failed to set HTML content:", innerErr);
              throw new Error("Unable to render HTML content");
            }
          } else if (!html || html.trim().length === 0) {
            // Extraction returned empty — likely corrupted file
            throw new Error("Document content appears corrupted or unrecognizable");
          } else {
            // HTML extraction returned something but doesn't look like HTML
            throw new Error("Document format not supported for preview");
          }
        }
        setLoading(false);
      } catch (err) {
        console.error("Failed to render DOCX", err);
        if (!canceled) {
          setError("Unable to render document preview.");
          setLoading(false);
        }
      }
    };

    loadDocument();

    return () => {
      canceled = true;
      if (container) container.innerHTML = "";
    };
  }, [document.id]);

  return (
    <div className="flex flex-col h-full">
      <div className="bg-gray-50 border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700 flex items-center justify-between p-0">
        <span className="dark:text-gray-300 text-gray-600 text-sm">Word Document</span>
        <div className="ui-flex-items-gap-2">
          {onEdit && (
            <button type="button" onClick={onEdit} className="align-items-center btn btn-primary d-flex gap-1">
              <PencilIcon className="ui-icon-4" />
              Edit Metadata
            </button>
          )}
        </div>
      </div>
      <div className="bg-white dark:bg-gray-900 flex-1 min-h-0 overflow-auto w-full">
        {loading && (
          <div className="flex h-full items-center justify-center">
            <div className="animate-spin border-b-2 border-primary-600 h-8 rounded-full w-8"></div>
          </div>
        )}
        {error && <div className="bg-red-50 dark:bg-red-900/20 m-4 p-1 rounded text-red-600">{error}</div>}
        <div
          ref={containerRef}
          className="docx-preview-container h-full w-full"
          style={{
            width: "100%",
            height: "100%",
          }}
        />
      </div>
    </div>
  );
}

// Office Document Viewer (for pptx, doc - shows download option)
function OfficeViewer({ document, documentType, onEdit }) {
  const typeLabels = {
    pptx: "PowerPoint Presentation",
    doc: "Word Document (Legacy)",
  };

  return (
    <div className="flex flex-col h-full">
      <div className="bg-gray-50 border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700 flex items-center justify-between p-0">
        <span className="dark:text-gray-300 text-gray-600 text-sm">{typeLabels[documentType] || "Office Document"}</span>
        {onEdit && (
          <button type="button" onClick={onEdit} className="align-items-center btn btn-primary d-flex gap-1">
            <PencilIcon className="ui-icon-4" />
            Edit Metadata
          </button>
        )}
      </div>
      <div className="bg-white dark:bg-gray-900 flex flex-1 items-center justify-center">
        <div className="p-1 text-center">
          <DocumentIcon className="h-16 mb-4 mx-auto text-gray-400 w-16" />
          <p className="dark:text-gray-400 mb-4 text-gray-600">Preview not available for this file type.</p>
          <a href={documentsAPI.fileUrl(document.id, { download: true })} download className="bg-primary-600 gap-2 hover:bg-primary-700 inline-flex items-center px-1 py-0 rounded text-white">
            <ArrowDownTrayIcon className="ui-icon-5" />
            Download to View
          </a>
        </div>
      </div>
    </div>
  );
}

// Text File Viewer
function TextViewer({ document, onEdit }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let canceled = false;

    const loadContent = async () => {
      try {
        setLoading(true);
        const res = await fetch(documentsAPI.fileUrl(document.id));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        if (!canceled) {
          setContent(text);
          setLoading(false);
        }
      } catch (err) {
        if (!canceled) {
          setError("Failed to load file content.");
          setLoading(false);
        }
      }
    };

    loadContent();
    return () => {
      canceled = true;
    };
  }, [document.id]);

  return (
    <div className="flex flex-col h-full">
      <div className="bg-gray-50 border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700 flex items-center justify-between p-0">
        <span className="dark:text-gray-300 text-gray-600 text-sm">Text File</span>
        {onEdit && (
          <button type="button" onClick={onEdit} className="align-items-center btn btn-primary d-flex gap-1">
            <PencilIcon className="ui-icon-4" />
            Edit Metadata
          </button>
        )}
      </div>
      <div className="bg-white dark:bg-gray-900 flex-1 min-h-0 overflow-auto w-full">
        {loading && (
          <div className="flex h-full items-center justify-center">
            <div className="animate-spin border-b-2 border-primary-600 h-8 rounded-full w-8"></div>
          </div>
        )}
        {error && <div className="bg-red-50 dark:bg-red-900/20 m-4 p-1 rounded text-red-600">{error}</div>}
        {!loading && !error && (
          <pre className="dark:text-gray-200 font-mono text-gray-800 text-sm w-full whitespace-pre-wrap" style={{ margin: 0, padding: "1rem", boxSizing: "border-box", height: "100%", overflowY: "auto" }}>
            {content}
          </pre>
        )}
      </div>
    </div>
  );
}

// Unknown File Type Viewer
function UnknownViewer({ document, onEdit }) {
  return (
    <div className="flex flex-col h-full">
      <div className="bg-gray-50 border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700 flex items-center justify-between p-0">
        <span className="dark:text-gray-300 text-gray-600 text-sm">File</span>
        {onEdit && (
          <button type="button" onClick={onEdit} className="align-items-center btn btn-primary d-flex gap-1">
            <PencilIcon className="ui-icon-4" />
            Edit Metadata
          </button>
        )}
      </div>
      <div className="bg-white dark:bg-gray-900 flex flex-1 items-center justify-center">
        <div className="p-1 text-center">
          <DocumentIcon className="h-16 mb-4 mx-auto text-gray-400 w-16" />
          <p className="dark:text-gray-400 mb-2 text-gray-600">{document.original_filename}</p>
          <p className="dark:text-gray-500 mb-4 text-gray-500 text-sm">Preview not available for this file type.</p>
          <a href={documentsAPI.fileUrl(document.id, { download: true })} download className="bg-primary-600 gap-2 hover:bg-primary-700 inline-flex items-center px-1 py-0 rounded text-white">
            <ArrowDownTrayIcon className="ui-icon-5" />
            Download
          </a>
        </div>
      </div>
    </div>
  );
}

// Editor Area Component — renders the appropriate editor based on document type
function EditorArea({ document, documentType }) {
  const editorRef = useRef(null);
  // Track when the editor instance becomes available so toolbar re-renders with controls
  const [editorInstance, setEditorInstance] = useState(null);
  // Force re-render on editor transactions so toolbar buttons reflect current selection state
  const [, setTxCount] = useState(0);
  useEffect(() => {
    if (!editorInstance) return;
    if (typeof editorInstance.on !== "function" || typeof editorInstance.off !== "function") return;
    const handler = () => setTxCount((n) => n + 1);
    editorInstance.on("transaction", handler);
    return () => editorInstance.off("transaction", handler);
  }, [editorInstance]);
  const { editorType, codeLanguage } = getEditorConfig(documentType, document.original_filename);
  const { content, setContent, isDirty, isLoading, isSaving, saveStatus, error, saveContent } = useDocumentEditor(document.id, documentType, document.original_filename);

  // Callback ref: when the editor component sets its ref, capture the instance in state
  // to trigger a re-render so the toolbar gets the live editor object
  const editorCallbackRef = useCallback((instance) => {
    editorRef.current = instance;
    setEditorInstance(instance);
  }, []);

  const handleUndo = () => {
    const ed = editorRef.current;
    if (editorType === "richtext" && ed) {
      ed.chain().focus().undo().run();
    } else if (editorType === "code" && ed?.undo) {
      ed.undo();
    }
  };

  const handleRedo = () => {
    const ed = editorRef.current;
    if (editorType === "richtext" && ed) {
      ed.chain().focus().redo().run();
    } else if (editorType === "code" && ed?.redo) {
      ed.redo();
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 h-full items-center justify-center">
        <div className="animate-spin border-b-2 border-primary-600 h-10 rounded-full w-10"></div>
        <p className="dark:text-gray-400 text-gray-500 text-sm">Loading content...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-1">
        <div className="text-center">
          <div className="bg-red-50 dark:bg-red-900/20 mb-4 p-1 rounded text-red-600">{error}</div>
          <a href={documentsAPI.fileUrl(document.id, { download: true })} download className="bg-primary-600 gap-2 hover:bg-primary-700 inline-flex items-center px-1 py-0 rounded text-white">
            <ArrowDownTrayIcon className="ui-icon-5" />
            Download Instead
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-hidden">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center">
              <div className="animate-spin border-b-2 border-primary-600 h-8 rounded-full w-8"></div>
            </div>
          }
        >
          {editorType === "richtext" ? <Editor_RichText ref={editorCallbackRef} content={content} onChange={setContent} /> : <Editor_Code ref={editorCallbackRef} content={content} onChange={setContent} language={codeLanguage || "text"} />}
        </Suspense>
      </div>
      <Editor_Toolbar editorType={editorType} editor={editorInstance} onSave={saveContent} onUndo={handleUndo} onRedo={handleRedo} isDirty={isDirty} isSaving={isSaving} saveStatus={saveStatus} />
    </div>
  );
}

// Main Document Viewer Modal
export default function Modal_Viewer_Document({ isOpen, onClose, document, onEdit, onSign, onDelete, onWorkflow }) {
  const [mode, setMode] = useState("view"); // 'view' or 'edit'

  // Reset mode when document changes
  useEffect(() => {
    setMode("view");
  }, [document?.id]);

  if (!document) return null;

  const documentType = getDocumentType(document);
  const editable = isEditableType(documentType);

  const handleToggleEdit = () => {
    if (mode === "edit") {
      setMode("view");
    } else {
      setMode("edit");
    }
  };

  const handleClose = () => {
    onClose();
  };

  const renderViewer = () => {
    switch (documentType) {
      case "image":
        return <ImageViewer document={document} onEdit={onEdit} />;
      case "pdf":
        return <Viewer_PDF document={document} onEdit={onEdit} />;
      case "docx":
        return <DocxViewer document={document} onEdit={onEdit} />;
      case "xlsx":
      case "xls":
        return (
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center">
                <div className="animate-spin border-b-2 border-primary-600 h-8 rounded-full w-8"></div>
              </div>
            }
          >
            <XlsxViewerLazy document={document} onEdit={onEdit} />
          </Suspense>
        );
      case "pptx":
      case "doc":
        return <OfficeViewer document={document} documentType={documentType} onEdit={onEdit} />;
      case "text":
        return <TextViewer document={document} onEdit={onEdit} />;
      default:
        return <UnknownViewer document={document} onEdit={onEdit} />;
    }
  };

  return (
    <Modal isOpen={isOpen && !!document} onClose={handleClose} noPadding={true} fullScreen={true} contentGravity="top">
      <div className="absolute bg-white dark:bg-gray-800 flex flex-col inset-0 lg:m-6 m-2 overflow-hidden rounded-lg shadow-xl sm:m-4">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700 flex items-center justify-between px-1 py-0">
          <div className="flex gap-3 items-center min-w-0">
            <DocumentIcon className="flex-shrink-0 h-6 text-gray-400 w-6" />
            <h3 className="dark:text-gray-100 font-medium text-gray-900 text-lg truncate">{document.original_filename}</h3>
          </div>
          <div className="ui-flex-items-gap-2">
            <button type="button" onClick={handleClose} className="align-items-center btn btn-outline-secondary d-flex dark:hover:text-gray-300 hover:text-gray-600 justify-content-center p-0 text-gray-400">
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content: Editor or Viewer */}
        <div className="flex-1 min-h-0 overflow-hidden">{mode === "edit" ? <EditorArea document={document} documentType={documentType} /> : renderViewer()}</div>

        {/* Footer with document info */}
        <div className="bg-gray-50 border-gray-200 border-t dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 px-1 py-0 text-gray-600 text-sm">
          <div className="flex flex-wrap gap-4">
            <span>Type: {document.content_type || "Unknown"}</span>
            <span>Size: {document.file_size ? formatFileSize(document.file_size) : "Unknown"}</span>
            <span>Uploaded: {document.created_at ? new Date(document.created_at).toLocaleDateString() : "Unknown"}</span>
            {document.description && <span>Description: {document.description}</span>}
            {document.is_signed && (
              <span className="flex gap-2 items-center ml-auto">
                <span className="bg-green-100 dark:bg-green-900/30 dark:text-green-400 font-medium gap-1 inline-flex items-center px-0 py-0.5 rounded text-green-700 text-xs">Signed by {document.signed_by || "Unknown"}</span>
                {document.signature_image && <img src={document.signature_image} alt="Signature" className="border h-5 rounded" style={{ maxWidth: "80px" }} />}
              </span>
            )}
          </div>

          <div className="border-gray-200 border-t dark:border-gray-700 flex flex-wrap gap-2 items-center mt-2 pt-0">
            {/* View/Edit toggle — only for editable types */}
            {editable && (
              <button
                onClick={handleToggleEdit}
                className={`flex items-center gap-1 px-1 py-1.5 text-sm rounded transition-colors ${mode === "edit" ? "bg-primary-600 text-white hover:bg-primary-700" : "text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"}`}
              >
                <PencilIcon className="ui-icon-4" />
                {mode === "edit" ? "Editing" : "Edit"}
              </button>
            )}

            {document.is_signed ? (
              <span className="bg-green-100 dark:bg-green-900/30 dark:text-green-400 font-medium gap-1 inline-flex items-center px-1 py-1.5 rounded text-green-700 text-sm">Signed</span>
            ) : (
              onSign && (
                <button type="button" onClick={() => onSign(document)} className="align-items-center btn btn-outline-secondary d-flex gap-1">
                  Sign
                </button>
              )
            )}

            {onDelete && (
              <button type="button" onClick={() => onDelete(document)} className="align-items-center btn btn-outline-danger d-flex gap-1">
                <XMarkIcon className="ui-icon-4" />
                Delete
              </button>
            )}

            {onWorkflow && (
              <button type="button" onClick={() => onWorkflow(document)} className="align-items-center btn btn-outline-primary d-flex gap-1">
                Workflow
              </button>
            )}

            <a href={documentsAPI.fileUrl(document.id, { download: true })} download className="bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300 flex gap-1 hover:bg-gray-200 items-center px-1 py-1.5 rounded text-gray-700 text-sm">
              <ArrowDownTrayIcon className="ui-icon-4" />
              Download
            </a>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// Export the type detection function for external use
// eslint-disable-next-line react-refresh/only-export-components -- Utility export is consumed by non-component modules.
export { getDocumentType };
