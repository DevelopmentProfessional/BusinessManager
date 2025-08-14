import React, { useEffect, useState } from 'react';
import { PlusIcon, DocumentIcon, TrashIcon, EyeIcon } from '@heroicons/react/24/outline';
import useStore from '../store/useStore';
import { documentsAPI } from '../services/api';
import Modal from '../components/Modal';
import MobileTable from '../components/MobileTable';
import MobileAddButton from '../components/MobileAddButton';

function DocumentUploadForm({ onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    entity_type: 'client',
    entity_id: '',
    description: '',
    file: null
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    setFormData(prev => ({ ...prev, file: e.target.files[0] }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.file) {
      alert('Please select a file to upload');
      return;
    }
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Upload Document</h3>
      </div>

      <div>
        <label htmlFor="entity_type" className="block text-sm font-medium text-gray-700">
          Entity Type *
        </label>
        <select
          id="entity_type"
          name="entity_type"
          required
          value={formData.entity_type}
          onChange={handleChange}
          className="input-field mt-1"
        >
          <option value="client">Client</option>
          <option value="product">Product</option>
          <option value="employee">Employee</option>
          <option value="asset">Asset</option>
        </select>
      </div>

      <div>
        <label htmlFor="entity_id" className="block text-sm font-medium text-gray-700">
          Entity ID *
        </label>
        <input
          type="text"
          id="entity_id"
          name="entity_id"
          required
          value={formData.entity_id}
          onChange={handleChange}
          className="input-field mt-1"
          placeholder="Enter entity ID (UUID)"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          value={formData.description}
          onChange={handleChange}
          className="input-field mt-1"
          placeholder="Document description"
        />
      </div>

      <div>
        <label htmlFor="file" className="block text-sm font-medium text-gray-700">
          File *
        </label>
        <input
          type="file"
          id="file"
          name="file"
          required
          onChange={handleFileChange}
          className="input-field mt-1"
          accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
        />
        <p className="mt-1 text-sm text-gray-500">
          Supported formats: PDF, DOC, DOCX, TXT, JPG, PNG, GIF
        </p>
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
        <button type="submit" className="btn-primary">
          Upload Document
        </button>
      </div>
    </form>
  );
}

export default function Documents() {
  const { 
    loading, setLoading, error, setError, clearError,
    isModalOpen, openModal, closeModal
  } = useStore();

  const [documents, setDocuments] = useState([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const response = await documentsAPI.getAll();
      setDocuments(response.data);
      clearError();
    } catch (err) {
      setError('Failed to load documents');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadDocument = () => {
    openModal('document-form');
  };

  const handleSubmitDocument = async (documentData) => {
    try {
      await documentsAPI.upload(
        documentData.entity_type,
        documentData.entity_id,
        documentData.file,
        documentData.description
      );
      loadDocuments(); // Reload to show new document
      closeModal();
      clearError();
    } catch (err) {
      setError('Failed to upload document');
      console.error(err);
    }
  };

  const handleDeleteDocument = async (documentId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;

    try {
      await documentsAPI.delete(documentId);
      setDocuments(docs => docs.filter(doc => doc.id !== documentId));
      clearError();
    } catch (err) {
      setError('Failed to delete document');
      console.error(err);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button 
            type="button" 
            onClick={handleUploadDocument}
            className="btn-primary flex items-center"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Upload Document
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Mobile view */}
      <div className="mt-6 md:hidden">
        <MobileTable
          data={documents}
          columns={[
            { key: 'original_filename', title: 'File Name' },
            { key: 'entity_type', title: 'Entity', render: (v) => <span className="capitalize">{v}</span> },
            { key: 'file_size', title: 'Size', render: (v) => formatFileSize(v) },
          ]}
          onDelete={(item) => handleDeleteDocument(item.id)}
          rightActions={(item) => (
            <button
              onClick={() => handlePreview(item)}
              className="flex-shrink-0 p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              title="Preview"
            >
              <EyeIcon className="h-5 w-5" />
            </button>
          )}
          emptyMessage="No documents uploaded yet"
        />
        <MobileAddButton onClick={handleUploadDocument} label="Upload" />
      </div>

      {/* Desktop table */}
      <div className="mt-8 flow-root hidden md:block">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      File Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Entity Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Entity ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      File Size
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Upload Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="relative px-6 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {documents.map((document) => (
                    <tr key={document.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <div className="flex items-center">
                          <DocumentIcon className="h-5 w-5 text-gray-400 mr-2" />
                          {document.original_filename}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className="capitalize">{document.entity_type}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {document.entity_id.slice(0, 8)}...
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatFileSize(document.file_size)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(document.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {document.description || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                        <button
                          onClick={() => handlePreview(document)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          <EyeIcon className="h-5 w-5 inline" />
                          <span className="sr-only">Preview</span>
                        </button>
                        <button
                          onClick={() => handleDeleteDocument(document.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {documents.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500">No documents found. Upload your first document to get started.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal for Document Upload Form */}
      <Modal isOpen={isModalOpen} onClose={closeModal}>
        {isModalOpen && (
          <DocumentUploadForm
            onSubmit={handleSubmitDocument}
            onCancel={closeModal}
          />
        )}
      </Modal>

      {/* Preview Modal */}
      <Modal isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)}>
        {isPreviewOpen && previewDoc && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Preview</h3>
              <a
                href={documentsAPI.fileUrl(previewDoc.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
              >
                Open in new tab
              </a>
            </div>
            <div className="border rounded overflow-hidden max-h-[70vh]">
              {previewDoc.content_type && previewDoc.content_type.startsWith('image/') ? (
                <img
                  src={documentsAPI.fileUrl(previewDoc.id)}
                  alt={previewDoc.original_filename}
                  className="w-full h-auto"
                />
              ) : previewDoc.content_type === 'application/pdf' ? (
                <iframe
                  title="PDF Preview"
                  src={documentsAPI.fileUrl(previewDoc.id)}
                  className="w-full h-[70vh]"
                />
              ) : (
                <div className="p-4 text-sm text-gray-700">
                  Preview not available for this file type. Use the button above to open or download.
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
