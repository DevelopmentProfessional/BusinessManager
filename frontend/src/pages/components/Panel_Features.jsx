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
 *   [2] FeatureAccordion — Per-feature accordion with description,
 *                        option toggles, copy, and remove actions
 *   [3] FeatureSection — Main export: loads global + item features,
 *                        handles all CRUD, notifies parent of stock/price
 *
 * CHANGE LOG:
 *   2026-03-05 | Claude | Initial implementation
 *   2026-03-11 | Claude | Accordion headers, remove icon, borderless table,
 *                         right-aligned add-option row, options preview in header
 * ============================================================
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { XMarkIcon, ChevronDownIcon, DocumentDuplicateIcon } from "@heroicons/react/24/outline";
import { featuresAPI, inventoryFeaturesAPI } from "../../services/api";
import Dropdown_Custom from "./Dropdown_Custom";

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
      className="form-control ui-control-sm"
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
  const [openFeatureIds, setOpenFeatureIds] = useState({});
  const [isCombinationsOpen, setIsCombinationsOpen] = useState(true);
  const featureSearchRef = useRef(null);
  const [editingFeatureId, setEditingFeatureId] = useState(null);
  const [featureNameDrafts, setFeatureNameDrafts] = useState({});

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
      setCombinationRows(cRes.value?.data ?? cRes.value ?? []);
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
        let createdId = created?.id;
        let createdName = created?.name || trimmed;

        // Fallback: if backend response shape is unexpected, resolve by name.
        if (!createdId) {
          const listRes = await featuresAPI.listAll();
          const all = listRes?.data ?? listRes ?? [];
          const normalizedTarget = normalizeName(createdName);
          const match = all.find((feature) => normalizeName(feature?.name) === normalizedTarget);
          createdId = match?.id;
          createdName = match?.name || createdName;
        }

        if (!createdId) {
          throw new Error("Feature was created but could not be resolved for linking.");
        }

        await inventoryFeaturesAPI.addFeature(inventoryId, createdId);
        setFeatureSearchTerm(createdName);
        setCommittedFeatureName(createdName);
        setIsFeatureSearchOpen(false);
        await reload();
      } catch (e) {
        const detail = e?.response?.data?.detail;
        const message = typeof detail === "string" ? detail : e?.message;
        setError(message || "Could not create feature");
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

  const handleFeatureNameSave = useCallback(
    async (featureId, nextName, fallbackDescription = "") => {
      const trimmed = String(nextName || "").trim();
      if (!trimmed) {
        setEditingFeatureId(null);
        return;
      }

      setError(null);
      try {
        const res = await featuresAPI.update(featureId, { name: trimmed, description: fallbackDescription });
        const updated = res?.data ?? res;
        syncFeatureState(featureId, updated);
        setFeatureNameDrafts((prev) => ({ ...prev, [featureId]: updated?.name ?? trimmed }));
      } catch (e) {
        setError(e?.response?.data?.detail ?? "Could not rename feature");
        await reload();
      } finally {
        setEditingFeatureId(null);
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
  const matchingFeatures = trimmedSearch ? globalMatchingFeatures : globalFeatures;
  const canCreateFeature = trimmedSearch.length > 0 && globalMatchingFeatures.length === 0 && normalizeName(trimmedSearch) !== normalizeName(committedFeatureName);
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
          return [
            ...prev,
            {
              combination_key: `single-${optionId}`,
              option_ids: [optionId],
              quantity: nextQty,
            },
          ];
        }

        if (nextQty === 0) {
          return prev.filter((_, idx) => idx !== existingIndex);
        }

        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: nextQty,
        };
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
          <div className="align-items-start d-flex gap-2 position-relative">
            <button type="button" className={`btn btn-sm ${canCreateFeature ? "btn-primary" : "btn-outline-secondary"}`} disabled={!canCreateFeature} onClick={() => void createFeatureWithName(trimmedSearch)}>
              Add
            </button>
            <div className="flex-grow-1 position-relative" style={{ minWidth: 0 }}>
              <input
                type="text"
                className="form-control ui-control-sm"
                placeholder="Search Feature"
                value={featureSearchTerm}
                onFocus={() => setIsFeatureSearchOpen(true)}
                onChange={(e) => {
                  setFeatureSearchTerm(e.target.value);
                  setCommittedFeatureName("");
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
                      setFeatureSearchTerm(match.name || "");
                      setCommittedFeatureName(match.name || "");
                      void linkExistingFeature(match.id, match.name || "");
                    } else if (canCreateFeature) {
                      void createFeatureWithName(trimmedSearch);
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
                          setFeatureSearchTerm(feature.name || "");
                          setCommittedFeatureName(feature.name || "");
                          void linkExistingFeature(feature.id, feature.name || "");
                        }}
                        onKeyDown={(e) => {
                          if (linked) return;
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setFeatureSearchTerm(feature.name || "");
                            setCommittedFeatureName(feature.name || "");
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
            </div>
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
              const isEditingName = editingFeatureId === feature.feature_id;
              const featureNameDraft = featureNameDrafts[feature.feature_id] ?? feature.feature_name;

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
                      {isEditingName ? (
                        <input
                          type="text"
                          className="form-control ui-control-sm"
                          value={featureNameDraft}
                          autoFocus
                          onChange={(e) => setFeatureNameDrafts((prev) => ({ ...prev, [feature.feature_id]: e.target.value }))}
                          onClick={(e) => e.stopPropagation()}
                          onBlur={() => void handleFeatureNameSave(feature.feature_id, featureNameDraft, feature.feature_description ?? "")}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void handleFeatureNameSave(feature.feature_id, featureNameDraft, feature.feature_description ?? "");
                            }
                            if (e.key === "Escape") {
                              e.preventDefault();
                              setFeatureNameDrafts((prev) => ({ ...prev, [feature.feature_id]: feature.feature_name }));
                              setEditingFeatureId(null);
                            }
                          }}
                          style={{ minWidth: 100, maxWidth: 220, fontSize: "0.82rem", paddingTop: 2, paddingBottom: 2 }}
                        />
                      ) : (
                        <button
                          type="button"
                          className="btn btn-link fw-semibold p-0 text-decoration-none text-start text-truncate"
                          style={{ fontSize: "0.86rem", color: isMismatched ? "#b45309" : "inherit", maxWidth: 220 }}
                          title="Click to rename feature"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFeatureNameDrafts((prev) => ({ ...prev, [feature.feature_id]: feature.feature_name }));
                            setEditingFeatureId(feature.feature_id);
                          }}
                        >
                          {feature.feature_name}
                        </button>
                      )}
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
                        className="align-items-center btn btn-link d-flex p-0 text-muted"
                        title="Copy feature"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleCopyFeature(feature);
                        }}
                      >
                        <DocumentDuplicateIcon style={{ width: 16, height: 16 }} />
                      </button>
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
                        <InlineTextInput value={feature.feature_description ?? ""} placeholder="Blank description" onSave={(nextDescription) => handleFeatureDescriptionSave(feature.feature_id, feature.feature_name, nextDescription)} />
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
                              <input type="checkbox" className="form-check-input" style={{ flexShrink: 0, marginTop: 0 }} checked={opt.is_enabled} onChange={(e) => handleOptionChange(feature.feature_id, opt.option_id, "is_enabled", e.target.checked)} />
                              <span className="text-truncate" style={{ fontSize: "0.82rem" }}>
                                {opt.option_name}
                              </span>
                            </label>

                            {feature.affects_price && (
                              <input
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
                              <input
                                type="number"
                                min={0}
                                step="1"
                                className="form-control ui-control-sm"
                                style={{ width: 72, fontSize: "0.75rem", padding: "0 4px", textAlign: "right" }}
                                value={getSingleFeatureOptionStock(feature.feature_id, opt.option_id)}
                                placeholder="0"
                                disabled={!opt.is_enabled}
                                onChange={(e) => setSingleFeatureOptionStock(feature.feature_id, opt.option_id, e.target.value)}
                              />
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="border-top my-2" />

                      <div className="ui-flex-center-gap-2">
                        <input
                          type="text"
                          className="form-control ui-control-sm"
                          style={{ fontSize: "0.75rem", minWidth: 80 }}
                          placeholder="New option…"
                          value={newOptionInputs[feature.feature_id] ?? ""}
                          onChange={(e) => setNewOptionInputs((prev) => ({ ...prev, [feature.feature_id]: e.target.value }))}
                          onKeyDown={(e) => e.key === "Enter" && handleAddOption(feature.feature_id)}
                        />
                        <button type="button" className="btn ui-btn-outline-secondary-sm" style={{ fontSize: "0.75rem", padding: "1px 8px", flexShrink: 0 }} onClick={() => handleAddOption(feature.feature_id)} disabled={!(newOptionInputs[feature.feature_id] ?? "").trim()}>
                          +
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
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
                              <input type="number" min={0} className="form-control ui-control-sm" value={row.quantity} onChange={(e) => updateCombinationQuantity(row.combination_key, e.target.value)} />
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
                        <input type="number" min={0} className="form-control ui-control-sm" placeholder="0" value={combinationDraft.quantity} onChange={(e) => setCombinationDraft((prev) => ({ ...prev, quantity: e.target.value }))} />
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
