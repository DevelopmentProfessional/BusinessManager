/*
 * ============================================================
 * FILE: FeatureSection.jsx
 *
 * PURPOSE:
 *   Self-contained section component for managing descriptive features
 *   (e.g. "Size", "Color") on an inventory item. Rendered inside
 *   Modal_Detail_Item in inventory mode, below the main form.
 *
 * FUNCTIONAL PARTS:
 *   [1] Helpers       — calcPriceRange, calcTotalStock
 *   [2] FeatureTable  — Per-feature option table (checkbox, qty, price)
 *   [3] FeatureSection — Main export: loads global + item features,
 *                        handles all CRUD, notifies parent of stock/price
 *
 * CHANGE LOG:
 *   2026-03-05 | Claude | Initial implementation
 *   2026-03-11 | Claude | Accordion headers, trash icon, borderless table,
 *                         right-aligned add-option row, options preview in header
 * ============================================================
 */

import React, { useState, useEffect, useCallback } from "react";
import { TrashIcon, ChevronDownIcon, DocumentDuplicateIcon } from "@heroicons/react/24/outline";
import { featuresAPI, inventoryFeaturesAPI } from "../../services/api";

// ─── 1 HELPERS ──────────────────────────────────────────────────────────────────

function calcPriceRange(features) {
  const active = features.find((f) => f.affects_price);
  if (!active) return null;
  const prices = active.options.filter((o) => o.is_enabled && o.price != null && o.price !== "").map((o) => parseFloat(o.price));
  if (!prices.length) return null;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return { min, max };
}

function calcFeatureTotal(feature) {
  return feature.options.filter((o) => o.is_enabled).reduce((sum, o) => sum + (parseInt(o.quantity) || 0), 0);
}

function calcTotalStock(features, combinations = []) {
  if (combinations.length > 0) {
    return combinations.reduce((sum, row) => sum + (parseInt(row.quantity, 10) || 0), 0);
  }
  if (!features.length) return 0;
  const totals = features.map(calcFeatureTotal);
  return Math.min(...totals);
}

function buildOptionLookup(features) {
  const lookup = {};
  features.forEach((feature) => {
    feature.options.forEach((option) => {
      lookup[option.option_id] = {
        featureId: feature.feature_id,
        featureName: feature.feature_name,
        optionName: option.option_name,
      };
    });
  });
  return lookup;
}

function InlineTextInput({ value, onSave, placeholder = "" }) {
  const [draft, setDraft] = useState(value ?? "");

  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  const commit = () => {
    const nextValue = draft.trim();
    if (nextValue !== (value ?? "")) {
      onSave(nextValue);
    }
  };

  return (
    <input
      type="text"
      className="form-control form-control-sm"
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        }
        if (e.key === "Escape") {
          setDraft(value ?? "");
        }
      }}
      style={{ minWidth: 0 }}
    />
  );
}

// ─── 2 FEATURE TABLE — removed; options rendered inline in compact cards ──────

// ─── 3 FEATURE SECTION ───────────────────────────────────────────────────────

