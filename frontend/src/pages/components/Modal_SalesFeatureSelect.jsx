/*
 * ============================================================
 * FILE: Modal_Feature_Select_Sales.jsx
 *
 * PURPOSE:
 *   Sales-mode feature selection modal. Opens when a product with
 *   descriptive features is added to cart. Lets the user pick one
 *   option per feature (e.g. Size: Small, Color: Red), choose a
 *   quantity, and confirm the add-to-cart action.
 *
 * PROPS:
 *   isOpen        — bool
 *   onClose       — () => void
 *   item          — inventory product object (with feature_names merged)
 *   onConfirm     — (item, selectedOptions, quantity, resolvedPrice) => void
 *
 * CHANGE LOG:
 *   2026-03-06 | Claude | Initial implementation
 * ============================================================
 */

import React, { useState, useEffect } from "react";
import { XMarkIcon, PlusIcon, MinusIcon, ShoppingCartIcon } from "@heroicons/react/24/outline";
import Modal from "./Modal";
import { inventoryFeaturesAPI } from "../../services/api";

export default function Modal_Feature_Select_Sales({ isOpen, onClose, item, onConfirm }) {
  const [features, setFeatures] = useState([]); // features with enabled options only
  const [combinations, setCombinations] = useState([]);
  const [selections, setSelections] = useState({}); // featureId → { optionId, optionName, price, quantity }
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);

  // Load feature option data when modal opens
  useEffect(() => {
    if (!isOpen || !item?.id) return;
    setLoading(true);
    setSelections({});
    setQuantity(1);

    Promise.all([inventoryFeaturesAPI.get(item.id), inventoryFeaturesAPI.getCombinations(item.id)])
      .then(([featureRes, comboRes]) => {
        const data = featureRes?.data ?? featureRes;
        const comboData = comboRes?.data ?? comboRes;
        const enabledFeatures = (Array.isArray(data) ? data : []).map((f) => ({ ...f, options: f.options.filter((o) => o.is_enabled) })).filter((f) => f.options.length > 0);
        setFeatures(enabledFeatures);
        setCombinations(Array.isArray(comboData) ? comboData : []);
      })
      .catch(() => {
        setFeatures([]);
        setCombinations([]);
      })
      .finally(() => setLoading(false));
  }, [isOpen, item?.id]);

  // All features must have a selection before Add to Cart is enabled
  const allSelected = features.length === 0 || features.every((f) => selections[f.feature_id]);

  // Use the affects_price feature's selected option price if set; else fall back to item.price
  const resolvedPrice = (() => {
    const pf = features.find((f) => f.affects_price);
    if (pf && selections[pf.feature_id]?.price != null) {
      return parseFloat(selections[pf.feature_id].price);
    }
    return item?.price ?? 0;
  })();

  const getMatchingCombinationQty = (pendingSelections = selections) => {
    if (!combinations.length) return null;
    const selectedIds = Object.values(pendingSelections).map((sel) => String(sel.optionId));
    if (!selectedIds.length) {
      return combinations.reduce((sum, row) => sum + (row.quantity ?? 0), 0);
    }
    return combinations
      .filter((row) => {
        const rowIds = Array.isArray(row.option_ids) ? row.option_ids.map(String) : [];
        return selectedIds.every((optionId) => rowIds.includes(optionId));
      })
      .reduce((sum, row) => sum + (row.quantity ?? 0), 0);
  };

  const getOptionAvailability = (featureId, option) => {
    if (!combinations.length) return option.quantity ?? 0;
    const pendingSelections = {
      ...selections,
      [featureId]: {
        optionId: option.option_id,
        optionName: option.option_name,
        price: option.price,
        qty: option.quantity,
      },
    };
    return getMatchingCombinationQty(pendingSelections) ?? 0;
  };

  // Max qty = smallest stock among all selected options (cap at 99 if nothing selected)
  const maxQty = (() => {
    if (combinations.length) {
      const matchedQty = getMatchingCombinationQty();
      if (matchedQty == null || matchedQty <= 0) return allSelected ? 0 : 99;
      return matchedQty;
    }
    const picked = Object.values(selections);
    if (!picked.length) return 99;
    return Math.max(1, Math.min(...picked.map((s) => s.qty ?? 99)));
  })();

  const select = (featureId, opt) => {
    setSelections((prev) => ({
      ...prev,
      [featureId]: {
        optionId: opt.option_id,
        optionName: opt.option_name,
        price: opt.price,
        qty: opt.quantity,
      },
    }));
    // Clamp quantity to new max
    const nextAvailability = getOptionAvailability(featureId, opt);
    setQuantity((q) => Math.min(q, Math.max(1, nextAvailability || opt.quantity || 1)));
  };

  const handleConfirm = () => {
    const selectedOptions = features.map((f) => ({
      featureId: f.feature_id,
      featureName: f.feature_name,
      optionId: selections[f.feature_id].optionId,
      optionName: selections[f.feature_id].optionName,
    }));
    onConfirm(item, selectedOptions, quantity, resolvedPrice);
  };

  if (!item) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} noPadding centered>
      <div className="ui-component-shell">
        <div className="component-header">
          <div className="component-header-left">{item.name}</div>
          <div className="component-header-center"></div>
          <div className="component-header-right"></div>
        </div>

        <div className="component-body">
          <div className="component-body-inner">
            {!loading && features.length === 0 && <div className="mb-2 ui-small-muted">No variants available</div>}

            {loading ? (
              <div className="py-1 small text-center text-muted">Loading options…</div>
            ) : (
              <>
            {/* Feature option pickers */}
            {features.map((f) => (
              <div key={f.feature_id} className="mb-3">
                <div className="align-items-center d-flex gap-2 mb-2">
                  <span className="fw-semibold ui-text-sm">{f.feature_name}</span>
                  {f.affects_price && (
                    <span className="badge bg-primary-subtle border border-primary-subtle text-primary-emphasis" style={{ fontSize: "0.65rem" }}>
                      Sets Price
                    </span>
                  )}
                </div>
                <div className="d-flex flex-wrap gap-2">
                  {f.options.map((opt) => {
                    const isSelected = selections[f.feature_id]?.optionId === opt.option_id;
                    const availability = getOptionAvailability(f.feature_id, opt);
                    const outOfStock = availability <= 0;
                    return (
                      <button key={opt.option_id} type="button" disabled={outOfStock} onClick={() => select(f.feature_id, opt)} className={`btn btn-sm ${isSelected ? "btn-primary" : outOfStock ? "btn-outline-secondary opacity-50" : "btn-outline-secondary"}`} style={{ fontSize: "0.82rem" }}>
                        {opt.option_name}
                        {f.affects_price && opt.price != null && <span className={`ms-1 ${isSelected ? "opacity-90" : "opacity-60"}`}>${parseFloat(opt.price).toFixed(2)}</span>}
                        <span className={`ms-1 ${isSelected ? "opacity-75" : "opacity-40"}`} style={{ fontSize: "0.7rem" }}>
                          ({availability})
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Quantity selector */}
            <div className="align-items-center border-bottom border-top d-flex justify-content-between mb-3 py-0">
              <span className="fw-medium small">Quantity</span>
              <div className="ui-flex-center-gap-2">
                <button type="button" className="align-items-center btn btn-outline-secondary btn-sm d-flex justify-content-center p-0 rounded-circle"  onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1}>
                  <MinusIcon className="ui-icon-4" />
                </button>
                <span className="fw-semibold" style={{ minWidth: 28, textAlign: "center" }}>
                  {quantity}
                </span>
                <button type="button" className="align-items-center btn btn-outline-secondary btn-sm d-flex justify-content-center p-0 rounded-circle"  onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))} disabled={maxQty <= 0 || quantity >= maxQty}>
                  <PlusIcon className="ui-icon-4" />
                </button>
              </div>
            </div>

            {allSelected && (
              <div className="mb-3 small text-muted">
                Remaining inventory for this combination: <strong>{Math.max(0, maxQty - quantity)}</strong>
              </div>
            )}

            {features.length > 0 && !allSelected && <div className="mt-2 small text-center text-muted">Select an option for each feature to continue</div>}
          </>
        )}
          </div>{/* /component-body-inner */}
        </div>{/* /component-body */}

        <div className="component-footer">
          <div className="component-footer-left">
            <div className="me-2">
              <div className="ui-small-muted">Total</div>
              <div className="fw-bold text-primary" style={{ fontSize: "1.25rem" }}>
                ${(resolvedPrice * quantity).toFixed(2)}
              </div>
            </div>
            <button type="button" className="align-items-center btn btn-primary d-flex gap-2 justify-content-center" onClick={handleConfirm} disabled={!allSelected || maxQty <= 0}>
              <ShoppingCartIcon className="ui-icon-5" />
              Add
            </button>
          </div>
          <div className="component-footer-center">
            <button type="button" onClick={onClose} className="btn ui-btn-circle-outline-secondary" title="Close">
              <XMarkIcon />
            </button>
          </div>
          <div className="component-footer-right"></div>
        </div>
      </div>
    </Modal>
  );
}
