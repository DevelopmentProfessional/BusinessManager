// FILE: Modal_ManageLookup.jsx
// Reusable manager modal for simple company-scoped lookup lists (name + description),
// e.g. client/employee/document statuses and service categories.
// Mirrors the Manage Subscriptions modal pattern on the Clients page.
import React, { useEffect, useMemo, useState } from "react";
import { InputText, InputTextarea } from "../Inputs";
import Modal from "./Modal";
import Button_Toolbar from "../buttons/Button_Toolbar";
import { showConfirm } from "../../../services/showConfirm";
import { sortItemsAlphabetically } from "../../../utils/displaySort";
import SettingsMasterDetail, { SettingsMasterDetailTable } from "../layout/Settings_MasterDetail";
import { XMarkIcon, CheckIcon, PlusIcon } from "../../../icons";

const NEW_ITEM_ID = "new";

export default function Modal_ManageLookup({
  isOpen,
  onClose,
  container,
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
  const [selectedId, setSelectedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const sortedItems = useMemo(() => sortItemsAlphabetically(items || [], ["name"]), [items]);
  const selectedItem = sortedItems.find((item) => String(item.id) === String(selectedId));

  const startNew = () => {
    setForm({ name: "", description: "" });
    setSelectedId(NEW_ITEM_ID);
    setError("");
  };

  useEffect(() => {
    if (selectedId === NEW_ITEM_ID) {
      setForm({ name: "", description: "" });
      return;
    }
    if (!selectedItem) {
      setForm({ name: "", description: "" });
      return;
    }
    setForm({ name: selectedItem.name || "", description: selectedItem.description || "" });
  }, [selectedId, selectedItem?.id]);

  const closeManager = () => {
    setForm({ name: "", description: "" });
    setSelectedId(null);
    setError("");
    onClose();
  };
  const closeDetail = () => {
    setForm({ name: "", description: "" });
    setSelectedId(null);
    setError("");
  };

  const handleSave = async (event) => {
    event?.preventDefault();
    const name = form.name.trim();
    if (!name || saving) return;
    setSaving(true);
    setError("");
    try {
      const payload = { name, description: form.description || null };
      if (selectedId !== NEW_ITEM_ID) {
        await api.update(selectedId, payload);
        await onItemsChanged?.();
      } else {
        const response = await api.create(payload);
        const created = response?.data ?? response;
        await onItemsChanged?.();
        setSelectedId(created?.id ?? null);
      }
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || `Failed to save ${entityLabel}.`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (itemId) => {
    if (!(await showConfirm(`Delete this ${entityLabel}?`))) return;
    setError("");
    try {
      await api.delete(itemId);
      if (String(selectedId) === String(itemId)) setSelectedId(null);
      await onItemsChanged?.();
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || `Failed to delete ${entityLabel}.`);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      container={container}
      onClose={closeManager}
      title={title}
      centered={true}
      contentGravity="bottom"
      footer={
        selectedId !== null ? (
          <div className="d-flex gap-2 justify-content-start align-items-center">
            <Button_Toolbar type="submit" form="lookup-entry-form" icon={CheckIcon} label={selectedId === NEW_ITEM_ID ? "Create" : "Save"} disabled={saving} className="btn-primary" title={`Save ${entityLabel}`} />
            <Button_Toolbar icon={XMarkIcon} label="" onClick={closeDetail} className="btn-outline-secondary" title="Cancel" />
          </div>
        ) : (
          <div className="d-flex gap-2 justify-content-start align-items-center">
            <Button_Toolbar icon={PlusIcon} label="Add" onClick={startNew} className="btn-primary" title={`Add ${entityLabel}`} />
            <Button_Toolbar icon={XMarkIcon} label="" onClick={closeManager} className="btn-outline-secondary" title="Cancel" />
          </div>
        )
      }
    >
      <div className="d-flex flex-column h-100 min-h-0 p-2">
        {error && <div className="alert alert-danger py-2 mb-2" role="alert">{error}</div>}
        <SettingsMasterDetail
          detailOpen={selectedId !== null}
          onBack={closeDetail}
          list={
            <div className="d-flex flex-column h-100 min-h-0">
              <div className="mb-2">
                <h5 className="mb-0 text-capitalize">{entityLabel}s</h5>
              </div>
              <SettingsMasterDetailTable
                columns={[
                  { label: "", style: { width: 48 } },
                  { label: entityLabel.charAt(0).toUpperCase() + entityLabel.slice(1) },
                  { label: "Description" },
                ]}
              >
                {sortedItems.length === 0 ? (
                  <tr><td colSpan={3} className="py-2 small text-center text-muted">No {entityLabel} entries yet.</td></tr>
                ) : sortedItems.map((item) => (
                  <tr key={item.id} className={String(item.id) === String(selectedId) ? "table-primary" : ""}>
                    <td className="text-center">
                      <button type="button" className="btn btn-bulk-circle btn-outline-danger btn-sm p-0" onClick={() => handleDelete(item.id)} title={`Delete ${entityLabel}`}>
                        <XMarkIcon style={{ width: 14, height: 14 }} />
                      </button>
                    </td>
                    <td>
                      <button type="button" className="btn btn-link fw-medium p-0 text-body text-start text-decoration-none" onClick={() => setSelectedId(item.id)}>
                        {item.name}
                      </button>
                    </td>
                    <td className="text-muted">{item.description || "—"}</td>
                  </tr>
                ))}
              </SettingsMasterDetailTable>
            </div>
          }
          detail={
            selectedId === NEW_ITEM_ID || selectedItem ? (
              <form id="lookup-entry-form" onSubmit={handleSave} className="d-flex flex-column gap-3">
                <h5 className="mb-0">{selectedId === NEW_ITEM_ID ? `New ${entityLabel}` : `Edit ${entityLabel}`}</h5>
                <div className="form-floating">
                  <InputText id="lookup-entry-name" className="form-control" placeholder={`${entityLabel} name`} value={form.name} onChange={(e) => setForm((previous) => ({ ...previous, name: e.target.value }))} />
                  <label htmlFor="lookup-entry-name">{entityLabel.charAt(0).toUpperCase() + entityLabel.slice(1)} name</label>
                </div>
                <div className="form-floating">
                  <InputTextarea id="lookup-entry-description" className="ui-description-textarea form-control" rows={6} placeholder="Description" value={form.description} onChange={(e) => setForm((previous) => ({ ...previous, description: e.target.value }))} />
                  <label htmlFor="lookup-entry-description">Description</label>
                </div>
              </form>
            ) : (
              <div className="align-items-center d-flex h-100 justify-content-center text-muted">Select an entry or add a new one.</div>
            )
          }
        />
      </div>
    </Modal>
  );
}
