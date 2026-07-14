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
import { ShoppingCartIcon, XMarkIcon, UserIcon, CreditCardIcon, PlusIcon, MinusIcon, SparklesIcon, CubeIcon } from "@heroicons/react/24/outline";

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
      className="bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700 overflow-y-auto rounded-xl shadow-lg"
      style={panelStyle}
    >
      {clients.length === 0 ? (
        <button type="button" onClick={onAddNew} className="bg-transparent border-0 dark:hover:bg-gray-700 dark:text-primary-400 flex gap-1 hover:bg-gray-50 items-center px-1 py-0 text-left text-primary-600 text-sm w-full">
          <PlusIcon className="ui-icon-4" />
          New customer
        </button>
      ) : (
        clients.map((c) => (
          <button
            key={c.id}
            type="button"
            role="option"
            onClick={() => onSelect(c)}
            className="bg-transparent border-0 dark:hover:bg-gray-700 dark:text-white hover:bg-gray-50 px-1 py-0 text-gray-900 text-left text-sm w-full"
            style={{ width: "100%", margin: 0 }}
          >
            <p className="font-medium mb-0">{c.name}</p>
            {(c.email || c.phone) && (
              <p className="dark:text-gray-400 mb-0 text-gray-500 text-xs">
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
    <div className="bg-gray-50 dark:bg-gray-800 flex gap-1 items-center rounded-lg">
      {/* Delete button — leftmost */}
      <div className="flex-shrink-0 px-1">
        <button
          onClick={() => onRemove(item.cartKey)}
          className="bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-800/50 flex h-7 hover:bg-red-200 items-center justify-center rounded-full transition-colors w-7"
          title="Remove item"
        >
          <XMarkIcon className="dark:text-red-400 h-4 text-red-500 w-4" />
        </button>
      </div>

      {/* Mini Image/Icon */}
      <div className={`w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden ${isService ? "bg-primary-100 dark:bg-primary-900" : isBundle ? "bg-orange-100 dark:bg-orange-900" : isMix ? "bg-pink-100 dark:bg-pink-900" : "bg-secondary-100 dark:bg-secondary-900"}`}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={item.name}
            className="h-full object-center object-cover w-full"
            onError={(e) => {
              e.target.style.display = "none";
              const fallback = e.target.nextElementSibling;
              if (fallback) fallback.style.display = "flex";
            }}
          />
        ) : null}
        <div className={`w-full h-full flex items-center justify-center ${imageUrl ? "hidden" : "flex"}`}>{isService ? <SparklesIcon className="h-6 text-primary-500 w-6" /> : <CubeIcon className={`h-6 w-6 ${isBundle ? "text-orange-500" : isMix ? "text-pink-500" : "text-secondary-500"}`} />}</div>
      </div>

      {/* Item Info */}
      <div className="flex-1 min-w-0">
        <h4 className="dark:text-white font-medium text-gray-900 text-sm truncate">{item.name}</h4>
        {mixSummary && (
          <p className="dark:text-pink-400 text-pink-600 text-xs truncate" title={mixSummary}>
            {mixSummary}
          </p>
        )}
        <p className="ui-muted-xs">
          ${item.price?.toFixed(2)} × {item.quantity}
        </p>
      </div>

      {/* Quantity Controls */}
      <div className="ui-flex-items-gap-1">
        <button onClick={() => onUpdateQuantity(item.cartKey, item.quantity - 1)} className="bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 flex h-7 hover:bg-gray-300 items-center justify-center rounded-full transition-colors w-7">
          <MinusIcon className="dark:text-gray-300 h-4 text-gray-600 w-4" />
        </button>
        <span className="dark:text-white font-medium text-center text-gray-900 text-sm w-8">{item.quantity}</span>
        <button onClick={() => onUpdateQuantity(item.cartKey, item.quantity + 1)} className="bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 flex h-7 hover:bg-gray-300 items-center justify-center rounded-full transition-colors w-7">
          <PlusIcon className="dark:text-gray-300 h-4 text-gray-600 w-4" />
        </button>
      </div>

      {/* Total */}
      <div className="flex-shrink-0 px-1 text-right">
        <p className="dark:text-white font-semibold p-1 text-gray-900 text-sm">${(item.price * item.quantity).toFixed(2)}</p>
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
      <div className="ui-component-shell">
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
                className="btn btn-circle btn-outline-danger btn-sm"
                title="Clear cart"
              >
                <XMarkIcon className="ui-icon-4" />
              </button>
            )}
          </div>
        </div>

        <div className="component-body">
          <div className="component-body-inner">
        {cart.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center p-1 text-center">
            <div className="bg-gray-100 dark:bg-gray-700 flex h-20 items-center justify-center mb-2 rounded-full w-20">
              <ShoppingCartIcon className="h-10 text-gray-400 w-10" />
            </div>
            <h4 className="dark:text-white font-medium mb-1 text-gray-900">Cart is empty</h4>
            <p className="dark:text-gray-400 text-gray-500 text-sm">Add items to get started</p>
          </div>
        ) : (
          <>
            {/* ─── 4 CLIENT SELECTION ─────────────────────────────────────── */}
            {/* Client Selection */}
            <div className="border-b border-gray-200 dark:border-gray-700 flex-shrink-0 p-1">
              <label className="block dark:text-gray-300 font-medium mb-1 text-gray-700 text-sm">
                <UserIcon className="h-4 inline mr-1 w-4" />
                Customer (optional)
              </label>
              {selectedClient ? (
                <div className="bg-primary-50 dark:bg-primary-900/30 flex items-center justify-between p-1 rounded-xl">
                  <div>
                    <p className="dark:text-white font-medium text-gray-900 text-sm">{selectedClient.name}</p>
                    {selectedClient.email && <p className="ui-muted-xs">{selectedClient.email}</p>}
                  </div>
                  <button onClick={() => setSelectedClient(null)} className="dark:hover:bg-primary-800 hover:bg-primary-100 p-1 rounded-lg transition-colors">
                    <XMarkIcon className="h-4 text-gray-500 w-4" />
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
                      className="app-search-input bg-gray-50 border border-gray-200 dark:bg-gray-700 dark:border-gray-600 dark:text-white flex-1 focus:border-transparent focus:ring-2 focus:ring-primary-500 placeholder-gray-400 px-0 rounded-xl text-gray-900"
                      autoComplete="off"
                      aria-expanded={showClientDropdown}
                      aria-haspopup="listbox"
                    />
                    <button
                      type="button"
                      onClick={handleAddNewClient}
                      className="bg-primary-600 flex flex-shrink-0 h-10 hover:bg-primary-700 items-center justify-center rounded-xl text-white transition-colors w-10"
                      title="Add new customer"
                    >
                      <PlusIcon className="ui-icon-5" />
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
            <div className="flex-1 max-h-[35vh] overflow-y-auto p-1 space-y-1">
              {cart.map((item) => (
                <CartItem key={item.cartKey} item={item} onUpdateQuantity={updateCartQuantity} onRemove={removeFromCart} />
              ))}
            </div>

            {/* ─── 6 CART SUMMARY & ACTIONS ───────────────────────────────── */}
            {/* Cart Summary & Checkout */}
            <div className="bg-gray-50 border-gray-200 border-t dark:bg-gray-800/50 dark:border-gray-700 flex-shrink-0 p-1">
              <div className="mb-1 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="dark:text-gray-400 text-gray-500">Subtotal ({cartItemCount} items)</span>
                  <span className="dark:text-white text-gray-900">${cartTotal.toFixed(2)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="dark:text-emerald-400 text-emerald-600">Discount</span>
                    <span className="dark:text-emerald-400 text-emerald-600">-${discountAmount.toFixed(2)}</span>
                  </div>
                )}
                {taxRate > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="dark:text-gray-400 text-gray-500">Tax ({Number(taxRate).toFixed(1).replace(/\.0$/, "")}%)</span>
                    <span className="dark:text-white text-gray-900">${taxAmount.toFixed(2)}</span>
                  </div>
                )}
                {/* Tip */}
                <div className="flex gap-2 items-center justify-between text-sm">
                  <span className="dark:text-gray-400 text-gray-500">Tip</span>
                  <div className="ui-flex-items-gap-1">
                    <span className="dark:text-gray-500 text-gray-400 text-sm">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={tipAmount}
                      onChange={(e) => setTipAmount(e.target.value)}
                      className="bg-white border border-gray-200 dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 px-0 py-1 rounded-lg text-gray-900 text-right text-sm w-24"
                    />
                  </div>
                </div>
                <div className="border-gray-200 border-t dark:border-gray-700 flex font-bold justify-between pt-1 text-lg">
                  <span className="dark:text-white text-gray-900">Total</span>
                  <span className="dark:text-secondary-400 text-secondary-600">${grandTotal.toFixed(2)}</span>
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
              className="btn-success text-white"
              style={{ borderColor: "#059669", backgroundColor: "#059669" }}
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
