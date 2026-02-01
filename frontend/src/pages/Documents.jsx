import React, { useEffect, useState, useRef } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  PlusIcon,
  DocumentIcon,
  TrashIcon,
  EyeIcon,
  PencilIcon,
  CheckIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import useStore from '../services/useStore';
import { documentsAPI, documentCategoriesAPI } from '../services/api';
import Modal from './components/Modal';
import MobileTable from './components/MobileTable';
import MobileAddButton from './components/MobileAddButton';
import PermissionGate from './components/PermissionGate';
import DocumentViewerModal from './components/DocumentViewerModal';
import DocumentEditModal from './components/DocumentEditModal';

function DocumentUploadForm({ onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    description: '',
    file: null,
  });
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    setFormData((prev) => ({ ...prev, file: e.target.files[0] }));
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFormData((prev) => ({ ...prev, file: e.dataTransfer.files[0] }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.file) {
      alert('Please select a file to upload');
      return;
    }
    try {
      setUploading(true);
      await onSubmit(formData);
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-1">
      <div className="mb-1">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
          Upload Document
        </h3>
      </div>

      {/* Drag and Drop Zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-1 text-center transition-colors ${
          dragActive
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {formData.file ? (
          <div className="space-y-2">
            <DocumentIcon className="h-12 w-12 text-primary-500 mx-auto" />
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {formData.file.name}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formatFileSize(formData.file.size)}
            </p>
            <button
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, file: null }))}
              className="text-sm text-red-600 hover:text-red-700"
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <PlusIcon className="h-12 w-12 text-gray-400 mx-auto" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Drag and drop a file here, or click to select
            </p>
            <input
              type="file"
              id="file"
              name="file"
              onChange={handleFileChange}
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif"
            />
            <label
              htmlFor="file"
              className="inline-block px-4 py-2 bg-primary-600 text-white rounded cursor-pointer hover:bg-primary-700"
            >
              Select File
            </label>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Supported: PDF, DOC/DOCX, XLS/XLSX, CSV, PPT/PPTX, TXT, JPG/PNG/GIF
      </p>

      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Description (optional)
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

      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary"
          disabled={uploading}
        >
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={uploading}>
          {uploading ? 'Uploading...' : 'Upload Document'}
        </button>
      </div>
    </form>
  );
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function Documents() {
  const navigate = useNavigate();
  const {
    loading,
    setLoading,
    error,
    setError,
    clearError,
    isModalOpen,
    modalContent,
    openModal,
    closeModal,
    hasPermission,
  } = useStore();

  // Check permissions at page level
  if (
    !hasPermission('documents', 'read') &&
    !hasPermission('documents', 'write') &&
    !hasPermission('documents', 'delete') &&
    !hasPermission('documents', 'admin')
  ) {
    return <Navigate to="/profile" replace />;
  }

  const [documents, setDocuments] = useState([]);

  // Viewer modal state
  const [viewerDoc, setViewerDoc] = useState(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  // Edit modal state
  const [editDoc, setEditDoc] = useState(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Sign modal state
  const [signDoc, setSignDoc] = useState(null);
  const [isSignOpen, setIsSignOpen] = useState(false);
  const [signerName, setSignerName] = useState('');

  // History modal state
  const [historyDoc, setHistoryDoc] = useState(null);
  const [historyItems, setHistoryItems] = useState([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Categories management state
  const [categories, setCategories] = useState([]);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [editingCatId, setEditingCatId] = useState(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [editingCatDesc, setEditingCatDesc] = useState('');

  // Ref to prevent double fetching in StrictMode
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    loadDocuments();
    loadCategories();
  }, []);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const response = await documentsAPI.getAll();
      const documentsData = response?.data ?? response;
      if (Array.isArray(documentsData)) {
        setDocuments(documentsData);
        clearError();
      } else {
        console.error('Invalid documents data format:', documentsData);
        setError('Invalid data format received from server');
        setDocuments([]);
      }
    } catch (err) {
      setError('Failed to load documents');
      console.error('Error loading documents:', err);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const res = await documentCategoriesAPI.list();
      setCategories(res.data || []);
    } catch (err) {
      console.warn('Failed to load categories', err);
    }
  };

  // View document in modal
  const handleView = (doc) => {
    setViewerDoc(doc);
    setIsViewerOpen(true);
  };

  // Open edit modal (can be called from viewer)
  const handleOpenEdit = (doc) => {
    setEditDoc(doc);
    setIsEditOpen(true);
  };

  // Handle edit from viewer modal
  const handleEditFromViewer = () => {
    if (viewerDoc) {
      setIsViewerOpen(false);
      handleOpenEdit(viewerDoc);
    }
  };

  // Save edited document
  const handleSaveEdit = (updatedDoc) => {
    setDocuments((prev) =>
      prev.map((d) => (d.id === updatedDoc.id ? updatedDoc : d))
    );
    // Also update viewerDoc if it's the same document
    if (viewerDoc && viewerDoc.id === updatedDoc.id) {
      setViewerDoc(updatedDoc);
    }
  };

  // Open in dedicated editor page
  const handleOpenEditor = (doc) => {
    navigate(`/documents/${doc.id}/edit`);
  };

  // Sign document
  const handleOpenSign = (doc) => {
    setSignDoc(doc);
    setSignerName('');
    setIsSignOpen(true);
  };

  const handleSubmitSign = async (e) => {
    e.preventDefault();
    if (!signDoc || !signerName.trim()) return;
    try {
      const res = await documentsAPI.sign(signDoc.id, signerName.trim());
      setDocuments((prev) =>
        prev.map((d) => (d.id === signDoc.id ? res.data : d))
      );
      setIsSignOpen(false);
      setSignDoc(null);
      setSignerName('');
      clearError();
    } catch (err) {
      setError('Failed to sign document');
      console.error(err);
    }
  };

  // History
  const handleOpenHistory = async (doc) => {
    setHistoryDoc(doc);
    try {
      const res = await documentsAPI.history(doc.id);
      setHistoryItems(res.data || []);
    } catch (err) {
      console.error('Failed to load history', err);
      setHistoryItems([]);
    }
    setIsHistoryOpen(true);
  };

  const handleReplaceContent = async (e) => {
    e.preventDefault();
    if (!historyDoc) return;
    const fileInput = e.target.elements?.newVersionFile;
    const noteInput = e.target.elements?.newVersionNote;
    const file = fileInput?.files?.[0];
    const note = noteInput?.value || undefined;
    if (!file) return;
    try {
      await documentsAPI.replaceContent(historyDoc.id, file, note);
      await loadDocuments();
      const res = await documentsAPI.history(historyDoc.id);
      setHistoryItems(res.data || []);
      clearError();
    } catch (err) {
      setError('Failed to replace content');
      console.error(err);
    }
  };

  // Upload
  const handleUploadDocument = () => {
    if (!hasPermission('documents', 'write')) {
      setError('You do not have permission to upload documents');
      return;
    }
    openModal('document-form');
  };

  const handleSubmitDocument = async (documentData) => {
    try {
      await documentsAPI.upload(documentData.file, documentData.description);
      loadDocuments();
      closeModal();
      clearError();
    } catch (err) {
      setError('Failed to upload document');
      console.error(err);
    }
  };

  // Delete
  const handleDeleteDocument = async (documentId) => {
    if (!hasPermission('documents', 'delete')) {
      setError('You do not have permission to delete documents');
      return;
    }

    if (!window.confirm('Are you sure you want to delete this document?'))
      return;

    try {
      await documentsAPI.delete(documentId);
      setDocuments((docs) => docs.filter((doc) => doc.id !== documentId));
      clearError();
    } catch (err) {
      setError('Failed to delete document');
      console.error(err);
    }
  };

  // Categories management
  const handleCreateCategory = async (e) => {
    e?.preventDefault?.();
    const name = newCatName.trim();
    if (!name) return;
    try {
      const res = await documentCategoriesAPI.create({
        name,
        description: newCatDesc || null,
      });
      setCategories((prev) => [...prev, res.data]);
      setNewCatName('');
      setNewCatDesc('');
    } catch (err) {
      console.error('Failed to create category', err);
    }
  };

  const startEditCategory = (cat) => {
    setEditingCatId(cat.id);
    setEditingCatName(cat.name || '');
    setEditingCatDesc(cat.description || '');
  };

  const cancelEditCategory = () => {
    setEditingCatId(null);
    setEditingCatName('');
    setEditingCatDesc('');
  };

  const saveEditCategory = async (catId) => {
    try {
      const payload = {
        name: editingCatName || undefined,
        description: editingCatDesc,
      };
      const res = await documentCategoriesAPI.update(catId, payload);
      setCategories((prev) =>
        prev.map((c) => (c.id === catId ? res.data : c))
      );
      cancelEditCategory();
    } catch (err) {
      console.error('Failed to update category', err);
    }
  };

  const handleDeleteCategory = async (catId) => {
    if (!window.confirm('Delete this category?')) return;
    try {
      await documentCategoriesAPI.delete(catId);
      setCategories((prev) => prev.filter((c) => c.id !== catId));
    } catch (err) {
      console.error('Failed to delete category', err);
    }
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Documents
          </h1>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none flex gap-2">
          <PermissionGate page="documents" permission="write">
            <button
              type="button"
              onClick={handleUploadDocument}
              className="btn-primary flex items-center"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Upload Document
            </button>
          </PermissionGate>
          <PermissionGate page="documents" permission="write">
            <button
              type="button"
              onClick={() => setIsCategoriesOpen(true)}
              className="btn-secondary"
              title="Manage Categories"
            >
              Manage Categories
            </button>
          </PermissionGate>
        </div>
      </div>

      {error && (
        <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded">
          {error}
        </div>
      )}


      {/* Documents List */}
      <div className="mt-6">
        <MobileTable
          data={documents}
          columns={[
            { key: 'original_filename', title: 'File Name' },
            {
              key: 'entity_type',
              title: 'Entity',
              render: (v) =>
                v ? <span className="capitalize">{v}</span> : '-',
            },
            {
              key: 'file_size',
              title: 'Size',
              render: (v) => formatFileSize(v),
            },
            {
              key: 'is_signed',
              title: 'Signed',
              render: (v) =>
                v ? (
                  <span className="text-green-600">Yes</span>
                ) : (
                  <span className="text-gray-500">No</span>
                ),
            },
          ]}
          onDelete={(item) => handleDeleteDocument(item.id)}
          rightActions={(item) => (
            <div className="flex space-x-2">
              <button
                onClick={() => handleView(item)}
                className="flex-shrink-0 p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                title="View"
              >
                <EyeIcon className="h-5 w-5" />
              </button>
              <button
                onClick={() => handleOpenEdit(item)}
                className="flex-shrink-0 p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Edit"
              >
                <PencilIcon className="h-5 w-5" />
              </button>
              <button
                onClick={() => handleOpenHistory(item)}
                className="flex-shrink-0 p-2 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                title="History"
              >
                <ClockIcon className="h-5 w-5" />
              </button>
              <button
                onClick={() => handleOpenSign(item)}
                className="flex-shrink-0 p-2 text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                title="Sign"
              >
                <CheckIcon className="h-5 w-5" />
              </button>
            </div>
          )}
          emptyMessage="No documents uploaded yet"
        />
        <MobileAddButton onClick={handleUploadDocument} label="Upload" />
      </div>

      {/* Document Upload Modal */}
      <Modal
        isOpen={isModalOpen && modalContent === 'document-form'}
        onClose={closeModal}
      >
        {isModalOpen && modalContent === 'document-form' && (
          <DocumentUploadForm
            onSubmit={handleSubmitDocument}
            onCancel={closeModal}
          />
        )}
      </Modal>

      {/* Document Viewer Modal */}
      <DocumentViewerModal
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        document={viewerDoc}
        onEdit={handleEditFromViewer}
      />

      {/* Document Edit Modal */}
      <DocumentEditModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        document={editDoc}
        onSave={handleSaveEdit}
      />

      {/* History Modal */}
      <Modal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)}>
        {isHistoryOpen && historyDoc && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              History: {historyDoc.original_filename}
            </h3>
            <div className="max-h-[40vh] overflow-auto border dark:border-gray-700 rounded">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Note
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {historyItems.map((h) => (
                    <tr key={h.id}>
                      <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                        {new Date(h.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                        {h.note || '-'}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        <a
                          className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
                          href={documentsAPI.historyFileUrl(h.id, {
                            download: true,
                          })}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Download
                        </a>
                      </td>
                    </tr>
                  ))}
                  {historyItems.length === 0 && (
                    <tr>
                      <td
                        className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400"
                        colSpan={3}
                      >
                        No history yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <form onSubmit={handleReplaceContent} className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Upload new version
              </label>
              <input type="file" name="newVersionFile" className="input-field" />
              <input
                type="text"
                name="newVersionNote"
                placeholder="Optional note for this version"
                className="input-field"
              />
              <div className="flex justify-end">
                <button type="submit" className="btn-primary">
                  Replace Content
                </button>
              </div>
            </form>
          </div>
        )}
      </Modal>

      {/* Sign Document Modal */}
      <Modal isOpen={isSignOpen} onClose={() => setIsSignOpen(false)}>
        {isSignOpen && signDoc && (
          <form onSubmit={handleSubmitSign} className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Sign Document
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {signDoc.original_filename}
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Signer Name *
              </label>
              <input
                type="text"
                required
                className="input-field mt-1"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Enter your name"
              />
            </div>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setIsSignOpen(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Sign
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Categories Management Modal */}
      <Modal isOpen={isCategoriesOpen} onClose={() => setIsCategoriesOpen(false)}>
        {isCategoriesOpen && (
          <div className="flex flex-col max-h-[70vh]">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
              Manage Categories
            </h3>

            {/* Scrollable content area */}
            <div className="flex-1 overflow-y-auto min-h-0">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-100 dark:bg-gray-700 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-16">
                      Delete
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {categories.map((cat) => (
                    <tr key={cat.id}>
                      <td className="px-4 py-2 text-sm">
                        <button
                          type="button"
                          className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                          onClick={() => handleDeleteCategory(cat.id)}
                          title="Delete category"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                        {editingCatId === cat.id ? (
                          <input
                            className="input-field"
                            value={editingCatName}
                            onChange={(e) => setEditingCatName(e.target.value)}
                          />
                        ) : (
                          cat.name
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                        {editingCatId === cat.id ? (
                          <input
                            className="input-field"
                            value={editingCatDesc}
                            onChange={(e) => setEditingCatDesc(e.target.value)}
                          />
                        ) : (
                          cat.description || '-'
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {editingCatId === cat.id ? (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={() => saveEditCategory(cat.id)}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={cancelEditCategory}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => startEditCategory(cat)}
                          >
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {categories.length === 0 && (
                    <tr>
                      <td
                        className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400"
                        colSpan={4}
                      >
                        No categories yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Add Category form at bottom */}
            <form
              onSubmit={handleCreateCategory}
              className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="New category name"
                  className="input-field"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  required
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  className="input-field"
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                />
                <div className="flex justify-end">
                  <button type="submit" className="btn-primary">
                    Add Category
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}
      </Modal>
    </div>
  );
}
