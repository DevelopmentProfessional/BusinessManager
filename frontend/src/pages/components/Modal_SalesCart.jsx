/*
 * ============================================================
 * FILE: Modal_Cart_Sales.jsx
 *
 * PURPOSE:
 *   Displays the sales cart as a bottom-sheet modal, showing all items
 *   currently added to the cart with quantity controls and a client selector.
 *   Provides a checkout action that hands off to the checkout modal.
 *
 * FUNCTIONAL PARTS:
 *   [1] CartItem (sub-component) — Individual cart line with image, quantity controls, and remove button
 *   [2] Cart Header — Item count display at the top of the modal
 *   [3] Empty State — Placeholder shown when the cart contains no items
 *   [4] Client Selection — Searchable customer picker with inline add-new option
 *   [5] Cart Items List — Scrollable list of CartItem rows
 *   [6] Cart Summary & Actions — Subtotal/tax/total breakdown, checkout and clear-all buttons
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-03-01 | Claude  | Added section comments and top-level documentation
 * ============================================================
 */
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Modal from "./Modal";
import Button_Toolbar from "./Button_Toolbar";
import { getDisplayImageUrl } from "./Utils_Image";
import { ShoppingCartIcon, XMarkIcon, UserIcon, CreditCardIcon, PlusIcon, MinusIcon, SparklesIcon, CubeIcon, TrashIcon } from "@heroicons/react/24/outline";

const CLIENT_DROPUP_Z_INDEX = 1200;

function getClientDropupStyle(anchorEl) {
  if (!anchorEl) return null;
  const rect = anchorEl.getBoundingClientRect();
  const width = Math.min(Math.max(rect.width, 260), window.innerWidth - 24);
  const left = Math.min(Math.max(rect.left, 12), window.innerWidth - width - 12);
  const bottom = Math.max(12, window.innerHeight - rect.top + 8);
  const maxHeight = Math.min(280, rect.top - 16);
  return { position: "fixed", left, bottom, width, maxHeight, zIndex: CLIENT_DROPUP_Z_INDEX };
}

/** Client matches rendered in a portal above the cart modal (avoids overflow clipping). */
function ClientSearchDropupPortal({ anchorRef, open, clients, onSelect, onAddNew }) {
  const [panelStyle, setPanelStyle] = useState(null);

  useEffect(() => {
    if (!open || !anchorRef.current) {
      setPanelStyle(null);
      return undefined;
    }
    const updatePosition = () => {
      if (anchorRef.current) setPanelStyle(getClientDropupStyle(anchorRef.current));
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, anchorRef, clients.length]);

  if (!open || !panelStyle) return null;

  return createPortal(
    <div
      role="listbox"
      data-client-search-dropup
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-y-auto"
      style={panelStyle}
    >
      {clients.length === 0 ? (
        <button type="button" onClick={onAddNew} className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-primary-600 dark:text-primary-400 flex items-center gap-1 border-0 bg-transparent">
          <PlusIcon className="h-4 w-4" />
          New customer
        </button>
      ) : (
        clients.map((c) => (
          <button
            key={c.id}
            type="button"
            role="option"
            onClick={() => onSelect(c)}
            className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-900 dark:text-white border-0 bg-transparent"
            style={{ width: "100%", margin: 0 }}
          >
            <p className="font-medium mb-0">{c.name}</p>
            {(c.email || c.phone) && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0">
                {[c.email, c.phone].filter(Boolean).join(" · ")}
              </p>
            )}
          </button>
        ))
      )}
    </div>,
    document.body
  );
}

