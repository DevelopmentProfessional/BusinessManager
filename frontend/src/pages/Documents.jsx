import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { PlusIcon, DocumentIcon, TrashIcon, PencilIcon, CheckIcon, ClockIcon, AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline';
import useStore from '../store/useStore';
import { usePermissionRefresh } from '../hooks/usePermissionRefresh';
import { documentsAPI, documentCategoriesAPI, employeesAPI } from '../services/api';
import Modal from '../components/Modal';
import MobileTable from '../components/MobileTable';
import MobileAddButton from '../components/MobileAddButton';
import PermissionGate from '../components/PermissionGate';
import { renderAsync } from 'docx-preview';
import OnlyOfficeEditor from '../components/OnlyOfficeEditor';
import CustomDropdown from '../components/CustomDropdown';

function DocumentUploadForm({ onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    description: '',
    file: null
  });
  const [uploading, setUploading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    setFormData(prev => ({ ...prev, file: e.target.files[0] }));
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Upload Document</h3>
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
          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif"
        />
        <p className="mt-1 text-sm text-gray-500">
          Supported: PDF, DOC/DOCX, XLS/XLSX, CSV, PPT/PPTX, TXT, JPG/PNG/GIF
        </p>
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <button type="button" onClick={onCancel} className="btn-secondary" disabled={uploading}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={uploading}>
          {uploading ? 'Uploading…' : 'Upload Document'}
        </button>
      </div>
    </form>
  );
}

