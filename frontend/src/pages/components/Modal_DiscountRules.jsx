/*

 * Full-screen discount rules panel (Inventory → Deals).

 */

import React, { useState, useEffect, useCallback } from "react";

import { XMarkIcon, TagIcon, CheckIcon } from "@heroicons/react/24/outline";

import { discountRulesAPI, inventoryAPI } from "../../services/api";

import { formatCurrency } from "../../utils/formatters";

import { showConfirm } from "../../services/showConfirm";

import Modal from "./Modal";

import Button_Toolbar from "./Button_Toolbar";
import Dropdown_Custom from "./Dropdown_Custom";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const EMPTY_FORM = {
  name: "",

  applies_to: "all",

  item_ids: [],

  discount_type: "percentage",

  discount_value: "",

  start_date: "",

  end_date: "",

  is_recurring: false,

  recur_frequency: "weekly",

  recur_days: [],

  recur_count: "",

  times_per_day: "",

  day_start_time: "",

  day_end_time: "",

  is_active: true,
};

const chipStyle = (active) => ({
  padding: "2px 8px",

  borderRadius: 12,

  fontSize: "0.72rem",

  cursor: "pointer",

  border: `1px solid ${active ? "#6366f1" : "var(--bs-border-color)"}`,

  background: active ? "#6366f1" : "transparent",

  color: active ? "#fff" : "var(--bs-body-color)",
});

