import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  DocumentIcon, 
  ArrowLeftIcon,
  CheckIcon,
  XMarkIcon,
  EyeIcon,
  DocumentArrowDownIcon
} from '@heroicons/react/24/outline';
import { documentsAPI } from '../services/api';
import OnlyOfficeEditor from './components/OnlyOfficeEditor';
import useStore from '../services/useStore';

export default function DocumentEditor() {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const { setLoading, setError, clearError } = useStore();
  
  const [document, setDocument] = useState(null);
  const [loading, setLocalLoading] = useState(true);
  const [error, setLocalError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    loadDocument();
  }, [documentId]);

  const loadDocument = async () => {
    setLocalLoading(true);
    setLocalError('');
    try {
      const response = await documentsAPI.getById(documentId);
      setDocument(response.data);
      clearError();
    } catch (err) {
      setLocalError('Failed to load document');
      setError('Failed to load document');
      console.error(err);
    } finally {
      setLocalLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // The OnlyOffice editor handles saving automatically
      // This is just for UI feedback
      await new Promise(resolve => setTimeout(resolve, 1000));
      clearError();
    } catch (err) {
      setError('Failed to save document');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = () => {
    if (document) {
      const link = document.createElement('a');
      link.href = documentsAPI.fileUrl(document.id, { download: true });
      link.download = document.original_filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleClose = () => {
    navigate('/documents');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="text-red-600 mb-4">
          <DocumentIcon className="h-16 w-16" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Document Not Found</h2>
        <p className="text-gray-600 mb-4">{error || 'The document could not be loaded.'}</p>
        <button
          onClick={handleClose}
          className="btn-primary flex items-center"
        >
          <ArrowLeftIcon className="h-5 w-5 mr-2" />
          Back to Documents
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header Ribbon */}
      <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <button
              onClick={handleClose}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Back to Documents"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <div className="flex items-center space-x-2">
              <DocumentIcon className="h-6 w-6 text-blue-600" />
              <span className="font-medium text-gray-900 dark:text-gray-100">{document.original_filename}</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                showPreview 
                  ? 'bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300' 
                  : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
              title="Toggle Preview"
            >
              <EyeIcon className="h-4 w-4 inline mr-1" />
              Preview
            </button>
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 text-sm rounded border bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              title="Download"
            >
              <DocumentArrowDownIcon className="h-4 w-4 inline mr-1" />
              Download
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-1.5 text-sm rounded bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
              title="Save"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <CheckIcon className="h-4 w-4 mr-1" />
                  Save
                </>
              )}
            </button>
            <button
              onClick={handleClose}
              className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              title="Close"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Document Info Bar */}
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center space-x-4">
              <span>Size: {formatFileSize(document.file_size)}</span>
              <span>Uploaded: {new Date(document.created_at).toLocaleDateString()}</span>
              {document.description && (
                <span>Description: {document.description}</span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {document.is_signed && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                  <CheckIcon className="h-3 w-3 mr-1" />
                  Signed{document.signed_by ? ` by ${document.signed_by}` : ''}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Editor Area - Document content should be light/white regardless of dark mode */}
      <div className="flex-1 overflow-hidden bg-white">
        {showPreview ? (
          <div className="w-full h-full bg-white">
            {(() => {
              const ct = (document.content_type || '').toLowerCase();
              const name = (document.original_filename || '').toLowerCase();
              
              if ((ct && ct.startsWith('image/')) || /(\.png|\.jpg|\.jpeg|\.gif|\.webp)$/i.test(name)) {
                return (
                  <img
                    src={documentsAPI.fileUrl(document.id)}
                    alt={document.original_filename}
                    className="w-full h-full object-contain bg-white"
                  />
                );
              } else if (ct.includes('pdf') || name.endsWith('.pdf')) {
                return (
                  <iframe
                    title="PDF Preview"
                    src={documentsAPI.fileUrl(document.id)}
                    className="w-full h-full bg-white"
                  />
                );
              } else {
                return (
                  <div className="flex items-center justify-center h-full bg-white">
                    <div className="text-center">
                      <DocumentIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">Preview not available for this file type.</p>
                      <p className="text-sm text-gray-500 mt-2">Use the editor for supported document types.</p>
                    </div>
                  </div>
                );
              }
            })()}
          </div>
        ) : (
          <OnlyOfficeEditor documentId={document.id} />
        )}
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