export default function FeatureSection({ inventoryId, onStockChange, onPriceRangeChange }) {
  const [globalFeatures, setGlobalFeatures] = useState([]);
  const [itemFeatures, setItemFeatures] = useState([]);
  const [combinationRows, setCombinationRows] = useState([]);
  const [featureSearchTerm, setFeatureSearchTerm] = useState("");
  const [committedFeatureName, setCommittedFeatureName] = useState("");
  const [isFeatureSearchOpen, setIsFeatureSearchOpen] = useState(false);
  const [newOptionInputs, setNewOptionInputs] = useState({}); // featureId → string
  const [combinationDraft, setCombinationDraft] = useState({ selections: {}, quantity: "" });
  const [dirty, setDirty] = useState({}); // featureId → bool
  const [combinationDirty, setCombinationDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [error, setError] = useState(null);
  const [isFeatureOptionsOpen, setIsFeatureOptionsOpen] = useState(true);
  const [isCombinationsOpen, setIsCombinationsOpen] = useState(true);

  // ── Load ──
  const reload = useCallback(async () => {
    try {
      const [gRes, pRes, cRes] = await Promise.all([featuresAPI.listAll(), inventoryFeaturesAPI.get(inventoryId), inventoryFeaturesAPI.getCombinations(inventoryId)]);
      setGlobalFeatures(gRes?.data ?? gRes);
      setItemFeatures(pRes?.data ?? pRes);
      setCombinationRows(cRes?.data ?? cRes ?? []);
    } catch (e) {
      console.error("FeatureSection load error:", e);
    }
  }, [inventoryId]);

  useEffect(() => {
    reload();
  }, [reload]);

  // ── Notify parent ──
  useEffect(() => {
    onStockChange?.(itemFeatures.length > 0 ? calcTotalStock(itemFeatures, combinationRows) : null);
    onPriceRangeChange?.(calcPriceRange(itemFeatures));
  }, [itemFeatures, combinationRows]); // eslint-disable-line

  const normalizeName = (value) => String(value || "").trim().toLowerCase();

  const syncFeatureState = useCallback((featureId, nextFeature) => {
    setGlobalFeatures((prev) => prev.map((feature) => (String(feature.id) === String(featureId) ? { ...feature, ...nextFeature } : feature)));
    setItemFeatures((prev) =>
      prev.map((feature) =>
        String(feature.feature_id) === String(featureId)
          ? {
              ...feature,
              feature_name: nextFeature.name ?? feature.feature_name,
              feature_description: nextFeature.description ?? feature.feature_description,
            }
          : feature
      )
    );
  }, []);

  // ── Local option edits ──
  const handleOptionChange = (featureId, optionId, field, value) => {
    setItemFeatures((prev) =>
      prev.map((f) =>
        f.feature_id !== featureId
          ? f
          : {
              ...f,
              options: f.options.map((o) => {
                if (o.option_id !== optionId) return o;
                if (field !== "quantity") return { ...o, [field]: value };
                const nextQty = Math.max(0, parseInt(value, 10) || 0);
                return {
                  ...o,
                  quantity: value,
                  is_enabled: nextQty > 0 ? true : o.is_enabled,
                };
              }),
            }
      )
    );
    setDirty((d) => ({ ...d, [featureId]: true }));
  };

  // ── Affects-price radio ──
  const handleAffectsPrice = async (featureId) => {
    setItemFeatures((prev) => prev.map((f) => ({ ...f, affects_price: f.feature_id === featureId })));
    try {
      await inventoryFeaturesAPI.setAffectsPrice(inventoryId, { feature_id: featureId || null });
    } catch {
      await reload();
    }
  };

  const handleClearAffectsPrice = async () => {
    setItemFeatures((prev) => prev.map((f) => ({ ...f, affects_price: false })));
    try {
      await inventoryFeaturesAPI.setAffectsPrice(inventoryId, { feature_id: null });
    } catch {
      await reload();
    }
  };

  // ── Save dirty features ──
  const persistFeatures = useCallback(
    async (featureIds) => {
      if (!featureIds?.length) return;
      setSaving(true);
      setError(null);
      try {
        const idSet = new Set(featureIds.map((id) => String(id)));
        const dirtyFeatures = itemFeatures.filter((f) => idSet.has(String(f.feature_id)));
        await Promise.all(
          dirtyFeatures.map((f) =>
            inventoryFeaturesAPI.saveOptionData(
              inventoryId,
              f.feature_id,
              f.options.map((o) => ({
                option_id: o.option_id,
                is_enabled: o.is_enabled,
                quantity: parseInt(o.quantity) || 0,
                price: o.price !== "" && o.price != null ? parseFloat(o.price) : null,
              }))
            )
          )
        );
        setDirty((prev) => {
          const next = { ...prev };
          featureIds.forEach((id) => {
            delete next[id];
            delete next[String(id)];
          });
          return next;
        });
        setLastSavedAt(Date.now());
      } catch (e) {
        setError(e?.response?.data?.detail?.message ?? e?.response?.data?.detail ?? "Save failed");
      } finally {
        setSaving(false);
      }
    },
    [inventoryId, itemFeatures]
  );

  const persistCombinations = useCallback(
    async (rows) => {
      const payload = rows.map((row) => ({
        option_ids: row.option_ids,
        quantity: Math.max(0, parseInt(row.quantity, 10) || 0),
      }));
      await inventoryFeaturesAPI.saveCombinations(inventoryId, payload);
    },
    [inventoryId]
  );

  const handleSave = async () => {
    await persistFeatures(Object.keys(dirty));
    if (combinationDirty) {
      try {
        await persistCombinations(combinationRows);
        setCombinationDirty(false);
      } catch (e) {
        setError(e?.response?.data?.detail ?? "Could not save combination stock");
      }
    }
  };

  useEffect(() => {
    if (saving || Object.keys(dirty).length === 0) return;
    const timer = setTimeout(() => {
      persistFeatures(Object.keys(dirty));
    }, 700);
    return () => clearTimeout(timer);
  }, [dirty, itemFeatures, saving, persistFeatures]);

  useEffect(() => {
    if (saving || !combinationDirty) return;
    const timer = setTimeout(async () => {
      try {
        await persistCombinations(combinationRows);
        setCombinationDirty(false);
        setLastSavedAt(Date.now());
      } catch (e) {
        setError(e?.response?.data?.detail ?? "Could not save combination stock");
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [combinationDirty, combinationRows, persistCombinations, saving]);

  const linkExistingFeature = useCallback(
    async (featureId, displayName) => {
      setError(null);
      try {
        await inventoryFeaturesAPI.addFeature(inventoryId, featureId);
        setFeatureSearchTerm(displayName || "");
        setCommittedFeatureName(displayName || "");
        setIsFeatureSearchOpen(false);
        await reload();
      } catch (e) {
        setError(e?.response?.data?.detail ?? "Could not add feature");
      }
    },
    [inventoryId, reload]
  );

  const createFeatureWithName = useCallback(
    async (name) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      setError(null);
      try {
        const res = await featuresAPI.create({ name: trimmed, description: "" });
        const created = res?.data ?? res;
        await inventoryFeaturesAPI.addFeature(inventoryId, created.id);
        setFeatureSearchTerm(created.name || trimmed);
        setCommittedFeatureName(created.name || trimmed);
        setIsFeatureSearchOpen(false);
        await reload();
      } catch (e) {
        setError(e?.response?.data?.detail ?? "Could not create feature");
      }
    },
    [inventoryId, reload]
  );

  const handleCopyFeature = useCallback(
    async (feature) => {
      const sourceName = String(feature.feature_name || "").trim();
      if (!sourceName) return;
      setError(null);
      try {
        const existingNames = new Set(globalFeatures.map((item) => normalizeName(item.name)));
        let nextName = `${sourceName}1`;
        while (existingNames.has(normalizeName(nextName))) {
          nextName += "1";
        }

        const createdRes = await featuresAPI.create({ name: nextName, description: feature.feature_description ?? "" });
        const created = createdRes?.data ?? createdRes;

        await Promise.all((feature.options || []).map((option) => featuresAPI.addOption(created.id, { name: option.option_name })));
        await inventoryFeaturesAPI.addFeature(inventoryId, created.id);
        await reload();
      } catch (e) {
        setError(e?.response?.data?.detail ?? "Could not copy feature");
      }
    },
    [globalFeatures, inventoryId, reload]
  );

  const handleFeatureDescriptionSave = useCallback(
    async (featureId, featureName, description) => {
      setError(null);
      try {
        const res = await featuresAPI.update(featureId, { name: featureName, description });
        const updated = res?.data ?? res;
        syncFeatureState(featureId, updated);
      } catch (e) {
        setError(e?.response?.data?.detail ?? "Could not save feature description");
        await reload();
      }
    },
    [reload, syncFeatureState]
  );

  // ── Remove feature from item ──
  const handleRemoveFeature = async (featureId) => {
    setError(null);
    try {
      await inventoryFeaturesAPI.removeFeature(inventoryId, featureId);
      await reload();
    } catch (e) {
      setError(e?.response?.data?.detail ?? "Cannot remove feature");
    }
  };

  // ── Add new option to a global feature ──
  const handleAddOption = async (featureId) => {
    const name = (newOptionInputs[featureId] ?? "").trim();
    if (!name) return;
    setError(null);
    try {
      const createdRes = await featuresAPI.addOption(featureId, { name });
      const created = createdRes?.data ?? createdRes;
      if (created?.id) {
        await inventoryFeaturesAPI.saveOptionData(inventoryId, featureId, [
          {
            option_id: created.id,
            is_enabled: true,
            quantity: 0, // Always 0; stock controlled via combinations table
            price: null,
          },
        ]);
      }
      setNewOptionInputs((prev) => ({ ...prev, [featureId]: "" }));
      await reload();
    } catch (e) {
      setError(e?.response?.data?.detail ?? "Could not add option");
    }
  };

  const optionLookup = buildOptionLookup(itemFeatures);
  const usesCombinationTable = itemFeatures.length > 1;

  const updateCombinationQuantity = (combinationKey, quantity) => {
    setCombinationRows((prev) => prev.map((row) => (row.combination_key === combinationKey ? { ...row, quantity: Math.max(0, parseInt(quantity, 10) || 0) } : row)));
    setCombinationDirty(true);
  };

  const removeCombinationRow = (combinationKey) => {
    setCombinationRows((prev) => prev.filter((row) => row.combination_key !== combinationKey));
    setCombinationDirty(true);
  };

  const handleDraftSelectionChange = (featureId, optionId) => {
    setCombinationDraft((prev) => ({
      ...prev,
      selections: {
        ...prev.selections,
        [featureId]: optionId,
      },
    }));
  };

  const handleAddCombination = () => {
    const requiredFeatures = itemFeatures.filter((feature) => feature.options.some((option) => option.is_enabled));
    const optionIds = requiredFeatures.map((feature) => combinationDraft.selections[feature.feature_id]).filter(Boolean);
    if (requiredFeatures.length === 0 || optionIds.length !== requiredFeatures.length) {
      setError("Select one enabled option from each feature before adding a combination.");
      return;
    }

    const quantity = Math.max(0, parseInt(combinationDraft.quantity, 10) || 0);
    const combinationKey = [...optionIds].map(String).sort().join("|");

    setCombinationRows((prev) => {
      const existing = prev.find((row) => row.combination_key === combinationKey);
      if (existing) {
        return prev.map((row) => (row.combination_key === combinationKey ? { ...row, quantity } : row));
      }
      return [
        ...prev,
        {
          combination_key: combinationKey,
          option_ids: optionIds,
          quantity,
        },
      ];
    });
    setCombinationDraft({ selections: {}, quantity: "" });
    setCombinationDirty(true);
    setError(null);
  };

  // ── Derived ──
  const affectingFeatureId = itemFeatures.find((f) => f.affects_price)?.feature_id ?? null;
  const trimmedSearch = featureSearchTerm.trim();
  const globalMatchingFeatures = globalFeatures.filter((gf) => normalizeName(gf.name).includes(normalizeName(featureSearchTerm)));
  const addableFeatures = globalMatchingFeatures.filter((gf) => !itemFeatures.find((pf) => pf.feature_id === gf.id));
  const matchingFeatures = trimmedSearch ? addableFeatures : [];
  const canCreateFeature = trimmedSearch.length > 0 && globalMatchingFeatures.length === 0 && normalizeName(trimmedSearch) !== normalizeName(committedFeatureName);
  const hasDirty = Object.keys(dirty).length > 0 || combinationDirty;

  const priceRange = calcPriceRange(itemFeatures);
  const priceDisplay = priceRange ? (priceRange.min === priceRange.max ? `$${priceRange.min.toFixed(2)}` : `From $${priceRange.min.toFixed(2)} to $${priceRange.max.toFixed(2)}`) : null;

  return (
    <div className="border-top mt-3 pt-3 px-1">
      <div className="mt-2 mb-3 border rounded p-1">
        <div className="d-flex align-items-center gap-2 mb-2">
          <h6 className="mb-0 fw-semibold">Feature</h6>
          <span className="text-muted small">({itemFeatures.length} total)</span>
        </div>

        <div className="d-flex gap-2 align-items-start mb-2 position-relative">
          <div className="position-relative flex-grow-1" style={{ minWidth: 0 }}>
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="Search Feature"
              value={featureSearchTerm}
              onFocus={() => setIsFeatureSearchOpen(true)}
              onChange={(e) => {
                setFeatureSearchTerm(e.target.value);
                setCommittedFeatureName("");
                setIsFeatureSearchOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (matchingFeatures.length === 1) {
                    const match = matchingFeatures[0];
                    setFeatureSearchTerm(match.name || "");
                    setCommittedFeatureName(match.name || "");
                    void linkExistingFeature(match.id, match.name || "");
                  } else if (canCreateFeature) {
                    void createFeatureWithName(trimmedSearch);
                  }
                }
              }}
            />
            {isFeatureSearchOpen && trimmedSearch && (
              <div className="position-absolute bg-white border rounded shadow-sm w-100" style={{ bottom: "calc(100% + 4px)", zIndex: 20, maxHeight: 220, overflowY: "auto" }}>
                {matchingFeatures.length === 0 ? (
                  <div className="px-2 py-2 text-muted small">{globalMatchingFeatures.length > 0 ? "Feature already linked" : "No matching features"}</div>
                ) : (
                  matchingFeatures.map((feature) => (
                    <button
                      key={feature.id}
                      type="button"
                      className="btn btn-link text-start text-decoration-none text-body w-100 px-2 py-1 border-bottom"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setFeatureSearchTerm(feature.name || "");
                        setCommittedFeatureName(feature.name || "");
                        void linkExistingFeature(feature.id, feature.name || "");
                      }}
                    >
                      <div className="fw-medium" style={{ fontSize: "0.82rem" }}>{feature.name}</div>
                      <div className="text-muted" style={{ fontSize: "0.75rem" }}>{feature.description?.trim() || "Blank description"}</div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <button type="button" className={`btn btn-sm ${canCreateFeature ? "btn-primary" : "btn-outline-secondary"}`} disabled={!canCreateFeature} onClick={() => void createFeatureWithName(trimmedSearch)}>
            Add
          </button>
        </div>

        <div className="table-responsive mb-1">
          <table className="table table-sm align-middle mb-0" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ width: "2rem", borderBottom: "1px solid var(--bs-border-color)", borderTop: "none", borderLeft: "none", borderRight: "none" }}></th>
                <th style={{ borderBottom: "1px solid var(--bs-border-color)", borderTop: "none", borderLeft: "none", borderRight: "none" }}>Name</th>
                <th style={{ borderBottom: "1px solid var(--bs-border-color)", borderTop: "none", borderLeft: "none", borderRight: "none" }}>Description</th>
              </tr>
            </thead>
            <tbody>
              {itemFeatures.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-muted small" style={{ border: "none" }}>
                    No descriptive features added yet.
                  </td>
                </tr>
              ) : (
                itemFeatures.map((feature) => (
                  <tr key={feature.feature_id} style={{ borderBottom: "1px solid var(--bs-border-color)" }}>
                    <td style={{ border: "none" }}>
                      <button type="button" className="btn btn-circle btn-outline-danger" onClick={() => handleRemoveFeature(feature.feature_id)} title="Remove feature">
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </td>
                    <td style={{ border: "none" }}>{feature.feature_name}</td>
                    <td style={{ border: "none" }}>
                      <div className="d-flex align-items-center gap-2">
                        <InlineTextInput value={feature.feature_description ?? ""} placeholder="Blank description" onSave={(nextDescription) => handleFeatureDescriptionSave(feature.feature_id, feature.feature_name, nextDescription)} />
                        <button type="button" className="btn btn-link btn-sm p-0 text-muted" title="Copy feature" onClick={() => void handleCopyFeature(feature)}>
                          <DocumentDuplicateIcon style={{ width: 16, height: 16 }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Descriptive options accordion ── */}
      {itemFeatures.length > 0 && (
        <div className="border rounded mb-3 overflow-hidden">
          <button type="button" className="btn-unstyled btn-tab w-100 d-flex align-items-start justify-content-between gap-2 px-3 py-2 border-0" style={{ background: "#f8f9fa" }} onClick={() => setIsFeatureOptionsOpen((prev) => !prev)}>
            <div className="text-start flex-grow-1">
              <div className="fw-semibold" style={{ fontSize: "0.86rem" }}>
                Descriptive Feature Options
              </div>
              <div className="d-flex flex-wrap gap-3 mt-1" onClick={(e) => e.stopPropagation()}>
                <div className="form-check form-check-inline mb-0">
                  <input className="form-check-input" type="radio" name={`ap_${inventoryId}`} id={`ap_none_${inventoryId}`} checked={affectingFeatureId === null} onChange={handleClearAffectsPrice} />
                  <label className="form-check-label small" htmlFor={`ap_none_${inventoryId}`}>
                    Fixed price
                  </label>
                </div>
                {itemFeatures.map((f) => (
                  <div key={f.feature_id} className="form-check form-check-inline mb-0">
                    <input className="form-check-input" type="radio" name={`ap_${inventoryId}`} id={`ap_${f.feature_id}`} checked={affectingFeatureId === f.feature_id} onChange={() => handleAffectsPrice(f.feature_id)} />
                    <label className="form-check-label small" htmlFor={`ap_${f.feature_id}`}>
                      Depends on {f.feature_name}
                    </label>
                  </div>
                ))}
              </div>
            </div>
            <ChevronDownIcon style={{ width: 16, height: 16, transform: isFeatureOptionsOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s ease" }} />
          </button>

          {isFeatureOptionsOpen && (
            <div className="p-2 bg-white">
              {/* ── Stock guidance ── */}
              <div className="alert alert-info py-1 mb-2" style={{ fontSize: "0.8rem" }}>
                Enable options in the checkbox lists below, then assign stock in the combination table below.
                {itemFeatures.length > 1 && " For multiple features, create one row per sellable combination."}
                {itemFeatures.length === 1 && " One row per enabled option."}
              </div>

              {/* ── Per-feature compact cards — horizontal scroll row ── */}
              <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", msOverflowStyle: "none", paddingBottom: 2 }}>
                {itemFeatures.map((f) => {
                  const featureTotal = calcFeatureTotal(f);
                  const isMismatched = itemFeatures.length > 1 && itemFeatures.map(calcFeatureTotal).some((t) => t !== featureTotal);
                  return (
                    <div key={f.feature_id} style={{ border: "1px solid #dee2e6", borderRadius: 6, flexShrink: 0, background: "#fff", overflow: "hidden" }}>
                      {/* Card header */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 6px 3px 8px", background: "#f8f9fa", borderBottom: "1px solid #dee2e6" }}>
                        <span style={{ fontSize: "0.82rem", fontWeight: 600, whiteSpace: "nowrap", color: isMismatched ? "#b45309" : undefined }}>{f.feature_name}</span>
                        {f.affects_price && (
                          <span className="badge bg-primary" style={{ fontSize: "0.6rem" }}>
                            Price
                          </span>
                        )}
                        {dirty[f.feature_id] && (
                          <span className="badge bg-warning text-dark" style={{ fontSize: "0.6rem" }}>
                            •
                          </span>
                        )}
                        <button type="button" className="btn btn-link p-0 text-danger d-flex align-items-center" style={{ marginLeft: "auto" }} title="Remove feature" onClick={() => handleRemoveFeature(f.feature_id)}>
                          <TrashIcon style={{ width: 11, height: 11 }} />
                        </button>
                      </div>

                      {/* Options list */}
                      <div style={{ padding: "4px 8px" }}>
                        {f.options.map((opt) => (
                          <div key={opt.option_id} style={{ display: "flex", alignItems: "center", gap: 5, padding: "2px 0", opacity: opt.is_enabled ? 1 : 0.45 }}>
                            <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", margin: 0, flex: f.affects_price ? "0 0 auto" : 1 }}>
                              <input type="checkbox" className="form-check-input" style={{ flexShrink: 0, marginTop: 0 }} checked={opt.is_enabled} onChange={(e) => handleOptionChange(f.feature_id, opt.option_id, "is_enabled", e.target.checked)} />
                              <span style={{ fontSize: "0.82rem", whiteSpace: "nowrap" }}>{opt.option_name}</span>
                            </label>

                            {f.affects_price && (
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                className="form-control form-control-sm"
                                style={{ width: 56, fontSize: "0.75rem", padding: "0 4px" }}
                                value={opt.price ?? ""}
                                placeholder="$"
                                disabled={!opt.is_enabled}
                                onChange={(e) => handleOptionChange(f.feature_id, opt.option_id, "price", e.target.value)}
                              />
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Divider */}
                      <div style={{ borderTop: "1px solid #dee2e6", margin: "0 8px" }} />

                      {/* Add option */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px 6px" }}>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          style={{ fontSize: "0.75rem", minWidth: 80 }}
                          placeholder="New option…"
                          value={newOptionInputs[f.feature_id] ?? ""}
                          onChange={(e) => setNewOptionInputs((prev) => ({ ...prev, [f.feature_id]: e.target.value }))}
                          onKeyDown={(e) => e.key === "Enter" && handleAddOption(f.feature_id)}
                        />
                        <button type="button" className="btn btn-outline-secondary btn-sm" style={{ fontSize: "0.75rem", padding: "1px 8px", flexShrink: 0 }} onClick={() => handleAddOption(f.feature_id)} disabled={!(newOptionInputs[f.feature_id] ?? "").trim()}>
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {itemFeatures.length > 0 && (
        <div className="mt-2 border rounded overflow-hidden">
          <button type="button" className="btn-unstyled btn-tab w-100 d-flex align-items-center justify-content-between gap-2 px-3 py-2 border-0" style={{ background: "#f8f9fa" }} onClick={() => setIsCombinationsOpen((prev) => !prev)}>
            <span className="fw-semibold" style={{ fontSize: "0.86rem" }}>
              {itemFeatures.length === 1 ? `${itemFeatures[0].feature_name} Stock` : "Feature Combinations"}
            </span>
            <ChevronDownIcon style={{ width: 16, height: 16, transform: isCombinationsOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s ease" }} />
          </button>

          {isCombinationsOpen && (
            <div className="p-2 bg-light-subtle">
              <div className="text-muted mb-2" style={{ fontSize: "0.74rem" }}>
                {itemFeatures.length === 1 ? "Set available stock for each enabled option." : "Add one row for each sellable feature combination and set the available count."}
              </div>

              <div style={{ overflowX: "auto", scrollbarWidth: "none", msOverflowStyle: "none" }}>
                <table className="table table-sm align-middle mb-2" style={{ width: "max-content" }}>
                  <thead>
                    <tr>
                      {itemFeatures.map((feature) => (
                        <React.Fragment key={feature.feature_id}>
                          <th>{feature.feature_name}</th>
                          {feature.affects_price && <th style={{ width: 70, textAlign: "center" }}>Price</th>}
                        </React.Fragment>
                      ))}
                      <th style={{ width: 110 }}>Count</th>
                      <th style={{ width: 80 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {combinationRows.length === 0 ? (
                      <tr>
                        <td colSpan={itemFeatures.reduce((acc, f) => acc + (f.affects_price ? 2 : 1), 0) + 2} className="text-muted" style={{ fontSize: "0.78rem" }}>
                          No combinations saved yet.
                        </td>
                      </tr>
                    ) : (
                      <>
                        {combinationRows.map((row) => (
                          <tr key={row.combination_key}>
                            {itemFeatures.map((feature) => {
                              const optionId = row.option_ids?.find((id) => optionLookup[id]?.featureId === feature.feature_id);
                              const option = feature.options.find((o) => o.option_id === optionId);
                              return (
                                <React.Fragment key={`${row.combination_key}-${feature.feature_id}`}>
                                  <td>{optionLookup[optionId]?.optionName ?? "—"}</td>
                                  {feature.affects_price && <td style={{ textAlign: "center", fontSize: "0.78rem" }}>{option?.price != null && option.price !== "" ? `$${parseFloat(option.price).toFixed(2)}` : "—"}</td>}
                                </React.Fragment>
                              );
                            })}
                            <td>
                              <input type="number" min={0} className="form-control form-control-sm" value={row.quantity} onChange={(e) => updateCombinationQuantity(row.combination_key, e.target.value)} />
                            </td>
                            <td className="text-end">
                              <button type="button" className="btn btn-link btn-sm text-danger p-0" onClick={() => removeCombinationRow(row.combination_key)}>
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                        {/* Total row */}
                        <tr style={{ background: "#f8f9fa", fontWeight: 600 }}>
                          <td colSpan={itemFeatures.reduce((acc, f) => acc + (f.affects_price ? 2 : 1), 0)} style={{ textAlign: "right", paddingRight: 12 }}>
                            Total:
                          </td>
                          <td style={{ textAlign: "center" }}>{calcTotalStock(itemFeatures, combinationRows)}</td>
                          <td />
                        </tr>
                      </>
                    )}
                    {/* Add new row */}
                    <tr>
                      {itemFeatures.map((feature) => {
                        const enabledOptions = feature.options.filter((option) => option.is_enabled);
                        return (
                          <React.Fragment key={`draft-${feature.feature_id}`}>
                            <td>
                              <select className="form-select form-select-sm" value={combinationDraft.selections[feature.feature_id] ?? ""} onChange={(e) => handleDraftSelectionChange(feature.feature_id, e.target.value)}>
                                <option value="">Select…</option>
                                {enabledOptions.map((option) => (
                                  <option key={option.option_id} value={option.option_id}>
                                    {option.option_name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            {feature.affects_price && (
                              <td style={{ textAlign: "center" }}>
                                {(() => {
                                  const selectedOptionId = combinationDraft.selections[feature.feature_id];
                                  const option = feature.options.find((o) => o.option_id === selectedOptionId);
                                  return option?.price != null && option.price !== "" ? `$${parseFloat(option.price).toFixed(2)}` : "—";
                                })()}
                              </td>
                            )}
                          </React.Fragment>
                        );
                      })}
                      <td>
                        <input type="number" min={0} className="form-control form-control-sm" placeholder="0" value={combinationDraft.quantity} onChange={(e) => setCombinationDraft((prev) => ({ ...prev, quantity: e.target.value }))} />
                      </td>
                      <td className="text-end">
                        <button type="button" className="btn btn-outline-primary btn-sm" onClick={handleAddCombination}>
                          Add Row
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {hasDirty && (
        <div className="mt-3">
          <button type="button" className="btn btn-outline-primary btn-sm" onClick={handleSave} disabled={saving}>
            Save now
          </button>
        </div>
      )}
    </div>
  );
}
