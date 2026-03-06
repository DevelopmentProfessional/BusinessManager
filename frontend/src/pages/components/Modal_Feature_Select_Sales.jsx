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

import React, { useState, useEffect } from 'react';
import { XMarkIcon, PlusIcon, MinusIcon, ShoppingCartIcon } from '@heroicons/react/24/outline';
import Modal from './Modal';
import { inventoryFeaturesAPI } from '../../services/api';

export default function Modal_Feature_Select_Sales({ isOpen, onClose, item, onConfirm }) {
  const [features, setFeatures]     = useState([]);  // features with enabled options only
  const [selections, setSelections] = useState({}); // featureId → { optionId, optionName, price, quantity }
  const [quantity, setQuantity]     = useState(1);
  const [loading, setLoading]       = useState(false);

  // Load feature option data when modal opens
  useEffect(() => {
    if (!isOpen || !item?.id) return;
    setLoading(true);
    setSelections({});
    setQuantity(1);

    inventoryFeaturesAPI.get(item.id)
      .then(res => {
        const data = res?.data ?? res;
        const enabledFeatures = (Array.isArray(data) ? data : [])
          .map(f => ({ ...f, options: f.options.filter(o => o.is_enabled) }))
          .filter(f => f.options.length > 0);
        setFeatures(enabledFeatures);
      })
      .catch(() => setFeatures([]))
      .finally(() => setLoading(false));
  }, [isOpen, item?.id]);

  // All features must have a selection before Add to Cart is enabled
  const allSelected = features.length === 0 || features.every(f => selections[f.feature_id]);

  // Use the affects_price feature's selected option price if set; else fall back to item.price
  const resolvedPrice = (() => {
    const pf = features.find(f => f.affects_price);
    if (pf && selections[pf.feature_id]?.price != null) {
      return parseFloat(selections[pf.feature_id].price);
    }
    return item?.price ?? 0;
  })();

  // Max qty = smallest stock among all selected options (cap at 99 if nothing selected)
  const maxQty = (() => {
    const picked = Object.values(selections);
    if (!picked.length) return 99;
    return Math.max(1, Math.min(...picked.map(s => s.qty ?? 99)));
  })();

  const select = (featureId, opt) => {
    setSelections(prev => ({
      ...prev,
      [featureId]: {
        optionId:   opt.option_id,
        optionName: opt.option_name,
        price:      opt.price,
        qty:        opt.quantity,
      },
    }));
    // Clamp quantity to new max
    setQuantity(q => Math.min(q, Math.max(1, opt.quantity ?? 99)));
  };

  const handleConfirm = () => {
    const selectedOptions = features.map(f => ({
      featureId:   f.feature_id,
      featureName: f.feature_name,
      optionId:    selections[f.feature_id].optionId,
      optionName:  selections[f.feature_id].optionName,
    }));
    onConfirm(item, selectedOptions, quantity, resolvedPrice);
  };

  if (!item) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} centered={true}>
      <div style={{ minWidth: 300 }}>

        {/* Header */}
        <div className="d-flex justify-content-between align-items-start mb-3">
          <div>
            <h6 className="fw-bold mb-0">{item.name}</h6>
            {!loading && features.length === 0 && (
              <div className="small text-muted">No variants available</div>
            )}
          </div>
          <button type="button" className="btn btn-link p-0 ms-2 text-muted" onClick={onClose}>
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="text-center py-3 text-muted small">Loading options…</div>
        ) : (
          <>
            {/* Feature option pickers */}
            {features.map(f => (
              <div key={f.feature_id} className="mb-3">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <span className="fw-semibold small">{f.feature_name}</span>
                  {f.affects_price && (
                    <span className="badge bg-primary-subtle text-primary-emphasis border border-primary-subtle"
                          style={{ fontSize: '0.65rem' }}>
                      Sets Price
                    </span>
                  )}
                </div>
                <div className="d-flex flex-wrap gap-2">
                  {f.options.map(opt => {
                    const isSelected = selections[f.feature_id]?.optionId === opt.option_id;
                    const outOfStock = opt.quantity <= 0;
                    return (
                      <button
                        key={opt.option_id}
                        type="button"
                        disabled={outOfStock}
                        onClick={() => select(f.feature_id, opt)}
                        className={`btn btn-sm ${
                          isSelected
                            ? 'btn-primary'
                            : outOfStock
                              ? 'btn-outline-secondary opacity-50'
                              : 'btn-outline-secondary'
                        }`}
                        style={{ fontSize: '0.82rem' }}
                      >
                        {opt.option_name}
                        {f.affects_price && opt.price != null && (
                          <span className={`ms-1 ${isSelected ? 'opacity-90' : 'opacity-60'}`}>
                            ${parseFloat(opt.price).toFixed(2)}
                          </span>
                        )}
                        <span className={`ms-1 ${isSelected ? 'opacity-75' : 'opacity-40'}`}
                              style={{ fontSize: '0.7rem' }}>
                          ({opt.quantity})
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Quantity selector */}
            <div className="d-flex align-items-center justify-content-between py-2 border-top border-bottom mb-3">
              <span className="fw-medium small">Quantity</span>
              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm rounded-circle p-0 d-flex align-items-center justify-content-center"
                  style={{ width: 32, height: 32 }}
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                >
                  <MinusIcon className="h-4 w-4" />
                </button>
                <span className="fw-semibold" style={{ minWidth: 28, textAlign: 'center' }}>
                  {quantity}
                </span>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm rounded-circle p-0 d-flex align-items-center justify-content-center"
                  style={{ width: 32, height: 32 }}
                  onClick={() => setQuantity(q => Math.min(maxQty, q + 1))}
                  disabled={quantity >= maxQty}
                >
                  <PlusIcon className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Total + Add to Cart */}
            <div className="d-flex align-items-center gap-3">
              <div className="flex-shrink-0">
                <div className="small text-muted">Total</div>
                <div className="fw-bold text-primary" style={{ fontSize: '1.25rem' }}>
                  ${(resolvedPrice * quantity).toFixed(2)}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-primary flex-grow-1 d-flex align-items-center justify-content-center gap-2"
                onClick={handleConfirm}
                disabled={!allSelected}
              >
                <ShoppingCartIcon className="h-5 w-5" />
                Add to Cart
              </button>
            </div>

            {features.length > 0 && !allSelected && (
              <div className="text-muted small text-center mt-2">
                Select an option for each feature to continue
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
