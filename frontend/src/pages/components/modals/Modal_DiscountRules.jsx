/*
 * Full-screen discount rules panel (Sales → Deals).
 */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { XMarkIcon, TagIcon, CheckIcon, TrashIcon, PlusIcon } from "../../../icons";
import { discountRulesAPI, inventoryAPI, servicesAPI } from "../../../services/api";
import { formatCurrency } from "../../../utils/formatters";
import { showConfirm } from "../../../services/showConfirm";
import Modal from "./Modal";
import Button_Toolbar from "../buttons/Button_Toolbar";
import Dropdown_Custom from "../dropdowns/Dropdown_Custom";
import { InputCheckbox, InputNumber, InputText, InputDateTime } from "../Inputs";
import useStore from "../../../services/useStore";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const getNowDateTimeString = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

const EMPTY_FORM = {
  name: "",
  deal_type: "product", // "product" | "cart_auto" | "cart_selectable"
  applies_to: "all",    // "all" | "all_products" | "all_services" | "all_packages" | "selected"
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
  const { hasPermission } = useStore();
  const canWriteDeals = hasPermission("sales", "write");
  const canDeleteDeals = hasPermission("sales", "delete");
  const [rules, setRules] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [services, setServices] = useState([]);
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
      const [rRes, iRes, sRes] = await Promise.all([
        discountRulesAPI.getAll(),
        inventoryAPI.getAll(),
        servicesAPI.getAll(),
      ]);
      setRules(Array.isArray(rRes?.data) ? rRes.data : []);
      const inv = Array.isArray(iRes?.data) ? iRes.data : [];
      setInventory(inv.filter((i) => !["RESOURCE", "ASSET", "LOCATION"].includes((i.type || "").toUpperCase())));
      const srv = Array.isArray(sRes?.data) ? sRes.data : [];
      setServices(srv);
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
    if (!canWriteDeals) return;
    setEditPanelOpen(true);
    setEditingId(rule.id);
    setForm({
      name: rule.name || "",
      deal_type: rule.deal_type || "product",
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
    if (!canWriteDeals) return;
    setEditPanelOpen(true);
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      start_date: getNowDateTimeString(),
    });
    setError("");
  };

  const handleDelete = async (id, e) => {
    e?.stopPropagation();
    if (!canDeleteDeals) return;
    if (!(await showConfirm("Delete this discount rule?"))) return;
    try {
      await discountRulesAPI.delete(id);
      if (editingId === id) resetForm();
      load();
    } catch {
      setError("Failed to delete.");
    }
  };

  const toggleItem = (id) => {
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
    if (!canWriteDeals) {
      setError("You do not have permission to manage deals.");
      return;
    }
    if (!form.name.trim()) {
      setError("Rule name is required.");
      return;
    }
    if (!form.discount_value || parseFloat(form.discount_value) <= 0) {
      setError("Discount value must be greater than 0.");
      return;
    }
    if (!form.start_date) {
      setError("Start date and time is required.");
      return;
    }

    const startDate = new Date(form.start_date);
    // Allow a 2-minute buffer so that normal form entry does not trigger past date error
    const nowWithBuffer = new Date(Date.now() - 2 * 60 * 1000);
    if (!editingId && startDate < nowWithBuffer) {
      setError("Start date and time cannot be in the past.");
      return;
    }

    if (form.end_date) {
      const endDate = new Date(form.end_date);
      if (endDate <= startDate) {
        setError("End date must be after start date.");
        return;
      }
    }

    setSaving(true);
    setError("");
    try {
      const payload = {
        name: form.name.trim(),
        deal_type: form.deal_type || "product",
        applies_to: form.deal_type === "product" ? form.applies_to : "all",
        item_ids: form.deal_type === "product" && form.applies_to === "selected" ? JSON.stringify(form.item_ids) : null,
        discount_type: form.discount_type,
        discount_value: parseFloat(form.discount_value) || 0,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        is_recurring: form.is_recurring,
        recur_frequency: form.is_recurring ? form.recur_frequency : null,
        recur_days: form.is_recurring && form.recur_frequency === "weekly" ? JSON.stringify(form.recur_days) : null,
        recur_count: form.recur_count !== "" ? parseInt(form.recur_count, 10) : null,
        times_per_day: form.times_per_day !== "" ? parseInt(form.times_per_day, 10) : null,
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

  const selectableCatalog = useMemo(() => {
    const list = [
      ...inventory.map((i) => ({ id: i.id, name: i.name, type: (i.type || "product").toLowerCase() })),
      ...services.map((s) => ({ id: s.id, name: s.name, type: "service" })),
    ];
    if (!productSearch) return list;
    const q = productSearch.toLowerCase();
    return list.filter((item) => (item.name || "").toLowerCase().includes(q));
  }, [inventory, services, productSearch]);

  const getAppliesToLabel = (rule) => {
    if (rule.deal_type === "cart_auto" || rule.deal_type === "cart_selectable") {
      return "Entire Cart";
    }
    switch (rule.applies_to) {
      case "all_products":
        return "All Products";
      case "all_services":
        return "All Services";
      case "all_packages":
        return "All Packages";
      case "selected":
        return "Selected Items";
      case "all":
      default:
        return "All Items & Services";
    }
  };

  const getDealNameColor = (rule) => {
    if (rule.deal_type !== "product") return "text-body";
    if (rule.applies_to === "all_services") return "text-primary";
    if (["all_products", "all_packages"].includes(rule.applies_to)) return "text-secondary";
    if (rule.applies_to !== "selected") return "text-body";

    let itemIds = [];
    try {
      itemIds = Array.isArray(rule.item_ids) ? rule.item_ids : JSON.parse(rule.item_ids || "[]");
    } catch {
      return "text-body";
    }
    if (!Array.isArray(itemIds)) return "text-body";

    const selectedTypes = new Set(
      itemIds.map((id) => {
        if (services.some((service) => String(service.id) === String(id))) return "service";
        if (inventory.some((item) => String(item.id) === String(id))) return "product";
        return "mixed";
      })
    );
    if (selectedTypes.size === 1 && selectedTypes.has("service")) return "text-primary";
    if (selectedTypes.size === 1 && selectedTypes.has("product")) return "text-secondary";
    return "text-body";
  };

  const showEditor = editPanelOpen;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <span className="align-items-center d-flex">
          <TagIcon className="app-icon me-1 text-primary" />
          Deals
        </span>
      }
      footer={
        <div className="d-flex gap-2 justify-content-start align-items-center">
          {showEditor ? (
            <>
              <Button_Toolbar
                icon={CheckIcon}
                label="Save"
                onClick={handleSave}
                className="btn-primary"
                disabled={saving}
                title={editingId ? "Save changes to deal" : "Save new deal"}
              />
              <Button_Toolbar
                icon={XMarkIcon}
                label="Cancel"
                onClick={resetForm}
                className="btn-outline-secondary"
                disabled={saving}
                title="Cancel editing"
              />
            </>
          ) : (
            <>
              {canWriteDeals && (
                <Button_Toolbar
                  icon={PlusIcon}
                  label="New"
                  onClick={startNew}
                  className="btn-primary"
                  title="New Rule"
                />
              )}
              <Button_Toolbar
                icon={XMarkIcon}
                label="Close"
                onClick={onClose}
                className="btn-outline-secondary"
                title="Close"
              />
            </>
          )}
        </div>
      }
    >
      <div className="p-1">
        {error && !showEditor && <div className="mb-2 small text-danger">{error}</div>}

        {loading ? (
          <div className="p-1 small text-muted">Loading…</div>
        ) : (
          <div className="border rounded table-responsive">
            <table className="align-middle mb-0 table table-hover table-sm text-size-small" style={{ fontSize: "var(--app-text-size-small, 0.75rem)" }}>
              <thead className="table-light">
                <tr>
                  <th>Name</th>
                  <th>Discount</th>
                  <th>Scope</th>
                  <th className="text-end" style={{ width: 48 }} />
                </tr>
              </thead>
              <tbody>
                {rules.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-2 small text-center text-muted">
                      No discount rules yet. Click New to create your first deal.
                    </td>
                  </tr>
                ) : (
                  rules.map((rule) => {
                    return (
                      <tr
                        key={rule.id}
                        className={editingId === rule.id ? "table-primary" : ""}
                      >
                        <td className="fw-medium">
                          {canWriteDeals ? (
                            <button
                              type="button"
                              className={`btn btn-link fw-medium p-0 text-start text-decoration-none ${getDealNameColor(rule)}`}
                              onClick={() => startEdit(rule)}
                            >
                              {rule.name}
                            </button>
                          ) : (
                            <span className={getDealNameColor(rule)}>{rule.name}</span>
                          )}
                        </td>
                        <td>{rule.discount_type === "percentage" ? `${rule.discount_value}%` : formatCurrency(rule.discount_value)}</td>
                        <td>{getAppliesToLabel(rule)}</td>
                        <td className="text-end">
                          {canDeleteDeals && (
                            <button type="button" className="btn btn-bulk-circle btn-outline-danger btn-sm p-0" title="Delete rule" onClick={(e) => handleDelete(rule.id, e)}>
                              <TrashIcon style={{ width: 14, height: 14 }} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showEditor && (
        <div className="bg-white border-start bottom-0 d-flex dark:bg-gray-900 end-0 flex-column position-absolute shadow-lg top-0 text-size-small" style={{ width: "min(100%, 24rem)", zIndex: 10, fontSize: "var(--app-text-size-small, 0.75rem)" }}>
          <div className="align-items-center border-bottom d-flex flex-shrink-0 gap-2 justify-content-between p-2">
            <span className="fw-semibold ui-text-sm">{editingId ? "Edit Deal" : "New Deal"}</span>
            <button type="button" className="btn ui-btn-outline-secondary-sm" onClick={resetForm} disabled={saving}>
              Clear
            </button>
          </div>

          <div className="flex-grow-1 min-h-0 overflow-auto p-2">
            {error && <div className="mb-2 small text-danger">{error}</div>}

            <div className="mb-2">
              <label className="form-label mb-0 small">Deal Name *</label>
              <input className="form-control ui-control-sm" placeholder="e.g. Summer Promo, Senior Discount" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </div>

            <div className="mb-2">
              <label className="form-label mb-0 small">Deal Type / Scope *</label>
              <Dropdown_Custom
                className="form-select ui-control-sm"
                value={form.deal_type || "product"}
                onChange={(e) => setForm((p) => ({ ...p, deal_type: e.target.value }))}
                options={[
                  { value: "product", label: "Product / Item Deal (auto-applied to line items)" },
                  { value: "cart_auto", label: "Automatic Cart Promotion (applied to all carts)" },
                  { value: "cart_selectable", label: "Selectable Cart Deal (chosen in cart)" },
                ]}
              />
            </div>

            <div className="g-2 mb-2 row">
              <div className="col-6">
                <label className="form-label mb-0 small">Discount Type</label>
                <Dropdown_Custom
                  className="form-select ui-control-sm"
                  value={form.discount_type}
                  onChange={(e) => setForm((p) => ({ ...p, discount_type: e.target.value }))}
                  options={[
                    { value: "percentage", label: "% (Percentage)" },
                    { value: "fixed", label: "$ (Fixed Amount)" },
                  ]}
                />
              </div>
              <div className="col-6">
                <label className="form-label mb-0 small">Value *</label>
                <InputNumber min="0" step="0.01" className="form-control ui-control-sm" value={form.discount_value} onChange={(e) => setForm((p) => ({ ...p, discount_value: e.target.value }))} placeholder="0.00" />
              </div>
            </div>

            {(!form.deal_type || form.deal_type === "product") && (
              <div className="mb-2">
                <label className="form-label mb-0 small">Applies to</label>
                <Dropdown_Custom
                  className="form-select ui-control-sm mb-1"
                  value={form.applies_to}
                  onChange={(e) => setForm((p) => ({ ...p, applies_to: e.target.value, item_ids: e.target.value === "selected" ? p.item_ids : [] }))}
                  options={[
                    { value: "all", label: "All Items & Services" },
                    { value: "all_products", label: "Products Only" },
                    { value: "all_services", label: "Services Only" },
                    { value: "all_packages", label: "Packages / Bundles / Mixes Only" },
                    { value: "selected", label: "Specific Selected Items" },
                  ]}
                />

                {form.applies_to === "selected" && (
                  <div className="mt-1">
                    <InputText className="form-control form-control-sm mb-1" placeholder="Search products or services…" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />
                    <div className="border rounded p-1" style={{ maxHeight: "10rem", overflowY: "auto" }}>
                      {selectableCatalog.map((item) => (
                        <label key={item.id} className="align-items-center border-bottom d-flex gap-2 mb-0 px-1 py-1 small cursor-pointer">
                          <InputCheckbox checked={form.item_ids.includes(item.id)} onChange={() => toggleItem(item.id)} />
                          <span className="flex-grow-1 text-truncate">{item.name}</span>
                          <span className="badge bg-light text-dark border text-capitalize" style={{ fontSize: "0.65rem" }}>
                            {item.type}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="g-2 mb-2 row">
              <div className="col-12">
                <label className="form-label mb-0 small">Start Date & Time * (Required)</label>
                <InputDateTime value={form.start_date} onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))} />
              </div>
              <div className="col-12">
                <label className="form-label mb-0 small">End Date & Time (Optional)</label>
                <InputDateTime value={form.end_date} onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))} />
              </div>
            </div>

            <div className="align-items-center d-flex gap-3 mb-2">
              <label className="align-items-center d-flex gap-1 mb-0 small cursor-pointer">
                <InputCheckbox checked={form.is_active} onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))} />
                Active
              </label>

              <label className="align-items-center d-flex gap-1 mb-0 small cursor-pointer">
                <InputCheckbox checked={form.is_recurring} onChange={(e) => setForm((p) => ({ ...p, is_recurring: e.target.checked }))} />
                Recurring schedule
              </label>
            </div>

            {form.is_recurring && (
              <div className="border mb-2 p-2 rounded small">
                <label className="form-label mb-0 small text-muted">Frequency</label>
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

          <div className="align-items-center border-top d-flex flex-shrink-0 gap-2 p-2">
            {canWriteDeals && <Button_Toolbar icon={CheckIcon} label="Save" onClick={handleSave} className="btn-primary" disabled={saving} title="Save deal" />}
            <Button_Toolbar icon={XMarkIcon} label="Cancel" onClick={resetForm} className="btn-outline-secondary" disabled={saving} title="Cancel" />
          </div>
        </div>
      )}
    </Modal>
  );
}
