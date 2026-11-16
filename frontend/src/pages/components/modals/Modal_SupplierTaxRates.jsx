import React, { useEffect, useState } from "react";
import { inventoryCategoriesAPI } from "../../../services/api";
import { InputNumber } from "../Inputs";
import { CheckIcon, XMarkIcon } from "../../../icons";
import Footer_Actions from "../footers/Footer_Actions";
import Button_Toolbar from "../buttons/Button_Toolbar";
import Modal from "./Modal";

const getErrorMessage = (error) =>
  String(error?.response?.data?.detail || error?.message || "Failed to save import-tax rates.");

export default function Modal_SupplierTaxRates({ isOpen, onClose }) {
  const [categories, setCategories] = useState([]);
  const [rates, setRates] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setLoading(true);
    setError("");
    inventoryCategoriesAPI.getAll()
      .then((response) => {
        if (!active) return;
        const rows = response?.data ?? response ?? [];
        if (!Array.isArray(rows)) throw new Error("Invalid inventory category data received.");
        setCategories(rows);
        setRates(Object.fromEntries(rows.map((category) => [category.id, String(category.import_tax_rate ?? 0)])));
      })
      .catch((loadError) => {
        if (active) setError(getErrorMessage(loadError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [isOpen]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      for (const category of categories) {
        const rate = Number(rates[category.id] ?? 0);
        if (!Number.isFinite(rate) || rate < 0) {
          throw new Error(`Enter a non-negative tax rate for ${category.name}.`);
        }
        if (rate !== Number(category.import_tax_rate ?? 0)) {
          await inventoryCategoriesAPI.update(category.id, { import_tax_rate: rate });
        }
      }
      onClose();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Import Tax Rates"
      footer={
        <Footer_Actions
          start={
            <Button_Toolbar
              icon={CheckIcon}
              label={saving ? "Saving…" : "Save"}
              onClick={handleSave}
              disabled={loading || saving}
              className="btn-primary"
              title="Save import-tax rates"
            />
          }
          center={
            <button
              type="button"
              className="btn btn-bulk-circle btn-outline-secondary p-0"
              onClick={onClose}
              disabled={saving}
              title="Cancel"
              aria-label="Cancel"
            >
              <XMarkIcon style={{ width: 16, height: 16 }} />
            </button>
          }
        />
      }
    >
      <div className="d-flex flex-column gap-2 p-1">
        {error && <div className="alert alert-danger py-1 small" role="alert">{error}</div>}
        {loading ? (
          <div className="py-2 small text-center text-muted">Loading inventory categories…</div>
        ) : categories.length === 0 ? (
          <div className="py-2 small text-center text-muted">Create inventory categories before configuring import tax.</div>
        ) : (
          categories.map((category) => (
            <div key={category.id} className="align-items-center border-bottom d-flex gap-2 justify-content-between pb-2">
              <div className="min-w-0">
                <div className="fw-medium small">{category.name}</div>
                <div className="text-muted text-capitalize text-xxs">{category.item_type}</div>
              </div>
              <div className="align-items-center d-flex flex-shrink-0 gap-1" style={{ width: 118 }}>
                <InputNumber
                  min="0"
                  step="0.01"
                  className="form-control ui-control-sm text-end"
                  value={rates[category.id] ?? "0"}
                  onChange={(event) => setRates((previous) => ({ ...previous, [category.id]: event.target.value }))}
                  aria-label={`Import tax percentage for ${category.name}`}
                />
                <span className="small text-muted">%</span>
              </div>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}
