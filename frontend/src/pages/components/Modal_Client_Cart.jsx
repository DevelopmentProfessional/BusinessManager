/*
 * Modal_Client_Cart.jsx
 * =====================
 * Full-screen modal showing a client's persistent shopping cart stored in the
 * database. Multiple employees can add/modify items from the Sales page and
 * the cart is always in sync. Quantity +/- and remove ops write through to the
 * DB immediately (fire-and-forget with optimistic UI).
 */
import React, { useState, useEffect } from 'react';
import { XMarkIcon, PlusIcon, MinusIcon, ShoppingCartIcon } from '@heroicons/react/24/outline';
import Modal from './Modal';
import { useNavigate } from 'react-router-dom';
import { clientCartAPI } from '../../services/api';

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
  const [cartItems, setCartItems] = useState([]);
  const [loading,   setLoading]   = useState(false);

  // Load from DB whenever the modal opens
  useEffect(() => {
    if (!isOpen || !client?.id) return;
    let cancelled = false;
    setLoading(true);
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
        // quantity became 0 → remove
        clientCartAPI.removeItem(client.id, cartKey).catch(() => {});
      }
      return next;
    });
  };

  const removeItem = (cartKey) => {
    setCartItems((prev) => prev.filter((item) => item.cartKey !== cartKey));
    clientCartAPI.removeItem(client.id, cartKey).catch(() => {});
  };

  const total = cartItems.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);

  const handleGoToSales = () => {
    navigate('/sales', { state: { preSelectedClient: client, preloadCart: cartItems } });
    onClose();
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
        <div className="flex-grow-1 overflow-auto no-scrollbar px-3 pt-2">
          {loading ? (
            <div className="d-flex justify-content-center py-5">
              <div className="spinner-border spinner-border-sm text-primary" role="status" />
            </div>
          ) : cartItems.length === 0 ? (
            <div className="text-center text-muted py-5">
              <ShoppingCartIcon style={{ width: 40, height: 40, margin: '0 auto 12px', opacity: 0.4 }} />
              <div className="fw-medium mb-1">Cart is empty</div>
              <div className="small text-muted">Tap "Sales" below to add items</div>
            </div>
          ) : (
            <>
              {cartItems.map((item) => (
                <div key={item.cartKey} className="d-flex align-items-center gap-2 py-2 border-bottom border-gray-100 dark:border-gray-700">
                  <div className="flex-grow-1 min-w-0">
                    <div className="fw-medium text-truncate">{item.name}</div>
                    <div className="small text-muted d-flex align-items-center gap-1">
                      ${(item.price || 0).toFixed(2)}
                      <span className={`badge ms-1 ${item.itemType === 'service' ? 'bg-primary-subtle text-primary' : 'bg-secondary-subtle text-secondary'} text-capitalize`}>
                        {item.itemType}
                      </span>
                    </div>
                  </div>
                  <div className="d-flex align-items-center gap-1 flex-shrink-0">
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
              ))}

              {/* Total */}
              <div className="d-flex justify-content-between fw-semibold py-3">
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
              <button
                type="button"
                onClick={handleGoToSales}
                className="btn btn-primary btn-sm p-1 d-flex align-items-center justify-content-center"
                style={{ width: '3rem', height: '3rem' }}
                title="Go to Sales"
              >
                <ShoppingCartIcon style={{ width: 18, height: 18 }} />
              </button>
            </div>
          </div>
        </div>

      </div>
    </Modal>
  );
}