export default function Modal_DiscountRules({ isOpen, onClose }) {
  const [rules, setRules] = useState([]);

  const [inventory, setInventory] = useState([]);

  const [loading, setLoading] = useState(false);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);

  const [productSearch, setProductSearch] = useState("");

  const [editPanelOpen, setEditPanelOpen] = useState(false);

  const resetForm = () => {
    setForm(EMPTY_FORM);

    setEditingId(null);

    setEditPanelOpen(false);

    setError("");
  };

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const [rRes, iRes] = await Promise.all([discountRulesAPI.getAll(), inventoryAPI.getAll()]);

      setRules(Array.isArray(rRes?.data) ? rRes.data : []);

      const inv = Array.isArray(iRes?.data) ? iRes.data : [];

      setInventory(inv.filter((i) => !["RESOURCE", "ASSET", "LOCATION"].includes((i.type || "").toUpperCase())));
    } catch {
      setError("Failed to load discount rules.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      load();
    } else {
      resetForm();

      setProductSearch("");
    }
  }, [isOpen, load]);

  const startEdit = (rule) => {
    setEditPanelOpen(true);

    setEditingId(rule.id);

    setForm({
      name: rule.name || "",

      applies_to: rule.applies_to || "all",

      item_ids: (() => {
        try {
          return JSON.parse(rule.item_ids || "[]");
        } catch {
          return [];
        }
      })(),

      discount_type: rule.discount_type || "percentage",

      discount_value: rule.discount_value ?? "",

      start_date: rule.start_date ? rule.start_date.slice(0, 16) : "",

      end_date: rule.end_date ? rule.end_date.slice(0, 16) : "",

      is_recurring: rule.is_recurring || false,

      recur_frequency: rule.recur_frequency || "weekly",

      recur_days: (() => {
        try {
          return JSON.parse(rule.recur_days || "[]");
        } catch {
          return [];
        }
      })(),

      recur_count: rule.recur_count ?? "",

      times_per_day: rule.times_per_day ?? "",

      day_start_time: rule.day_start_time || "",

      day_end_time: rule.day_end_time || "",

      is_active: rule.is_active !== false,
    });

    setError("");
  };

  const startNew = () => {
    setEditPanelOpen(true);

    setEditingId(null);

    setForm(EMPTY_FORM);

    setError("");
  };

  const handleDelete = async (id, e) => {
    e?.stopPropagation();

    if (!(await showConfirm("Delete this discount rule?"))) return;

    try {
      await discountRulesAPI.delete(id);

      if (editingId === id) resetForm();

      load();
    } catch {
      setError("Failed to delete.");
    }
  };

  const toggleProduct = (id) => {
    setForm((prev) => ({
      ...prev,

      item_ids: prev.item_ids.includes(id) ? prev.item_ids.filter((x) => x !== id) : [...prev.item_ids, id],
    }));
  };

  const toggleDay = (day) => {
    setForm((prev) => ({
      ...prev,

      recur_days: prev.recur_days.includes(day) ? prev.recur_days.filter((d) => d !== day) : [...prev.recur_days, day],
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError("Rule name is required.");

      return;
    }

    if (!form.discount_value || parseFloat(form.discount_value) <= 0) {
      setError("Discount value must be greater than 0.");

      return;
    }

    setSaving(true);

    setError("");

    try {
      const payload = {
        name: form.name.trim(),

        applies_to: form.applies_to,

        item_ids: form.applies_to === "selected" ? JSON.stringify(form.item_ids) : null,

        discount_type: form.discount_type,

        discount_value: parseFloat(form.discount_value) || 0,

        start_date: form.start_date || null,

        end_date: form.end_date || null,

        is_recurring: form.is_recurring,

        recur_frequency: form.is_recurring ? form.recur_frequency : null,

        recur_days: form.is_recurring && form.recur_frequency === "weekly" ? JSON.stringify(form.recur_days) : null,

        recur_count: form.recur_count !== "" ? parseInt(form.recur_count) : null,

        times_per_day: form.times_per_day !== "" ? parseInt(form.times_per_day) : null,

        day_start_time: form.day_start_time || null,

        day_end_time: form.day_end_time || null,

        is_active: form.is_active,
      };

      if (editingId) {
        await discountRulesAPI.update(editingId, payload);
      } else {
        await discountRulesAPI.create(payload);
      }

      resetForm();

      load();
    } catch {
      setError("Failed to save rule.");
    } finally {
      setSaving(false);
    }
  };

  const filteredInventory = inventory.filter((i) => !productSearch || (i.name || "").toLowerCase().includes(productSearch.toLowerCase()));

  const showEditor = editPanelOpen;

  return (
    <Modal isOpen={isOpen} onClose={onClose} noPadding fullScreen>
      <div className="ui-component-shell">
        <div className="component-header">
          <div className="component-header-left">
            <TagIcon className="app-icon me-1 text-primary" />
            Discount Rules
          </div>
          <div className="component-header-center"></div>
          <div className="component-header-right">
            <button type="button" className="btn btn-primary btn-sm" onClick={startNew}>
              New
            </button>
          </div>
        </div>

        <div className="component-body">
          <div className="component-body-inner">
          {error && !showEditor && <div className="mb-2 small text-danger">{error}</div>}

          {loading ? (
            <div className="p-1 small text-muted">Loading…</div>
          ) : (
            <div className="border rounded table-responsive">
              <table className="align-middle mb-0 table table-hover table-sm">
                <thead className="table-light">
                  <tr>
                    <th>Name</th>

                    <th>Discount</th>

                    <th>Applies to</th>

                    <th>Status</th>

                    <th className="text-end" style={{ width: 48 }} />
                  </tr>
                </thead>

                <tbody>
                  {rules.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-1 small text-center text-muted">
                        No rules yet. Click New or a row to edit.
                      </td>
                    </tr>
                  ) : (
                    rules.map((rule) => (
                      <tr
                        key={rule.id}
                        role="button"
                        tabIndex={0}
                        className={editingId === rule.id ? "table-primary" : ""}
                        onClick={() => startEdit(rule)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            startEdit(rule);
                            return;
                          }
                          if (e.key === " " || e.key === "Spacebar") {
                            e.preventDefault();
                            startEdit(rule);
                          }
                        }}
                        style={{ cursor: "pointer" }}
                      >
                        <td className="fw-medium">{rule.name}</td>

                        <td>{rule.discount_type === "percentage" ? `${rule.discount_value}%` : formatCurrency(rule.discount_value)}</td>

                        <td>{rule.applies_to === "all" ? "All items" : "Selected"}</td>

                        <td>{rule.is_active ? "Active" : "Inactive"}</td>

                        <td className="text-end" onClick={(e) => e.stopPropagation()}>
                          <button type="button" className="btn btn-bulk-circle btn-outline-danger btn-sm p-0" title="Delete rule" onClick={(e) => handleDelete(rule.id, e)}>
                            <XMarkIcon style={{ width: 14, height: 14 }} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          </div>{/* /component-body-inner */}
        </div>{/* /component-body */}

        <div className="component-footer">
          <div className="component-footer-left"></div>
          <div className="component-footer-center">
            <button type="button" onClick={onClose} className="btn ui-btn-circle-outline-secondary" title="Close">
              <XMarkIcon />
            </button>
          </div>
          <div className="component-footer-right"></div>
        </div>

        {showEditor && (
          <div className="bg-white border-start bottom-0 d-flex dark:bg-gray-900 end-0 flex-column position-absolute shadow-lg top-0" style={{ width: "min(100%, 22rem)", zIndex: 10 }}>
            <div className="align-items-center border-bottom d-flex flex-shrink-0 gap-2 justify-content-between p-0">
              <span className="fw-semibold ui-text-sm">{editingId ? "Edit rule" : "New rule"}</span>

              <button type="button" className="btn ui-btn-outline-secondary-sm" onClick={resetForm} disabled={saving}>
                Clear
              </button>
            </div>

            <div className="flex-grow-1 min-h-0 overflow-auto p-1">
              {error && <div className="mb-2 small text-danger">{error}</div>}

              <div className="mb-2">
                <label className="form-label mb-0 small">Rule name</label>

                <input className="form-control ui-control-sm" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
              </div>

              <div className="g-2 mb-2 row">
                <div className="col-6">
                  <label className="form-label mb-0 small">Type</label>

                  <Dropdown_Custom
                    className="form-select ui-control-sm"
                    value={form.discount_type}
                    onChange={(e) => setForm((p) => ({ ...p, discount_type: e.target.value }))}
                    options={[
                      { value: "percentage", label: "%" },
                      { value: "fixed", label: "$" },
                    ]}
                  />
                </div>

                <div className="col-6">
                  <label className="form-label mb-0 small">Value</label>

                  <input type="number" min="0" step="0.01" className="form-control ui-control-sm" value={form.discount_value} onChange={(e) => setForm((p) => ({ ...p, discount_value: e.target.value }))} />
                </div>
              </div>

              <label className="align-items-center d-flex gap-1 mb-2 small">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))} />
                Active
              </label>

              <div className="mb-2">
                <span className="d-block fw-semibold mb-1 small text-muted">Apply to</span>

                <label className="align-items-center d-flex gap-1 me-2 small">
                  <input type="radio" name="applies_to" value="all" checked={form.applies_to === "all"} onChange={() => setForm((p) => ({ ...p, applies_to: "all", item_ids: [] }))} />
                  All
                </label>

                <label className="align-items-center d-flex gap-1 small">
                  <input type="radio" name="applies_to" value="selected" checked={form.applies_to === "selected"} onChange={() => setForm((p) => ({ ...p, applies_to: "selected" }))} />
                  Selected
                </label>
              </div>

              {form.applies_to === "selected" && (
                <>
                  <input type="text" className="form-control form-control-sm mb-2" placeholder="Search products…" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />

                  <div className="border mb-2 rounded" style={{ maxHeight: "8rem", overflowY: "auto" }}>
                    {filteredInventory.map((item) => (
                      <label key={item.id} className="align-items-center border-bottom d-flex gap-2 mb-0 px-0 py-1 small">
                        <input type="checkbox" checked={form.item_ids.includes(item.id)} onChange={() => toggleProduct(item.id)} />

                        <span className="flex-grow-1 text-truncate">{item.name}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}

              <div className="g-2 mb-2 row">
                <div className="col-12">
                  <label className="form-label mb-0 small">Start</label>
                  <input type="datetime-local" className="form-control ui-control-sm" value={form.start_date} onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))} />
                </div>
                <div className="col-12">
                  <label className="form-label mb-0 small">End</label>

                  <input type="datetime-local" className="form-control ui-control-sm" value={form.end_date} onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))} />
                </div>
              </div>

              <label className="align-items-center d-flex gap-1 mb-2 small">
                <input type="checkbox" checked={form.is_recurring} onChange={(e) => setForm((p) => ({ ...p, is_recurring: e.target.checked }))} />
                Recurring
              </label>

              {form.is_recurring && (
                <div className="border mb-0 p-0 rounded small">
                  <Dropdown_Custom
                    className="form-select form-select-sm mb-2"
                    value={form.recur_frequency}
                    onChange={(e) => setForm((p) => ({ ...p, recur_frequency: e.target.value }))}
                    options={[
                      { value: "daily", label: "Daily" },
                      { value: "weekly", label: "Weekly" },
                      { value: "monthly", label: "Monthly" },
                    ]}
                  />

                  {form.recur_frequency === "weekly" && (
                    <div className="d-flex flex-wrap gap-1 mb-2">
                      {DAYS.map((d) => (
                        <button key={d} type="button" onClick={() => toggleDay(d)} style={chipStyle(form.recur_days.includes(d))}>
                          {d}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="align-items-center border-top d-flex flex-shrink-0 gap-2 p-0">
              <Button_Toolbar icon={CheckIcon} label="Save" onClick={handleSave} className="btn-primary" disabled={saving} title="Save rule" />
              <button type="button" onClick={resetForm} className="btn ui-btn-circle-outline-secondary" title="Cancel" disabled={saving}>
                <XMarkIcon />
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
