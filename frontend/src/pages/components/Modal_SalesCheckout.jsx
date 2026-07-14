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
 * ============================================================
 */
import React, { useState, useRef, useEffect } from "react";
import Modal from "./Modal";
import Modal_TemplateUse from "./Modal_TemplateUse";
import { clientsAPI } from "../../services/api";
import { XMarkIcon, CreditCardIcon, BanknotesIcon, CheckCircleIcon, ArrowLeftIcon, ShoppingCartIcon, UserIcon, ReceiptPercentIcon, PrinterIcon, CameraIcon, VideoCameraIcon, DevicePhoneMobileIcon } from "@heroicons/react/24/outline";
import { CheckCircleIcon as CheckCircleSolid } from "@heroicons/react/24/solid";

// ─── 1 COMPONENT DEFINITION & STATE ────────────────────────────────────────
export default function Modal_Checkout_Sales({ isOpen, onClose, cart = [], cartTotal = 0, discountAmount = 0, selectedClient = null, onProcessPayment, taxRate = 0, currentUser = null, appSettings = null, receiptSettings = null }) {
  const [paymentMethod, setPaymentMethod] = useState("card_scan");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCVC, setCardCVC] = useState("");
  const [cardName, setCardName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [showTemplateUse, setShowTemplateUse] = useState(false);
  const [templateFilterType, setTemplateFilterType] = useState(null);
  const completedSaleRef = useRef(null);

  // Camera scan state
  const [showCamera, setShowCamera] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Client email prompt (for email receipt action)
  const [showEmailPrompt, setShowEmailPrompt] = useState(false);
  const [promptEmail, setPromptEmail] = useState("");
  const [emailSaveError, setEmailSaveError] = useState("");

  const subtotal = cartTotal;
  const effectiveSubtotal = Math.max(0, subtotal - (discountAmount || 0));
  const tax = effectiveSubtotal * (taxRate / 100);
  const total = effectiveSubtotal + tax;
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const isCardScan = paymentMethod === "card_scan";
  const isTapPay = paymentMethod === "tap_pay";
  const nfcSupported = typeof window !== "undefined" && "NDEFReader" in window;

  // ─── 2 INPUT FORMATTERS ────────────────────────────────────────────────────
  // Format card number with spaces
  const formatCardNumber = (value) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || "";
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    return parts.length ? parts.join(" ") : value;
  };

  // Format expiry date
  const formatExpiry = (value) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    if (v.length >= 2) {
      return v.substring(0, 2) + "/" + v.substring(2, 4);
    }
    return v;
  };

  const handleCardNumberChange = (e) => {
    const formatted = formatCardNumber(e.target.value);
    if (formatted.length <= 19) setCardNumber(formatted);
  };

  const handleExpiryChange = (e) => {
    const formatted = formatExpiry(e.target.value.replace("/", ""));
    if (formatted.length <= 5) setCardExpiry(formatted);
  };

  const handleCVCChange = (e) => {
    const v = e.target.value.replace(/[^0-9]/gi, "");
    if (v.length <= 4) setCardCVC(v);
  };

  // ─── 3 VALIDATION & FORM HANDLERS ──────────────────────────────────────────
  const isCardValid = () => {
    return cardNumber.replace(/\s/g, "").length >= 15 && cardExpiry.length === 5 && cardCVC.length >= 3 && cardName.trim().length > 0;
  };

  const resetForm = () => {
    setCardNumber("");
    setCardExpiry("");
    setCardCVC("");
    setCardName("");
    setPaymentSuccess(false);
    setIsProcessing(false);
    setShowTemplateUse(false);
    setTemplateFilterType(null);
    completedSaleRef.current = null;
    stopCamera();
    setShowCamera(false);
    setCameraError("");
  };

  // ─── CAMERA HELPERS ────────────────────────────────────────────────────────
  const startCamera = async () => {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      setCameraError("Camera access denied or unavailable.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (showCamera) startCamera();
    else stopCamera();
    return () => stopCamera();
  }, [showCamera]);

  const captureAndParseCard = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d").drawImage(videoRef.current, 0, 0);
    // OCR not available without a library — close camera and let user type
    stopCamera();
    setShowCamera(false);
    setCameraError("");
  };

  // ─── RECEIPT ACTION HELPER ─────────────────────────────────────────────────
  const triggerReceiptAction = () => {
    if (!receiptSettings?.templateId) {
      // No template — show template selector
      setTemplateFilterType("receipt");
      setShowTemplateUse(true);
      return;
    }
    const action = receiptSettings.action || "select";
    if (action === "email") {
      const email = selectedClient?.email || "";
      if (!email) {
        setPromptEmail("");
        setShowEmailPrompt(true);
      } else {
        setTemplateFilterType("receipt");
        setShowTemplateUse(true);
      }
    } else {
      setTemplateFilterType("receipt");
      setShowTemplateUse(true);
    }
  };

  const handleSubmit = async () => {
    setIsProcessing(true);

    // Simulate payment processing
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Capture sale entity so template modal has stable data
    completedSaleRef.current = {
      id: Date.now().toString(),
      created_at: new Date().toISOString(),
      subtotal,
      tax_amount: tax,
      total,
      payment_method: paymentMethod,
    };

    setIsProcessing(false);
    setPaymentSuccess(true);
    // User clicks Done to close — no auto-close
  };

  const handleDone = () => {
    onProcessPayment(paymentMethod);
    resetForm();
  };

  const handleClose = () => {
    if (!isProcessing) {
      resetForm();
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} noPadding={true} centered={true} contentGravity="top">
      <div className="bg-white dark:bg-gray-900 h-full max-w-2xl overflow-hidden w-full">
        {/* ─── 4 MODAL HEADER ──────────────────────────────────────────────── */}
        {/* Header */}
        <div className="bg-gradient-to-r border-b border-gray-200 dark:border-gray-700 flex from-emerald-500 items-center justify-between p-1 to-emerald-600">
          <div className="ui-flex-items-gap-1">
            <div className="bg-white/20 p-1 rounded-lg">
              <ShoppingCartIcon className="h-5 text-white w-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-white">Checkout</h2>
              <p className="text-emerald-100 text-sm">{itemCount} items</p>
            </div>
          </div>
          <button onClick={handleClose} disabled={isProcessing} className="disabled:opacity-50 hover:bg-white/20 p-1 rounded-lg transition-colors">
            <XMarkIcon className="h-5 text-white w-5" />
          </button>
        </div>

        {/* ─── 5 PAYMENT SUCCESS SCREEN ────────────────────────────────────── */}
        {paymentSuccess ? (
          <div className="p-1 text-center">
            <div className="animate-in bg-emerald-100 dark:bg-emerald-900/50 duration-300 flex h-24 items-center justify-center mb-1 mx-auto rounded-full w-24 zoom-in">
              <CheckCircleSolid className="h-14 text-emerald-500 w-14" />
            </div>
            <h3 className="dark:text-white font-bold mb-1 text-2xl text-gray-900">Payment Successful!</h3>
            <p className="dark:text-gray-400 mb-1 text-gray-500">Transaction completed successfully</p>
            <p className="dark:text-emerald-400 font-bold mb-3 text-3xl text-emerald-600">${total.toFixed(2)}</p>

            {/* Receipt / Done row */}
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

            {/* Email prompt when client has no email */}
            {showEmailPrompt && (
              <div className="bg-gray-50 border dark:bg-gray-800 mt-2 p-0 rounded-xl text-left">
                <p className="dark:text-gray-300 mb-1 text-gray-700 text-sm">Client has no email on file. Enter email to send receipt:</p>
                <div className="flex gap-1">
                  <input type="email" value={promptEmail} onChange={(e) => setPromptEmail(e.target.value)} placeholder="client@email.com" className="flex-1 form-control form-control-sm" />
                  <button
                    type="button"
                    className="btn btn-emerald btn-sm"
                    onClick={() => {
                      if (!selectedClient || !promptEmail) return;
                      setEmailSaveError("");
                      clientsAPI
                        .update(selectedClient.id, { email: promptEmail })
                        .then(() => {
                          setShowEmailPrompt(false);
                          setTemplateFilterType("receipt");
                          setShowTemplateUse(true);
                        })
                        .catch(() => setEmailSaveError("Failed to save email. Please try again."));
                    }}
                    disabled={!promptEmail}
                    style={{ background: "#059669", color: "#fff", border: "none" }}
                  >
                    Send
                  </button>
                  <button
                    type="button"
                    className="btn ui-btn-outline-secondary-sm"
                    onClick={() => {
                      setShowEmailPrompt(false);
                      setEmailSaveError("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
                {emailSaveError && <p className="mb-0 mt-1 small text-danger">{emailSaveError}</p>}
              </div>
            )}
            {showTemplateUse && completedSaleRef.current && (
              <Modal_TemplateUse
                page="sales"
                entity={completedSaleRef.current}
                client={selectedClient}
                items={cart.map((item) => ({
                  item_name: item.name,
                  quantity: item.quantity,
                  unit_price: item.price,
                  line_total: item.price * item.quantity,
                  selectedOptions: item.selectedOptions ?? [],
                }))}
                currentUser={currentUser}
                settings={appSettings}
                filterType={templateFilterType}
                onClose={() => setShowTemplateUse(false)}
              />
            )}
          </div>
        ) : (
          <div className="flex flex-col max-h-[calc(90vh-80px)] md:flex-row overflow-hidden">
            {/* ─── 6 ORDER SUMMARY PANEL ───────────────────────────────────── */}
            {/* Order Summary */}
            <div className="bg-gray-50 border-b border-gray-200 dark:bg-gray-800/50 dark:border-gray-700 md:border-b-0 md:border-r md:w-2/5 overflow-y-auto p-1">
              <h3 className="dark:text-white flex font-semibold gap-1 items-center mb-1 text-gray-900">
                <ReceiptPercentIcon className="h-5 text-gray-500 w-5" />
                Order Summary
              </h3>

              {selectedClient && (
                <div className="bg-primary-50 border border-primary-200 dark:bg-primary-900/30 dark:border-primary-800 mb-1 p-1 rounded-xl">
                  <div className="ui-flex-items-gap-1">
                    <UserIcon className="h-4 text-primary-500 w-4" />
                    <p className="dark:text-primary-400 font-medium text-primary-600 text-xs">Customer</p>
                  </div>
                  <p className="dark:text-white font-semibold mt-1 text-gray-900 text-sm">{selectedClient.name}</p>
                  {selectedClient.email && <p className="ui-muted-xs">{selectedClient.email}</p>}
                </div>
              )}

              <div className="max-h-48 mb-1 overflow-y-auto pr-1 space-y-1">
                {cart.map((item) => (
                  <div key={item.cartKey} className="bg-white dark:bg-gray-800 flex justify-between p-1 rounded-lg text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="dark:text-white font-medium text-gray-900 truncate">{item.name}</p>
                      {item.selectedOptions?.length > 0 && <p className="dark:text-indigo-400 mt-0.5 text-indigo-600 text-xs">{item.selectedOptions.map((o) => `${o.featureName}: ${o.optionName}`).join(" · ")}</p>}
                      <p className="ui-muted-xs">
                        ${item.price?.toFixed(2)} × {item.quantity}
                      </p>
                    </div>
                    <span className="dark:text-white font-semibold ml-2 text-gray-900">${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="border-gray-200 border-t dark:border-gray-700 pt-1 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="dark:text-gray-400 text-gray-500">Subtotal</span>
                  <span className="dark:text-white text-gray-900">${subtotal.toFixed(2)}</span>
                </div>
                {(discountAmount || 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="dark:text-gray-400 text-gray-500">Discount</span>
                    <span className="dark:text-red-400 text-red-600">-${(discountAmount || 0).toFixed(2)}</span>
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

            {/* ─── 7 PAYMENT FORM ──────────────────────────────────────────── */}
            {/* Payment Form */}
            <div className="md:w-3/5 overflow-y-auto p-1">
              <h3 className="dark:text-white font-semibold mb-1 text-gray-900">Payment Method</h3>

              {/* ─── 8 PAYMENT METHOD TABS ───────────────────────────────── */}
              {/* Payment Method Tabs */}
              <div className="flex gap-1 mb-1">
                <button
                  onClick={() => setPaymentMethod("card_scan")}
                  className={`flex-1 py-1 px-0 rounded-xl border-2 flex items-center justify-center gap-1 transition-all ${
                    isCardScan ? "border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300" : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  <CreditCardIcon className="ui-icon-5" />
                  <span className="font-medium">Card Scan</span>
                </button>
                <button
                  onClick={() => setPaymentMethod("tap_pay")}
                  className={`flex-1 py-1 px-0 rounded-xl border-2 flex items-center justify-center gap-1 transition-all ${
                    isTapPay ? "border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300" : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  <DevicePhoneMobileIcon className="ui-icon-5" />
                  <span className="font-medium">Tap Pay</span>
                </button>
                <button
                  onClick={() => setPaymentMethod("cash")}
                  className={`flex-1 py-1 px-0 rounded-xl border-2 flex items-center justify-center gap-1 transition-all ${
                    paymentMethod === "cash" ? "border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300" : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  <BanknotesIcon className="ui-icon-5" />
                  <span className="font-medium">Cash</span>
                </button>
              </div>

              {isCardScan ? (
                <div className="space-y-1">
                  {/* Card Number */}
                  <div className="input-group">
                    <span className="input-group-text">
                      <CreditCardIcon className="h-5 text-gray-400 w-5" />
                    </span>
                    <div className="flex-1 form-floating">
                      <input type="text" id="cardNumber" value={cardNumber} onChange={handleCardNumberChange} placeholder="Card Number" className="form-control ui-control-sm" />
                      <label htmlFor="cardNumber">Card Number</label>
                    </div>
                    <button type="button" onClick={() => setShowCamera(true)} className="btn ui-btn-outline-secondary-sm" title="Scan card with camera">
                      <CameraIcon className="ui-icon-5" />
                    </button>
                  </div>

                  {/* Camera modal */}
                  {showCamera && (
                    <div className="bg-black border overflow-hidden relative rounded-xl">
                      <div className="bg-gray-900 flex items-center justify-between px-0 py-1">
                        <span className="flex gap-1 items-center text-white text-xs">
                          <VideoCameraIcon className="ui-icon-4" /> Point camera at card
                        </span>
                        <button type="button" onClick={() => setShowCamera(false)} className="hover:text-gray-300 text-white">
                          <XMarkIcon className="ui-icon-4" />
                        </button>
                      </div>
                      {cameraError ? (
                        <div className="p-1 text-center text-red-400 text-sm">{cameraError}</div>
                      ) : (
                        <>
                          <video ref={videoRef} className="w-full" playsInline muted style={{ maxHeight: "200px", objectFit: "cover" }} />
                          {/* Card outline guide */}
                          <div className="absolute flex inset-0 items-center justify-center pointer-events-none" style={{ top: "2rem" }}>
                            <div className="border-2 border-white/70 rounded-xl" style={{ width: "85%", height: "55%" }} />
                          </div>
                          <div className="bg-gray-900 flex gap-1 p-1">
                            <button type="button" onClick={captureAndParseCard} className="btn btn-sm flex-1 text-white" style={{ background: "#059669", border: "none" }}>
                              <CameraIcon className="h-4 inline me-1 w-4" /> Capture
                            </button>
                            <button type="button" onClick={() => setShowCamera(false)} className="border-gray-600 btn btn-outline-secondary btn-sm text-white">
                              Cancel
                            </button>
                          </div>
                          <p className="pb-1 text-center text-gray-400 text-xs">After capture, verify and adjust the fields manually.</p>
                        </>
                      )}
                    </div>
                  )}

                  {/* Cardholder Name */}
                  <div className="form-floating">
                    <input type="text" id="cardName" value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder="Cardholder Name" className="form-control ui-control-sm" />
                    <label htmlFor="cardName">Cardholder Name</label>
                  </div>

                  {/* Expiry & CVC */}
                  <div className="gap-4 grid grid-cols-2">
                    <div className="form-floating">
                      <input type="text" id="cardExpiry" value={cardExpiry} onChange={handleExpiryChange} placeholder="MM/YY" className="form-control ui-control-sm" />
                      <label htmlFor="cardExpiry">Expiry Date</label>
                    </div>
                    <div className="form-floating">
                      <input type="text" id="cardCVC" value={cardCVC} onChange={handleCVCChange} placeholder="CVC" className="form-control ui-control-sm" />
                      <label htmlFor="cardCVC">CVC</label>
                    </div>
                  </div>

                  <button
                    onClick={handleSubmit}
                    disabled={!isCardValid() || isProcessing}
                    className={`w-full py-0 rounded-pill font-semibold text-white transition-all flex items-center justify-center gap-1 mt-1 ${isCardValid() && !isProcessing ? "bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20" : "bg-gray-300 dark:bg-gray-700 cursor-not-allowed"}`}
                  >
                    {isProcessing ? (
                      <>
                        <div className="animate-spin border-2 border-t-white border-white/30 h-5 rounded-full w-5" />…
                      </>
                    ) : (
                      <>
                        <CheckCircleIcon className="ui-icon-5" />
                        Pay ${total.toFixed(2)}
                      </>
                    )}
                  </button>
                </div>
              ) : isTapPay ? (
                <div className="py-0 text-center">
                  <div className="bg-indigo-100 dark:bg-indigo-900/50 flex h-20 items-center justify-center mb-2 mx-auto rounded-full w-20">
                    <DevicePhoneMobileIcon className="app-icon app-icon--lg dark:text-indigo-400 text-indigo-600" />
                  </div>
                  <p className="dark:text-gray-400 mb-1 text-gray-600">Tap customer card or device to continue</p>
                  <p className="dark:text-gray-400 mb-2 text-gray-500 text-xs">{nfcSupported ? "NFC-ready device detected." : "NFC hardware may be unavailable in this browser/device. You can still complete payment manually."}</p>
                  <p className="dark:text-emerald-400 font-bold mb-2 text-4xl text-emerald-600">${total.toFixed(2)}</p>
                  <button onClick={handleSubmit} disabled={isProcessing} className="bg-emerald-600 flex font-semibold gap-1 hover:bg-emerald-700 items-center justify-center py-0 rounded-pill shadow-emerald-600/20 shadow-lg text-white transition-all w-full">
                    {isProcessing ? (
                      <>
                        <div className="animate-spin border-2 border-t-white border-white/30 h-5 rounded-full w-5" />…
                      </>
                    ) : (
                      <>
                        <CheckCircleIcon className="ui-icon-5" />
                        Charge ${total.toFixed(2)}
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
                  <button onClick={handleSubmit} disabled={isProcessing} className="bg-emerald-600 flex font-semibold gap-1 hover:bg-emerald-700 items-center justify-center py-0 rounded-pill shadow-emerald-600/20 shadow-lg text-white transition-all w-full">
                    {isProcessing ? (
                      <>
                        <div className="animate-spin border-2 border-t-white border-white/30 h-5 rounded-full w-5" />…
                      </>
                    ) : (
                      <>
                        <CheckCircleIcon className="ui-icon-5" />
                        Confirm
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
