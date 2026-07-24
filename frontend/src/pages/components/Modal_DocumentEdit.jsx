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
 *   2026-05-15 | Copilot | Shortened modal action button labels for compact training-mode layouts
 * ============================================================
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import { documentsAPI, documentCategoriesAPI, employeesAPI, documentTagsAPI } from "../../services/api";
import Dropdown_Custom from "./Dropdown_Custom";
import Modal from "./Modal";
import { XMarkIcon, TagIcon, MagnifyingGlassIcon, DocumentTextIcon, CheckIcon } from "@heroicons/react/24/outline";
import { sortItemsAlphabetically } from "../../utils/displaySort";

// ─── 1 HELPERS ─────────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (bytes == null || bytes < 0) return "—";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1);
  return `${val} ${units[i]}`;
}

const MIME_FRIENDLY = {
  "application/pdf": "PDF",
  "application/msword": "Word (.doc)",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word (.docx)",
  "application/vnd.ms-excel": "Excel (.xls)",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel (.xlsx)",
  "application/vnd.ms-powerpoint": "PowerPoint (.ppt)",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PowerPoint (.pptx)",
  "text/plain": "Plain Text",
  "text/csv": "CSV",
  "image/jpeg": "JPEG Image",
  "image/png": "PNG Image",
  "image/gif": "GIF Image",
  "image/webp": "WebP Image",
};

function friendlyMime(contentType) {
  if (!contentType) return "—";
  return MIME_FRIENDLY[contentType] || contentType;
}

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function formatDateInput(value) {
  if (!value) return "";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return "";
  }
}

