/*
 * Modal_MultiEdit.jsx
 * =====================
 * Generic bulk-edit modal used by Inventory, Clients, Employees, Documents,
 * and Services pages.  Callers supply a `fields` array describing which fields
 * can be edited, and an `onSave(updates)` callback that receives only the
 * fields the user explicitly changed (blank = "leave unchanged").
 *
 * Props:
 *   isOpen          : bool
 *   onClose         : () => void
 *   title           : string  — e.g. "Edit 5 Inventory Items"
 *   fields          : Array<{
 *                      key         : string,
 *                      label       : string,
 *                      type        : 'text' | 'number' | 'select',
 *                      options?    : Array<{ value: string|number, label: string }>,
 *                      placeholder?: string,
 *                    }>
 *   selectedItems   : Array<any>  — the list of selected items being edited
 *   onSave          : (updates: Record<string, any>) => Promise<void>
 *   saving          : bool
 */
import React, { useState, useEffect, useMemo } from "react";
import { XMarkIcon, CheckIcon } from "@heroicons/react/24/outline";
import Modal from "./Modal";

export default function Modal_MultiEdit({ isOpen, onClose, title, fields = [], selectedItems = [], onSave, saving = false }) {
  const [formData, setFormData] = useState({});
  const [localSaving, setLocalSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Analyze selected items to determine which fields should be dropdowns
  const fieldConfig = useMemo(() => {
    const config = {};
    fields.forEach((field) => {
      if (!selectedItems || selectedItems.length === 0) {
        config[field.key] = { ...field, shouldBeDropdown: false, commonValue: null };
        return;
      }

      // Get all values for this field from selected items
      const values = selectedItems.map((item) => item[field.key]);
      const uniqueValues = [...new Set(values)];

      // If all items have the same value and field has options, make it a dropdown
      const hasOptions = field.options && field.options.length > 0;
      const allSame = uniqueValues.length === 1;
      const shouldBeDropdown = hasOptions && allSame;

      config[field.key] = {
        ...field,
        shouldBeDropdown,
        commonValue: allSame ? values[0] : null,
      };
    });
    return config;
  }, [fields, selectedItems]);

  // Reset all fields to empty string (= leave unchanged) whenever the modal opens
  useEffect(() => {
    if (isOpen) {
      const initial = {};
      fields.forEach((f) => {
        initial[f.key] = "";
      });
      setFormData(initial);
      setSaveError("");
    }
  }, [isOpen, fields]);

  const handleChange = (key, value) => setFormData((prev) => ({ ...prev, [key]: value }));

  const pendingUpdates = () => {
    const updates = {};
    fields.forEach((f) => {
      const val = formData[f.key];
      if (val === "" || val === undefined) return;
      if (f.type === "number") {
        const parsed = Number(val);
        if (!Number.isFinite(parsed)) return;
        updates[f.key] = parsed;
        return;
      }
      updates[f.key] = val;
    });
    return updates;
  };

  const hasChanges = Object.keys(pendingUpdates()).length > 0;

  const handleSave = async () => {
    const updates = pendingUpdates();
    if (!Object.keys(updates).length) return;
    setSaveError("");
    setLocalSaving(true);
    try {
      await onSave(updates);
    } catch {
      setSaveError("Failed to save changes. Please try again.");
    } finally {
      setLocalSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} noPadding fullScreen>
      <div className="ui-component-shell">
        <div className="component-header">
          <div className="component-header-left">{title}</div>
          <div className="component-header-center" />
          <div className="component-header-right" />
        </div>

        <div className="component-body">
          <div className="component-body-inner">
            <p className="mb-3 small text-muted">Leave a field blank to keep it unchanged for all selected items. Only filled-in fields will be applied.</p>

            {saveError && <div className="alert alert-danger py-0 small">{saveError}</div>}

            {fields.map((field) => {
              const config = fieldConfig[field.key];

              return (
                <div key={field.key} className="mb-3">
                  <label className="form-label fw-semibold small">{field.label}</label>

                  {field.type === "select" && (
                    <div className="mb-1 small text-muted">
                      {config.commonValue !== null && config.commonValue !== undefined ? `Shared value: ${(field.options || []).find((opt) => String(opt.value) === String(config.commonValue))?.label || config.commonValue}` : "Mixed values across selected items"}
                    </div>
                  )}

                  {field.type === "select" ? (
                    <select className="form-select ui-control-sm" value={formData[field.key] ?? ""} onChange={(e) => handleChange(field.key, e.target.value)}>
                      <option value="">— Leave unchanged —</option>
                      {(field.options || []).map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : field.type === "number" ? (
                    <input
                      type="number"
                      className="form-control ui-control-sm"
                      value={formData[field.key] ?? ""}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      placeholder={field.placeholder || (config.commonValue !== null && config.commonValue !== undefined ? `Shared value: ${config.commonValue}` : "Leave blank to keep unchanged")}
                      min={field.min}
                      max={field.max}
                      step={field.step}
                    />
                  ) : (
                    <input
                      type="text"
                      className="form-control ui-control-sm"
                      value={formData[field.key] ?? ""}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      placeholder={field.placeholder || (config.commonValue !== null && config.commonValue !== undefined ? `Shared value: ${config.commonValue}` : "Leave blank to keep unchanged")}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="component-footer" style={{ position: "relative" }}>
          <div className="component-footer-left">
            <button type="button" onClick={handleSave} disabled={saving || localSaving || !hasChanges} className="align-items-center btn btn-success d-flex gap-1" title="Apply changes to all selected items">
              <CheckIcon style={{ width: 16, height: 16 }} />
              {saving || localSaving ? "Saving…" : "Save"}
            </button>
          </div>
          <div className="component-footer-center" style={{ position: "absolute", left: "50%", transform: "translateX(-50%)" }}>
            <button type="button" onClick={onClose} className="btn ui-btn-circle-outline-secondary" title="Close">
              <XMarkIcon />
            </button>
          </div>
          <div className="component-footer-right" />
        </div>
      </div>
    </Modal>
  );
}
