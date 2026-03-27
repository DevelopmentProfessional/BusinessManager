/*
 * Modal_Client_Cart.jsx
 * =====================
 * Full-screen modal showing a client's persistent shopping cart stored in the
 * database. Multiple employees can add/modify items from the Sales page and
 * the cart is always in sync. Quantity +/- and remove ops write through to the
 * DB immediately (fire-and-forget with optimistic UI).
 *
 * Per-item expand panel:
 *   - Products/Inventory: select descriptive features (options) fetched from the DB
 *   - Services: pick/change the desired appointment date & time
 */
import React, { useState, useEffect } from 'react';
import {
  XMarkIcon, PlusIcon, MinusIcon, ShoppingCartIcon, CheckCircleIcon,
  ChevronDownIcon, ChevronUpIcon,
} from '@heroicons/react/24/outline';
import Modal from './Modal';
import { useNavigate } from 'react-router-dom';
import { clientCartAPI, clientOrdersAPI, inventoryFeaturesAPI } from '../../services/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Map a DB ClientCartItemRead → frontend cart item shape */
const mapDbItem = (d) => ({
  cartKey:         d.cart_key,
  id:              d.item_id,
  itemType:        d.item_type,
  name:            d.item_name,
  price:           d.unit_price,
  quantity:        d.quantity,
  selectedOptions: d.options_json ? (() => { try { return JSON.parse(d.options_json); } catch { return []; } })() : [],
});

/** Map frontend cart item → DB upsert body */
const mapToDb = (item) => ({
  cart_key:     item.cartKey,
  item_id:      item.id || null,
  item_type:    item.itemType,
  item_name:    item.name,
  unit_price:   item.price,
  quantity:     item.quantity,
  line_total:   item.price * item.quantity,
  options_json: item.selectedOptions?.length > 0 ? JSON.stringify(item.selectedOptions) : null,
});

/**
 * Exported helper — async DB-backed cart count.
 * Used by Modal_Detail_Client to show badge count.
 * Returns 0 on error.
 */
