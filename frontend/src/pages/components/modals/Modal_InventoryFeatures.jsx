import React, { useEffect, useMemo, useState } from "react";
import Modal from "./Modal";
import SettingsMasterDetail, { SettingsMasterDetailTable } from "../layout/Settings_MasterDetail";
import Button_Toolbar from "../buttons/Button_Toolbar";
import { InputText, InputTextarea } from "../Inputs";
import { CheckIcon, PlusIcon, TrashIcon, XMarkIcon } from "../../../icons";
import { featuresAPI } from "../../../services/api";
import { showConfirm } from "../../../services/showConfirm";
import { sortItemsAlphabetically } from "../../../utils/displaySort";

const NEW_FEATURE_ID = "new";

function getErrorMessage(error, fallback) {
  const detail = error?.response?.data?.detail;
  return (typeof detail === "string" && detail) || error?.message || fallback;
}

export default function Modal_InventoryFeatures({ isOpen, onClose, container, onFeaturesChanged }) {
  const [features, setFeatures] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [optionName, setOptionName] = useState("");
  const [optionDrafts, setOptionDrafts] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const sortedFeatures = useMemo(() => sortItemsAlphabetically(features, ["name"]), [features]);
  const selectedFeature = features.find((feature) => String(feature.id) === String(selectedId));
  const options = selectedFeature?.options || [];

  const loadFeatures = async (keepId = selectedId) => {
    setLoading(true);
    setError("");
    try {
      const response = await featuresAPI.listAll();
      const next = response?.data ?? response;
      const list = Array.isArray(next) ? next : [];
      setFeatures(list);
      setSelectedId((current) => {
        if (current === NEW_FEATURE_ID) return current;
        const preferred = keepId === undefined ? current : keepId;
        if (preferred == null) return null;
        return list.some((feature) => String(feature.id) === String(preferred)) ? preferred : null;
      });
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Unable to load inventory features."));
    } finally {
      setLoading(false);
    }
  };

  const refreshInventoryFeatureSummary = async () => {
    try {
      await onFeaturesChanged?.();
    } catch (refreshError) {
      setError(getErrorMessage(refreshError, "The feature was saved, but inventory summaries could not be refreshed."));
    }
  };

  useEffect(() => {
    if (isOpen) void loadFeatures(null);
  }, [isOpen]);

  useEffect(() => {
    if (selectedId === NEW_FEATURE_ID) {
      setName("");
      setDescription("");
      setOptionName("");
      setOptionDrafts({});
      return;
    }
    if (!selectedFeature) {
      setName("");
      setDescription("");
      setOptionName("");
      setOptionDrafts({});
      return;
    }
    setName(selectedFeature.name || "");
    setDescription(selectedFeature.description || "");
    setOptionDrafts(Object.fromEntries((selectedFeature.options || []).map((option) => [option.id, option.name || option.option_name || ""])));
  }, [selectedId, selectedFeature?.id]);

  const handleSave = async (event) => {
    event?.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || saving) return;
    setSaving(true);
    setError("");
    try {
      if (selectedId === NEW_FEATURE_ID) {
        const response = await featuresAPI.create({ name: trimmedName, description: description.trim() || "" });
        const created = response?.data ?? response;
        const id = created?.id ?? created?.feature?.id;
        await loadFeatures(id ?? null);
        await refreshInventoryFeatureSummary();
      } else {
        await featuresAPI.update(selectedId, { name: trimmedName, description: description.trim() || "" });
        await loadFeatures(selectedId);
        await refreshInventoryFeatureSummary();
      }
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Unable to save this feature."));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFeature = async () => {
    if (!selectedFeature) return;
    const affectedProducts = Number(selectedFeature.usage_count) || 0;
    const productLabel = `${affectedProducts} product${affectedProducts === 1 ? "" : "s"}`;
    if (!(await showConfirm(`This will delete the feature and its options from ${productLabel}. You can restore the feature and its linked data using the app's Undo action. Continue?`))) return;
    setSaving(true);
    setError("");
    try {
      await featuresAPI.delete(selectedFeature.id);
      await loadFeatures(null);
      await refreshInventoryFeatureSummary();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, "Unable to delete this feature."));
    } finally {
      setSaving(false);
    }
  };

  const handleAddOption = async (event) => {
    event?.preventDefault();
    const value = optionName.trim();
    if (!selectedFeature || !value || saving) return;
    setSaving(true);
    setError("");
    try {
      await featuresAPI.addOption(selectedFeature.id, { name: value });
      setOptionName("");
      await loadFeatures(selectedFeature.id);
    } catch (optionError) {
      setError(getErrorMessage(optionError, "Unable to add this feature option."));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOption = async (option) => {
    const value = String(optionDrafts[option.id] || "").trim();
    if (!selectedFeature || !value || saving) return;
    setSaving(true);
    setError("");
    try {
      await featuresAPI.renameOption(selectedFeature.id, option.id, { name: value });
      await loadFeatures(selectedFeature.id);
    } catch (optionError) {
      setError(getErrorMessage(optionError, "Unable to update this feature option."));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOption = async (option) => {
    if (!selectedFeature || !(await showConfirm(`Delete the "${option.name || option.option_name}" option?`))) return;
    setSaving(true);
    setError("");
    try {
      await featuresAPI.deleteOption(selectedFeature.id, option.id);
      await loadFeatures(selectedFeature.id);
    } catch (optionError) {
      setError(getErrorMessage(optionError, "Unable to delete this feature option."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      container={container}
      onClose={onClose}
      title="Inventory Features"
      noPadding
      contentGravity="bottom"
      footer={selectedId !== null ? (
        <>
          {selectedFeature && optionName.trim() && <Button_Toolbar type="submit" form="inventory-feature-option-form" icon={PlusIcon} label="Add option" disabled={saving} className="btn-outline-primary" title="Add option" />}
          <Button_Toolbar type="submit" form="inventory-feature-form" icon={CheckIcon} label={selectedId === NEW_FEATURE_ID ? "Create" : "Save"} disabled={saving} className="btn-primary" title="Save feature" />
          <Button_Toolbar icon={XMarkIcon} label="" onClick={() => setSelectedId(null)} className="btn-outline-secondary" title="Cancel" />
        </>
      ) : (
        <>
          <Button_Toolbar icon={PlusIcon} label="Add" onClick={() => setSelectedId(NEW_FEATURE_ID)} className="btn-primary" title="Add feature" />
          <Button_Toolbar icon={XMarkIcon} label="" onClick={onClose} className="btn-outline-secondary" title="Cancel" />
        </>
      )}
    >
      <div className="d-flex flex-column h-100 min-h-0 p-2">
        {error && <div className="alert alert-danger py-2 mb-2" role="alert">{error}</div>}
        <SettingsMasterDetail
          detailOpen={selectedId !== null}
          onBack={() => setSelectedId(null)}
          list={
            <div className="d-flex flex-column h-100 min-h-0">
              <div className="mb-2">
                <h5 className="mb-0">Features</h5>
              </div>
              <SettingsMasterDetailTable columns={[{ label: "Feature" }, { label: "Options" }, { label: "Used by" }]}>
                {loading ? (
                  <tr><td colSpan={3} className="text-center text-muted py-2">Loading features…</td></tr>
                ) : sortedFeatures.length === 0 ? (
                  <tr><td colSpan={3} className="text-center text-muted py-2">No features yet. Add one to get started.</td></tr>
                ) : sortedFeatures.map((feature) => (
                  <tr key={feature.id} className={String(feature.id) === String(selectedId) ? "table-primary" : ""}>
                    <td>
                      <button type="button" className="btn btn-link fw-medium p-0 text-start text-decoration-none" onClick={() => setSelectedId(feature.id)}>
                        {feature.name}
                      </button>
                    </td>
                    <td>{feature.options?.length || 0}</td>
                    <td>{Number(feature.usage_count) || 0}</td>
                  </tr>
                ))}
              </SettingsMasterDetailTable>
            </div>
          }
          detail={
            <div className="d-flex flex-column h-100 justify-content-end overflow-auto">
              {selectedId === NEW_FEATURE_ID || selectedFeature ? (
                <>
                <form id="inventory-feature-form" onSubmit={handleSave} className="d-flex flex-column gap-3">
                  <div className="align-items-center d-flex justify-content-between">
                    <h5 className="mb-0">{selectedId === NEW_FEATURE_ID ? "New Feature" : selectedFeature.name}</h5>
                    {selectedFeature && <Button_Toolbar icon={TrashIcon} label="Delete" onClick={handleDeleteFeature} disabled={saving} className="btn-outline-danger btn-sm" title="Delete feature" />}
                  </div>
                  <div className="form-floating">
                    <InputText id="inventory-feature-name" className="form-control" value={name} onChange={(event) => setName(event.target.value)} placeholder="Feature name" required />
                    <label htmlFor="inventory-feature-name">Feature name *</label>
                  </div>
                  <div className="form-floating">
                    <InputTextarea id="inventory-feature-description" className="form-control" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Description" />
                    <label htmlFor="inventory-feature-description">Description</label>
                  </div>
                </form>
                {selectedFeature && (
                    <div className="border-top pt-3">
                      <h6>Options</h6>
                      <form id="inventory-feature-option-form" onSubmit={handleAddOption} className="d-flex gap-2 mb-2">
                        <InputText className="form-control" value={optionName} onChange={(event) => setOptionName(event.target.value)} placeholder="New option" />
                      </form>
                      {options.length === 0 && <div className="small text-muted">No options defined.</div>}
                      <div className="d-flex flex-column gap-2">
                        {options.map((option) => (
                          <div key={option.id} className="align-items-center d-flex gap-2">
                            <InputText
                              className="form-control"
                              value={optionDrafts[option.id] ?? option.name ?? option.option_name ?? ""}
                              onChange={(event) => setOptionDrafts((previous) => ({ ...previous, [option.id]: event.target.value }))}
                            />
                            <Button_Toolbar icon={CheckIcon} label="Save" onClick={() => handleSaveOption(option)} disabled={saving} className="btn-outline-primary btn-sm" title="Save option" />
                            <Button_Toolbar icon={TrashIcon} label="Delete" onClick={() => handleDeleteOption(option)} disabled={saving} className="btn-outline-danger btn-sm" title="Delete option" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="align-items-center d-flex h-100 justify-content-center text-muted">
                  {loading ? "Loading features…" : "Select a feature or add a new one."}
                </div>
              )}
            </div>
          }
        />
      </div>
    </Modal>
  );
}