export default function Documents() {
  const navigate = useNavigate();
  const { 
    loading, setLoading, error, setError, clearError,
    isModalOpen, modalContent, openModal, closeModal, hasPermission
  } = useStore();

  // Use the permission refresh hook
  usePermissionRefresh();

  // Check permissions at page level
  if (!hasPermission('documents', 'read') && 
      !hasPermission('documents', 'write') && 
      !hasPermission('documents', 'delete') && 
      !hasPermission('documents', 'admin')) {
    return <Navigate to="/profile" replace />;
  }

  const [documents, setDocuments] = useState([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editDoc, setEditDoc] = useState(null);
  const [isSignOpen, setIsSignOpen] = useState(false);
  const [signDoc, setSignDoc] = useState(null);
  const [signerName, setSignerName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [categories, setCategories] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [editOwnerId, setEditOwnerId] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editReviewDate, setEditReviewDate] = useState('');
  const [editAssignments, setEditAssignments] = useState([]);
  const [assignEmployeeId, setAssignEmployeeId] = useState('');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyDoc, setHistoryDoc] = useState(null);
  const [historyItems, setHistoryItems] = useState([]);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [editingCatId, setEditingCatId] = useState(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [editingCatDesc, setEditingCatDesc] = useState('');
  const [docxContainerEl, setDocxContainerEl] = useState(null);
  const [docxError, setDocxError] = useState('');
  const ONLYOFFICE_URL = (import.meta.env.VITE_ONLYOFFICE_URL || '').trim();
  const onlyofficeEnabled = !!ONLYOFFICE_URL;

  useEffect(() => {
    loadDocuments();
    loadMetaLists();
  }, []);

  // Render DOCX inline when preview modal opens (view-only fallback if OnlyOffice editing isn't enabled)
  useEffect(() => {
    let canceled = false;
    const renderDocx = async () => {
      const ct = (previewDoc?.content_type || '').toLowerCase();
      const name = (previewDoc?.original_filename || '').toLowerCase();
      if (!isPreviewOpen || !previewDoc) return;
      // If OnlyOffice is enabled and this is an editable Office doc, skip docx-preview fallback
      const isOfficeEditable = ct.includes('wordprocessingml.document') || name.endsWith('.docx') || ct.includes('spreadsheetml.sheet') || name.endsWith('.xlsx') || ct.includes('presentationml.presentation') || name.endsWith('.pptx');
      if (onlyofficeEnabled && isOfficeEditable) return;
      if (!docxContainerEl) return;
      const isDocx = ct.includes('wordprocessingml.document') || name.endsWith('.docx');
      if (isDocx) {
        try {
          const res = await fetch(documentsAPI.fileUrl(previewDoc.id));
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }
          const ab = await res.arrayBuffer();
          if (canceled) return;
          // Clear previous content before rendering
          docxContainerEl.innerHTML = '';
          await renderAsync(ab, docxContainerEl, undefined, { className: 'docx', inWrapper: false });
          setDocxError('');
        } catch (err) {
          console.error('Failed to render DOCX preview', err);
          setDocxError('Unable to render DOCX preview.');
        }
      } else {
        // Clean up if switching away from DOCX type
        if (docxContainerEl) {
          docxContainerEl.innerHTML = '';
        }
        setDocxError('');
      }
    };
    renderDocx();
    return () => {
      canceled = true;
      if (docxContainerEl) docxContainerEl.innerHTML = '';
      setDocxError('');
    };
  }, [isPreviewOpen, previewDoc, docxContainerEl, onlyofficeEnabled]);

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

  const handlePreview = (doc) => {
    setPreviewDoc(doc);
    // Initialize inline edit fields with selected document values
    setEditDescription(doc.description || '');
    setEditOwnerId(doc.owner_id || '');
    setEditCategoryId(doc.category_id || '');
    setEditReviewDate(formatDateInput(doc.review_date));
    setIsPreviewOpen(true);
  };

  const handleOpenEditor = (doc) => {
    navigate(`/documents/${doc.id}/edit`);
  };

  const handleOpenEdit = (doc) => {
    setEditDoc(doc);
    setEditDescription(doc.description || '');
    setEditOwnerId(doc.owner_id || '');
    setEditCategoryId(doc.category_id || '');
    setEditReviewDate(formatDateInput(doc.review_date));
    loadAssignments(doc.id);
    setIsEditOpen(true);
  };

  const handleSubmitEdit = async (e) => {
    e.preventDefault();
    if (!editDoc) return;
    try {
      const body = {
        description: editDescription,
        owner_id: editOwnerId || null,
        category_id: editCategoryId || null,
        review_date: editReviewDate || null,
      };
      const res = await documentsAPI.update(editDoc.id, body);
      setDocuments((prev) => prev.map((d) => (d.id === editDoc.id ? res.data : d)));
      setIsEditOpen(false);
      setEditDoc(null);
      clearError();
    } catch (err) {
      setError('Failed to update document');
      console.error(err);
    }
  };

  // Save edits from the fullscreen preview footer without closing the preview
  const handleSubmitInlineEdit = async (e) => {
    e.preventDefault();
    if (!previewDoc) return;
    try {
      const body = {
        description: editDescription,
        owner_id: editOwnerId || null,
        category_id: editCategoryId || null,
        review_date: editReviewDate || null,
      };
      const res = await documentsAPI.update(previewDoc.id, body);
      setDocuments((prev) => prev.map((d) => (d.id === previewDoc.id ? res.data : d)));
      setPreviewDoc(res.data);
      clearError();
    } catch (err) {
      setError('Failed to update document');
      console.error(err);
    }
  };

  const handleOpenSign = (doc) => {
    setSignDoc(doc);
    setSignerName('');
    setIsSignOpen(true);
  };

  const loadMetaLists = async () => {
    try {
      const [catsRes, empRes] = await Promise.all([
        documentCategoriesAPI.list(),
        employeesAPI.getAll(),
      ]);
      setCategories(catsRes.data || []);
      setEmployees(empRes.data || []);
    } catch (err) {
      console.warn('Failed to load categories or employees', err);
    }
  };

  const loadAssignments = async (documentId) => {
    try {
      const res = await documentsAPI.listAssignments(documentId);
      setEditAssignments(res.data || []);
    } catch (err) {
      console.warn('Failed to load assignments', err);
      setEditAssignments([]);
    }
  };

  const handleAddAssignment = async () => {
    if (!editDoc || !assignEmployeeId) return;
    try {
      await documentsAPI.addAssignment(editDoc.id, assignEmployeeId);
      setAssignEmployeeId('');
      await loadAssignments(editDoc.id);
    } catch (err) {
      console.error('Failed to add assignment', err);
    }
  };

  const handleRemoveAssignment = async (employee_id) => {
    if (!editDoc) return;
    try {
      await documentsAPI.removeAssignment(editDoc.id, employee_id);
      await loadAssignments(editDoc.id);
    } catch (err) {
      console.error('Failed to remove assignment', err);
    }
  };

  // Categories management handlers
  const handleCreateCategory = async (e) => {
    e?.preventDefault?.();
    const name = newCatName.trim();
    if (!name) return;
    try {
      const res = await documentCategoriesAPI.create({ name, description: newCatDesc || null });
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
      const payload = { name: editingCatName || undefined, description: editingCatDesc };
      const res = await documentCategoriesAPI.update(catId, payload);
      setCategories((prev) => prev.map((c) => (c.id === catId ? res.data : c)));
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
      // If current edit doc uses this category, clear selection
      setEditCategoryId((prev) => (prev === catId ? '' : prev));
    } catch (err) {
      console.error('Failed to delete category', err);
    }
  };

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

  const formatDateInput = (value) => {
    if (!value) return '';
    try {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return '';
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    } catch {
      return '';
    }
  };

  const handleSubmitSign = async (e) => {
    e.preventDefault();
    if (!signDoc || !signerName.trim()) return;
    try {
      const res = await documentsAPI.sign(signDoc.id, signerName.trim());
      setDocuments((prev) => prev.map((d) => (d.id === signDoc.id ? res.data : d)));
      setIsSignOpen(false);
      setSignDoc(null);
      setSignerName('');
      clearError();
    } catch (err) {
      setError('Failed to sign document');
      console.error(err);
    }
  };

  const handleUploadDocument = () => {
    if (!hasPermission('documents', 'write')) {
      setError('You do not have permission to upload documents');
      return;
    }
    openModal('document-form');
  };

  const handleSubmitDocument = async (documentData) => {
    try {
      await documentsAPI.upload(
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
    if (!hasPermission('documents', 'delete')) {
      setError('You do not have permission to delete documents');
      return;
    }
    
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
              onClick={() => setIsCategoriesOpen((v) => !v)}
              className="ml-2 btn-secondary"
              title="Manage Categories"
            >
              {isCategoriesOpen ? 'Hide Categories' : 'Manage Categories'}
            </button>
          </PermissionGate>
        </div>
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {isCategoriesOpen && (
        <div className="mt-4 p-4 border rounded bg-gray-50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-medium text-gray-900">Manage Categories</h3>
          </div>
          <form onSubmit={handleCreateCategory} className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
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
              <button type="submit" className="btn-primary">Add Category</button>
            </div>
          </form>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {categories.map((cat) => (
                  <tr key={cat.id}>
                    <td className="px-4 py-2 text-sm text-gray-700">
                      {editingCatId === cat.id ? (
                        <input className="input-field" value={editingCatName} onChange={(e) => setEditingCatName(e.target.value)} />
                      ) : (
                        cat.name
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700">
                      {editingCatId === cat.id ? (
                        <input className="input-field" value={editingCatDesc} onChange={(e) => setEditingCatDesc(e.target.value)} />
                      ) : (
                        cat.description || '-'
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm">
                      {editingCatId === cat.id ? (
                        <div className="flex gap-2">
                          <button type="button" className="btn-primary" onClick={() => saveEditCategory(cat.id)}>Save</button>
                          <button type="button" className="btn-secondary" onClick={cancelEditCategory}>Cancel</button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button type="button" className="btn-secondary" onClick={() => startEditCategory(cat)}>Edit</button>
                          <button type="button" className="btn-secondary text-red-700" onClick={() => handleDeleteCategory(cat.id)}>Delete</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {categories.length === 0 && (
                  <tr>
                    <td className="px-4 py-4 text-sm text-gray-500" colSpan={3}>No categories yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mobile view */}
      <div className="mt-6 md:hidden">
        <MobileTable
          data={documents}
          columns={[
            { key: 'original_filename', title: 'File Name' },
            { key: 'entity_type', title: 'Entity', render: (v) => v ? <span className="capitalize">{v}</span> : '-' },
            { key: 'file_size', title: 'Size', render: (v) => formatFileSize(v) },
            { key: 'is_signed', title: 'Signed', render: (v, row) => (
              v ? <span className="text-green-600">Yes</span> : <span className="text-gray-500">No</span>
            ) },
          ]}
          onDelete={(item) => handleDeleteDocument(item.id)}
          rightActions={(item) => (
            <div className="flex space-x-2">
              <button
                onClick={() => handleOpenEditor(item)}
                className="flex-shrink-0 p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Open in Editor"
              >
                <DocumentIcon className="h-5 w-5" />
              </button>
              <button
                onClick={() => handlePreview(item)}
                className="flex-shrink-0 p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                title="Preview"
              >
                <PencilIcon className="h-5 w-5" />
              </button>
              <button
                onClick={() => handleOpenEdit(item)}
                className="flex-shrink-0 p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Meta"
              >
                <AdjustmentsHorizontalIcon className="h-5 w-5" />
              </button>
              <button
                onClick={() => handleOpenSign(item)}
                className="flex-shrink-0 p-2 text-green-700 hover:bg-green-50 rounded-lg transition-colors"
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Signed
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
                        {document.entity_type ? (
                          <span className="capitalize">{document.entity_type}</span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {document.entity_id ? `${document.entity_id.slice(0, 8)}...` : '-'}
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {document.is_signed ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-green-700 bg-green-100">
                            Signed{document.signed_by ? ` by ${document.signed_by}` : ''}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-gray-700 bg-gray-100">Not signed</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                        <button
                          onClick={() => handleOpenEditor(document)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Open in Editor"
                        >
                          <DocumentIcon className="h-5 w-5 inline" />
                        </button>
                        <button
                          onClick={() => handlePreview(document)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="Preview"
                        >
                          <PencilIcon className="h-5 w-5 inline" />
                        </button>
                        <button
                          onClick={() => handleOpenHistory(document)}
                          className="text-amber-700 hover:text-amber-900"
                          title="History"
                        >
                          <ClockIcon className="h-5 w-5 inline" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(document)}
                          className="text-gray-700 hover:text-gray-900"
                          title="Meta"
                        >
                          <AdjustmentsHorizontalIcon className="h-5 w-5 inline" />
                        </button>
                        <button
                          onClick={() => handleOpenSign(document)}
                          className="text-green-700 hover:text-green-900"
                          title="Sign"
                        >
                          <CheckIcon className="h-5 w-5 inline" />
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
      <Modal isOpen={isModalOpen && modalContent === 'document-form'} onClose={closeModal}>
        {isModalOpen && modalContent === 'document-form' && (
          <DocumentUploadForm
            onSubmit={handleSubmitDocument}
            onCancel={closeModal}
          />
        )}
      </Modal>

      {/* Edit Modal - Fullscreen with footer controls */}
      <Modal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        fullScreen
        noPadding
        footer={(
          isPreviewOpen && previewDoc ? (
            <form onSubmit={handleSubmitInlineEdit} className="w-full grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-600">Description</label>
                <input
                  type="text"
                  className="input-field mt-1"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Description"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600">Owner</label>
                <CustomDropdown
                  value={editOwnerId || ''}
                  onChange={(e) => setEditOwnerId(e.target.value)}
                  options={[
                    { value: '', label: 'Unassigned' },
                    ...employees.map((emp) => ({
                      value: emp.id,
                      label: emp.first_name ? `${emp.first_name} ${emp.last_name || ''}`.trim() : emp.name || emp.email || emp.id
                    }))
                  ]}
                  placeholder="Select owner"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600">Category</label>
                <CustomDropdown
                  value={editCategoryId || ''}
                  onChange={(e) => setEditCategoryId(e.target.value)}
                  options={[
                    { value: '', label: 'None' },
                    ...categories.map((cat) => ({
                      value: cat.id,
                      label: cat.name
                    }))
                  ]}
                  placeholder="Select category"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600">Review Date</label>
                <input
                  type="date"
                  className="input-field mt-1"
                  value={editReviewDate}
                  onChange={(e) => setEditReviewDate(e.target.value)}
                />
              </div>
              <div className="md:col-span-5 flex justify-end">
                <button type="submit" className="btn-primary">Save</button>
              </div>
            </form>
          ) : null
        )}
      >
        {isPreviewOpen && previewDoc && (
          <div className="w-full h-full">
            {(() => { const ct = (previewDoc.content_type || '').toLowerCase(); const name=(previewDoc.original_filename||'').toLowerCase(); const isDocx = ct.includes('wordprocessingml.document') || name.endsWith('.docx'); const isXlsx = ct.includes('spreadsheetml.sheet') || name.endsWith('.xlsx'); const isPptx = ct.includes('presentationml.presentation') || name.endsWith('.pptx'); const isOffice = isDocx || isXlsx || isPptx; return (
            <div className="w-full h-full">
              {(ct && ct.startsWith('image/')) || /(\.png|\.jpg|\.jpeg|\.gif|\.webp)$/i.test(name) ? (
                <img
                  src={documentsAPI.fileUrl(previewDoc.id)}
                  alt={previewDoc.original_filename}
                  className="w-full h-full object-contain"
                />
              ) : ct.includes('pdf') || name.endsWith('.pdf') ? (
                <iframe
                  title="PDF Preview"
                  src={documentsAPI.fileUrl(previewDoc.id)}
                  className="w-full h-full"
                />
              ) : isOffice ? (
                onlyofficeEnabled ? (
                  <OnlyOfficeEditor documentId={previewDoc.id} />
                ) : isDocx ? (
                  <div className="w-full h-full overflow-auto bg-gray-50">
                    {docxError && (
                      <div className="m-2 text-sm text-red-700 bg-red-50 border border-red-200 p-2 rounded">{docxError}</div>
                    )}
                    <div ref={setDocxContainerEl} />
                  </div>
                ) : (
                  <div className="p-4 text-sm text-gray-700">Editing for this Office file requires configuring OnlyOffice Document Server.</div>
                )
              ) : (
                <div className="p-4 text-sm text-gray-700">
                  Preview not available for this file type.
                </div>
              )}
            </div>); })()}
          </div>
        )}
      </Modal>

      {/* Edit Document Modal */}
      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)}>
        {isEditOpen && editDoc && (
          <form onSubmit={handleSubmitEdit} className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Edit Document</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                className="input-field mt-1"
                rows={3}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Owner</label>
                <CustomDropdown
                  value={editOwnerId || ''}
                  onChange={(e) => setEditOwnerId(e.target.value)}
                  options={[
                    { value: '', label: 'Unassigned' },
                    ...employees.map((emp) => ({
                      value: emp.id,
                      label: emp.first_name ? `${emp.first_name} ${emp.last_name || ''}`.trim() : emp.name || emp.email || emp.id
                    }))
                  ]}
                  placeholder="Select owner"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Review Date</label>
                <input
                  type="date"
                  className="input-field mt-1"
                  value={editReviewDate}
                  onChange={(e) => setEditReviewDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Category</label>
                <CustomDropdown
                  value={editCategoryId || ''}
                  onChange={(e) => setEditCategoryId(e.target.value)}
                  options={[
                    { value: '', label: 'None' },
                    ...categories.map((cat) => ({
                      value: cat.id,
                      label: cat.name
                    }))
                  ]}
                  placeholder="Select category"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assignments</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {editAssignments.length === 0 && (
                  <span className="text-sm text-gray-500">No assigned employees</span>
                )}
                {editAssignments.map((a) => {
                  const emp = employees.find((e) => e.id === a.employee_id);
                  const label = emp ? (emp.first_name ? `${emp.first_name} ${emp.last_name || ''}`.trim() : emp.name || emp.email || a.employee_id) : a.employee_id;
                  return (
                    <span key={a.employee_id} className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                      {label}
                      <button type="button" onClick={() => handleRemoveAssignment(a.employee_id)} className="ml-2 text-red-600 hover:text-red-800">×</button>
                    </span>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <CustomDropdown
                  value={assignEmployeeId}
                  onChange={(e) => setAssignEmployeeId(e.target.value)}
                  options={employees.map((emp) => ({
                    value: emp.id,
                    label: emp.first_name ? `${emp.first_name} ${emp.last_name || ''}`.trim() : emp.name || emp.email || emp.id
                  }))}
                  placeholder="Select employee"
                  className="flex-1"
                />
                <button type="button" onClick={handleAddAssignment} className="btn-secondary">Add</button>
              </div>
            </div>
            <div className="flex justify-end space-x-3 pt-2">
              <button type="button" onClick={() => setIsEditOpen(false)} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary">Save</button>
            </div>
          </form>
        )}
      </Modal>

      {/* History Modal */}
      <Modal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)}>
        {isHistoryOpen && historyDoc && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">History: {historyDoc.original_filename}</h3>
            <div className="max-h-[40vh] overflow-auto border rounded">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Note</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {historyItems.map((h) => (
                    <tr key={h.id}>
                      <td className="px-4 py-2 text-sm text-gray-700">{new Date(h.created_at).toLocaleString()}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">{h.note || '-'}</td>
                      <td className="px-4 py-2 text-sm">
                        <a
                          className="text-indigo-600 hover:text-indigo-800"
                          href={documentsAPI.historyFileUrl(h.id, { download: true })}
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
                      <td className="px-4 py-4 text-sm text-gray-500" colSpan={3}>No history yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <form onSubmit={handleReplaceContent} className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Upload new version</label>
              <input type="file" name="newVersionFile" className="input-field" />
              <input type="text" name="newVersionNote" placeholder="Optional note for this version" className="input-field" />
              <div className="flex justify-end">
                <button type="submit" className="btn-primary">Replace Content</button>
              </div>
            </form>
          </div>
        )}
      </Modal>

      {/* Sign Document Modal */}
      <Modal isOpen={isSignOpen} onClose={() => setIsSignOpen(false)}>
        {isSignOpen && signDoc && (
          <form onSubmit={handleSubmitSign} className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Sign Document</h3>
            <p className="text-sm text-gray-600">{signDoc.original_filename}</p>
            <div>
              <label className="block text-sm font-medium text-gray-700">Signer Name *</label>
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
              <button type="button" onClick={() => setIsSignOpen(false)} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary">Sign</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