export async function getClientCartCount(clientId) {
  if (!clientId) return 0;
  try {
    const res  = await clientCartAPI.getItems(clientId);
    const items = Array.isArray(res?.data) ? res.data : [];
    return items.reduce((s, i) => s + (i.quantity || 1), 0);
  } catch { return 0; }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Modal_Client_Cart({ isOpen, onClose, client }) {
  const navigate   = useNavigate();
  const [cartItems,    setCartItems]    = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [creating,     setCreating]     = useState(false);
  const [orderCreated, setOrderCreated] = useState(null);

  // per-item feature expand state
  const [expandedCartKey, setExpandedCartKey] = useState(null);
  const [featureData,     setFeatureData]     = useState({});   // cartKey → features[]
  const [featureLoading,  setFeatureLoading]  = useState({});   // cartKey → bool

  // Load from DB whenever the modal opens
  useEffect(() => {
    if (!isOpen || !client?.id) return;
    let cancelled = false;
    setLoading(true);
    setOrderCreated(null);
    setExpandedCartKey(null);
    setFeatureData({});
    clientCartAPI.getItems(client.id)
      .then((res) => {
        if (!cancelled) {
          const items = Array.isArray(res?.data) ? res.data : [];
          setCartItems(items.map(mapDbItem));
        }
      })
      .catch(() => { if (!cancelled) setCartItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen, client?.id]);

  // ── Mutation handlers (optimistic UI + DB fire-and-forget) ────────────────

  const updateQty = (cartKey, delta) => {
    setCartItems((prev) => {
      const next = prev
        .map((item) => item.cartKey === cartKey ? { ...item, quantity: item.quantity + delta } : item)
        .filter((item) => item.quantity > 0);

      const updated = next.find((i) => i.cartKey === cartKey);
      if (updated) {
        clientCartAPI.upsertItem(client.id, mapToDb(updated)).catch(() => {});
      } else {
        clientCartAPI.removeItem(client.id, cartKey).catch(() => {});
      }
      return next;
    });
  };

  const removeItem = (cartKey) => {
    setCartItems((prev) => prev.filter((item) => item.cartKey !== cartKey));
    clientCartAPI.removeItem(client.id, cartKey).catch(() => {});
    if (expandedCartKey === cartKey) setExpandedCartKey(null);
  };

  // ── Feature / option selection ────────────────────────────────────────────

  const handleExpandItem = async (cartKey, item) => {
    if (expandedCartKey === cartKey) {
      setExpandedCartKey(null);
      return;
    }
    setExpandedCartKey(cartKey);

    // Only fetch features for inventory/product items (not services)
    if (item.itemType !== 'service' && item.id && !featureData[cartKey]) {
      setFeatureLoading((prev) => ({ ...prev, [cartKey]: true }));
      try {
        const res = await inventoryFeaturesAPI.get(item.id);
        setFeatureData((prev) => ({ ...prev, [cartKey]: Array.isArray(res?.data) ? res.data : [] }));
      } catch {
        setFeatureData((prev) => ({ ...prev, [cartKey]: [] }));
      } finally {
        setFeatureLoading((prev) => ({ ...prev, [cartKey]: false }));
      }
    }
  };

  /** Toggle a feature option on a cart item (radio-style per feature) */
  const handleSelectFeatureOption = (cartKey, featureId, featureName, optionId, optionName) => {
    setCartItems((prev) => prev.map((item) => {
      if (item.cartKey !== cartKey) return item;
      const existing = Array.isArray(item.selectedOptions) ? item.selectedOptions : [];
      // Remove any previous selection for this feature, then add the new one
      const filtered = existing.filter((o) => o.feature_id !== featureId);
      const alreadySelected = existing.some((o) => o.feature_id === featureId && o.option_id === optionId);
      const updated = alreadySelected
        ? filtered  // deselect if same option tapped again
        : [...filtered, { feature_id: featureId, feature_name: featureName, option_id: optionId, option_name: optionName }];
      const updatedItem = { ...item, selectedOptions: updated };
      clientCartAPI.upsertItem(client.id, mapToDb(updatedItem)).catch(() => {});
      return updatedItem;
    }));
  };

  /** Set or clear the desired appointment date for a service cart item */
  const handleSetScheduledDate = (cartKey, isoValue) => {
    setCartItems((prev) => prev.map((item) => {
      if (item.cartKey !== cartKey) return item;
      const existing = Array.isArray(item.selectedOptions) ? item.selectedOptions : [];
      const filtered = existing.filter((o) => o.type !== 'scheduled_date');
      const updated = isoValue ? [...filtered, { type: 'scheduled_date', value: isoValue }] : filtered;
      const updatedItem = { ...item, selectedOptions: updated };
      clientCartAPI.upsertItem(client.id, mapToDb(updatedItem)).catch(() => {});
      return updatedItem;
    }));
  };

  // ── Actions ───────────────────────────────────────────────────────────────

  const total = cartItems.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);

  const handleGoToSales = () => {
    navigate('/sales', { state: { preSelectedClient: client, preloadCart: cartItems } });
    onClose();
  };

  const handleCreateOrder = async () => {
    if (cartItems.length === 0) return;
    setCreating(true);
    try {
      const res = await clientOrdersAPI.createFromCart(client.id, { payment_method: 'pending' });
      const order = res?.data ?? res;
      setOrderCreated(order);
      setCartItems([]);
    } catch {
      // order creation failed — stay on cart view
    } finally {
      setCreating(false);
    }
  };

  if (!client) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} noPadding={true} fullScreen={true}>
      <div className="d-flex flex-column bg-white dark:bg-gray-900" style={{ height: '100%' }}>

        {/* Header */}
        <div className="flex-shrink-0 p-2 border-bottom border-gray-200 dark:border-gray-700 d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-2">
            <ShoppingCartIcon style={{ width: 18, height: 18 }} />
            <h6 className="mb-0 fw-semibold text-gray-900 dark:text-gray-100">
              {client.name}'s Cart
            </h6>
          </div>
        </div>

        {/* Content */}
        <div className="flex-grow-1 overflow-auto no-scrollbar">
          {loading ? (
            <div className="d-flex justify-content-center py-5">
              <div className="spinner-border spinner-border-sm text-primary" role="status" />
            </div>
          ) : orderCreated ? (
            <div className="text-center py-5 px-3">
              <CheckCircleIcon style={{ width: 48, height: 48, color: '#22c55e', margin: '0 auto 12px' }} />
              <div className="fw-semibold mb-1">Order Created</div>
              <div className="small text-muted mb-1">
                Order #{String(orderCreated.id || '').split('-')[0].toUpperCase()} is now in the queue.
              </div>
              <div className="small text-muted">Status: <strong>{orderCreated.status || 'payment_pending'}</strong></div>
            </div>
          ) : cartItems.length === 0 ? (
            <div className="text-center text-muted py-5">
              <ShoppingCartIcon style={{ width: 40, height: 40, margin: '0 auto 12px', opacity: 0.4 }} />
              <div className="fw-medium mb-1">Cart is empty</div>
              <div className="small text-muted">Tap "Sales" below to add items</div>
            </div>
          ) : (
            <>
              {cartItems.map((item) => {
                const isExpanded  = expandedCartKey === item.cartKey;
                const isService   = item.itemType === 'service';
                const features    = featureData[item.cartKey] || [];
                const loadingFeat = featureLoading[item.cartKey] || false;

                // Read already-selected values from options
                const selectedFeatureMap = Object.fromEntries(
                  (item.selectedOptions || [])
                    .filter((o) => o.feature_id)
                    .map((o) => [o.feature_id, o.option_id])
                );
                const scheduledDate = (item.selectedOptions || []).find((o) => o.type === 'scheduled_date')?.value || '';

                return (
                  <div key={item.cartKey} className="border-bottom border-gray-100 dark:border-gray-700">
                    {/* ── Main row ── */}
                    <div className="d-flex align-items-center gap-2 py-2 px-3">
                      <div className="flex-grow-1 min-w-0">
                        <div className="fw-medium text-truncate">{item.name}</div>
                        <div className="small text-muted d-flex align-items-center gap-1 flex-wrap">
                          ${(item.price || 0).toFixed(2)}
                          <span className={`badge ms-1 ${isService ? 'bg-primary-subtle text-primary' : 'bg-secondary-subtle text-secondary'} text-capitalize`}>
                            {item.itemType}
                          </span>
                          {/* Show selected option pills */}
                          {(item.selectedOptions || []).filter((o) => o.feature_name && o.option_name).map((o) => (
                            <span key={o.feature_id} className="badge bg-info-subtle text-info" style={{ fontSize: '0.65rem' }}>
                              {o.feature_name}: {o.option_name}
                            </span>
                          ))}
                          {scheduledDate && (
                            <span className="badge bg-success-subtle text-success" style={{ fontSize: '0.65rem' }}>
                              {new Date(scheduledDate).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="d-flex align-items-center gap-1 flex-shrink-0">
                        {/* Qty controls */}
                        <button
                          type="button"
                          onClick={() => updateQty(item.cartKey, -1)}
                          className="btn btn-outline-secondary btn-sm rounded-circle d-flex align-items-center justify-content-center"
                          style={{ width: 28, height: 28, padding: 0 }}
                        >
                          <MinusIcon style={{ width: 14, height: 14 }} />
                        </button>
                        <span className="fw-semibold" style={{ minWidth: 24, textAlign: 'center' }}>
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQty(item.cartKey, 1)}
                          className="btn btn-outline-secondary btn-sm rounded-circle d-flex align-items-center justify-content-center"
                          style={{ width: 28, height: 28, padding: 0 }}
                        >
                          <PlusIcon style={{ width: 14, height: 14 }} />
                        </button>

                        {/* Expand details button */}
                        <button
                          type="button"
                          onClick={() => handleExpandItem(item.cartKey, item)}
                          className={`btn btn-sm rounded-circle d-flex align-items-center justify-content-center ms-1 ${isExpanded ? 'btn-primary' : 'btn-outline-secondary'}`}
                          style={{ width: 28, height: 28, padding: 0 }}
                          title={isService ? 'Set appointment date' : 'Select options'}
                        >
                          {isExpanded
                            ? <ChevronUpIcon style={{ width: 14, height: 14 }} />
                            : <ChevronDownIcon style={{ width: 14, height: 14 }} />}
                        </button>

                        {/* Remove */}
                        <button
                          type="button"
                          onClick={() => removeItem(item.cartKey)}
                          className="btn btn-link btn-sm text-danger p-0 ms-1 d-flex align-items-center"
                          style={{ lineHeight: 1 }}
                          title="Remove"
                        >
                          <XMarkIcon style={{ width: 16, height: 16 }} />
                        </button>
                      </div>
                    </div>

                    {/* ── Expanded panel ── */}
                    {isExpanded && (
                      <div className="px-3 pb-3 bg-gray-50 dark:bg-gray-800">
                        {isService ? (
                          /* ── Service: appointment date picker ── */
                          <div>
                            <div className="small fw-semibold text-muted mb-1">Appointment Date &amp; Time</div>
                            <input
                              type="datetime-local"
                              className="form-control form-control-sm"
                              value={scheduledDate ? scheduledDate.slice(0, 16) : ''}
                              onChange={(e) => handleSetScheduledDate(item.cartKey, e.target.value || null)}
                            />
                            {scheduledDate && (
                              <button
                                type="button"
                                className="btn btn-link btn-sm text-danger p-0 mt-1"
                                style={{ fontSize: '0.75rem' }}
                                onClick={() => handleSetScheduledDate(item.cartKey, null)}
                              >
                                Clear date
                              </button>
                            )}
                          </div>
                        ) : (
                          /* ── Product: feature option picker ── */
                          loadingFeat ? (
                            <div className="d-flex justify-content-center py-2">
                              <div className="spinner-border spinner-border-sm text-secondary" role="status" />
                            </div>
                          ) : features.length === 0 ? (
                            <div className="small text-muted py-1">No configurable options for this item.</div>
                          ) : (
                            <div className="d-flex flex-column gap-2 pt-1">
                              {features.map((feature) => {
                                const enabledOptions = feature.options.filter((o) => o.is_enabled);
                                if (enabledOptions.length === 0) return null;
                                return (
                                  <div key={feature.feature_id}>
                                    <div className="small fw-semibold text-muted mb-1">{feature.feature_name}</div>
                                    <div className="d-flex flex-wrap gap-1">
                                      {enabledOptions.map((opt) => {
                                        const isSelected = selectedFeatureMap[feature.feature_id] === opt.option_id;
                                        return (
                                          <button
                                            key={opt.option_id}
                                            type="button"
                                            onClick={() => handleSelectFeatureOption(
                                              item.cartKey,
                                              feature.feature_id,
                                              feature.feature_name,
                                              opt.option_id,
                                              opt.option_name,
                                            )}
                                            className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-outline-secondary'}`}
                                            style={{ fontSize: '0.75rem', padding: '2px 10px' }}
                                          >
                                            {opt.option_name}
                                            {opt.price != null && feature.affects_price && (
                                              <span className="ms-1 opacity-75">+${opt.price.toFixed(2)}</span>
                                            )}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Total */}
              <div className="d-flex justify-content-between fw-semibold py-3 px-3">
                <span>{cartItems.reduce((s, i) => s + i.quantity, 0)} item(s)</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 pt-2 pb-4 px-3 border-top border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="d-flex align-items-center">
            <div className="flex-grow-1 d-flex gap-3 justify-content-center">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-outline-secondary btn-sm p-1 d-flex align-items-center justify-content-center"
                style={{ width: '3rem', height: '3rem' }}
                title="Close"
              >
                <XMarkIcon style={{ width: 18, height: 18 }} />
              </button>
              {!orderCreated && (
                <>
                  <button
                    type="button"
                    onClick={handleGoToSales}
                    className="btn btn-primary btn-sm p-1 d-flex align-items-center justify-content-center"
                    style={{ width: '3rem', height: '3rem' }}
                    title="Go to Sales"
                  >
                    <ShoppingCartIcon style={{ width: 18, height: 18 }} />
                  </button>
                  {cartItems.length > 0 && (
                    <button
                      type="button"
                      onClick={handleCreateOrder}
                      disabled={creating}
                      className="btn btn-success btn-sm d-flex align-items-center gap-1 px-3"
                      style={{ height: '3rem', fontSize: 12 }}
                      title="Create portal order from cart"
                    >
                      <CheckCircleIcon style={{ width: 16, height: 16 }} />
                      {creating ? 'Creating…' : 'Create Order'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

      </div>
    </Modal>
  );
}
