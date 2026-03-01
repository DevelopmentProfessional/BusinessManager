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
import React from 'react';
import Modal from './Modal';
import { getDisplayImageUrl } from './imageUtils';
import {
  ShoppingCartIcon, XMarkIcon, UserIcon, CreditCardIcon,
  PlusIcon, MinusIcon, SparklesIcon, CubeIcon
} from '@heroicons/react/24/outline';

// ─── 1 CARTITEM SUB-COMPONENT ──────────────────────────────────────────────
const CartItem = ({ item, onUpdateQuantity, onRemove }) => {
  const isService = item.itemType === 'service';
  const imageUrl = getDisplayImageUrl(item);

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
      {/* Mini Image/Icon */}
      <div className={`w-12 h-12 rounded-lg flex-shrink-0 overflow-hidden ${
        isService
          ? 'bg-primary-100 dark:bg-primary-900'
          : 'bg-secondary-100 dark:bg-secondary-900'
      }`}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={item.name}
            className="w-full h-full object-cover object-center"
            onError={(e) => {
              e.target.style.display = 'none';
              const fallback = e.target.nextElementSibling;
              if (fallback) fallback.style.display = 'flex';
            }}
          />
        ) : null}
        <div
          className={`w-full h-full flex items-center justify-center ${
            imageUrl ? 'hidden' : 'flex'
          }`}
        >
          {isService ? (
            <SparklesIcon className="h-6 w-6 text-primary-500" />
          ) : (
            <CubeIcon className="h-6 w-6 text-secondary-500" />
          )}
        </div>
      </div>

      {/* Item Info */}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm text-gray-900 dark:text-white truncate">{item.name}</h4>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          ${item.price?.toFixed(2)} × {item.quantity}
        </p>
      </div>

      {/* Quantity Controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onUpdateQuantity(item.cartKey, item.quantity - 1)}
          className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center justify-center transition-colors"
        >
          <MinusIcon className="h-4 w-4 text-gray-600 dark:text-gray-300" />
        </button>
        <span className="w-8 text-center text-sm font-medium text-gray-900 dark:text-white">{item.quantity}</span>
        <button
          onClick={() => onUpdateQuantity(item.cartKey, item.quantity + 1)}
          className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center justify-center transition-colors"
        >
          <PlusIcon className="h-4 w-4 text-gray-600 dark:text-gray-300" />
        </button>
      </div>

      {/* Subtotal & Remove */}
      <div className="text-right">
        <p className="font-semibold text-sm text-gray-900 dark:text-white">
          ${(item.price * item.quantity).toFixed(2)}
        </p>
        <button
          onClick={() => onRemove(item.cartKey)}
          className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400"
        >
          Remove
        </button>
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
  loadClients,
  openAddClientModal,
  handleSelectClient,
  setClientsLocal,
  updateCartQuantity,
  removeFromCart,
  setCart,
  handleCheckout,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} noPadding={true}>
      <div className="flex flex-col max-h-[90vh]">
        {/* ─── 3 CART HEADER ─────────────────────────────────────────────── */}
        {/* Cart Header */}
        <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <ShoppingCartIcon className="h-5 w-5" />
            Cart ({cartItemCount})
          </h3>
        </div>

        {cart.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
              <ShoppingCartIcon className="h-10 w-10 text-gray-400" />
            </div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-1">Cart is empty</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">Add items to get started</p>
          </div>
        ) : (
          <>
            {/* ─── 4 CLIENT SELECTION ─────────────────────────────────────── */}
            {/* Client Selection */}
            <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <UserIcon className="h-4 w-4 inline mr-1" />
                Customer (optional)
              </label>
              {selectedClient ? (
                <div className="flex items-center justify-between p-3 bg-primary-50 dark:bg-primary-900/30 rounded-xl">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white text-sm">{selectedClient.name}</p>
                    {selectedClient.email && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">{selectedClient.email}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedClient(null)}
                    className="p-1 hover:bg-primary-100 dark:hover:bg-primary-800 rounded-lg transition-colors"
                  >
                    <XMarkIcon className="h-4 w-4 text-gray-500" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Search customers..."
                      value={clientSearch}
                      onChange={(e) => { setClientSearch(e.target.value); setShowClientDropdown(true); }}
                      onFocus={() => { loadClients(); setShowClientDropdown(true); }}
                      className="app-search-input flex-1 px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => openAddClientModal((newClient) => {
                        handleSelectClient(newClient);
                        setClientsLocal(prev => [...prev, newClient]);
                        setClientSearch('');
                        setShowClientDropdown(false);
                      })}
                      className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-primary-600 hover:bg-primary-700 text-white transition-colors"
                      title="Add new customer"
                    >
                      <PlusIcon className="h-5 w-5" />
                    </button>
                  </div>
                  {showClientDropdown && clientSearch && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                      {filteredClients.slice(0, 5).map(c => (
                        <button key={c.id} onClick={() => { handleSelectClient(c); setClientSearch(''); setShowClientDropdown(false); }} className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-900 dark:text-white">
                          <p className="font-medium">{c.name}</p>
                          {c.email && <p className="text-xs text-gray-500 dark:text-gray-400">{c.email}</p>}
                        </button>
                      ))}
                      {filteredClients.length === 0 && (
                        <button
                          onClick={() => openAddClientModal((newClient) => {
                            handleSelectClient(newClient);
                            setClientsLocal(prev => [...prev, newClient]);
                            setClientSearch('');
                            setShowClientDropdown(false);
                          })}
                          className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-primary-600 dark:text-primary-400 flex items-center gap-2"
                        >
                          <PlusIcon className="h-4 w-4" />
                          Create new customer
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ─── 5 CART ITEMS LIST ──────────────────────────────────────── */}
            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[35vh]">
              {cart.map(item => (
                <CartItem
                  key={item.cartKey}
                  item={item}
                  onUpdateQuantity={updateCartQuantity}
                  onRemove={removeFromCart}
                />
              ))}
            </div>

            {/* ─── 6 CART SUMMARY & ACTIONS ───────────────────────────────── */}
            {/* Cart Summary & Checkout */}
            <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <div className="space-y-2 mb-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Subtotal ({cartItemCount} items)</span>
                  <span className="text-gray-900 dark:text-white">${cartTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Tax (8%)</span>
                  <span className="text-gray-900 dark:text-white">${(cartTotal * 0.08).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t border-gray-200 dark:border-gray-700">
                  <span className="text-gray-900 dark:text-white">Total</span>
                  <span className="text-secondary-600 dark:text-secondary-400">${(cartTotal * 1.08).toFixed(2)}</span>
                </div>
              </div>

              {/* Row 1: Checkout + Continue */}
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => { onClose(); handleCheckout(); }}
                  className="flex-1 py-3 bg-secondary-600 hover:bg-secondary-700 text-white rounded-full font-semibold transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  <CreditCardIcon className="h-5 w-5" />
                  Checkout
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-full text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Continue Shopping
                </button>
              </div>

              {/* Row 2: Clear All */}
              {cart.length > 0 && (
                <div className="flex">
                  <button
                    onClick={() => setCart([])}
                    className="text-sm text-red-500 hover:text-red-700 dark:hover:text-red-400"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
