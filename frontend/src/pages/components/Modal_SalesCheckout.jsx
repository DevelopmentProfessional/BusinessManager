/*
 * ============================================================
 * FILE: Modal_Checkout_Sales.jsx
 *
 * PURPOSE:
 *   Full checkout and payment processing modal for the Sales page.
 *   Handles card and cash payment flows with simulated processing, a
 *   success confirmation screen, and post-sale invoice/receipt printing
 *   via the document template system.
 *
 * FUNCTIONAL PARTS:
 *   [1] State & Derived Values — Payment form state, subtotal/tax/total calculations
 *   [2] Input Formatters — Card number, expiry, and CVC formatting helpers
 *   [3] Validation & Form Handlers — Card validity check, submit, done, and close handlers
 *   [4] Modal Header — Checkout title bar with item count and close button
 *   [5] Payment Success Screen — Confirmation UI with Print Invoice / Print Receipt actions
 *   [6] Order Summary Panel — Read-only cart list with pricing breakdown
 *   [7] Payment Method Tabs — Card / Cash toggle buttons
 *   [8] Card Payment Form — Card number, name, expiry, CVC inputs with submit button
 *   [9] Cash Payment View — Amount display with confirm button
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-03-01 | Claude  | Added section comments and top-level documentation
 *   2026-03-01 | Claude  | P6-B — taxRate prop now accepts a percentage value (e.g. 8.5); hides tax line when 0
 *   2026-07-31 | GitHub Copilot | Added appointment/client context and selectable checkout items; fixed fullscreen responsive layout
 * ============================================================
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import Modal from "./Modal";
import Modal_TemplateUse from "./Modal_TemplateUse";
import { clientsAPI } from "../../services/api";
import { XMarkIcon, CreditCardIcon, BanknotesIcon, CheckCircleIcon, ShoppingCartIcon, PrinterIcon, DevicePhoneMobileIcon } from "@heroicons/react/24/outline";
import { CheckCircleIcon as CheckCircleSolid } from "@heroicons/react/24/solid";

// ─── 1 COMPONENT DEFINITION & STATE ────────────────────────────────────────
export default function Modal_Checkout_Sales({ isOpen, onClose, cart = [], discountAmount = 0, selectedClient = null, checkoutContext = null, onProcessPayment, getDiscountForItems = null, taxRate = 0, currentUser = null, appSettings = null, receiptSettings = null }) {
  const [paymentMethod, setPaymentMethod] = useState("card_scan");
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [showTemplateUse, setShowTemplateUse] = useState(false);
  const [templateFilterType, setTemplateFilterType] = useState(null);
  const [selectedCartKeys, setSelectedCartKeys] = useState(() => new Set());
  const completedSaleRef = useRef(null);

  // Client email prompt (for email receipt action)
  const [showEmailPrompt, setShowEmailPrompt] = useState(false);
  const [promptEmail, setPromptEmail] = useState("");
  const [emailSaveError, setEmailSaveError] = useState("");

  const normalizedCart = useMemo(
    () =>
      cart.map((item, index) => ({
        ...item,
        _checkoutKey: item.cartKey || `${item.itemType || "item"}-${item.id || "idx"}-${index}`,
      })),
    [cart]
  );

  const selectedItems = normalizedCart.filter((item) => selectedCartKeys.has(item._checkoutKey));
  const subtotal = selectedItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
  const selectedItemsDiscountRaw = typeof getDiscountForItems === "function" ? Number(getDiscountForItems(selectedItems)) : Number(discountAmount || 0);
  const selectedItemsDiscount = Math.min(Math.max(0, Number.isFinite(selectedItemsDiscountRaw) ? selectedItemsDiscountRaw : 0), subtotal);
  const effectiveSubtotal = Math.max(0, subtotal - selectedItemsDiscount);
  const tax = effectiveSubtotal * (taxRate / 100);
  const total = effectiveSubtotal + tax;
  const itemCount = selectedItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const selectedLineCount = selectedItems.length;
  const allItemsSelected = normalizedCart.length > 0 && selectedLineCount === normalizedCart.length;
  const isCardScan = paymentMethod === "card_scan";
  const isTapPay = paymentMethod === "tap_pay";
  const stripeReady = Boolean(appSettings?.stripe_enabled);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedCartKeys(new Set(normalizedCart.map((item) => item._checkoutKey)));
  }, [isOpen, normalizedCart]);

  const resetForm = () => {
    setPaymentSuccess(false);
    setIsProcessing(false);
    setShowTemplateUse(false);
    setTemplateFilterType(null);
    completedSaleRef.current = null;
  };

  const triggerReceiptAction = () => {
    if (!receiptSettings?.templateId) {
      setTemplateFilterType("receipt");
      setShowTemplateUse(true);
      return;
    }

    const action = receiptSettings.action || "select";
    if (action === "email") {
      const email = selectedClient?.email || "";
      if (!email) {
        setPromptEmail("");
        setEmailSaveError("");
        setShowEmailPrompt(true);
      } else {
        setTemplateFilterType("receipt");
        setShowTemplateUse(true);
      }
      return;
    }

    setTemplateFilterType("receipt");
    setShowTemplateUse(true);
  };

  const handleSavePromptEmail = async () => {
    const nextEmail = String(promptEmail || "").trim();
    if (!nextEmail || !nextEmail.includes("@")) {
      setEmailSaveError("Please enter a valid email address.");
      return;
    }

    if (!selectedClient?.id) {
      setEmailSaveError("No client selected for this receipt.");
      return;
    }

    try {
      setEmailSaveError("");
      await clientsAPI.update(selectedClient.id, { email: nextEmail });
      setShowEmailPrompt(false);
      setTemplateFilterType("receipt");
      setShowTemplateUse(true);
    } catch (err) {
      setEmailSaveError(err?.response?.data?.detail || "Failed to save email.");
    }
  };

  const handleSubmit = async () => {
    if (selectedItems.length === 0) return;

    setIsProcessing(true);
    try {
      const checkoutItems = selectedItems.map(({ _checkoutKey, ...item }) => item);
      const paymentResult = await onProcessPayment(paymentMethod, checkoutItems);
      if (paymentResult?.checkout_url) {
        window.location.assign(paymentResult.checkout_url);
        return;
      }

      completedSaleRef.current = {
        id: paymentResult?.sale_id || Date.now().toString(),
        created_at: new Date().toISOString(),
        subtotal,
        tax_amount: tax,
        total,
        payment_method: paymentMethod,
        items: checkoutItems.map((item) => ({
          item_name: item.name,
          item_type: item.itemType,
          quantity: item.quantity,
          unit_price: item.price,
          line_total: Number(item.price || 0) * Number(item.quantity || 0),
        })),
      };

      setPaymentSuccess(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDone = () => {
    resetForm();
    onClose();
  };

  const handleClose = () => {
    if (!isProcessing) {
      resetForm();
      onClose();
    }
  };

  const toggleCartItem = (checkoutKey) => {
    setSelectedCartKeys((prev) => {
      const next = new Set(prev);
      if (next.has(checkoutKey)) next.delete(checkoutKey);
      else next.add(checkoutKey);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (allItemsSelected) {
      setSelectedCartKeys(new Set());
      return;
    }
    setSelectedCartKeys(new Set(normalizedCart.map((item) => item._checkoutKey)));
  };

  const checkoutDateLabel = checkoutContext?.appointmentDate
    ? new Date(checkoutContext.appointmentDate).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <Modal isOpen={isOpen} onClose={handleClose} noPadding={true} centered={true} contentGravity="top">
      <div className="bg-white dark:bg-gray-900 flex flex-col h-full w-full">
        {/* Header */}
        <div className="bg-gradient-to-r border-b border-gray-200 dark:border-gray-700 flex from-emerald-500 items-center justify-between p-1 to-emerald-600">
          <div className="ui-flex-items-gap-1">
            <div className="bg-white/20 p-1 rounded-lg">
              <ShoppingCartIcon className="h-5 text-white w-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-white">Checkout</h2>
              <p className="text-emerald-100 text-sm">{itemCount} items selected</p>
            </div>
          </div>
          <button onClick={handleClose} disabled={isProcessing} className="disabled:opacity-50 hover:bg-white/20 p-1 rounded-lg transition-colors">
            <XMarkIcon className="h-5 text-white w-5" />
          </button>
        </div>

        {paymentSuccess ? (
          <div className="p-1 text-center">
            <div className="animate-in bg-emerald-100 dark:bg-emerald-900/50 duration-300 flex h-24 items-center justify-center mb-1 mx-auto rounded-full w-24 zoom-in">
              <CheckCircleSolid className="h-14 text-emerald-500 w-14" />
            </div>
            <h3 className="dark:text-white font-bold mb-1 text-2xl text-gray-900">Payment Successful!</h3>
            <p className="dark:text-gray-400 mb-1 text-gray-500">Transaction completed successfully</p>
            <p className="dark:text-emerald-400 font-bold mb-3 text-3xl text-emerald-600">${total.toFixed(2)}</p>

            <div className="flex gap-2 items-center justify-between mb-1">
              <button
                type="button"
                onClick={triggerReceiptAction}
                className="bg-emerald-600 flex font-semibold gap-1.5 hover:bg-emerald-700 items-center px-1 py-0 rounded-xl text-sm text-white transition-colors"
                title={receiptSettings?.templateId ? "Send / print receipt" : "Select receipt template"}
              >
                <PrinterIcon className="ui-icon-4" /> Receipt
              </button>
              <button type="button" onClick={handleDone} className="bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 flex-1 font-semibold hover:bg-gray-300 mx-2 py-0 rounded-xl text-gray-700 text-sm transition-colors">
                Done
              </button>
            </div>

            {showEmailPrompt && (
              <div className="bg-gray-50 border dark:bg-gray-800 mt-2 p-0 rounded-xl text-left">
                <p className="dark:text-gray-300 mb-1 text-gray-700 text-sm">Client has no email on file. Enter email to send receipt:</p>
                <div className="flex gap-1">
                  <input type="email" value={promptEmail} onChange={(e) => setPromptEmail(e.target.value)} placeholder="client@email.com" className="flex-1 form-control form-control-sm" />
                  <button type="button" onClick={handleSavePromptEmail} className="btn btn-success btn-sm">
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEmailPrompt(false);
                      setEmailSaveError("");
                    }}
                    className="btn btn-outline-secondary btn-sm"
                  >
                    Cancel
                  </button>
                </div>
                {emailSaveError && <p className="mt-2 text-danger text-xs">{emailSaveError}</p>}
              </div>
            )}
          </div>
        ) : (
          <div className="gap-1 grid grid-cols-1 md:grid-cols-5 min-h-0 p-1">
            <div className="bg-gray-50 border border-gray-200 dark:bg-gray-800/40 dark:border-gray-700 flex flex-col md:col-span-2 min-h-0 rounded-2xl">
              <div className="p-1 space-y-1">
                <div className="bg-white border border-gray-200 dark:bg-gray-800/70 dark:border-gray-700 p-1 rounded-xl">
                  <div className="dark:text-white font-semibold text-gray-900 text-sm">{selectedClient?.name || "Walk-in checkout"}</div>
                  {(selectedClient?.email || selectedClient?.phone) && <div className="dark:text-gray-400 text-gray-500 text-xs">{[selectedClient?.email, selectedClient?.phone].filter(Boolean).join(" • ")}</div>}
                  {checkoutContext?.serviceName && <div className="dark:text-emerald-300 mt-1 text-emerald-700 text-xs">Service: {checkoutContext.serviceName}</div>}
                  {checkoutDateLabel && <div className="dark:text-gray-400 text-gray-500 text-xs">Appointment: {checkoutDateLabel}</div>}
                  {checkoutContext?.appointmentStatus && <div className="dark:text-gray-400 text-gray-500 text-xs">Status: {checkoutContext.appointmentStatus}</div>}
                  {checkoutContext?.employeeName && <div className="dark:text-gray-400 text-gray-500 text-xs">Employee: {checkoutContext.employeeName}</div>}
                  {checkoutContext?.notes && <div className="dark:text-gray-400 text-gray-500 text-xs line-clamp-2">Notes: {checkoutContext.notes}</div>}
                </div>

                <div className="items-center flex justify-between">
                  <p className="dark:text-white font-semibold mb-0 text-gray-900 text-sm">Items available for checkout</p>
                  <button type="button" onClick={handleToggleSelectAll} className="btn btn-sm btn-outline-secondary">
                    {allItemsSelected ? "Deselect all" : "Select all"}
                  </button>
                </div>

                <div className="bg-white border border-gray-200 dark:bg-gray-800/70 dark:border-gray-700 max-h-56 md:max-h-[34vh] overflow-y-auto rounded-xl">
                  {normalizedCart.length === 0 ? (
                    <p className="dark:text-gray-400 mb-0 p-1 text-gray-500 text-sm">No cart items found.</p>
                  ) : (
                    normalizedCart.map((item) => {
                      const isSelected = selectedCartKeys.has(item._checkoutKey);
                      return (
                        <button key={item._checkoutKey} type="button" onClick={() => toggleCartItem(item._checkoutKey)} className={`bg-transparent border-0 border-b dark:border-gray-700 flex gap-1 items-center p-1 text-left transition-colors w-full ${isSelected ? "bg-emerald-50/60 dark:bg-emerald-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-700/40"}`}>
                          <input type="checkbox" checked={isSelected} readOnly className="h-4 w-4" />
                          <div className="min-w-0 flex-1">
                            <p className="dark:text-white font-medium mb-0 text-gray-900 text-sm truncate">{item.name}</p>
                            <p className="dark:text-gray-400 mb-0 text-gray-500 text-xs">
                              ${Number(item.price || 0).toFixed(2)} × {item.quantity}
                            </p>
                          </div>
                          <span className="dark:text-white font-semibold text-gray-900 text-sm">${(Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2)}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="border-gray-200 border-t dark:border-gray-700 mt-auto p-1 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="dark:text-gray-400 text-gray-500">Subtotal</span>
                  <span className="dark:text-white text-gray-900">${subtotal.toFixed(2)}</span>
                </div>
                {selectedItemsDiscount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="dark:text-gray-400 text-gray-500">Discount</span>
                    <span className="dark:text-red-400 text-red-600">-${selectedItemsDiscount.toFixed(2)}</span>
                  </div>
                )}
                {taxRate > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="dark:text-gray-400 text-gray-500">Tax ({Number(taxRate).toFixed(1).replace(/\.0$/, "")}%)</span>
                    <span className="dark:text-white text-gray-900">${tax.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-gray-200 border-t dark:border-gray-700 flex font-bold justify-between pt-1 text-xl">
                  <span className="dark:text-white text-gray-900">Total</span>
                  <span className="dark:text-emerald-400 text-emerald-600">${total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="md:col-span-3 min-w-0 overflow-y-auto p-1">
              <h3 className="dark:text-white font-semibold mb-1 text-gray-900">Payment Method</h3>

              <div className="gap-1 grid grid-cols-1 mb-1 sm:grid-cols-3">
                <button
                  onClick={() => setPaymentMethod("card_scan")}
                  className={`flex-1 py-1 px-0 rounded-xl border-2 flex items-center justify-center gap-1 transition-all ${isCardScan ? "border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300" : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"}`}
                >
                  <CreditCardIcon className="ui-icon-5" />
                  <span className="font-medium">Card Scan</span>
                </button>
                <button
                  onClick={() => setPaymentMethod("tap_pay")}
                  className={`flex-1 py-1 px-0 rounded-xl border-2 flex items-center justify-center gap-1 transition-all ${isTapPay ? "border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300" : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"}`}
                >
                  <DevicePhoneMobileIcon className="ui-icon-5" />
                  <span className="font-medium">Tap Pay</span>
                </button>
                <button
                  onClick={() => setPaymentMethod("cash")}
                  className={`flex-1 py-1 px-0 rounded-xl border-2 flex items-center justify-center gap-1 transition-all ${paymentMethod === "cash" ? "border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300" : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"}`}
                >
                  <BanknotesIcon className="ui-icon-5" />
                  <span className="font-medium">Cash</span>
                </button>
              </div>

              {isCardScan || isTapPay ? (
                <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 p-1 rounded-2xl space-y-1">
                  <div className="flex items-center gap-1">
                    <div className="bg-emerald-100 dark:bg-emerald-900/40 p-1 rounded-full">{isTapPay ? <DevicePhoneMobileIcon className="h-5 text-emerald-600 w-5" /> : <CreditCardIcon className="h-5 text-emerald-600 w-5" />}</div>
                    <div>
                      <p className="dark:text-white font-semibold text-gray-900 text-sm">{isTapPay ? "Tap to Pay" : "Stripe checkout"}</p>
                      <p className="dark:text-gray-400 text-gray-500 text-xs">{stripeReady ? "Payment opens in Stripe's hosted flow. No card data is stored in the app." : "Stripe is not configured for this company."}</p>
                    </div>
                  </div>
                  <div className="border border-dashed border-emerald-200 dark:border-emerald-800 rounded-xl p-1 text-sm text-gray-600 dark:text-gray-300">
                    Total: <span className="font-semibold text-gray-900 dark:text-white">${total.toFixed(2)}</span>
                  </div>
                  <button
                    onClick={handleSubmit}
                    disabled={!stripeReady || isProcessing || selectedLineCount === 0}
                    className={`w-full py-0 rounded-pill font-semibold text-white transition-all flex items-center justify-center gap-1 mt-1 ${stripeReady && !isProcessing && selectedLineCount > 0 ? "bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20" : "bg-gray-300 dark:bg-gray-700 cursor-not-allowed"}`}
                  >
                    {isProcessing ? (
                      <>
                        <div className="animate-spin border-2 border-t-white border-white/30 h-5 rounded-full w-5" />...
                      </>
                    ) : (
                      <>
                        <CheckCircleIcon className="ui-icon-5" />
                        {selectedLineCount > 0 ? "Continue to secure checkout" : "Select at least one item"}
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="py-0 text-center">
                  <div className="bg-emerald-100 dark:bg-emerald-900/50 flex h-20 items-center justify-center mb-2 mx-auto rounded-full w-20">
                    <BanknotesIcon className="app-icon app-icon--lg dark:text-emerald-400 text-emerald-600" />
                  </div>
                  <p className="dark:text-gray-400 mb-2 text-gray-600">Amount to collect</p>
                  <p className="dark:text-emerald-400 font-bold mb-2 text-4xl text-emerald-600">${total.toFixed(2)}</p>
                  <button onClick={handleSubmit} disabled={isProcessing || selectedLineCount === 0} className="bg-emerald-600 flex font-semibold gap-1 hover:bg-emerald-700 items-center justify-center py-0 rounded-pill shadow-emerald-600/20 shadow-lg text-white transition-all w-full disabled:bg-gray-300 disabled:cursor-not-allowed dark:disabled:bg-gray-700">
                    {isProcessing ? (
                      <>
                        <div className="animate-spin border-2 border-t-white border-white/30 h-5 rounded-full w-5" />...
                      </>
                    ) : (
                      <>
                        <CheckCircleIcon className="ui-icon-5" />
                        {selectedLineCount > 0 ? "Confirm" : "Select at least one item"}
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showTemplateUse && completedSaleRef.current && (
        <div className="fixed inset-0 z-50">
          <Modal_TemplateUse
            page="sales"
            entity={completedSaleRef.current}
            client={selectedClient}
            items={completedSaleRef.current.items || []}
            currentUser={currentUser}
            settings={appSettings}
            filterType={templateFilterType || "receipt"}
            onClose={() => setShowTemplateUse(false)}
          />
        </div>
      )}
    </Modal>
  );
}
