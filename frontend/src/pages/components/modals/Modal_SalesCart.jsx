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
import { InputNumber, InputText } from "../Inputs";
import { createPortal } from "react-dom";
import Modal from "./Modal";
import Button_Toolbar from "../buttons/Button_Toolbar";
import Gate_Permission from "../layout/Gate_Permission";
import Footer_Actions from "../footers/Footer_Actions";
import { getViewportClampedMenuBottom } from "../dropdowns/menuPosition";
import { ShoppingCartIcon, XMarkIcon, UserIcon, CreditCardIcon, PlusIcon, MinusIcon, DocumentTextIcon, TrashIcon } from "../../../icons";

const CLIENT_DROPUP_Z_INDEX = 1200;

function getClientDropupStyle(anchorEl) {
  if (!anchorEl) return null;
  const rect = anchorEl.getBoundingClientRect();
  const width = Math.min(Math.max(rect.width, 260), window.innerWidth - 24);
  const left = Math.min(Math.max(rect.left, 12), window.innerWidth - width - 12);
  const bottom = Math.max(12, getViewportClampedMenuBottom(rect.top, 8));
  const maxHeight = Math.min(280, rect.top - 16);
  return { position: "fixed", left, bottom, width, maxHeight, zIndex: CLIENT_DROPUP_Z_INDEX };
}

