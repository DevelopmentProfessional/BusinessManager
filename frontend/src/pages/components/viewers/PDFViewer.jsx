import React, { useState, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import {
  PencilIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassPlusIcon,
  MagnifyingGlassMinusIcon,
  ArrowsPointingOutIcon,
} from '@heroicons/react/24/outline';
import { documentsAPI } from '../../../services/api';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export default function PDFViewer({ document, onEdit }) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [loadError, setLoadError] = useState(false);
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(null);

  const onDocumentLoadSuccess = useCallback(({ numPages: total }) => {
    setNumPages(total);
    setPageNumber(1);
    setLoadError(false);
  }, []);

  const onDocumentLoadError = useCallback((err) => {
    console.error('react-pdf load error, falling back to iframe', err);
    setLoadError(true);
  }, []);

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
  const measuredRef = useCallback((node) => {
    if (node !== null) {
      containerRef.current = node;
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setContainerWidth(entry.contentRect.width);
        }
      });
      observer.observe(node);
      return () => observer.disconnect();
    }
  }, []);

  const fileUrl = documentsAPI.fileUrl(document.id);

  // Fallback: if react-pdf fails, use browser's native PDF viewer via iframe
  if (loadError) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <span className="text-sm text-gray-600 dark:text-gray-300">PDF Document</span>
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={onEdit}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700"
              >
                <PencilIcon className="h-4 w-4" />
                Edit Metadata
              </button>
            )}
          </div>
        </div>
        <div className="flex-1">
          <iframe
            title="PDF Preview"
            src={fileUrl}
            className="w-full h-full border-0"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-wrap gap-2">
        <div className="flex items-center gap-1">
          {/* Page navigation */}
          <button
            onClick={goToPrev}
            disabled={pageNumber <= 1}
            className="p-1.5 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 border rounded hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Previous page"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
            <input
              type="number"
              min={1}
              max={numPages || 1}
              value={pageNumber}
              onChange={handlePageInput}
              className="w-12 text-center border rounded bg-white dark:bg-gray-700 dark:text-gray-200 text-sm py-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span>/ {numPages || '...'}</span>
          </div>
          <button
            onClick={goToNext}
            disabled={pageNumber >= (numPages || 1)}
            className="p-1.5 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 border rounded hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Next page"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>

          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

          {/* Zoom controls */}
          <button
            onClick={zoomOut}
            disabled={scale <= 0.5}
            className="p-1.5 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 border rounded hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-40"
            title="Zoom out"
          >
            <MagnifyingGlassMinusIcon className="h-4 w-4" />
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-300 min-w-[50px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={zoomIn}
            disabled={scale >= 3}
            className="p-1.5 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 border rounded hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-40"
            title="Zoom in"
          >
            <MagnifyingGlassPlusIcon className="h-4 w-4" />
          </button>
          <button
            onClick={fitWidth}
            className="p-1.5 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 border rounded hover:bg-gray-100 dark:hover:bg-gray-600"
            title="Fit width"
          >
            <ArrowsPointingOutIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {onEdit && (
            <button
              onClick={onEdit}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700"
            >
              <PencilIcon className="h-4 w-4" />
              Edit Metadata
            </button>
          )}
        </div>
      </div>

      {/* PDF Content */}
      <div
        ref={measuredRef}
        className="flex-1 overflow-auto bg-gray-200 dark:bg-gray-900 flex justify-center p-4"
      >
        <Document
          file={fileUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
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
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
              </div>
            }
            className="shadow-lg"
          />
        </Document>
      </div>
    </div>
  );
}
