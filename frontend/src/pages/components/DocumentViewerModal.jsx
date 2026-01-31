import React, { useState, useEffect, useRef } from 'react';
import { XMarkIcon, ArrowDownTrayIcon, PencilIcon, DocumentIcon } from '@heroicons/react/24/outline';
import { documentsAPI } from '../../services/api';
import { renderAsync } from 'docx-preview';

// Determine document type from content_type and filename
function getDocumentType(doc) {
  if (!doc) return 'unknown';
  const ct = (doc.content_type || '').toLowerCase();
  const name = (doc.original_filename || '').toLowerCase();

  if (ct.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(name)) {
    return 'image';
  }
  if (ct.includes('pdf') || name.endsWith('.pdf')) {
    return 'pdf';
  }
  if (ct.includes('wordprocessingml.document') || name.endsWith('.docx')) {
    return 'docx';
  }
  if (ct.includes('spreadsheetml.sheet') || name.endsWith('.xlsx')) {
    return 'xlsx';
  }
  if (ct.includes('presentationml.presentation') || name.endsWith('.pptx')) {
    return 'pptx';
  }
  if (ct.includes('msword') || name.endsWith('.doc')) {
    return 'doc';
  }
  if (ct.includes('ms-excel') || name.endsWith('.xls')) {
    return 'xls';
  }
  if (ct.includes('text/') || /\.(txt|csv|json|xml|html|css|js|md)$/i.test(name)) {
    return 'text';
  }
  return 'unknown';
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
      <div className="flex items-center justify-between p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
            className="px-2 py-1 text-sm bg-white dark:bg-gray-700 border rounded hover:bg-gray-100 dark:hover:bg-gray-600"
          >
            -
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-300 min-w-[60px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
            className="px-2 py-1 text-sm bg-white dark:bg-gray-700 border rounded hover:bg-gray-100 dark:hover:bg-gray-600"
          >
            +
          </button>
          <button
            onClick={resetView}
            className="px-2 py-1 text-sm bg-white dark:bg-gray-700 border rounded hover:bg-gray-100 dark:hover:bg-gray-600"
          >
            Reset
          </button>
        </div>
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
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden bg-gray-100 dark:bg-gray-900 flex items-center justify-center cursor-move"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img
          src={documentsAPI.fileUrl(document.id)}
          alt={document.original_filename}
          className="max-w-full max-h-full object-contain transition-transform"
          style={{
            transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
            cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
          }}
          draggable={false}
        />
      </div>
    </div>
  );
}

// PDF Viewer Component
function PDFViewer({ document, onEdit }) {
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
          src={documentsAPI.fileUrl(document.id)}
          className="w-full h-full border-0"
        />
      </div>
    </div>
  );
}

// DOCX Viewer Component (using docx-preview library)
function DocxViewer({ document, onEdit }) {
  const containerRef = useRef(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let canceled = false;

    const loadDocument = async () => {
      if (!containerRef.current) return;

      try {
        setLoading(true);
        setError('');
        const res = await fetch(documentsAPI.fileUrl(document.id));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const ab = await res.arrayBuffer();
        if (canceled) return;

        containerRef.current.innerHTML = '';
        await renderAsync(ab, containerRef.current, undefined, {
          className: 'docx',
          inWrapper: false,
        });
        setLoading(false);
      } catch (err) {
        console.error('Failed to render DOCX', err);
        if (!canceled) {
          setError('Unable to render document preview.');
          setLoading(false);
        }
      }
    };

    loadDocument();

    return () => {
      canceled = true;
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [document.id]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <span className="text-sm text-gray-600 dark:text-gray-300">Word Document</span>
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
      <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900 p-4">
        {loading && (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        )}
        {error && (
          <div className="text-red-600 bg-red-50 dark:bg-red-900/20 p-4 rounded">{error}</div>
        )}
        <div ref={containerRef} className="docx-preview-container" />
      </div>
    </div>
  );
}

// Office Document Viewer (for xlsx, pptx, doc, xls - shows download option)
function OfficeViewer({ document, documentType, onEdit }) {
  const typeLabels = {
    xlsx: 'Excel Spreadsheet',
    pptx: 'PowerPoint Presentation',
    doc: 'Word Document (Legacy)',
    xls: 'Excel Spreadsheet (Legacy)',
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <span className="text-sm text-gray-600 dark:text-gray-300">
          {typeLabels[documentType] || 'Office Document'}
        </span>
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
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center p-8">
          <DocumentIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Preview not available for this file type.
          </p>
          <a
            href={documentsAPI.fileUrl(document.id)}
            download
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
          >
            <ArrowDownTrayIcon className="h-5 w-5" />
            Download to View
          </a>
        </div>
      </div>
    </div>
  );
}

// Text File Viewer
function TextViewer({ document, onEdit }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
          setError('Failed to load file content.');
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
      <div className="flex items-center justify-between p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <span className="text-sm text-gray-600 dark:text-gray-300">Text File</span>
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
      <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900 p-4">
        {loading && (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        )}
        {error && (
          <div className="text-red-600 bg-red-50 dark:bg-red-900/20 p-4 rounded">{error}</div>
        )}
        {!loading && !error && (
          <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 dark:text-gray-200">
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
      <div className="flex items-center justify-between p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <span className="text-sm text-gray-600 dark:text-gray-300">File</span>
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
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center p-8">
          <DocumentIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 mb-2">{document.original_filename}</p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
            Preview not available for this file type.
          </p>
          <a
            href={documentsAPI.fileUrl(document.id)}
            download
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
          >
            <ArrowDownTrayIcon className="h-5 w-5" />
            Download
          </a>
        </div>
      </div>
    </div>
  );
}

// Main Document Viewer Modal
export default function DocumentViewerModal({ isOpen, onClose, document, onEdit }) {
  if (!isOpen || !document) return null;

  const documentType = getDocumentType(document);

  const renderViewer = () => {
    switch (documentType) {
      case 'image':
        return <ImageViewer document={document} onEdit={onEdit} />;
      case 'pdf':
        return <PDFViewer document={document} onEdit={onEdit} />;
      case 'docx':
        return <DocxViewer document={document} onEdit={onEdit} />;
      case 'xlsx':
      case 'pptx':
      case 'doc':
      case 'xls':
        return <OfficeViewer document={document} documentType={documentType} onEdit={onEdit} />;
      case 'text':
        return <TextViewer document={document} onEdit={onEdit} />;
      default:
        return <UnknownViewer document={document} onEdit={onEdit} />;
    }
  };

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-gray-500 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75 transition-opacity"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="fixed inset-4 sm:inset-8 flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex items-center gap-3 min-w-0">
            <DocumentIcon className="h-6 w-6 text-gray-400 flex-shrink-0" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 truncate">
              {document.original_filename}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={documentsAPI.fileUrl(document.id)}
              download
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              Download
            </a>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Viewer Content */}
        <div className="flex-1 overflow-hidden">{renderViewer()}</div>

        {/* Footer with document info */}
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex flex-wrap gap-4">
            <span>Type: {document.content_type || 'Unknown'}</span>
            <span>
              Size: {document.file_size ? formatFileSize(document.file_size) : 'Unknown'}
            </span>
            <span>
              Uploaded: {document.created_at ? new Date(document.created_at).toLocaleDateString() : 'Unknown'}
            </span>
            {document.description && <span>Description: {document.description}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Export the type detection function for external use
export { getDocumentType };
