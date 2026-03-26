/*
 * ============================================================
 * FILE: Modal_Edit_Document.jsx
 *
 * PURPOSE:
 *   Modal form for editing the metadata of an existing document record.
 *   Allows the user to update description, owner, category, review date,
 *   employee assignments, and document tags.  Displays read-only file info
 *   (size, MIME type, upload date) captured at upload time.
 *
 * FUNCTIONAL PARTS:
 *   [1] Helpers          — formatBytes, friendlyMime, formatDate
 *   [2] State            — form fields, tag state, supporting list state
 *   [3] Effects          — load categories / employees / assignments / tags on open
 *   [4] Tag Handlers     — tag search, add tag (create + attach), remove tag
 *   [5] Assignment Handlers
 *   [6] Submit Handler   — PATCH metadata + PUT tags
 *   [7] Render           — file-info band, editable fields, tags section, assignments
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-03-01 | Claude  | Added section comments and top-level documentation
 *   2026-03-26 | Claude  | Added file-info display (size, type, dates),
 *                          document tags section with search + add + remove
 * ============================================================
 */

import React, { useState, useEffect, useRef } from 'react';
import { documentsAPI, documentCategoriesAPI, employeesAPI, documentTagsAPI } from '../../services/api';
import Dropdown_Custom from './Dropdown_Custom';
import Modal from './Modal';
import { XMarkIcon, TagIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

// ─── 1 HELPERS ─────────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (bytes == null || bytes < 0) return '—';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1);
  return `${val} ${units[i]}`;
}

const MIME_FRIENDLY = {
  'application/pdf': 'PDF',
  'application/msword': 'Word (.doc)',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word (.docx)',
  'application/vnd.ms-excel': 'Excel (.xls)',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel (.xlsx)',
  'application/vnd.ms-powerpoint': 'PowerPoint (.ppt)',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint (.pptx)',
  'text/plain': 'Plain Text',
  'text/csv': 'CSV',
  'image/jpeg': 'JPEG Image',
  'image/png': 'PNG Image',
  'image/gif': 'GIF Image',
  'image/webp': 'WebP Image',
};