// ─── 1 CARTITEM SUB-COMPONENT ──────────────────────────────────────────────
const CartItem = ({ item, onUpdateQuantity, onRemove }) => {
  const isService = item.itemType === "service";
  const isBundle = item.itemType === "bundle";
  const isMix = item.itemType === "mix";
  const imageUrl = getDisplayImageUrl(item);

  // Build a compact mix selection summary: "3× White, 7× Black"
  const mixSummary = isMix && item.mixSelections?.length > 0 ? item.mixSelections.map((s) => `${s.quantity}× ${s.product_name}`).join(", ") : null;

  return (
    <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-800 rounded-lg">
      {/* Delete button — leftmost */}
      <div className="px-1 flex-shrink-0">
        <button
          onClick={() => onRemove(item.cartKey)}
          className="w-7 h-7 rounded-full bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-800/50 flex items-center justify-center transition-colors"
          title="Remove item"
        >
          <TrashIcon className="h-4 w-4 text-red-500 dark:text-red-400" />
        </button>
      </div>

      {/* Mini Image/Icon */}
      <div className={`w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden ${isService ? "bg-primary-100 dark:bg-primary-900" : isBundle ? "bg-orange-100 dark:bg-orange-900" : isMix ? "bg-pink-100 dark:bg-pink-900" : "bg-secondary-100 dark:bg-secondary-900"}`}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={item.name}
            className="w-full h-full object-cover object-center"
            onError={(e) => {
              e.target.style.display = "none";
              const fallback = e.target.nextElementSibling;
              if (fallback) fallback.style.display = "flex";
            }}
          />
        ) : null}
        <div className={`w-full h-full flex items-center justify-center ${imageUrl ? "hidden" : "flex"}`}>{isService ? <SparklesIcon className="h-6 w-6 text-primary-500" /> : <CubeIcon className={`h-6 w-6 ${isBundle ? "text-orange-500" : isMix ? "text-pink-500" : "text-secondary-500"}`} />}</div>
      </div>

      {/* Item Info */}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm text-gray-900 dark:text-white truncate">{item.name}</h4>
        {mixSummary && (
          <p className="text-xs text-pink-600 dark:text-pink-400 truncate" title={mixSummary}>
            {mixSummary}
          </p>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400">
          ${item.price?.toFixed(2)} × {item.quantity}
        </p>
      </div>

      {/* Quantity Controls */}
      <div className="flex items-center gap-1">
        <button onClick={() => onUpdateQuantity(item.cartKey, item.quantity - 1)} className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center justify-center transition-colors">
          <MinusIcon className="h-4 w-4 text-gray-600 dark:text-gray-300" />
        </button>
        <span className="w-8 text-center text-sm font-medium text-gray-900 dark:text-white">{item.quantity}</span>
        <button onClick={() => onUpdateQuantity(item.cartKey, item.quantity + 1)} className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center justify-center transition-colors">
          <PlusIcon className="h-4 w-4 text-gray-600 dark:text-gray-300" />
        </button>
      </div>

      {/* Total */}
      <div className="px-1 flex-shrink-0 text-right">
        <p className="p-1 font-semibold text-sm text-gray-900 dark:text-white">${(item.price * item.quantity).toFixed(2)}</p>
      </div>
    </div>
  );
};

