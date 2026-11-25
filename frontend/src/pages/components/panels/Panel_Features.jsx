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
 *   [2] FeatureAccordion — Per-item option toggles, pricing, and stock controls
 *   [3] FeatureSection — Main export: loads global + item features,
 *                        links Settings-managed features and notifies parent of stock/price
 *
 * CHANGE LOG:
 *   2026-11-19 | GitHub Copilot | Relocated stock change reason from inline section to a popup modal when stock changes
 *   2026-03-05 | Claude | Initial implementation
 *   2026-03-11 | Claude | Accordion headers, remove icon, borderless table,
 *                         right-aligned add-option row, options preview in header
 * ============================================================
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { CheckIcon, XMarkIcon, ChevronDownIcon } from "../../../icons";
import { featuresAPI, inventoryFeaturesAPI } from "../../../services/api";
import Dropdown_Custom from "../dropdowns/Dropdown_Custom";
import { InputCheckbox, InputNumber, InputText } from "../Inputs";
import Modal from "../modals/Modal";
import Button_Toolbar from "../buttons/Button_Toolbar";
import Footer_Actions from "../footers/Footer_Actions";

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

function haveCombinationsChanged(rowsA = [], rowsB = []) {
  if (rowsA.length !== rowsB.length) return true;
  const mapA = new Map(rowsA.map((r) => [r.combination_key, parseInt(r.quantity, 10) || 0]));
  for (const r of rowsB) {
    if (!mapA.has(r.combination_key)) return true;
    if (mapA.get(r.combination_key) !== (parseInt(r.quantity, 10) || 0)) return true;
  }
  return false;
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

// ─── 2 FEATURE TABLE — removed; options rendered inline in compact cards ──────

// ─── 3 FEATURE SECTION ───────────────────────────────────────────────────────

export default function FeatureSection({ inventoryId, onStockChange, onPriceRangeChange, onFeaturesChanged }) {
  const [globalFeatures, setGlobalFeatures] = useState([]);
  const [itemFeatures, setItemFeatures] = useState([]);
  const [combinationRows, setCombinationRows] = useState([]);
  const [savedCombinationRows, setSavedCombinationRows] = useState([]);
  const [isStockReasonModalOpen, setIsStockReasonModalOpen] = useState(false);
  const [stockReasonError, setStockReasonError] = useState("");
  const combinationRowsRef = useRef(combinationRows);
  const savedCombinationRowsRef = useRef(savedCombinationRows);

  useEffect(() => {
    combinationRowsRef.current = combinationRows;
  }, [combinationRows]);

  useEffect(() => {
    savedCombinationRowsRef.current = savedCombinationRows;
  }, [savedCombinationRows]);

  const [featureSearchTerm, setFeatureSearchTerm] = useState("");
  const [isFeatureSearchOpen, setIsFeatureSearchOpen] = useState(false);
  const [combinationDraft, setCombinationDraft] = useState({ selections: {}, quantity: "" });
  const [dirty, setDirty] = useState({}); // featureId → bool
  const [combinationDirty, setCombinationDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stockAdjustmentReason, setStockAdjustmentReason] = useState("");
  const [, setLastSavedAt] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [openFeatureIds, setOpenFeatureIds] = useState({});
  const [isCombinationsOpen, setIsCombinationsOpen] = useState(true);
  const featureSearchRef = useRef(null);

  // ── Load ──
  const reload = useCallback(async () => {
    const [gRes, pRes, cRes] = await Promise.allSettled([featuresAPI.listAll(), inventoryFeaturesAPI.get(inventoryId), inventoryFeaturesAPI.getCombinations(inventoryId)]);

    if (gRes.status === "fulfilled") {
      setGlobalFeatures(gRes.value?.data ?? gRes.value ?? []);
    }
    if (pRes.status === "fulfilled") {
      setItemFeatures(pRes.value?.data ?? pRes.value ?? []);
    }
    if (cRes.status === "fulfilled") {
      const rows = cRes.value?.data ?? cRes.value ?? [];
      setCombinationRows(rows);
      combinationRowsRef.current = rows;
      setSavedCombinationRows(rows);
      savedCombinationRowsRef.current = rows;
    }

    if (gRes.status === "rejected" || pRes.status === "rejected" || cRes.status === "rejected") {
      console.error("FeatureSection load error:", {
        features: gRes.status === "rejected" ? gRes.reason : null,
        itemFeatures: pRes.status === "rejected" ? pRes.reason : null,
        combinations: cRes.status === "rejected" ? cRes.reason : null,
      });
    }
  }, [inventoryId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    setOpenFeatureIds((prev) => {
      const next = {};
      itemFeatures.forEach((feature) => {
        next[feature.feature_id] = prev[feature.feature_id] ?? true;
      });
      return next;
    });
  }, [itemFeatures]);

  // Close the feature search list when clicking outside the search area
  useEffect(() => {
    if (!isFeatureSearchOpen) return;

    const handlePointerDownOutside = (event) => {
      if (featureSearchRef.current && !featureSearchRef.current.contains(event.target)) {
        setIsFeatureSearchOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDownOutside);
    return () => {
      document.removeEventListener("mousedown", handlePointerDownOutside);
    };
  }, [isFeatureSearchOpen]);

  // ── Notify parent ──
  useEffect(() => {
    onStockChange?.(itemFeatures.length > 0 ? calcTotalStock(itemFeatures, combinationRows) : null);
    onPriceRangeChange?.(calcPriceRange(itemFeatures));
  }, [itemFeatures, combinationRows]); // eslint-disable-line

  const normalizeName = (value) =>
    String(value || "")
      .trim()
      .toLowerCase();

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
    async (featureIds, reason = "") => {
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
              })),
              reason || undefined
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
    async (rows, reason = "") => {
      const payload = rows.map((row) => ({
        option_ids: row.option_ids,
        quantity: Math.max(0, parseInt(row.quantity, 10) || 0),
      }));
      await inventoryFeaturesAPI.saveCombinations(inventoryId, payload, reason || undefined);
      setSavedCombinationRows(rows);
      savedCombinationRowsRef.current = rows;
    },
    [inventoryId]
  );

  const handleStockInputBlur = (e) => {
    const nextTarget = e?.relatedTarget;
    if (nextTarget?.classList?.contains("feature-stock-input")) {
      return;
    }
    if (haveCombinationsChanged(savedCombinationRowsRef.current, combinationRowsRef.current)) {
      setStockReasonError("");
      setStockAdjustmentReason("");
      setIsStockReasonModalOpen(true);
    }
  };

  const handleConfirmStockReason = async () => {
    const reasonTrimmed = stockAdjustmentReason.trim();
    if (!reasonTrimmed) {
      setStockReasonError("A reason is required when changing feature stock.");
      return;
    }

    setSaving(true);
    setStockReasonError("");
    try {
      await persistCombinations(combinationRowsRef.current, reasonTrimmed);
      if (Object.keys(dirty).length > 0) {
        await persistFeatures(Object.keys(dirty), reasonTrimmed);
      }
      setCombinationDirty(false);
      setSavedCombinationRows(combinationRowsRef.current);
      savedCombinationRowsRef.current = combinationRowsRef.current;
      setIsStockReasonModalOpen(false);
      setStockAdjustmentReason("");
      setNotice("Stock changes saved successfully.");
      await onFeaturesChanged?.();
    } catch (e) {
      const detail = e?.response?.data?.detail;
      setStockReasonError(typeof detail === "string" ? detail : e?.message || "Could not save combination stock");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelStockReason = () => {
    if (saving) return;
    setCombinationRows(savedCombinationRowsRef.current);
    combinationRowsRef.current = savedCombinationRowsRef.current;
    setCombinationDirty(false);
    setIsStockReasonModalOpen(false);
    setStockAdjustmentReason("");
    setStockReasonError("");
  };

  const handleSave = async () => {
    if (combinationDirty && haveCombinationsChanged(savedCombinationRowsRef.current, combinationRowsRef.current)) {
      setStockReasonError("");
      setStockAdjustmentReason("");
      setIsStockReasonModalOpen(true);
      return;
    }
    await persistFeatures(Object.keys(dirty));
  };

  useEffect(() => {
    if (saving || Object.keys(dirty).length === 0) return;
    const timer = setTimeout(() => {
      persistFeatures(Object.keys(dirty));
    }, 700);
    return () => clearTimeout(timer);
  }, [dirty, itemFeatures, saving, persistFeatures]);

  const linkExistingFeature = useCallback(
    async (featureId, displayName) => {
      setError(null);
      try {
        await inventoryFeaturesAPI.addFeature(inventoryId, featureId);
        setFeatureSearchTerm(displayName || "");
        setIsFeatureSearchOpen(false);
        await reload();
      } catch (e) {
        setError(e?.response?.data?.detail ?? "Could not add feature");
      }
    },
    [inventoryId, reload]
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

  const optionLookup = buildOptionLookup(itemFeatures);
  const updateCombinationQuantity = (combinationKey, quantity) => {
    const nextQty = Math.max(0, parseInt(quantity, 10) || 0);
    const nextRows = combinationRowsRef.current.map((row) =>
      row.combination_key === combinationKey ? { ...row, quantity: nextQty } : row
    );
    setCombinationRows(nextRows);
    combinationRowsRef.current = nextRows;
    setCombinationDirty(true);
  };

  const removeCombinationRow = (combinationKey) => {
    const nextRows = combinationRowsRef.current.filter((row) => row.combination_key !== combinationKey);
    setCombinationRows(nextRows);
    combinationRowsRef.current = nextRows;
    setCombinationDirty(true);
    if (haveCombinationsChanged(savedCombinationRowsRef.current, nextRows)) {
      setStockReasonError("");
      setStockAdjustmentReason("");
      setIsStockReasonModalOpen(true);
    }
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

    const currentRows = combinationRowsRef.current;
    const existing = currentRows.find((row) => row.combination_key === combinationKey);
    const nextRows = existing
      ? currentRows.map((row) => (row.combination_key === combinationKey ? { ...row, quantity } : row))
      : [
          ...currentRows,
          {
            combination_key: combinationKey,
            option_ids: optionIds,
            quantity,
          },
        ];

    setCombinationRows(nextRows);
    combinationRowsRef.current = nextRows;
    setCombinationDraft({ selections: {}, quantity: "" });
    setCombinationDirty(true);
    setError(null);

    if (haveCombinationsChanged(savedCombinationRowsRef.current, nextRows)) {
      setStockReasonError("");
      setStockAdjustmentReason("");
      setIsStockReasonModalOpen(true);
    }
  };

  // ── Derived ──
  const affectingFeatureId = itemFeatures.find((f) => f.affects_price)?.feature_id ?? null;
  const trimmedSearch = featureSearchTerm.trim();
  const globalMatchingFeatures = globalFeatures.filter((gf) => normalizeName(gf.name).includes(normalizeName(featureSearchTerm)));
  const matchingFeatures = trimmedSearch ? globalMatchingFeatures : globalFeatures;
  const hasDirty = Object.keys(dirty).length > 0 || combinationDirty;

  const priceRange = calcPriceRange(itemFeatures);
  const priceDisplay = priceRange ? (priceRange.min === priceRange.max ? `$${priceRange.min.toFixed(2)}` : `From $${priceRange.min.toFixed(2)} to $${priceRange.max.toFixed(2)}`) : null;
  const priceModeFeature = itemFeatures.find((feature) => feature.affects_price) ?? null;
  const priceModeLabel = priceModeFeature ? `Depends on ${priceModeFeature.feature_name}` : "Fixed price";
  const isFeatureLinked = (featureId) => itemFeatures.some((feature) => String(feature.feature_id) === String(featureId));

  const getSingleFeatureOptionStock = useCallback(
    (featureId, optionId) => {
      if (itemFeatures.length !== 1) return "";
      if (String(itemFeatures[0].feature_id) !== String(featureId)) return "";

      const row = combinationRows.find((combination) => Array.isArray(combination.option_ids) && combination.option_ids.length === 1 && String(combination.option_ids[0]) === String(optionId));
      return row ? String(parseInt(row.quantity, 10) || 0) : "";
    },
    [itemFeatures, combinationRows]
  );

  const setSingleFeatureOptionStock = useCallback(
    (featureId, optionId, value) => {
      if (itemFeatures.length !== 1) return;
      if (String(itemFeatures[0].feature_id) !== String(featureId)) return;

      const nextQty = Math.max(0, parseInt(value, 10) || 0);
      setCombinationRows((prev) => {
        const existingIndex = prev.findIndex((combination) => Array.isArray(combination.option_ids) && combination.option_ids.length === 1 && String(combination.option_ids[0]) === String(optionId));

        if (existingIndex === -1) {
          if (nextQty === 0) return prev;
          const next = [
            ...prev,
            {
              combination_key: `single-${optionId}`,
              option_ids: [optionId],
              quantity: nextQty,
            },
          ];
          combinationRowsRef.current = next;
          return next;
        }

        if (nextQty === 0) {
          const next = prev.filter((_, idx) => idx !== existingIndex);
          combinationRowsRef.current = next;
          return next;
        }

        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: nextQty,
        };
        combinationRowsRef.current = next;
        return next;
      });
      setCombinationDirty(true);
      setError(null);
    },
    [itemFeatures]
  );

  return (
    <div className="border mb-2 mt-3 p-1 rounded">
      <div className="mb-2">
        <div className="align-items-center d-flex gap-2 mb-2">
          <h6 className="fw-semibold mb-0">Feature</h6>
          {priceDisplay && <span className="badge border ms-auto text-bg-light">{priceDisplay}</span>}
        </div>

        <div className="d-flex flex-column gap-2 mb-2 position-relative" ref={featureSearchRef}>
          <div className="position-relative">
              <InputText
                className="form-control ui-control-sm"
                placeholder="Search Feature"
                value={featureSearchTerm}
                onFocus={() => setIsFeatureSearchOpen(true)}
                onChange={(e) => {
                  setFeatureSearchTerm(e.target.value);
                  setIsFeatureSearchOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setIsFeatureSearchOpen(false);
                    return;
                  }
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (matchingFeatures.length === 1) {
                      const match = matchingFeatures[0];
                      if (!isFeatureLinked(match.id)) void linkExistingFeature(match.id, match.name || "");
                    }
                  }
                }}
              />
              {isFeatureSearchOpen && matchingFeatures.length > 0 && (
                <div className="bg-white border position-absolute rounded shadow-sm w-100" style={{ top: "calc(100% + 4px)", zIndex: 20, maxHeight: 220, overflowY: "auto" }}>
                  {matchingFeatures.map((feature) => {
                    const linked = isFeatureLinked(feature.id);
                    return (
                      <div
                        key={feature.id}
                        role="option"
                        aria-selected={linked}
                        tabIndex={linked ? -1 : 0}
                        className={`w-100 px-0 py-1 border-bottom ${linked ? "opacity-75" : ""}`}
                        style={{ cursor: linked ? "default" : "pointer", userSelect: "none" }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          if (linked) return;
                          void linkExistingFeature(feature.id, feature.name || "");
                        }}
                        onKeyDown={(e) => {
                          if (linked) return;
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            void linkExistingFeature(feature.id, feature.name || "");
                          }
                        }}
                      >
                        <div className="align-items-center d-flex gap-2 justify-content-between">
                          <div className="fw-medium text-truncate" style={{ fontSize: "0.82rem" }}>
                            {feature.name}
                          </div>
                          {linked && (
                            <span className="badge border text-bg-light" style={{ fontSize: "0.6rem" }}>
                              Linked
                            </span>
                          )}
                        </div>
                        <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                          {feature.description?.trim() || "Blank description"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {trimmedSearch && globalMatchingFeatures.length === 0 && <div className="mt-1 small text-muted">Create features in Inventory Settings &gt; Features.</div>}
          </div>

          <div className="w-100">
            <Dropdown_Custom
              className="form-select ui-control-sm"
              value={affectingFeatureId == null ? "fixed" : String(affectingFeatureId)}
              onChange={(e) => {
                const selectedValue = e.target.value;
                if (selectedValue === "fixed") {
                  void handleClearAffectsPrice();
                  return;
                }
                void handleAffectsPrice(selectedValue);
              }}
              options={[
                { value: "fixed", label: "Fixed price" },
                ...itemFeatures.map((feature) => ({ value: String(feature.feature_id), label: `Depends on ${feature.feature_name}` })),
              ]}
            />
            <div className="mt-1 ui-small-muted">{priceModeLabel}</div>
          </div>
        </div>

        {itemFeatures.length === 0 ? (
          <div className="py-0 small text-muted">No descriptive features added yet.</div>
        ) : (
          <div className="d-flex flex-column gap-2 mb-1">
            {itemFeatures.map((feature) => {
              const isOpen = openFeatureIds[feature.feature_id] ?? true;
              const featureTotal = calcFeatureTotal(feature);
              const isMismatched = itemFeatures.length > 1 && itemFeatures.map(calcFeatureTotal).some((t) => t !== featureTotal);

              return (
                <div key={feature.feature_id} className="bg-white border overflow-hidden rounded">
                  <div
                    role="button"
                    tabIndex={0}
                    className="align-items-center border-bottom d-flex gap-2 justify-content-between px-1 py-0"
                    style={{ background: "#f8f9fa", cursor: "pointer" }}
                    onClick={() => setOpenFeatureIds((prev) => ({ ...prev, [feature.feature_id]: !(prev[feature.feature_id] ?? true) }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setOpenFeatureIds((prev) => ({ ...prev, [feature.feature_id]: !(prev[feature.feature_id] ?? true) }));
                      }
                    }}
                  >
                    <div className="align-items-center d-flex flex-wrap gap-2 min-w-0">
                      <span className="fw-semibold text-truncate" style={{ fontSize: "0.86rem", color: isMismatched ? "#b45309" : "inherit", maxWidth: 220 }}>
                        {feature.feature_name}
                      </span>
                      {feature.affects_price && (
                        <span className="badge bg-primary" style={{ fontSize: "0.6rem" }}>
                          Price
                        </span>
                      )}
                      {dirty[feature.feature_id] && (
                        <span className="badge bg-warning text-dark" style={{ fontSize: "0.6rem" }}>
                          •
                        </span>
                      )}
                    </div>

                    <div className="align-items-center d-flex flex-shrink-0 gap-1">
                      <button
                        type="button"
                        className="align-items-center btn btn-link d-flex p-0 text-danger"
                        title="Remove feature"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleRemoveFeature(feature.feature_id);
                        }}
                      >
                        <XMarkIcon style={{ width: 15, height: 15 }} />
                      </button>
                      <ChevronDownIcon style={{ width: 16, height: 16, transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s ease" }} />
                    </div>
                  </div>

                  {isOpen && (
                    <div className="p-0">
                      <div className="mb-2">
                        <div className="mb-1 small text-muted">Description</div>
                        <div className="small">{feature.feature_description || <span className="text-muted">No description</span>}</div>
                      </div>

                      <div className="align-items-center d-flex gap-2 justify-content-between mb-1">
                        <div className="ui-small-muted">Options</div>
                        {itemFeatures.length === 1 && (
                          <div className="ui-small-muted" style={{ width: 72, textAlign: "right" }}>
                            Stock
                          </div>
                        )}
                      </div>
                      <div className="d-flex flex-column gap-1">
                        {feature.options.map((opt) => (
                          <div key={opt.option_id} className="ui-flex-center-gap-2" style={{ opacity: opt.is_enabled ? 1 : 0.45 }}>
                            <label className="align-items-center d-flex flex-grow-1 gap-2 mb-0" style={{ cursor: "pointer", minWidth: 0 }}>
                              <InputCheckbox style={{ flexShrink: 0, marginTop: 0 }} checked={opt.is_enabled} onChange={(e) => handleOptionChange(feature.feature_id, opt.option_id, "is_enabled", e.target.checked)} />
                              <span className="text-truncate" style={{ fontSize: "0.82rem" }}>
                                {opt.option_name}
                              </span>
                            </label>

                            {feature.affects_price && (
                              <InputNumber
                                type="number"
                                min={0}
                                step="0.01"
                                className="form-control ui-control-sm"
                                style={{ width: 72, fontSize: "0.75rem", padding: "0 4px" }}
                                value={opt.price ?? ""}
                                placeholder="$"
                                disabled={!opt.is_enabled}
                                onChange={(e) => handleOptionChange(feature.feature_id, opt.option_id, "price", e.target.value)}
                              />
                            )}

                            {itemFeatures.length === 1 && (
                              <InputNumber
                                type="number"
                                min={0}
                                step="1"
                                className="form-control ui-control-sm feature-stock-input"
                                style={{ width: 72, fontSize: "0.75rem", padding: "0 4px", textAlign: "right" }}
                                value={getSingleFeatureOptionStock(feature.feature_id, opt.option_id)}
                                placeholder="0"
                                disabled={!opt.is_enabled}
                                onChange={(e) => setSingleFeatureOptionStock(feature.feature_id, opt.option_id, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    e.target.blur();
                                  }
                                }}
                                onBlur={handleStockInputBlur}
                              />
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="mt-2 small text-muted">Manage feature definitions and options in Inventory Settings &gt; Features.</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {notice && (
          <div className="mt-2 small text-success" role="status">
            {notice}{" "}
            <button type="button" className="btn btn-link btn-sm p-0 text-success text-decoration-underline" onClick={() => setNotice(null)}>
              dismiss
            </button>
          </div>
        )}
        {error && (
          <div className="mt-2 small text-danger">
            {error}{" "}
            <button type="button" className="btn btn-link btn-sm p-0 text-danger text-decoration-underline" onClick={() => setError(null)}>
              dismiss
            </button>
          </div>
        )}
      </div>

      {itemFeatures.length > 1 && (
        <div className="border mt-2 overflow-hidden rounded">
          <button type="button" className="align-items-center border-0 btn-tab btn-unstyled d-flex gap-2 justify-content-between px-1 py-0 w-100" style={{ background: "#f8f9fa" }} onClick={() => setIsCombinationsOpen((prev) => !prev)}>
            <span className="fw-semibold" style={{ fontSize: "0.86rem" }}>
              {itemFeatures.length === 1 ? `${itemFeatures[0].feature_name} Stock` : "Feature Combinations"}
            </span>
            <ChevronDownIcon style={{ width: 16, height: 16, transform: isCombinationsOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s ease" }} />
          </button>

          {isCombinationsOpen && (
            <div className="bg-light-subtle p-0">
              <div className="mb-2 text-muted" style={{ fontSize: "0.74rem" }}>
                {itemFeatures.length === 1 ? "Set available stock for each enabled option." : "Add one row for each sellable feature combination and set the available count."}
              </div>

              <div style={{ overflowX: "auto", scrollbarWidth: "none", msOverflowStyle: "none" }}>
                <table className="align-middle mb-2 table table-sm" style={{ width: "max-content" }}>
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
                              <InputNumber
                                min={0}
                                className="form-control ui-control-sm feature-stock-input"
                                value={row.quantity}
                                onChange={(e) => updateCombinationQuantity(row.combination_key, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    e.target.blur();
                                  }
                                }}
                                onBlur={handleStockInputBlur}
                              />
                            </td>
                            <td className="text-end">
                              <button type="button" className="btn btn-link btn-sm p-0 text-danger" onClick={() => removeCombinationRow(row.combination_key)}>
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </>
                    )}
                    {/* Add new row */}
                    <tr>
                      {itemFeatures.map((feature) => {
                        const enabledOptions = feature.options.filter((option) => option.is_enabled);
                        return (
                          <React.Fragment key={`draft-${feature.feature_id}`}>
                            <td>
                              <Dropdown_Custom
                                className="form-select ui-control-sm"
                                value={combinationDraft.selections[feature.feature_id] ?? ""}
                                onChange={(e) => handleDraftSelectionChange(feature.feature_id, e.target.value)}
                                options={[
                                  { value: "", label: "Select…" },
                                  ...enabledOptions.map((option) => ({ value: option.option_id, label: option.option_name })),
                                ]}
                              />
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
                        <InputNumber min={0} className="form-control ui-control-sm" placeholder="0" value={combinationDraft.quantity} onChange={(e) => setCombinationDraft((prev) => ({ ...prev, quantity: e.target.value }))} />
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

      <Modal
        isOpen={isStockReasonModalOpen}
        onClose={handleCancelStockReason}
        title="Reason for Stock Change"
        centered
        footer={
          <Footer_Actions
            start={
              <Button_Toolbar
                icon={CheckIcon}
                label={saving ? "Applying…" : "Apply adjustment"}
                onClick={handleConfirmStockReason}
                className="btn-primary"
                disabled={saving || !stockAdjustmentReason.trim()}
              />
            }
            center={
              <Button_Toolbar
                icon={XMarkIcon}
                label="Cancel"
                onClick={handleCancelStockReason}
                className="btn-outline-secondary"
                disabled={saving}
              />
            }
          />
        }
      >
        <div className="mb-2">
          <div className="form-text mb-2">
            Stock count is being adjusted
            {(() => {
              const prevTotal = calcTotalStock(itemFeatures, savedCombinationRowsRef.current);
              const nextTotal = calcTotalStock(itemFeatures, combinationRowsRef.current);
              const delta = nextTotal - prevTotal;
              return (
                <span>
                  : from <strong>{prevTotal}</strong> to <strong>{nextTotal}</strong> ({delta >= 0 ? `+${delta}` : delta} units).
                </span>
              );
            })()}
          </div>
          <label className="form-label" htmlFor={`stock-adjustment-reason-${inventoryId}`}>
            Reason *
          </label>
          <InputTextarea
            id={`stock-adjustment-reason-${inventoryId}`}
            rows={3}
            autoFocus
            value={stockAdjustmentReason}
            placeholder="Required: enter a reason for this stock change..."
            onChange={(e) => {
              setStockAdjustmentReason(e.target.value);
              setStockReasonError("");
            }}
            maxLength={1000}
          />
        </div>
        {stockReasonError && <div className="alert alert-danger mb-0 py-2">{stockReasonError}</div>}
      </Modal>
    </div>
  );
}