// ─── 2 COMPONENT ───────────────────────────────────────────────────────────────
export default function Modal_Edit_Document({ isOpen, onClose, document, onSave }) {
  // Editable fields
  const [description, setDescription] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [reviewDate, setReviewDate] = useState("");

  // Supporting lists
  const [categories, setCategories] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [assignEmployeeId, setAssignEmployeeId] = useState("");

  // Tag state
  const [docTags, setDocTags] = useState([]); // tags currently on this doc
  const [tagSearch, setTagSearch] = useState(""); // search text in tag input
  const [tagSuggestions, setTagSuggestions] = useState([]); // suggestions from API
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const tagInputRef = useRef(null);
  const tagDropdownRef = useRef(null);

  // UI state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const sortedCategories = useMemo(() => sortItemsAlphabetically(categories, ["name"]), [categories]);
  const sortedEmployees = useMemo(() => sortItemsAlphabetically(employees, ["first_name", "last_name", "name", "email"]), [employees]);
  const sortedDocTags = useMemo(() => sortItemsAlphabetically(docTags, ["name"]), [docTags]);
  const sortedTagSuggestions = useMemo(() => sortItemsAlphabetically(tagSuggestions, ["name"]), [tagSuggestions]);

  // ─── 3 EFFECTS ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    Promise.all([documentCategoriesAPI.list(), employeesAPI.getAll()])
      .then(([catsRes, empRes]) => {
        setCategories(sortItemsAlphabetically(catsRes.data || [], ["name"]));
        setEmployees(sortItemsAlphabetically(empRes.data || [], ["first_name", "last_name", "name", "email"]));
      })
      .catch((err) => console.warn("Failed to load categories or employees", err));
  }, [isOpen]);

  useEffect(() => {
    if (!document) return;
    setDescription(document.description || "");
    setOwnerId(document.owner_id || "");
    setCategoryId(document.category_id || "");
    setReviewDate(formatDateInput(document.review_date));
    setDocTags([]);
    setTagSearch("");
    setTagSuggestions([]);
    setShowTagDropdown(false);
    loadAssignments(document.id);
    loadDocTags(document.id);
  }, [document]);

  // Close tag dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target) && tagInputRef.current && !tagInputRef.current.contains(e.target)) {
        setShowTagDropdown(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, []);

  const loadAssignments = async (documentId) => {
    try {
      const res = await documentsAPI.listAssignments(documentId);
      setAssignments(res.data || []);
    } catch (err) {
      console.warn("Failed to load assignments", err);
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
      setTagSuggestions(sortItemsAlphabetically(all.filter((t) => !attached.has(t.id)), ["name"]));
      setShowTagDropdown(true);
    } catch {
      setTagSuggestions([]);
    }
  };

  const handleAddTag = async (tag) => {
    // tag may be an existing {id, name} or just a name string (create new)
    let resolved = tag;
    if (typeof tag === "string") {
      const name = tag.trim();
      if (!name) return;
      // Check if already attached by name
      if (docTags.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
        setTagSearch("");
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
      setTagSearch("");
      setShowTagDropdown(false);
      return;
    }
    setDocTags((prev) => sortItemsAlphabetically([...prev, resolved], ["name"]));
    setTagSearch("");
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
      setAssignEmployeeId("");
      await loadAssignments(document.id);
    } catch (err) {
      console.error("Failed to add assignment", err);
    }
  };

  const handleRemoveAssignment = async (employee_id) => {
    if (!document) return;
    try {
      await documentsAPI.removeAssignment(document.id, employee_id);
      await loadAssignments(document.id);
    } catch (err) {
      console.error("Failed to remove assignment", err);
    }
  };

  // ─── 6 SUBMIT ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!document) return;
    setSaving(true);
    setError("");
    try {
      // Convert review_date from "YYYY-MM-DD" string to ISO datetime for backend
      let reviewDateTime = null;
      if (reviewDate) {
        const dt = new Date(reviewDate);
        if (!isNaN(dt.getTime())) {
          reviewDateTime = dt.toISOString();
        }
      }

      await Promise.all([
        documentsAPI.update(document.id, {
          description,
          owner_id: ownerId || null,
          category_id: categoryId || null,
          review_date: reviewDateTime,
        }),
        documentTagsAPI.setForDocument(
          document.id,
          docTags.map((t) => t.id)
        ),
      ]);
      const updated = await documentsAPI.getById(document.id);
      if (onSave) onSave(updated.data);
      onClose();
    } catch (err) {
      setError("Failed to update document");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // ─── 7 RENDER ─────────────────────────────────────────────────────────────────
  if (!document) return null;

  return (
    <Modal isOpen={isOpen && !!document} onClose={onClose} centered noPadding>
      <form className="ui-component-shell" id="doc-edit-form" onSubmit={handleSubmit}>
        <div className="component-header">
          <div className="component-header-left">
            <DocumentTextIcon className="app-icon me-1 text-muted" aria-hidden="true" />
            Edit Document
          </div>
          <div className="component-header-center"></div>
          <div className="component-header-right"></div>
        </div>
        <div className="component-body">
          <div className="component-body-inner">
            <div className="space-y-4">
              {error && <div className="bg-red-50 dark:bg-red-900/20 p-1 rounded text-red-600 text-sm">{error}</div>}

              {/* ── File info band (read-only) ────────────────────────────────────── */}
              <div className="bg-gray-50 border border-gray-200 dark:bg-gray-800 dark:border-gray-700 p-1 rounded text-sm">
                <p className="dark:text-gray-200 flex font-medium gap-1 items-center mb-2 text-gray-700">
                  <TagIcon className="h-4 opacity-60 w-4" /> File Information
                </p>
                <div className="dark:text-gray-400 gap-x-4 gap-y-1 grid grid-cols-2 text-gray-600">
                  <span className="font-medium">Filename</span>
                  <span className="truncate" title={document.original_filename}>
                    {document.original_filename}
                  </span>

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
                      <span>{document.signed_by || "—"}</span>
                      <span className="font-medium">Signed at</span>
                      <span>{formatDate(document.signed_at)}</span>
                    </>
                  )}
                </div>
              </div>

              {/* ── Description ──────────────────────────────────────────────────── */}
              <div className="form-floating mb-3">
                <textarea id="doc_description" className="form-control ui-control-sm" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" />
                <label htmlFor="doc_description">Description</label>
              </div>

              {/* ── Owner + Review Date ───────────────────────────────────────────── */}
              <div className="gap-4 grid grid-cols-1 sm:grid-cols-2">
                <div>
                  <label className="block dark:text-gray-300 font-medium text-gray-700 text-sm">Owner</label>
                  <Dropdown_Custom
                    name="owner_id"
                    value={ownerId || ""}
                    onChange={(e) => setOwnerId(e.target.value)}
                    options={[
                      { value: "", label: "Unassigned" },
                      ...sortedEmployees.map((emp) => ({
                        value: emp.id,
                        label: emp.first_name ? `${emp.first_name} ${emp.last_name || ""}`.trim() : emp.name || emp.email || emp.id,
                      })),
                    ]}
                    placeholder="Select owner"
                  />
                </div>
                <div className="form-floating">
                  <input type="date" id="doc_review_date" className="form-control ui-control-sm" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} placeholder="Review Date" />
                  <label htmlFor="doc_review_date">Review Date</label>
                </div>
              </div>

              {/* ── Category ─────────────────────────────────────────────────────── */}
              <div>
                <label className="block dark:text-gray-300 font-medium text-gray-700 text-sm">Category</label>
                <Dropdown_Custom name="category_id" value={categoryId || ""} onChange={(e) => setCategoryId(e.target.value)} options={[{ value: "", label: "None" }, ...sortedCategories.map((cat) => ({ value: cat.id, label: cat.name }))]} placeholder="Select category" />
              </div>

              {/* ── Tags ─────────────────────────────────────────────────────────── */}
              <div>
                <label className="block dark:text-gray-300 font-medium mb-1 text-gray-700 text-sm">Tags</label>

                {/* Attached tags */}
                <div className="flex flex-wrap gap-1 mb-2 min-h-[1.75rem]">
                  {sortedDocTags.length === 0 && <span className="dark:text-gray-500 italic text-gray-400 text-xs">No tags yet</span>}
                  {sortedDocTags.map((tag) => (
                    <span key={tag.id} className="bg-blue-100 dark:bg-blue-900/40 dark:text-blue-200 font-medium gap-1 inline-flex items-center px-0 py-0.5 rounded-full text-blue-800 text-xs">
                      {tag.name}
                      <button type="button" onClick={() => handleRemoveTag(tag.id)} className="dark:hover:text-white focus:outline-none hover:text-blue-900" aria-label={`Remove tag ${tag.name}`}>
                        <XMarkIcon className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>

                {/* Tag search + add */}
                <div className="relative">
                  <div className="ui-flex-items-gap-2">
                    <div className="flex-1 relative">
                      <MagnifyingGlassIcon className="-translate-y-1/2 absolute h-4 left-2 pointer-events-none text-gray-400 top-1/2 w-4" />
                      <input
                        ref={tagInputRef}
                        type="text"
                        value={tagSearch}
                        onChange={(e) => handleTagSearchChange(e.target.value)}
                        onFocus={() => {
                          if (tagSuggestions.length > 0) setShowTagDropdown(true);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (tagSuggestions.length === 1) handleAddTag(tagSuggestions[0]);
                            else if (tagSearch.trim()) handleAddTag(tagSearch.trim());
                          }
                          if (e.key === "Escape") setShowTagDropdown(false);
                        }}
                        placeholder="Search or create a tag…"
                        className="form-control form-control-sm ps-1"
                        style={{ fontSize: "0.82rem" }}
                        autoComplete="off"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (tagSuggestions.length === 1) handleAddTag(tagSuggestions[0]);
                        else if (tagSearch.trim()) handleAddTag(tagSearch.trim());
                      }}
                      className="btn btn-outline-primary btn-sm flex-shrink-0"
                      style={{ fontSize: "0.8rem" }}
                      disabled={!tagSearch.trim()}
                    >
                      Add
                    </button>
                  </div>

                  {/* Dropdown suggestions */}
                  {showTagDropdown && sortedTagSuggestions.length > 0 && (
                    <div ref={tagDropdownRef} className="absolute app-menu-panel bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-600 max-h-40 mt-1 overflow-y-auto rounded shadow-lg w-full z-50">
                      {sortedTagSuggestions.map((tag) => (
                        <button
                          key={tag.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleAddTag(tag);
                          }}
                          className="app-menu-item dark:hover:bg-blue-900/30 dark:text-gray-200 hover:bg-blue-50 px-1 py-1.5 text-gray-700 text-left w-full"
                        >
                          {tag.name}
                        </button>
                      ))}
                      {tagSearch.trim() && !sortedTagSuggestions.some((t) => t.name.toLowerCase() === tagSearch.trim().toLowerCase()) && (
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleAddTag(tagSearch.trim());
                          }}
                          className="app-menu-item border-gray-100 border-t dark:border-gray-700 dark:hover:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-50 px-1 py-1.5 text-blue-600 text-left w-full"
                        >
                          + Create "{tagSearch.trim()}"
                        </button>
                      )}
                    </div>
                  )}

                  {/* Show "create" option when search has text but no dropdown suggestions */}
                  {tagSearch.trim() && !showTagDropdown && tagSuggestions.length === 0 && (
                    <p className="dark:text-gray-500 mt-1 text-gray-400 text-xs">
                      Press <kbd className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-xs">Enter</kbd> or click Add to create tag "{tagSearch.trim()}"
                    </p>
                  )}
                </div>
              </div>

              {/* ── Assignments ───────────────────────────────────────────────────── */}
              <div>
                <label className="block dark:text-gray-300 font-medium mb-1 text-gray-700 text-sm">Assignments</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {assignments.length === 0 && <span className="dark:text-gray-400 text-gray-500 text-sm">No assigned employees</span>}
                  {[...assignments]
                    .sort((a, b) => {
                      const empA = sortedEmployees.find((e) => e.id === a.employee_id);
                      const empB = sortedEmployees.find((e) => e.id === b.employee_id);
                      const labelA = empA ? (empA.first_name ? `${empA.first_name} ${empA.last_name || ""}`.trim() : empA.name || empA.email || a.employee_id) : a.employee_id;
                      const labelB = empB ? (empB.first_name ? `${empB.first_name} ${empB.last_name || ""}`.trim() : empB.name || empB.email || b.employee_id) : b.employee_id;
                      return String(labelA).localeCompare(String(labelB), undefined, { sensitivity: "base" });
                    })
                    .map((a) => {
                    const emp = sortedEmployees.find((e) => e.id === a.employee_id);
                    const label = emp ? (emp.first_name ? `${emp.first_name} ${emp.last_name || ""}`.trim() : emp.name || emp.email || a.employee_id) : a.employee_id;
                    return (
                      <span key={a.employee_id} className="bg-gray-100 dark:bg-gray-700 dark:text-gray-300 gap-1 inline-flex items-center px-0 py-1 rounded-full text-gray-700 text-sm">
                        {label}
                        <button type="button" onClick={() => handleRemoveAssignment(a.employee_id)} className="focus:outline-none hover:text-red-500" aria-label="Remove">
                          <XMarkIcon className="h-3 w-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <Dropdown_Custom
                    value={assignEmployeeId}
                    onChange={(e) => setAssignEmployeeId(e.target.value)}
                    options={sortedEmployees.map((emp) => ({
                      value: emp.id,
                      label: emp.first_name ? `${emp.first_name} ${emp.last_name || ""}`.trim() : emp.name || emp.email || emp.id,
                    }))}
                    placeholder="Select employee"
                    className="flex-1"
                  />
                  <button type="button" onClick={handleAddAssignment} className="btn btn-secondary">
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>
          {/* /component-body-inner */}
        </div>
        {/* /component-body */}
        <div className="component-footer">
          <div className="component-footer-left">
            <button type="submit" className="align-items-center btn btn-primary d-inline-flex gap-1" disabled={saving}>
              <CheckIcon className="app-icon" aria-hidden="true" />
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
          <div className="component-footer-center">
            <button type="button" className="btn ui-btn-circle-outline-secondary" onClick={onClose} title="Cancel">
              <XMarkIcon />
            </button>
          </div>
          <div className="component-footer-right"></div>
        </div>
      </form>
    </Modal>
  );
}