function friendlyMime(contentType) {
  if (!contentType) return '—';
  return MIME_FRIENDLY[contentType] || contentType;
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function formatDateInput(value) {
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
}

// ─── 2 COMPONENT ───────────────────────────────────────────────────────────────
export default function Modal_Edit_Document({ isOpen, onClose, document, onSave }) {
  // Editable fields
  const [description, setDescription] = useState('');
  const [ownerId, setOwnerId]       = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [reviewDate, setReviewDate] = useState('');

  // Supporting lists
  const [categories, setCategories] = useState([]);
  const [employees, setEmployees]   = useState([]);
  const [assignments, setAssignments]       = useState([]);
  const [assignEmployeeId, setAssignEmployeeId] = useState('');

  // Tag state
  const [docTags, setDocTags]           = useState([]);   // tags currently on this doc
  const [tagSearch, setTagSearch]       = useState('');   // search text in tag input
  const [tagSuggestions, setTagSuggestions] = useState([]); // suggestions from API
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const tagInputRef = useRef(null);
  const tagDropdownRef = useRef(null);

  // UI state
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  // ─── 3 EFFECTS ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    Promise.all([documentCategoriesAPI.list(), employeesAPI.getAll()])
      .then(([catsRes, empRes]) => {
        setCategories(catsRes.data || []);
        setEmployees(empRes.data || []);
      })
      .catch((err) => console.warn('Failed to load categories or employees', err));
  }, [isOpen]);

  useEffect(() => {
    if (!document) return;
    setDescription(document.description || '');
    setOwnerId(document.owner_id || '');
    setCategoryId(document.category_id || '');
    setReviewDate(formatDateInput(document.review_date));
    setDocTags([]);
    setTagSearch('');
    setTagSuggestions([]);
    setShowTagDropdown(false);
    loadAssignments(document.id);
    loadDocTags(document.id);
  }, [document]);

  // Close tag dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (
        tagDropdownRef.current && !tagDropdownRef.current.contains(e.target) &&
        tagInputRef.current && !tagInputRef.current.contains(e.target)
      ) {
        setShowTagDropdown(false);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, []);

  const loadAssignments = async (documentId) => {
    try {
      const res = await documentsAPI.listAssignments(documentId);
      setAssignments(res.data || []);
    } catch (err) {
      console.warn('Failed to load assignments', err);
      setAssignments([]);
    }
  };

  const loadDocTags = async (documentId) => {
    try {
      const res = await documentTagsAPI.getForDocument(documentId);
      setDocTags(res.data || []);
    } catch {
      setDocTags([]);
    }
  };

  // ─── 4 TAG HANDLERS ──────────────────────────────────────────────────────────
  const handleTagSearchChange = async (val) => {
    setTagSearch(val);
    if (!val.trim()) {
      setTagSuggestions([]);
      setShowTagDropdown(false);
      return;
    }
    try {
      const res = await documentTagsAPI.list(val.trim());
      const all = res.data || [];
      // Filter out tags already attached
      const attached = new Set(docTags.map((t) => t.id));
      setTagSuggestions(all.filter((t) => !attached.has(t.id)));
      setShowTagDropdown(true);
    } catch {
      setTagSuggestions([]);
    }
  };

  const handleAddTag = async (tag) => {
    // tag may be an existing {id, name} or just a name string (create new)
    let resolved = tag;
    if (typeof tag === 'string') {
      const name = tag.trim();
      if (!name) return;
      // Check if already attached by name
      if (docTags.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
        setTagSearch('');
        setShowTagDropdown(false);
        return;
      }
      try {
        const res = await documentTagsAPI.create(name);
        resolved = res.data;
      } catch {
        return;
      }
    }
    if (docTags.some((t) => t.id === resolved.id)) {
      setTagSearch('');
      setShowTagDropdown(false);
      return;
    }
    setDocTags((prev) => [...prev, resolved]);
    setTagSearch('');
    setTagSuggestions([]);
    setShowTagDropdown(false);
  };

  const handleRemoveTag = (tagId) => {
    setDocTags((prev) => prev.filter((t) => t.id !== tagId));
  };

  // ─── 5 ASSIGNMENT HANDLERS ────────────────────────────────────────────────────
  const handleAddAssignment = async () => {
    if (!document || !assignEmployeeId) return;
    try {
      await documentsAPI.addAssignment(document.id, assignEmployeeId);
      setAssignEmployeeId('');
      await loadAssignments(document.id);
    } catch (err) {
      console.error('Failed to add assignment', err);
    }
  };

  const handleRemoveAssignment = async (employee_id) => {
    if (!document) return;
    try {
      await documentsAPI.removeAssignment(document.id, employee_id);
      await loadAssignments(document.id);
    } catch (err) {
      console.error('Failed to remove assignment', err);
    }
  };

  // ─── 6 SUBMIT ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!document) return;
    setSaving(true);
    setError('');
    try {
      await Promise.all([
        documentsAPI.update(document.id, {
          description,
          owner_id: ownerId || null,
          category_id: categoryId || null,
          review_date: reviewDate || null,
        }),
        documentTagsAPI.setForDocument(document.id, docTags.map((t) => t.id)),
      ]);
      const updated = await documentsAPI.getById(document.id);
      if (onSave) onSave(updated.data);
      onClose();
    } catch (err) {
      setError('Failed to update document');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // ─── 7 RENDER ─────────────────────────────────────────────────────────────────
  if (!document) return null;

  return (
    <Modal
      isOpen={isOpen && !!document}
      onClose={onClose}
      title="Edit Document Metadata"
      centered={true}
      footer={
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" form="doc-edit-form" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      }
    >
      <form id="doc-edit-form" onSubmit={handleSubmit}>
        <div className="space-y-4">

          {error && (
            <div className="text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded text-sm">{error}</div>
          )}

          {/* ── File info band (read-only) ────────────────────────────────────── */}
          <div className="rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 text-sm">
            <p className="font-medium text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-1">
              <TagIcon className="w-4 h-4 opacity-60" /> File Information
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-600 dark:text-gray-400">
              <span className="font-medium">Filename</span>
              <span className="truncate" title={document.original_filename}>{document.original_filename}</span>

              <span className="font-medium">File type</span>
              <span>{friendlyMime(document.content_type)}</span>

              <span className="font-medium">File size</span>
              <span>{formatBytes(document.file_size)}</span>

              <span className="font-medium">Uploaded</span>
              <span>{formatDate(document.created_at)}</span>

              {document.updated_at && document.updated_at !== document.created_at && (
                <>
                  <span className="font-medium">Last modified</span>
                  <span>{formatDate(document.updated_at)}</span>
                </>
              )}

              {document.entity_type && (
                <>
                  <span className="font-medium">Linked to</span>
                  <span className="capitalize">{document.entity_type}</span>
                </>
              )}

              {document.is_signed && (
                <>
                  <span className="font-medium">Signed by</span>
                  <span>{document.signed_by || '—'}</span>
                  <span className="font-medium">Signed at</span>
                  <span>{formatDate(document.signed_at)}</span>
                </>
              )}
            </div>
          </div>

          {/* ── Description ──────────────────────────────────────────────────── */}
          <div className="form-floating mb-3">
            <textarea
              id="doc_description"
              className="form-control form-control-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description"
              style={{ height: '80px' }}
            />
            <label htmlFor="doc_description">Description</label>
          </div>

          {/* ── Owner + Review Date ───────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Owner</label>
              <Dropdown_Custom
                value={ownerId || ''}
                onChange={(e) => setOwnerId(e.target.value)}
                options={[
                  { value: '', label: 'Unassigned' },
                  ...employees.map((emp) => ({
                    value: emp.id,
                    label: emp.first_name
                      ? `${emp.first_name} ${emp.last_name || ''}`.trim()
                      : emp.name || emp.email || emp.id,
                  })),
                ]}
                placeholder="Select owner"
              />
            </div>
            <div className="form-floating">
              <input
                type="date"
                id="doc_review_date"
                className="form-control form-control-sm"
                value={reviewDate}
                onChange={(e) => setReviewDate(e.target.value)}
                placeholder="Review Date"
              />
              <label htmlFor="doc_review_date">Review Date</label>
            </div>
          </div>

          {/* ── Category ─────────────────────────────────────────────────────── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
            <Dropdown_Custom
              value={categoryId || ''}
              onChange={(e) => setCategoryId(e.target.value)}
              options={[
                { value: '', label: 'None' },
                ...categories.map((cat) => ({ value: cat.id, label: cat.name })),
              ]}
              placeholder="Select category"
            />
          </div>

          {/* ── Tags ─────────────────────────────────────────────────────────── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tags
            </label>

            {/* Attached tags */}
            <div className="flex flex-wrap gap-1 mb-2 min-h-[1.75rem]">
              {docTags.length === 0 && (
                <span className="text-xs text-gray-400 dark:text-gray-500 italic">No tags yet</span>
              )}
              {docTags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200"
                >
                  {tag.name}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag.id)}
                    className="hover:text-blue-900 dark:hover:text-white focus:outline-none"
                    aria-label={`Remove tag ${tag.name}`}
                  >
                    <XMarkIcon className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>

            {/* Tag search + add */}
            <div className="relative">
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <MagnifyingGlassIcon className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    ref={tagInputRef}
                    type="text"
                    value={tagSearch}
                    onChange={(e) => handleTagSearchChange(e.target.value)}
                    onFocus={() => { if (tagSuggestions.length > 0) setShowTagDropdown(true); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (tagSuggestions.length === 1) handleAddTag(tagSuggestions[0]);
                        else if (tagSearch.trim()) handleAddTag(tagSearch.trim());
                      }
                      if (e.key === 'Escape') setShowTagDropdown(false);
                    }}
                    placeholder="Search or create a tag…"
                    className="form-control form-control-sm ps-7"
                    style={{ fontSize: '0.82rem' }}
                    autoComplete="off"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (tagSuggestions.length === 1) handleAddTag(tagSuggestions[0]);
                    else if (tagSearch.trim()) handleAddTag(tagSearch.trim());
                  }}
                  className="btn btn-sm btn-outline-primary flex-shrink-0"
                  style={{ fontSize: '0.8rem' }}
                  disabled={!tagSearch.trim()}
                >
                  Add
                </button>
              </div>

              {/* Dropdown suggestions */}
              {showTagDropdown && tagSuggestions.length > 0 && (
                <div
                  ref={tagDropdownRef}
                  className="absolute z-50 mt-1 w-full rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg max-h-40 overflow-y-auto"
                >
                  {tagSuggestions.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); handleAddTag(tag); }}
                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-700 dark:text-gray-200"
                    >
                      {tag.name}
                    </button>
                  ))}
                  {tagSearch.trim() && !tagSuggestions.some((t) => t.name.toLowerCase() === tagSearch.trim().toLowerCase()) && (
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); handleAddTag(tagSearch.trim()); }}
                      className="w-full text-left px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-t border-gray-100 dark:border-gray-700"
                    >
                      + Create "{tagSearch.trim()}"
                    </button>
                  )}
                </div>
              )}

              {/* Show "create" option when search has text but no dropdown suggestions */}
              {tagSearch.trim() && !showTagDropdown && tagSuggestions.length === 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Press <kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-xs">Enter</kbd> or click Add to create tag "{tagSearch.trim()}"
                </p>
              )}
            </div>
          </div>

          {/* ── Assignments ───────────────────────────────────────────────────── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Assignments
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {assignments.length === 0 && (
                <span className="text-sm text-gray-500 dark:text-gray-400">No assigned employees</span>
              )}
              {assignments.map((a) => {
                const emp = employees.find((e) => e.id === a.employee_id);
                const label = emp
                  ? emp.first_name
                    ? `${emp.first_name} ${emp.last_name || ''}`.trim()
                    : emp.name || emp.email || a.employee_id
                  : a.employee_id;
                return (
                  <span
                    key={a.employee_id}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm"
                  >
                    {label}
                    <button
                      type="button"
                      onClick={() => handleRemoveAssignment(a.employee_id)}
                      className="hover:text-red-500 focus:outline-none"
                      aria-label="Remove"
                    >
                      <XMarkIcon className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Dropdown_Custom
                value={assignEmployeeId}
                onChange={(e) => setAssignEmployeeId(e.target.value)}
                options={employees.map((emp) => ({
                  value: emp.id,
                  label: emp.first_name
                    ? `${emp.first_name} ${emp.last_name || ''}`.trim()
                    : emp.name || emp.email || emp.id,
                }))}
                placeholder="Select employee"
                className="flex-1"
              />
              <button type="button" onClick={handleAddAssignment} className="btn-secondary">
                Add
              </button>
            </div>
          </div>

        </div>
      </form>
    </Modal>
  );
}
