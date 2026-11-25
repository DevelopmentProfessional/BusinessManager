/*
 * ============================================================
 * FILE: Viewer_PDF.jsx
 *
 * PURPOSE:
 *   Renders a paginated, zoomable PDF viewer using react-pdf backed by PDF.js.
 *   If react-pdf fails to load the file, the component automatically falls back
 *   to an iframe so the browser's native PDF renderer is used instead.
 *
 * FUNCTIONAL PARTS:
 *   [1] Worker Configuration      — sets the PDF.js worker source URL via pdfjs.GlobalWorkerOptions
 *   [2] Viewer_PDF Component       — state management for page, zoom, and error; resize observer
 *                                   for responsive page width
 *   [3] Navigation & Zoom Helpers — goToPrev, goToNext, zoomIn, zoomOut, fitWidth, handlePageInput
 *   [4] Iframe Fallback Render    — renders a native iframe when react-pdf errors
 *   [5] Primary Render            — full toolbar with pagination and zoom controls
 *                                   and react-pdf Document/Page content area
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-03-01 | Claude  | Added section comments and top-level documentation
 *   2026-11-25 | GitHub Copilot | Simplified PDF fallback and moved metadata actions to the shared footer
 * ============================================================
 */

import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { ChevronLeftIcon, ChevronRightIcon, MagnifyingGlassPlusIcon, MagnifyingGlassMinusIcon, ArrowsPointingOutIcon } from "../../../icons";
import { documentsAPI } from "../../../services/api";

// ─── 1 WORKER CONFIGURATION ────────────────────────────────────────────────────

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

// ─── 2 PDFVIEWER COMPONENT ─────────────────────────────────────────────────────

