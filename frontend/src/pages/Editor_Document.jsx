/*
 * ============================================================
 * FILE: Editor_Document.jsx
 *
 * PURPOSE:
 *   Full-screen document editor page reached via /documents/:documentId.
 *   Loads document metadata from the API, then renders an OnlyOffice editor
 *   for collaborative editing along with a header ribbon containing file info,
 *   preview toggle, download, save, and close actions.
 *
 * FUNCTIONAL PARTS:
 *   [1] Imports & component setup — React, router hooks, heroicons, API service, OnlyOffice editor
 *   [2] State declarations — document data, loading/error flags, save state, preview toggle
 *   [3] useEffect / lifecycle — triggers loadDocument on documentId change
 *   [4] Data loading — loadDocument fetches document metadata from the API
 *   [5] Action handlers — handleSave, handleDownload, handleClose
 *   [6] Render — loading spinner, error state, header ribbon, editor/preview area
 *   [7] Utility — formatFileSize helper function
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-03-01 | Claude  | Added section comments and top-level documentation
 *   2026-05-15 | Copilot | Shortened document action button labels for compact training-mode layouts
 *   2026-09-11 | GitHub Copilot | Removed unused loading setter and stabilized document-load effect dependencies
 * ============================================================
 */

// ─── 1 IMPORTS ──────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DocumentIcon, ArrowLeftIcon, CheckIcon, XMarkIcon, EyeIcon, DocumentArrowDownIcon } from "@heroicons/react/24/outline";
import { documentsAPI } from "../services/api";
import Editor_OnlyOffice from "./components/Editor_OnlyOffice";
import useStore from "../services/useStore";

