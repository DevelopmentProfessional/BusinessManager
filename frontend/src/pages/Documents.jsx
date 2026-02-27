import React, { useEffect, useState, useRef, useMemo, lazy, Suspense } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  PlusIcon,
  DocumentIcon,
  TrashIcon,
  EyeIcon,
  PencilIcon,
  CheckIcon,
  ClockIcon,
  FolderOpenIcon,
  CheckCircleIcon,
  TagIcon,
  XMarkIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import useStore from '../services/useStore';
import Button_Toolbar from './components/Button_Toolbar';
import api, { documentsAPI, documentCategoriesAPI, templatesAPI } from '../services/api';
import Modal from './components/Modal';
import Table_Mobile from './components/Table_Mobile';
import Button_Add_Mobile from './components/Button_Add_Mobile';
import Gate_Permission from './components/Gate_Permission';
import Modal_Viewer_Document from './components/Modal_Viewer_Document';
import Modal_Edit_Document from './components/Modal_Edit_Document';
import Modal_Template_Editor from './components/Modal_Template_Editor';

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

      <div className="form-floating mb-2">
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          className="form-control form-control-sm"
          placeholder="Description"
          style={{ height: '80px' }}
        />
        <label htmlFor="description">Description (optional)</label>
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
    user,
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

  const [documents, setDocuments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  // Viewer modal state
  const [viewerDoc, setViewerDoc] = useState(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  // Edit modal state
  const [editDoc, setEditDoc] = useState(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Sign modal state
  const [signDoc, setSignDoc] = useState(null);
  const [isSignOpen, setIsSignOpen] = useState(false);
  const [signaturePreview, setSignaturePreview] = useState(null);
  const [signLoading, setSignLoading] = useState(false);

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
  
  // Filter dropdown state
  const [isFilterCategoriesOpen, setIsFilterCategoriesOpen] = useState(false);
  const [isFilterStatusOpen, setIsFilterStatusOpen] = useState(false);
  const [isFilterTypeOpen, setIsFilterTypeOpen] = useState(false);

  // Templates state
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [isTemplateEditorOpen, setIsTemplateEditorOpen] = useState(false);
  const [templateTypeFilter, setTemplateTypeFilter] = useState('all');

  const categoryNameById = useMemo(() => {
    return new Map(categories.map((cat) => [String(cat.id), cat.name]));
  }, [categories]);

  const entityTypeOptions = useMemo(() => {
    const types = documents
      .map((doc) => doc.entity_type)
      .filter(Boolean);
    return Array.from(new Set(types)).sort();
  }, [documents]);

  const getStatusFilterButtonClass = () => {
    if (statusFilter === 'signed') return 'bg-green-600 text-white';
    if (statusFilter === 'unsigned') return 'bg-red-600 text-white';
    return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600';
  };

  const filteredDocuments = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return documents.filter((doc) => {
      const categoryId = doc.category_id ?? doc.category?.id;
      const categoryName = categoryId != null ? categoryNameById.get(String(categoryId)) || '' : '';
      const docType = doc.entity_type || 'document';

      if (categoryFilter !== 'all' && String(categoryId || '') !== categoryFilter) return false;
      if (statusFilter === 'signed' && !doc.is_signed) return false;
      if (statusFilter === 'unsigned' && doc.is_signed) return false;
      if (typeFilter !== 'all' && docType !== typeFilter) return false;

      if (!term) return true;

      const haystack = [
        doc.original_filename,
        doc.description,
        doc.entity_type,
        categoryName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [documents, searchTerm, categoryFilter, statusFilter, typeFilter, categoryNameById]);

  // Ref to prevent double fetching in StrictMode
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    loadDocuments();
    loadCategories();
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setTemplatesLoading(true);
    try {
      const res = await templatesAPI.getAll();
      setTemplates(res.data || []);
    } catch (err) {
      console.warn('Failed to load templates', err);
    } finally {
      setTemplatesLoading(false);
    }
  };

  const handleNewTemplate = () => {
    setEditingTemplate(null);
    setIsTemplateEditorOpen(true);
  };

  const handleEditTemplate = (tpl) => {
    setEditingTemplate(tpl);
    setIsTemplateEditorOpen(true);
  };

  const handleSaveTemplate = async (data) => {
    if (editingTemplate?.id) {
      const res = await templatesAPI.update(editingTemplate.id, data);
      setTemplates((prev) => prev.map((t) => (t.id === editingTemplate.id ? res.data : t)));
    } else {
      const res = await templatesAPI.create(data);
      setTemplates((prev) => [...prev, res.data]);
    }
    setIsTemplateEditorOpen(false);
    setEditingTemplate(null);
  };

  const handleDeleteTemplate = async (tpl) => {
    if (!window.confirm(`Delete template "${tpl.name}"?`)) return;
    try {
      await templatesAPI.delete(tpl.id);
      setTemplates((prev) => prev.filter((t) => t.id !== tpl.id));
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Failed to delete template';
      alert(msg);
    }
  };

  const loadDocuments = async (retries = 2) => {
    setLoading(true);
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await documentsAPI.getAll();
        const documentsData = response?.data ?? response;
        if (Array.isArray(documentsData)) {
          setDocuments(documentsData);
          clearError();
          setLoading(false);
          return;
        } else {
          console.error('Invalid documents data format:', documentsData);
          setError('Invalid data format received from server');
          setDocuments([]);
        }
      } catch (err) {
        const isTimeout = err.code === 'ECONNABORTED' || err.message?.includes('timeout');
        if (isTimeout && attempt < retries) {
          console.warn(`Document load timeout, retrying (${attempt + 1}/${retries})...`);
          continue;
        }
        setError('Failed to load documents');
        console.error('Error loading documents:', err);
        setDocuments([]);
      }
    }
    setLoading(false);
  };

  const loadCategories = async (retries = 2) => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await documentCategoriesAPI.list();
        setCategories(res.data || []);
        return;
      } catch (err) {
        const isTimeout = err.code === 'ECONNABORTED' || err.message?.includes('timeout');
        if (isTimeout && attempt < retries) {
          continue;
        }
        console.warn('Failed to load categories', err);
      }
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

  // Handle sign from viewer modal
  const handleSignFromViewer = (doc) => {
    setIsViewerOpen(false);
    handleOpenSign(doc);
  };

  // Handle delete from viewer modal
  const handleDeleteFromViewer = async (doc) => {
    setIsViewerOpen(false);
    if (doc?.id) {
      await handleDeleteDocument(doc.id);
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
  const handleOpenSign = async (doc) => {
    setSignDoc(doc);
    setSignaturePreview(null);
    setIsSignOpen(true);
    // Load user's signature
    try {
      const res = await api.get('/auth/me/signature');
      setSignaturePreview(res.data?.signature_data || null);
    } catch (err) {
      setSignaturePreview(null);
    }
  };

  const handleSubmitSign = async () => {
    if (!signDoc) return;
    setSignLoading(true);
    try {
      const res = await documentsAPI.sign(signDoc.id);
      const signData = res.data;
      // Update the document in the list with sign info
      setDocuments((prev) =>
        prev.map((d) => (d.id === signDoc.id ? {
          ...d,
          is_signed: true,
          signed_by: signData.signed_by,
          signed_at: signData.signed_at,
          signature_image: signData.signature_image,
        } : d))
      );
      setIsSignOpen(false);
      setSignDoc(null);
      clearError();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to sign document');
      console.error(err);
    } finally {
      setSignLoading(false);
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

  // Permission check after all hooks
  if (
    !hasPermission('documents', 'read') &&
    !hasPermission('documents', 'write') &&
    !hasPermission('documents', 'delete') &&
    !hasPermission('documents', 'admin')
  ) {
    return <Navigate to="/profile" replace />;
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="d-flex flex-column vh-100 overflow-hidden bg-body">

      {/* Header */}
      <div className="flex-shrink-0 border-bottom p-3 d-flex align-items-center justify-content-between">
        <h1 className="h-4 mb-0 fw-bold text-body-emphasis">Documents</h1>
        <button
          type="button"
          onClick={() => setIsCategoriesOpen(true)}
          className="btn d-flex align-items-center gap-1 p-0 border-0"
          title="Manage categories"
          aria-label="Manage categories"
        >
          <span style={{ fontSize: '1.5rem' }}>🗄️</span>
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex-shrink-0 alert alert-danger border-0 rounded-0 m-0 d-flex align-items-center justify-content-between">
          <span>{error}</span>
          <button
            className="btn btn-sm btn-outline-danger ms-3"
            onClick={() => { clearError(); loadDocuments(); loadCategories(); }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Main table container */}
      <div className="flex-grow-1 d-flex flex-column overflow-hidden">

        {/* Container_Scrollable rows – grow upwards from bottom */}
        <div
          className="flex-grow-1 overflow-auto d-flex flex-column-reverse bg-white dark:bg-gray-900 no-scrollbar"
          style={{ background: 'var(--bs-body-bg)' }}
        >
          {showTemplates ? (
            /* ── Templates list ── */
            (() => {
              const TEMPLATE_TYPE_COLORS = {
                email: 'bg-blue-100 text-blue-800',
                invoice: 'bg-green-100 text-green-800',
                receipt: 'bg-teal-100 text-teal-800',
                memo: 'bg-purple-100 text-purple-800',
                quote: 'bg-yellow-100 text-yellow-800',
                custom: 'bg-gray-100 text-gray-700',
              };
              const filtered = templates.filter(
                (t) => templateTypeFilter === 'all' || t.template_type === templateTypeFilter
              );
              return filtered.length > 0 ? (
                <table className="table table-borderless table-hover mb-0 table-fixed">
                  <colgroup>
                    <col />
                    <col style={{ width: '80px' }} />
                  </colgroup>
                  <tbody>
                    {filtered.map((tpl) => (
                      <tr key={tpl.id} className="align-middle border-bottom" style={{ height: '56px' }}>
                        <td className="px-3">
                          <div className="d-flex align-items-center gap-2">
                            <span className="fw-medium text-truncate">{tpl.name}</span>
                            {tpl.is_standard && (
                              <span className="badge bg-warning text-dark" style={{ fontSize: '0.65rem' }}>Standard</span>
                            )}
                          </div>
                          <span className={`badge rounded-pill mt-1 ${TEMPLATE_TYPE_COLORS[tpl.template_type] || TEMPLATE_TYPE_COLORS.custom}`} style={{ fontSize: '0.65rem' }}>
                            {tpl.template_type}
                          </span>
                        </td>
                        <td className="text-center px-2">
                          <div className="d-flex gap-1 justify-content-center">
                            <button
                              onClick={() => handleEditTemplate(tpl)}
                              className="btn btn-sm btn-outline-primary border-0 p-1"
                              title="Edit"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteTemplate(tpl)}
                              className="btn btn-sm btn-outline-danger border-0 p-1"
                              title={tpl.is_standard ? 'Standard templates cannot be deleted' : 'Delete'}
                              disabled={tpl.is_standard}
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="d-flex align-items-center justify-content-center flex-grow-1 text-muted">
                  {templatesLoading ? 'Loading templates...' : 'No templates found'}
                </div>
              );
            })()
          ) : (
            /* ── Documents list ── */
            filteredDocuments.length > 0 ? (
              <table className="table table-borderless table-hover mb-0 table-fixed">
                <colgroup>
                  <col />
                  <col style={{ width: '60px' }} />
                </colgroup>
                <tbody>
                  {filteredDocuments.map((doc, index) => (
                    <tr
                      key={doc.id || index}
                      className="align-middle border-bottom"
                      style={{ height: '56px' }}
                    >
                      {/* File Name */}
                      <td className="px-3">
                        <div className="fw-medium text-truncate" style={{ maxWidth: '100%' }}>
                          {doc.original_filename ?? '(unnamed)'}
                        </div>
                        <div className="small text-muted text-truncate">
                          {doc.entity_type ? <span className="text-capitalize">{doc.entity_type}</span> : 'Document'}
                        </div>
                      </td>

                      {/* View */}
                      <td className="text-center px-2">
                        <button
                          onClick={() => handleView(doc)}
                          className="btn btn-sm btn-outline-primary border-0 p-1"
                          title="View"
                        >
                          👁
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="d-flex align-items-center justify-content-center flex-grow-1 text-muted">
                No documents found
              </div>
            )
          )}
        </div>

        {/* Fixed bottom – headers + controls */}
        <div className="app-footer-search flex-shrink-0 bg-white dark:bg-gray-800 border-top border-gray-200 dark:border-gray-700 shadow-sm" style={{ zIndex: 10 }}>
          {/* Column Headers */}
          <table className="table table-borderless mb-0 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
            <colgroup>
              <col />
              <col style={{ width: showTemplates ? '80px' : '60px' }} />
            </colgroup>
            <tfoot>
              <tr className="bg-gray-100 dark:bg-gray-700">
                <th>{showTemplates ? 'Template' : 'Document'}</th>
                <th className="text-center">{showTemplates ? 'Actions' : 'View'}</th>
              </tr>
            </tfoot>
          </table>

          {/* Controls */}
          <div className="p-3 pt-2 border-top border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            {!showTemplates && (
              <div className="position-relative w-100 mb-2">
                <span className="position-absolute top-50 start-0 translate-middle-y ps-2 text-muted">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0"/>
                  </svg>
                </span>
                <input
                  type="text"
                  placeholder="Search by name, type, or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="app-search-input form-control ps-5 w-100 rounded-pill"
                />
              </div>
            )}

            <div className="d-flex align-items-center gap-1 mb-1 flex-wrap pb-1" style={{ minHeight: '3rem' }}>
              {/* Templates toggle */}
              <Button_Toolbar
                icon={DocumentTextIcon}
                label="Templates"
                onClick={() => setShowTemplates((v) => !v)}
                className={`border-0 shadow-lg transition-all ${
                  showTemplates
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                title={showTemplates ? 'Back to Documents' : 'Templates'}
              />

              {showTemplates ? (
                /* Templates mode controls */
                <>
                  <button
                    type="button"
                    onClick={handleNewTemplate}
                    className="btn flex-shrink-0 d-flex align-items-center justify-content-center rounded-circle bg-secondary-600 hover:bg-secondary-700 text-white border-0 shadow-lg"
                    style={{ width: '3rem', height: '3rem' }}
                    title="New template"
                  >
                    <PlusIcon className="h-5 w-5" />
                  </button>
                  {/* Type filter for templates */}
                  {['all', 'email', 'invoice', 'receipt', 'memo', 'quote', 'custom'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTemplateTypeFilter(t)}
                      className={`btn btn-sm rounded-pill px-3 border-0 ${
                        templateTypeFilter === t
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </>
              ) : (
                /* Documents mode controls */
                <>
                  <Gate_Permission page="documents" permission="write">
                    <Button_Toolbar
                      icon={PlusIcon}
                      label="Upload"
                      onClick={handleUploadDocument}
                      className="bg-secondary-600 hover:bg-secondary-700 text-white border-0 shadow-lg"
                    />
                  </Gate_Permission>

              {/* Clear Filters Button */}
              {(categoryFilter !== 'all' || statusFilter !== 'all' || typeFilter !== 'all') && (
                <Button_Toolbar
                  icon={XMarkIcon}
                  label="Clear"
                  onClick={() => { setCategoryFilter('all'); setStatusFilter('all'); setTypeFilter('all'); }}
                  className="bg-red-600 hover:bg-red-700 text-white border-0 shadow-lg transition-all"
                />
              )}

              {/* Categories Filter */}
              <div className="position-relative">
                <Button_Toolbar
                  icon={FolderOpenIcon}
                  label="Category"
                  onClick={() => setIsFilterCategoriesOpen(!isFilterCategoriesOpen)}
                  className={`border-0 shadow-lg transition-all ${
                    categoryFilter !== 'all'
                      ? 'bg-primary-600 hover:bg-primary-700 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                  data-active={categoryFilter !== 'all'}
                />
                {isFilterCategoriesOpen && (
                  <div className="position-absolute bottom-100 start-0 mb-2 bg-white border border-gray-200 rounded-xl shadow-lg p-2 z-50" style={{ minWidth: '200px' }}>
                    <button
                      onClick={() => { setCategoryFilter('all'); setIsFilterCategoriesOpen(false); }}
                      className={`d-block w-100 text-start px-3 py-2 rounded-lg mb-1 transition-colors ${categoryFilter === 'all' ? 'bg-primary-50 text-primary-600' : 'hover:bg-gray-50 text-gray-900'}`}
                    >
                      All Categories
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => { setCategoryFilter(String(cat.id)); setIsFilterCategoriesOpen(false); }}
                        className={`d-block w-100 text-start px-3 py-2 rounded-lg mb-1 transition-colors ${categoryFilter === String(cat.id) ? 'bg-primary-50 text-primary-600' : 'hover:bg-gray-50 text-gray-900'}`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Status Filter */}
              <div className="position-relative">
                <Button_Toolbar
                  icon={CheckCircleIcon}
                  label="Status"
                  onClick={() => setIsFilterStatusOpen(!isFilterStatusOpen)}
                  className={`border-0 shadow-lg transition-all ${getStatusFilterButtonClass()}`}
                  data-active={statusFilter !== 'all'}
                />
                {isFilterStatusOpen && (
                  <div className="position-absolute bottom-100 start-0 mb-2 bg-white border border-gray-200 rounded-xl shadow-lg p-2 z-50" style={{ minWidth: '180px' }}>
                    <button
                      onClick={() => { setStatusFilter('all'); setIsFilterStatusOpen(false); }}
                      className={`d-block w-100 text-start px-3 py-2 rounded-lg mb-1 transition-colors ${statusFilter === 'all' ? 'bg-secondary-50 text-secondary-600' : 'hover:bg-gray-50 text-gray-900'}`}
                    >
                      All Statuses
                    </button>
                    <button
                      onClick={() => { setStatusFilter('signed'); setIsFilterStatusOpen(false); }}
                      className={`d-block w-100 text-start px-3 py-2 rounded-lg mb-1 transition-colors ${statusFilter === 'signed' ? 'bg-secondary-50 text-secondary-600' : 'hover:bg-gray-50 text-gray-900'}`}
                    >
                      Signed
                    </button>
                    <button
                      onClick={() => { setStatusFilter('unsigned'); setIsFilterStatusOpen(false); }}
                      className={`d-block w-100 text-start px-3 py-2 rounded-lg transition-colors ${statusFilter === 'unsigned' ? 'bg-secondary-50 text-secondary-600' : 'hover:bg-gray-50 text-gray-900'}`}
                    >
                      Unsigned
                    </button>
                  </div>
                )}
              </div>

              {/* Type Filter */}
              <div className="position-relative">
                <Button_Toolbar
                  icon={TagIcon}
                  label="Type"
                  onClick={() => setIsFilterTypeOpen(!isFilterTypeOpen)}
                  className={`border-0 shadow-lg transition-all ${
                    typeFilter !== 'all'
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                  data-active={typeFilter !== 'all'}
                />
                {isFilterTypeOpen && (
                  <div className="position-absolute bottom-100 start-0 mb-2 bg-white border border-gray-200 rounded-xl shadow-lg p-2 z-50" style={{ minWidth: '180px', maxHeight: '300px', overflowY: 'auto' }}>
                    <button
                      onClick={() => { setTypeFilter('all'); setIsFilterTypeOpen(false); }}
                      className={`d-block w-100 text-start px-3 py-2 rounded-lg mb-1 transition-colors ${typeFilter === 'all' ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-gray-50 text-gray-900'}`}
                    >
                      All Types
                    </button>
                    {entityTypeOptions.map((type) => (
                      <button
                        key={type}
                        onClick={() => { setTypeFilter(type); setIsFilterTypeOpen(false); }}
                        className={`d-block w-100 text-start px-3 py-2 rounded-lg mb-1 transition-colors ${typeFilter === type ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-gray-50 text-gray-900'}`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                )}
              </div>
                </>
              )}

            </div>
          </div>
        </div>
      </div>

      {/* Template Editor Modal */}
      {isTemplateEditorOpen && (
        <Modal_Template_Editor
          template={editingTemplate}
          onSave={handleSaveTemplate}
          onClose={() => { setIsTemplateEditorOpen(false); setEditingTemplate(null); }}
        />
      )}

      {/* Document Upload Modal */}
      <Modal
        isOpen={isModalOpen && modalContent === 'document-form'}
        onClose={closeModal}
        noPadding={true}
        fullScreen={true}
      >
        {isModalOpen && modalContent === 'document-form' && (
          <DocumentUploadForm
            onSubmit={handleSubmitDocument}
            onCancel={closeModal}
          />
        )}
      </Modal>

      {/* Document Viewer Modal */}
      <Modal_Viewer_Document
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        document={viewerDoc}
        onEdit={handleEditFromViewer}
        onSign={handleSignFromViewer}
        onDelete={handleDeleteFromViewer}
      />

      {/* Document Edit Modal */}
      <Modal_Edit_Document
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        document={editDoc}
        onSave={handleSaveEdit}
      />

      {/* History Modal */}
      <Modal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} noPadding={true} fullScreen={true}>
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
              <input type="file" name="newVersionFile" className="form-control form-control-sm mb-2" />
              <div className="form-floating mb-2">
                <input
                  type="text"
                  id="newVersionNote"
                  name="newVersionNote"
                  placeholder="Version Note"
                  className="form-control form-control-sm"
                />
                <label htmlFor="newVersionNote">Version Note (optional)</label>
              </div>
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
      <Modal isOpen={isSignOpen} onClose={() => setIsSignOpen(false)} noPadding={true} fullScreen={true}>
        {isSignOpen && signDoc && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Sign Document
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {signDoc.original_filename}
            </p>

            {signaturePreview ? (
              <>
                <div className="text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Your signature:
                  </p>
                  <div className="inline-block border rounded p-3 bg-white">
                    <img
                      src={signaturePreview}
                      alt="Your signature"
                      style={{ maxWidth: '300px', maxHeight: '100px' }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Signing as: {user?.first_name} {user?.last_name}
                  </p>
                </div>
                <div className="flex justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsSignOpen(false)}
                    className="btn-secondary"
                    disabled={signLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitSign}
                    className="btn-primary"
                    disabled={signLoading}
                  >
                    {signLoading ? 'Signing...' : 'Apply Signature'}
                  </button>
                </div>
              </>
            ) : signaturePreview === null && !signDoc ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
              </div>
            ) : (
              <>
                <div className="text-center py-4">
                  <p className="text-gray-600 dark:text-gray-400 mb-2">
                    No signature saved yet.
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-500">
                    Go to Employees &gt; Edit your profile &gt; Signature tab to create your signature.
                  </p>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setIsSignOpen(false)}
                    className="btn-secondary"
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* Categories Management Modal */}
      <Modal
        isOpen={isCategoriesOpen}
        onClose={() => { setIsCategoriesOpen(false); cancelEditCategory(); }}
        noPadding={true}
        fullScreen={true}
        footer={
          <div style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {/* Row 1 — Add / edit-save inputs + action button */}
            <form
              onSubmit={handleCreateCategory}
              className="px-3 pt-2 pb-1 d-flex align-items-center gap-2"
            >
              <div className="form-floating flex-grow-1" style={{ minWidth: 0 }}>
                <input
                  type="text"
                  id="newCatName"
                  placeholder="Category Name"
                  className="form-control form-control-sm"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  required
                />
                <label htmlFor="newCatName">Category Name *</label>
              </div>
              <div className="form-floating flex-grow-1" style={{ minWidth: 0 }}>
                <input
                  type="text"
                  id="newCatDesc"
                  placeholder="Description"
                  className="form-control form-control-sm"
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                />
                <label htmlFor="newCatDesc">Description</label>
              </div>
              <button
                type="submit"
                className="btn flex-shrink-0 d-flex align-items-center justify-content-center rounded-circle bg-secondary-600 hover:bg-secondary-700 text-white border-0 shadow"
                style={{ width: '3rem', height: '3rem' }}
                title="Add category"
              >
                <PlusIcon className="h-5 w-5" />
              </button>
            </form>

            {/* Row 2 — Cancel */}
            <div className="px-3 pb-2 pt-1">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary rounded-pill"
                onClick={() => { setIsCategoriesOpen(false); cancelEditCategory(); }}
              >
                Cancel
              </button>
            </div>
          </div>
        }
      >
        {isCategoriesOpen && (
          <div className="p-4 flex flex-col h-full">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3 flex-shrink-0">
              Manage Categories
            </h3>

            {/* Scrollable list */}
            <div
              className="flex-1 overflow-y-auto min-h-0"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-100 dark:bg-gray-700 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" style={{ width: '3.5rem' }}></th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-3 py-2" style={{ width: '8rem' }}></th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {categories.map((cat) => (
                    <tr key={cat.id} className="align-middle">
                      {/* Delete */}
                      <td className="px-3 py-1">
                        <button
                          type="button"
                          className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                          onClick={() => handleDeleteCategory(cat.id)}
                          title="Delete category"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </td>
                      {/* Name */}
                      <td className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300">
                        {editingCatId === cat.id ? (
                          <input
                            className="form-control form-control-sm"
                            value={editingCatName}
                            onChange={(e) => setEditingCatName(e.target.value)}
                          />
                        ) : (
                          cat.name
                        )}
                      </td>
                      {/* Description */}
                      <td className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300">
                        {editingCatId === cat.id ? (
                          <input
                            className="form-control form-control-sm"
                            value={editingCatDesc}
                            onChange={(e) => setEditingCatDesc(e.target.value)}
                          />
                        ) : (
                          cat.description || <span className="text-gray-400">—</span>
                        )}
                      </td>
                      {/* Actions */}
                      <td className="px-3 py-1">
                        {editingCatId === cat.id ? (
                          <div className="d-flex gap-1">
                            <button
                              type="button"
                              className="btn btn-sm d-flex align-items-center justify-content-center rounded-circle bg-success text-white border-0"
                              style={{ width: '3rem', height: '3rem' }}
                              onClick={() => saveEditCategory(cat.id)}
                              title="Save"
                            >
                              <CheckIcon className="h-5 w-5" />
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm d-flex align-items-center justify-content-center rounded-circle btn-outline-secondary border-0 bg-gray-200"
                              style={{ width: '3rem', height: '3rem' }}
                              onClick={cancelEditCategory}
                              title="Cancel edit"
                            >
                              <XMarkIcon className="h-5 w-5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-sm d-flex align-items-center justify-content-center rounded-circle btn-outline-secondary"
                            style={{ width: '3rem', height: '3rem' }}
                            onClick={() => startEditCategory(cat)}
                            title="Edit category"
                          >
                            <PencilIcon className="h-5 w-5" />
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
          </div>
        )}
      </Modal>
    </div>
  );
}