export default function Viewer_PDF({ document }) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [loadError, setLoadError] = useState(null);
  const [fileData, setFileData] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const loadAttemptRef = useRef(0);
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(null);

  useEffect(() => {
    loadAttemptRef.current += 1;
    setNumPages(null);
    setPageNumber(1);
    setScale(1.0);
    setLoadError(null);
    setFileData(null);
    setRetrying(false);
  }, [document.id]);

  const onDocumentLoadSuccess = useCallback(({ numPages: total }) => {
    setNumPages(total);
    setPageNumber(1);
    setLoadError(null);
  }, []);

  const onDocumentLoadError = useCallback(async (err) => {
    if (fileData) {
      console.error("react-pdf could not render the downloaded PDF", err);
      setLoadError(err);
      return;
    }

    const attempt = loadAttemptRef.current;
    setRetrying(true);
    try {
      const response = await documentsAPI.getFileContent(document.id);
      if (attempt !== loadAttemptRef.current) return;
      setFileData(new Uint8Array(response.data));
    } catch (retryError) {
      if (attempt !== loadAttemptRef.current) return;
      console.error("Unable to load PDF for preview", { initialError: err, retryError });
      setLoadError(retryError);
    } finally {
      if (attempt === loadAttemptRef.current) setRetrying(false);
    }
  }, [document.id, fileData]);

  // ─── 3 NAVIGATION & ZOOM HELPERS ─────────────────────────────────────────────

  const goToPrev = () => setPageNumber((p) => Math.max(1, p - 1));
  const goToNext = () => setPageNumber((p) => Math.min(numPages || 1, p + 1));
  const zoomIn = () => setScale((s) => Math.min(3, s + 0.25));
  const zoomOut = () => setScale((s) => Math.max(0.5, s - 0.25));
  const fitWidth = () => setScale(1.0);

  const handlePageInput = (e) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 1 && val <= (numPages || 1)) {
      setPageNumber(val);
    }
  };

  // Measure container for responsive width
  // Falls back to a static clientWidth snapshot on browsers without ResizeObserver
  // (Firefox < 69, Safari < 13.1, older Edge/Samsung Internet)
  const measuredRef = useCallback((node) => {
    if (node !== null) {
      containerRef.current = node;
      if (typeof ResizeObserver !== "undefined") {
        const observer = new ResizeObserver((entries) => {
          for (const entry of entries) {
            setContainerWidth(entry.contentRect.width);
          }
        });
        observer.observe(node);
        return () => observer.disconnect();
      } else {
        // Fallback: measure once and re-measure on window resize
        const measure = () => setContainerWidth(node.clientWidth);
        measure();
        window.addEventListener("resize", measure, { passive: true });
        return () => window.removeEventListener("resize", measure);
      }
    }
  }, []);

  const fileUrl = documentsAPI.fileUrl(document.id);
  const pdfFile = useMemo(() => (fileData ? { data: fileData } : fileUrl), [fileData, fileUrl]);

  // ─── 4 IFRAME FALLBACK RENDER ─────────────────────────────────────────────────

  // Fallback: if react-pdf fails, use browser's native PDF viewer via iframe
  if (loadError) {
    return (
      <div className="flex flex-col h-full">
        <div className="bg-gray-50 border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700 flex items-center justify-between p-0">
          <span className="dark:text-gray-300 text-gray-600 text-sm">PDF Document</span>
        </div>
        <div className="flex-1">
          <div className="flex flex-col h-full">
            <iframe title="PDF Preview" src={fileUrl} className="border-0 flex-1 min-h-0 w-full" />
          </div>
        </div>
      </div>
    );
  }

  // ─── 5 PRIMARY RENDER ──────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="bg-gray-50 border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700 flex flex-wrap gap-2 items-center justify-between p-0">
        <div className="ui-flex-items-gap-1">
          {/* Page navigation */}
          <button
            onClick={goToPrev}
            disabled={pageNumber <= 1}
            className="align-items-center btn btn-outline-secondary d-flex disabled:cursor-not-allowed disabled:opacity-40 justify-content-center p-0"
            title="Previous page"
          >
            <ChevronLeftIcon className="ui-icon-4" />
          </button>
          <div className="dark:text-gray-300 flex gap-1 items-center text-gray-600 text-sm">
            <input
              type="number"
              min={1}
              max={numPages || 1}
              value={pageNumber}
              onChange={handlePageInput}
              className="[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield] bg-white border dark:bg-gray-700 dark:text-gray-200 py-1 rounded text-center text-sm w-12"
            />
            <span>/ {numPages || "..."}</span>
          </div>
          <button
            onClick={goToNext}
            disabled={pageNumber >= (numPages || 1)}
            className="align-items-center btn btn-outline-secondary d-flex disabled:cursor-not-allowed disabled:opacity-40 justify-content-center p-0"
            title="Next page"
          >
            <ChevronRightIcon className="ui-icon-4" />
          </button>

          <div className="bg-gray-300 dark:bg-gray-600 h-6 mx-1 w-px" />

          {/* Zoom controls */}
          <button onClick={zoomOut} disabled={scale <= 0.5} className="btn btn-outline-secondary disabled:opacity-40 p-0" title="Zoom out">
            <MagnifyingGlassMinusIcon className="ui-icon-4" />
          </button>
          <span className="dark:text-gray-300 min-w-[50px] text-center text-gray-600 text-sm">{Math.round(scale * 100)}%</span>
          <button onClick={zoomIn} disabled={scale >= 3} className="btn btn-outline-secondary disabled:opacity-40 p-0" title="Zoom in">
            <MagnifyingGlassPlusIcon className="ui-icon-4" />
          </button>
          <button onClick={fitWidth} className="align-items-center btn btn-outline-secondary d-flex justify-content-center p-0" title="Fit width">
            <ArrowsPointingOutIcon className="ui-icon-4" />
          </button>
        </div>

      </div>

      {/* PDF Content */}
      <div ref={measuredRef} className="bg-white flex flex-1 justify-center min-h-0 overflow-auto p-1">
        {retrying ? (
          <div aria-live="polite" className="flex h-32 items-center justify-center">
            <div className="animate-spin border-b-2 border-primary-600 h-8 rounded-full w-8"></div>
            <span className="dark:text-gray-300 ml-3 text-gray-600 text-sm">Retrying PDF preview…</span>
          </div>
        ) : (
          <Document
            key={document.id}
            file={pdfFile}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="flex h-32 items-center justify-center">
                <div className="animate-spin border-b-2 border-primary-600 h-8 rounded-full w-8"></div>
              </div>
            }
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              width={scale === 1.0 && containerWidth ? containerWidth - 48 : undefined}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              loading={
                <div className="flex h-32 items-center justify-center">
                  <div className="animate-spin border-b-2 border-primary-600 h-6 rounded-full w-6"></div>
                </div>
              }
              className="shadow-lg"
            />
          </Document>
        )}
      </div>
    </div>
  );
}