// ─── 2 MAIN MODAL COMPONENT ────────────────────────────────────────────────
export default function Modal_Cart_Sales({
  isOpen,
  onClose,
  cart,
  selectedClient,
  setSelectedClient,
  clientSearch,
  setClientSearch,
  showClientDropdown,
  setShowClientDropdown,
  filteredClients,
  cartItemCount,
  cartTotal,
  taxRate = 0,
  discountAmount = 0,
  loadClients,
  openAddClientModal,
  handleSelectClient,
  setClientsLocal,
  updateCartQuantity,
  removeFromCart,
  setCart,
  handleCheckout,
}) {
  const [tipAmount, setTipAmount] = useState("");
  const clientSearchAnchorRef = useRef(null);
  const tip = parseFloat(tipAmount) || 0;
  const discountedSubtotal = Math.max(cartTotal - discountAmount, 0);
  const taxAmount = discountedSubtotal * (taxRate / 100);
  const grandTotal = discountedSubtotal + taxAmount + tip;

  useEffect(() => {
    if (isOpen) loadClients();
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isOpen) setShowClientDropdown(false);
  }, [isOpen, setShowClientDropdown]);

  useEffect(() => {
    if (!showClientDropdown) return undefined;
    const onDocClick = (e) => {
      if (clientSearchAnchorRef.current?.contains(e.target)) return;
      if (e.target.closest?.("[data-client-search-dropup]")) return;
      setShowClientDropdown(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [showClientDropdown, setShowClientDropdown]);

  const handleAddNewClient = () =>
    openAddClientModal((newClient) => {
      handleSelectClient(newClient);
      setClientsLocal((prev) => [...prev, newClient]);
      setClientSearch("");
      setShowClientDropdown(false);
    });

  return (
    <Modal isOpen={isOpen} onClose={onClose} noPadding={true} contentGravity="bottom">
      <div className="component">
        <div className="component-header">
          <div className="component-header-left">
            <ShoppingCartIcon className="app-icon me-1" />
            Cart ({cartItemCount})
          </div>
          <div className="component-header-center"></div>
          <div className="component-header-right">
            {cart.length > 0 && (
              <button
                onClick={() => setCart([])}
                className="btn btn-sm btn-outline-danger btn-circle"
                title="Clear cart"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="component-body">
          <div className="component-body-inner">
        {cart.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-1 text-center">
            <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-2">
              <ShoppingCartIcon className="h-10 w-10 text-gray-400" />
            </div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-1">Cart is empty</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">Add items to get started</p>
          </div>
        ) : (
          <>
            {/* ─── 4 CLIENT SELECTION ─────────────────────────────────────── */}
            {/* Client Selection */}
            <div className="flex-shrink-0 p-1 border-b border-gray-200 dark:border-gray-700">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <UserIcon className="h-4 w-4 inline mr-1" />
                Customer (optional)
              </label>
              {selectedClient ? (
                <div className="flex items-center justify-between p-1 bg-primary-50 dark:bg-primary-900/30 rounded-xl">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white text-sm">{selectedClient.name}</p>
                    {selectedClient.email && <p className="text-xs text-gray-500 dark:text-gray-400">{selectedClient.email}</p>}
                  </div>
                  <button onClick={() => setSelectedClient(null)} className="p-1 hover:bg-primary-100 dark:hover:bg-primary-800 rounded-lg transition-colors">
                    <XMarkIcon className="h-4 w-4 text-gray-500" />
                  </button>
                </div>
              ) : (
                <div ref={clientSearchAnchorRef}>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      placeholder="Search customers..."
                      value={clientSearch}
                      onChange={(e) => {
                        setClientSearch(e.target.value);
                        setShowClientDropdown(true);
                      }}
                      onFocus={() => {
                        loadClients();
                        setShowClientDropdown(true);
                      }}
                      className="app-search-input flex-1 px-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      autoComplete="off"
                      aria-expanded={showClientDropdown}
                      aria-haspopup="listbox"
                    />
                    <button
                      type="button"
                      onClick={handleAddNewClient}
                      className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-primary-600 hover:bg-primary-700 text-white transition-colors"
                      title="Add new customer"
                    >
                      <PlusIcon className="h-5 w-5" />
                    </button>
                  </div>
                  <ClientSearchDropupPortal
                    anchorRef={clientSearchAnchorRef}
                    open={showClientDropdown}
                    clients={filteredClients}
                    onSelect={(c) => {
                      handleSelectClient(c);
                      setClientSearch("");
                      setShowClientDropdown(false);
                    }}
                    onAddNew={handleAddNewClient}
                  />
                </div>
              )}
            </div>

            {/* ─── 5 CART ITEMS LIST ──────────────────────────────────────── */}
            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-1 space-y-1 max-h-[35vh]">
              {cart.map((item) => (
                <CartItem key={item.cartKey} item={item} onUpdateQuantity={updateCartQuantity} onRemove={removeFromCart} />
              ))}
            </div>

            {/* ─── 6 CART SUMMARY & ACTIONS ───────────────────────────────── */}
            {/* Cart Summary & Checkout */}
            <div className="flex-shrink-0 p-1 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <div className="space-y-1 mb-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Subtotal ({cartItemCount} items)</span>
                  <span className="text-gray-900 dark:text-white">${cartTotal.toFixed(2)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-emerald-600 dark:text-emerald-400">Discount</span>
                    <span className="text-emerald-600 dark:text-emerald-400">-${discountAmount.toFixed(2)}</span>
                  </div>
                )}
                {taxRate > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Tax ({Number(taxRate).toFixed(1).replace(/\.0$/, "")}%)</span>
                    <span className="text-gray-900 dark:text-white">${taxAmount.toFixed(2)}</span>
                  </div>
                )}
                {/* Tip */}
                <div className="flex items-center justify-between text-sm gap-2">
                  <span className="text-gray-500 dark:text-gray-400">Tip</span>
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400 dark:text-gray-500 text-sm">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={tipAmount}
                      onChange={(e) => setTipAmount(e.target.value)}
                      className="w-24 text-right text-sm px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                </div>
                <div className="flex justify-between text-lg font-bold border-t border-gray-200 dark:border-gray-700 pt-1">
                  <span className="text-gray-900 dark:text-white">Total</span>
                  <span className="text-secondary-600 dark:text-secondary-400">${grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </>
        )}
          </div>{/* /component-body-inner */}
        </div>{/* /component-body */}

        <div className="component-footer">
          <div className="component-footer-left">
            <Button_Toolbar
              icon={CreditCardIcon}
              label="Pay"
              title="Checkout"
              onClick={() => {
                onClose();
                handleCheckout();
              }}
            />
          </div>
          <div className="component-footer-center">
            <button type="button" onClick={onClose} className="btn btn-outline-secondary" title="Close">
              Close
            </button>
          </div>
          <div className="component-footer-right"></div>
        </div>
      </div>
    </Modal>
  );
}