/** Client matches rendered in a portal above the cart modal (avoids overflow clipping). */
function ClientSearchDropupPortal({ anchorRef, open, clients, onSelect, onAddNew, canCreateClient = false }) {
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
        canCreateClient ? (
          <button type="button" onClick={onAddNew} className="bg-transparent border-0 dark:hover:bg-gray-700 dark:text-primary-400 flex gap-1 hover:bg-gray-50 items-center px-1 py-0 text-left text-primary-600 text-sm w-full">
            <PlusIcon className="ui-icon-4" />
            New customer
          </button>
        ) : (
          <div className="dark:text-gray-400 px-1 py-1 text-gray-500 text-sm">No customers found</div>
        )
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
const CartItem = ({ item, itemDiscount, onUpdateQuantity, onRemove, canEdit = false }) => {
  const isMix = item.itemType === "mix";

  // Build a compact mix selection summary: "3× White, 7× Black"
  const mixSummary = isMix && item.mixSelections?.length > 0 ? item.mixSelections.map((s) => `${s.quantity}× ${s.product_name}`).join(", ") : null;

  const grossLineTotal = (item.price || 0) * (item.quantity || 1);
  const discountVal = Number(itemDiscount?.discountAmount || 0);
  const netLineTotal = Math.max(0, grossLineTotal - discountVal);

  return (
    <div className="bg-gray-50 dark:bg-gray-800 flex gap-0.5 items-center rounded-lg">
      {/* Delete button — leftmost */}
      {canEdit && <div className="flex-shrink-0 px-0.5">
        <button
          onClick={() => onRemove(item.cartKey)}
          className="bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-800/50 flex h-7 hover:bg-red-200 items-center justify-center rounded-full transition-colors w-7"
          title="Remove item"
        >
          <XMarkIcon className="dark:text-red-400 h-4 text-red-500 w-4" />
        </button>
      </div>}

      {/* Item Info */}
      <div className="flex-1 min-w-0">
        <h4 className="dark:text-white font-medium leading-tight line-clamp-2 mb-0 text-gray-900 text-sm" title={item.name}>
          {item.name}
        </h4>
        {mixSummary && (
          <p className="dark:text-pink-400 text-pink-600 text-xs truncate mb-0" title={mixSummary}>
            {mixSummary}
          </p>
        )}
      </div>

      {/* Quantity Controls */}
      {canEdit ? (
        <div className="align-items-center d-flex flex-shrink-0" style={{ gap: "0.125rem" }}>
          <button onClick={() => onUpdateQuantity(item.cartKey, item.quantity - 1)} className="bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 flex h-7 hover:bg-gray-300 items-center justify-center rounded-full transition-colors w-7">
            <MinusIcon className="dark:text-gray-300 h-4 text-gray-600 w-4" />
          </button>
          <span className="dark:text-white font-medium text-center text-gray-900 text-sm w-7">{item.quantity}</span>
          <button onClick={() => onUpdateQuantity(item.cartKey, item.quantity + 1)} className="bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 flex h-7 hover:bg-gray-300 items-center justify-center rounded-full transition-colors w-7">
            <PlusIcon className="dark:text-gray-300 h-4 text-gray-600 w-4" />
          </button>
        </div>
      ) : (
        <span className="dark:text-white font-medium flex-shrink-0 text-center text-gray-900 text-sm w-7">{item.quantity}</span>
      )}

      {/* Total */}
      <div className="flex-shrink-0 text-right">
        <p className="dark:text-white font-semibold text-gray-900 text-sm mb-0">${netLineTotal.toFixed(2)}</p>
      </div>
    </div>
  );
};

// ─── 2 MAIN MODAL COMPONENT ────────────────────────────────────────────────
export default function Modal_Cart_Sales({
  isOpen,
  onClose,
  canWriteSales = false,
  canWriteClients = false,
  cart = [],
  selectedClient = null,
  setSelectedClient = () => {},
  clientSearch = "",
  setClientSearch = () => {},
  showClientDropdown = false,
  setShowClientDropdown = () => {},
  filteredClients = [],
  cartItemCount = 0,
  cartTotal = 0,
  taxRate = 0,
  discountAmount = 0,
  itemDiscounts = {},
  itemDiscountsTotal = 0,
  autoCartDiscount = 0,
  autoCartDeals = [],
  selectableCartDeals = [],
  selectedCartDealIds = [],
  setSelectedCartDealIds = () => {},
  allowMultipleCartDeals = true,
  loadClients = () => {},
  openAddClientModal = () => {},
  handleSelectClient = () => {},
  setClientsLocal = () => {},
  updateCartQuantity = () => {},
  removeFromCart = () => {},
  clearCart = () => {},
  handleCheckout = () => {},
  onCreateQuote = () => {},
}) {
  const [tipAmount, setTipAmount] = useState("");
  const clientSearchAnchorRef = useRef(null);
  const tip = parseFloat(tipAmount) || 0;
  const discountedSubtotal = Math.max(cartTotal - discountAmount, 0);
  const taxAmount = taxRate > 0 ? discountedSubtotal * (taxRate / 100) : 0;
  const grandTotal = discountedSubtotal + taxAmount + tip;
  const selectedCartDiscount = Math.max(0, discountAmount - itemDiscountsTotal - autoCartDiscount);

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

  const handleAddNewClient = () => {
    if (!canWriteSales || !canWriteClients) return;
    openAddClientModal((newClient) => {
      handleSelectClient(newClient);
      setClientsLocal((prev) => [...prev, newClient]);
      setClientSearch("");
      setShowClientDropdown(false);
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} noPadding={true} contentGravity="bottom">
      <div className="ui-component-shell">
        <div className="component-header">
          <div className="component-header-left">
            <ShoppingCartIcon className="app-icon me-1" />
            Cart ({cartItemCount})
          </div>
          <div className="component-header-center"></div>
          <div className="component-header-right"></div>
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
            {canWriteSales && <div className="border-b border-gray-200 dark:border-gray-700 flex-shrink-0 p-1">
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
                    <InputText
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
                    {canWriteClients && (
                      <button
                        type="button"
                        onClick={handleAddNewClient}
                        className="bg-primary-600 flex flex-shrink-0 h-10 hover:bg-primary-700 items-center justify-center rounded-xl text-white transition-colors w-10"
                        title="Add new customer"
                      >
                        <PlusIcon className="ui-icon-5" />
                      </button>
                    )}
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
                    canCreateClient={canWriteSales && canWriteClients}
                  />
                </div>
              )}
            </div>}

            {/* ─── 5 CART ITEMS LIST ──────────────────────────────────────── */}
            {/* Cart Items */}
            <div className="flex-1 max-h-[35vh] overflow-y-auto p-0.5 space-y-1">
              {cart.map((item) => (
                <CartItem
                  key={item.cartKey}
                  item={item}
                  itemDiscount={itemDiscounts[item.cartKey]}
                  onUpdateQuantity={updateCartQuantity}
                  onRemove={removeFromCart}
                  canEdit={canWriteSales}
                />
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

                {/* Selectable cart deals picker (if any selectable deals exist) */}
                {canWriteSales && selectableCartDeals.length > 0 && (
                  <div className="py-1 border-top border-bottom border-gray-200 dark:border-gray-700 my-1">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span className="text-xs fw-semibold text-muted">Available Cart Deals</span>
                    </div>
                    <div className="d-flex flex-wrap gap-1">
                      {selectableCartDeals.map((deal) => {
                        const isSelected = selectedCartDealIds.includes(deal.id);
                        return (
                          <button
                            key={deal.id}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setSelectedCartDealIds(selectedCartDealIds.filter((id) => id !== deal.id));
                              } else {
                                if (allowMultipleCartDeals) {
                                  setSelectedCartDealIds([...selectedCartDealIds, deal.id]);
                                } else {
                                  setSelectedCartDealIds([deal.id]);
                                }
                              }
                            }}
                            className={`btn btn-sm py-0 px-2 rounded-pill ${
                              isSelected ? "btn-primary text-white" : "btn-outline-secondary"
                            }`}
                            style={{ fontSize: "0.72rem" }}
                          >
                            {deal.name} ({deal.discount_type === "percentage" ? `${deal.discount_value}%` : `$${deal.discount_value}`})
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ZERO SUPPRESSION: Only show discount lines if > 0 */}
                {itemDiscountsTotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="dark:text-emerald-400 text-emerald-600">Item Discounts</span>
                    <span className="dark:text-emerald-400 text-emerald-600">-${itemDiscountsTotal.toFixed(2)}</span>
                  </div>
                )}
                {autoCartDiscount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="dark:text-emerald-400 text-emerald-600">
                      Promotion {autoCartDeals.length > 0 ? `(${autoCartDeals.map((d) => d.name).join(", ")})` : ""}
                    </span>
                    <span className="dark:text-emerald-400 text-emerald-600">-${autoCartDiscount.toFixed(2)}</span>
                  </div>
                )}
                {selectedCartDiscount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="dark:text-emerald-400 text-emerald-600">Applied Deals</span>
                    <span className="dark:text-emerald-400 text-emerald-600">-${selectedCartDiscount.toFixed(2)}</span>
                  </div>
                )}

                {/* ZERO SUPPRESSION: Only show Tax line if taxAmount > 0 */}
                {taxAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="dark:text-gray-400 text-gray-500">Tax ({Number(taxRate).toFixed(1).replace(/\.0$/, "")}%)</span>
                    <span className="dark:text-white text-gray-900">${taxAmount.toFixed(2)}</span>
                  </div>
                )}
                {/* Tip */}
                {canWriteSales && (
                  <div className="flex gap-2 items-center justify-between text-sm">
                    <span className="dark:text-gray-400 text-gray-500">Tip</span>
                    <div className="ui-flex-items-gap-1">
                      <span className="dark:text-gray-500 text-gray-400 text-sm">$</span>
                      <InputNumber
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={tipAmount}
                        onChange={(e) => setTipAmount(e.target.value)}
                        className="bg-white border border-gray-200 dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 px-0 py-1 rounded-lg text-gray-900 text-right text-sm w-24"
                        style={{ marginBottom: 0 }}
                      />
                    </div>
                  </div>
                )}
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
          <Footer_Actions
            start={
              <div className="align-items-center d-flex flex-wrap gap-2">
                {canWriteSales && cart.length > 0 && (
                  <Button_Toolbar
                    icon={TrashIcon}
                    label=""
                    compact
                    onClick={clearCart}
                    className="btn-outline-danger"
                    title="Clear cart"
                  />
                )}
                {canWriteSales && (
                  <Button_Toolbar
                    icon={DocumentTextIcon}
                    label="Quote"
                    title={selectedClient ? "Create a quote for the selected client" : "Create a quote; select a client to email it"}
                    onClick={onCreateQuote}
                    disabled={cart.length === 0}
                    className="btn-outline-secondary"
                  />
                )}
                {canWriteSales && <Gate_Permission page="sales" permission="write">
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
                </Gate_Permission>}
              </div>
            }
            center={<Button_Toolbar icon={XMarkIcon} label="Close" onClick={onClose} className="btn-outline-secondary" title="Close" />}
          />
        </div>
      </div>
    </Modal>
  );
}