export default function Editor_Document() {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const { setError, clearError } = useStore();

  // ─── 2 STATE DECLARATIONS ────────────────────────────────────────────────
  const [document, setDocument] = useState(null);
  const [loading, setLocalLoading] = useState(true);
  const [error, setLocalError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // ─── 4 DATA LOADING ──────────────────────────────────────────────────────
  const loadDocument = useCallback(async () => {
    setLocalLoading(true);
    setLocalError("");
    try {
      const response = await documentsAPI.getById(documentId);
      setDocument(response.data);
      clearError();
    } catch (err) {
      setLocalError("Failed to load document");
      setError("Failed to load document");
      console.error(err);
    } finally {
      setLocalLoading(false);
    }
  }, [documentId, clearError, setError]);

  // ─── 3 LIFECYCLE — load document when documentId changes ─────────────────
  useEffect(() => {
    loadDocument();
  }, [loadDocument]);

  // ─── 5 ACTION HANDLERS ───────────────────────────────────────────────────
  const handleSave = async () => {
    setIsSaving(true);
    try {
      // The OnlyOffice editor handles saving automatically
      // This is just for UI feedback
      await new Promise((resolve) => setTimeout(resolve, 1000));
      clearError();
    } catch (err) {
      setError("Failed to save document");
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = () => {
    if (document) {
      const link = window.document.createElement("a");
      link.href = documentsAPI.fileUrl(document.id, { download: true });
      link.download = document.original_filename;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
    }
  };

  const handleClose = () => {
    navigate("/documents");
  };

  // ─── 6 RENDER ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin border-b-2 border-primary-600 h-12 rounded-full w-12"></div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="flex flex-col h-screen items-center justify-center">
        <div className="mb-4 text-red-600">
          <DocumentIcon className="h-16 w-16" />
        </div>
        <h2 className="font-semibold mb-2 text-gray-900 text-xl">Document Not Found</h2>
        <p className="mb-4 text-gray-600">{error || "The document could not be loaded."}</p>
        <button onClick={handleClose} className="btn-primary flex items-center">
          <ArrowLeftIcon className="h-5 mr-2 w-5" />
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-900 flex flex-col h-screen">
      {/* Header Ribbon */}
      <div className="bg-gray-50 border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700">
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700 flex items-center justify-between px-1 py-0">
          <div className="flex items-center space-x-3">
            <button onClick={handleClose} className="dark:hover:bg-gray-700 dark:hover:text-gray-200 dark:text-gray-400 hover:bg-gray-100 hover:text-gray-900 p-0 rounded-lg text-gray-600 transition-colors" title="Back to Documents">
              <ArrowLeftIcon className="ui-icon-5" />
            </button>
            <div className="flex items-center space-x-2">
              <DocumentIcon className="h-6 text-blue-600 w-6" />
              <span className="dark:text-gray-100 font-medium text-gray-900">{document.original_filename}</span>
            </div>
          </div>
        </div>

        {/* Document Info Bar */}
        <div className="bg-gray-50 dark:bg-gray-800 px-1 py-0">
          <div className="dark:text-gray-400 flex items-center justify-between text-gray-600 text-sm">
            <div className="flex items-center space-x-4">
              <span>Size: {formatFileSize(document.file_size)}</span>
              <span>Uploaded: {new Date(document.created_at).toLocaleDateString()}</span>
              {document.description && <span>Description: {document.description}</span>}
            </div>
            <div className="flex items-center space-x-2">
              {document.is_signed && (
                <span className="bg-green-100 dark:bg-green-900/30 dark:text-green-300 font-medium inline-flex items-center px-0 py-1 rounded-full text-green-800 text-xs">
                  <CheckIcon className="h-3 mr-1 w-3" />
                  Signed{document.signed_by ? ` by ${document.signed_by}` : ""}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Editor Area - Document content should be light/white regardless of dark mode */}
      <div className="bg-white flex-1 overflow-hidden">
        {showPreview ? (
          <div className="bg-white h-full w-full">
            {(() => {
              const ct = (document.content_type || "").toLowerCase();
              const name = (document.original_filename || "").toLowerCase();

              if ((ct && ct.startsWith("image/")) || /(\.png|\.jpg|\.jpeg|\.gif|\.webp)$/i.test(name)) {
                return <img src={documentsAPI.fileUrl(document.id)} alt={document.original_filename} className="bg-white h-full object-contain w-full" />;
              }
              if (ct.includes("pdf") || name.endsWith(".pdf")) {
                return <iframe title="PDF Preview" src={documentsAPI.fileUrl(document.id)} className="bg-white h-full w-full" />;
              }
              return (
                <div className="bg-white flex h-full items-center justify-center">
                  <div className="text-center">
                    <DocumentIcon className="h-16 mb-4 mx-auto text-gray-400 w-16" />
                    <p className="text-gray-600">Preview not available for this file type.</p>
                    <p className="mt-2 text-gray-500 text-sm">Use the editor for supported document types.</p>
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          <Editor_OnlyOffice documentId={document.id} />
        )}
      </div>

      {/* Bottom controls */}
      <div className="bg-gray-50 border-gray-200 border-t dark:bg-gray-800 dark:border-gray-700 px-1 py-0">
        <div className="align-items-center d-flex flex-wrap gap-2">
          <button onClick={handleClose} className="bg-white border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600 dark:text-gray-300 hover:bg-gray-50 px-1 py-1.5 rounded text-gray-700 text-sm transition-colors" title="Back to Documents">
            <ArrowLeftIcon className="h-4 inline mr-1 w-4" />
            Back
          </button>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`px-1 py-1.5 text-sm rounded border transition-colors ${
              showPreview ? "bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300" : "bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
            }`}
            title="Toggle Preview"
          >
            <EyeIcon className="h-4 inline mr-1 w-4" />
            Preview
          </button>
          <button onClick={handleDownload} className="bg-white border border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600 dark:text-gray-300 hover:bg-gray-50 px-1 py-1.5 rounded text-gray-700 text-sm transition-colors" title="Download">
            <DocumentArrowDownIcon className="h-4 inline mr-1 w-4" />
            Download
          </button>
          <button onClick={handleSave} disabled={isSaving} className="align-items-center bg-blue-600 d-flex dark:bg-blue-700 dark:hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-blue-700 px-1 py-1.5 rounded text-sm text-white transition-colors" title="Save">
            {isSaving ? (
              <>
                <div className="animate-spin border-b-2 border-white h-4 mr-2 rounded-full w-4"></div>
                Saving...
              </>
            ) : (
              <>
                <CheckIcon className="h-4 mr-1 w-4" />
                Save
              </>
            )}
          </button>
          <button onClick={handleClose} className="dark:hover:bg-gray-700 dark:hover:text-gray-200 dark:text-gray-400 hover:bg-gray-100 hover:text-gray-900 ms-auto p-1.5 rounded text-gray-600 transition-colors" title="Close">
            <XMarkIcon className="ui-icon-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 7 UTILITY FUNCTIONS ─────────────────────────────────────────────────────
function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
