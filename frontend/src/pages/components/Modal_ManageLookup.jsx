// FILE: Modal_ManageLookup.jsx
// Reusable manager modal for simple company-scoped lookup lists (name + description),
// e.g. client/employee/document statuses and service categories.
// Mirrors the Manage Subscriptions modal pattern on the Clients page.
import React, { useState } from "react";
import Modal from "./Modal";
import { showConfirm } from "../../services/showConfirm";
import { sortItemsAlphabetically } from "../../utils/displaySort";
import { CheckCircleIcon, XCircleIcon, PencilIcon, XMarkIcon } from "@heroicons/react/24/outline";

export default function Modal_ManageLookup({
  isOpen,
  onClose,
  title,
  // Label for a single entry, e.g. "status" or "category"
  entityLabel = "entry",
  // Array of { id, name, description }
  items,
  // Called after any create/update/delete so the parent can refresh its list
  onItemsChanged,
  // API with list/create/update/delete (createLookupAPI shape)
  api,
}) {
  const [form, setForm] = useState({ name: "", description: "" });
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const sortedItems = sortItemsAlphabetically(items || [], ["name"]);

  const resetForm = () => {
    setForm({ name: "", description: "" });
    setEditingId(null);
  };

  const handleSave = async () => {
    const name = form.name.trim();
    if (!name || saving) return;
    setSaving(true);
    try {
      const payload = { name, description: form.description || null };
      if (editingId) {
        await api.update(editingId, payload);
      } else {
        await api.create(payload);
      }
      resetForm();
      await onItemsChanged?.();
    } catch (err) {
      console.error(`Failed to save ${entityLabel}`, err);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setForm({ name: item.name || "", description: item.description || "" });
  };

  const handleDelete = async (itemId) => {
    if (!(await showConfirm(`Delete this ${entityLabel}?`))) return;
    try {
      await api.delete(itemId);
      if (editingId === itemId) resetForm();
      await onItemsChanged?.();
    } catch (err) {
      console.error(`Failed to delete ${entityLabel}`, err);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        resetForm();
        onClose();
      }}
      title={title}
      centered={true}
      contentGravity="top"
    >
      <div className="d-flex flex-column gap-3">
        <div className="border d-flex flex-column gap-2 p-0 ui-pill-container">
          <input type="text" className="form-control ui-control-sm" placeholder={`${entityLabel.charAt(0).toUpperCase()}${entityLabel.slice(1)} name`} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          <textarea className="ui-description-textarea form-control form-control-sm" placeholder="Description" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          <div className="d-flex gap-2">
            <button type="button" className="align-items-center btn btn-primary btn-sm d-flex gap-2" onClick={handleSave} disabled={saving}>
              <CheckCircleIcon className="ui-icon-4" />
              <span>{editingId ? "Update" : "Create"}</span>
            </button>
            {editingId && (
              <button type="button" className="align-items-center btn btn-outline-secondary btn-sm d-flex gap-2" onClick={resetForm}>
                <XCircleIcon className="ui-icon-4" />
                <span>Cancel</span>
              </button>
            )}
          </div>
        </div>

        <div className="d-flex flex-column gap-2" style={{ maxHeight: "220px", overflowY: "auto" }}>
          {sortedItems.length === 0 && <p className="py-1 small text-center text-muted">No {entityLabel} entries yet. Add one above.</p>}
          {sortedItems.map((item) => (
            <div key={item.id} className="align-items-start border d-flex gap-2 justify-content-between p-0 ui-pill-container">
              <div className="small">
                <div className="fw-semibold">{item.name}</div>
                {item.description && <div className="text-muted">{item.description}</div>}
              </div>
              <div className="d-flex gap-1">
                <button type="button" className="align-items-center btn btn-outline-primary btn-sm d-flex gap-2" onClick={() => handleEdit(item)}>
                  <PencilIcon className="ui-icon-4" />
                  <span>Edit</span>
                </button>
                <button type="button" className="align-items-center btn btn-outline-danger btn-sm d-flex gap-2" onClick={() => handleDelete(item.id)}>
                  <XMarkIcon className="ui-icon-4" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
