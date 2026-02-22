import React, { useState } from 'react';
import Modal from './Modal';
import { 
  XMarkIcon, CreditCardIcon, BanknotesIcon, 
  CheckCircleIcon, ArrowLeftIcon, ShoppingCartIcon,
  UserIcon, ReceiptPercentIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';

/**
 * Modal_Checkout_Sales - A reusable checkout/payment modal component
 * Handles card and cash payments with validation and processing animation
 */
export default function Modal_Checkout_Sales({ 
  isOpen, 
  onClose, 
  cart = [], 
  cartTotal = 0, 
  selectedClient = null,
  onProcessPayment,
  taxRate = 0.08
}) {
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCVC, setCardCVC] = useState('');
  const [cardName, setCardName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  
  const subtotal = cartTotal;
  const tax = subtotal * taxRate;
  const total = subtotal + tax;
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  
  // Format card number with spaces
  const formatCardNumber = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    return parts.length ? parts.join(' ') : value;
  };
  
  // Format expiry date
  const formatExpiry = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
  };
  
  const handleCardNumberChange = (e) => {
    const formatted = formatCardNumber(e.target.value);
    if (formatted.length <= 19) setCardNumber(formatted);
  };
  
  const handleExpiryChange = (e) => {
    const formatted = formatExpiry(e.target.value.replace('/', ''));
    if (formatted.length <= 5) setCardExpiry(formatted);
  };
  
  const handleCVCChange = (e) => {
    const v = e.target.value.replace(/[^0-9]/gi, '');
    if (v.length <= 4) setCardCVC(v);
  };
  
  const isCardValid = () => {
    return cardNumber.replace(/\s/g, '').length >= 15 && 
           cardExpiry.length === 5 && 
           cardCVC.length >= 3 &&
           cardName.trim().length > 0;
  };
  
  const resetForm = () => {
    setCardNumber('');
    setCardExpiry('');
    setCardCVC('');
    setCardName('');
    setPaymentSuccess(false);
    setIsProcessing(false);
  };
  
  const handleSubmit = async () => {
    setIsProcessing(true);
    
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setIsProcessing(false);
    setPaymentSuccess(true);
    
    // Wait a moment then complete
    setTimeout(() => {
      onProcessPayment(paymentMethod);
      resetForm();
    }, 1500);
  };
  
  const handleClose = () => {
    if (!isProcessing) {
      resetForm();
      onClose();
    }
  };
  
  return (
    <Modal isOpen={isOpen} onClose={handleClose} noPadding={true} centered={true}>
      <div className="bg-white dark:bg-gray-900 w-full max-w-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-1 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-emerald-500 to-emerald-600">
          <div className="flex items-center gap-1">
            <div className="p-2 bg-white/20 rounded-lg">
              <ShoppingCartIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Checkout</h2>
              <p className="text-emerald-100 text-sm">{itemCount} items</p>
            </div>
          </div>
          <button 
            onClick={handleClose}
            disabled={isProcessing}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
          >
            <XMarkIcon className="h-5 w-5 text-white" />
          </button>
        </div>
        
        {paymentSuccess ? (
          <div className="p-1 text-center">
            <div className="w-24 h-24 mx-auto mb-1 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center animate-in zoom-in duration-300">
              <CheckCircleSolid className="h-14 w-14 text-emerald-500" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Payment Successful!</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-2">Transaction completed successfully</p>
            <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">${total.toFixed(2)}</p>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row max-h-[calc(90vh-80px)] overflow-hidden">
            {/* Order Summary */}
            <div className="md:w-2/5 p-1 bg-gray-50 dark:bg-gray-800/50 border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-1">
                <ReceiptPercentIcon className="h-5 w-5 text-gray-500" />
                Order Summary
              </h3>
              
              {selectedClient && (
                <div className="mb-1 p-1 bg-primary-50 dark:bg-primary-900/30 rounded-xl border border-primary-200 dark:border-primary-800">
                  <div className="flex items-center gap-1">
                    <UserIcon className="h-4 w-4 text-primary-500" />
                    <p className="text-xs text-primary-600 dark:text-primary-400 font-medium">Customer</p>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">{selectedClient.name}</p>
                  {selectedClient.email && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">{selectedClient.email}</p>
                  )}
                </div>
              )}
              
              <div className="space-y-1 max-h-48 overflow-y-auto mb-1 pr-1">
                {cart.map(item => (
                  <div key={item.cartKey} className="flex justify-between text-sm p-2 bg-white dark:bg-gray-800 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 dark:text-white font-medium truncate">{item.name}</p>
                      <p className="text-gray-500 dark:text-gray-400 text-xs">
                        ${item.price?.toFixed(2)} × {item.quantity}
                      </p>
                    </div>
                    <span className="font-semibold text-gray-900 dark:text-white ml-2">
                      ${(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
              
              <div className="border-t border-gray-200 dark:border-gray-700 pt-1 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
                  <span className="text-gray-900 dark:text-white">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Tax ({(taxRate * 100).toFixed(0)}%)</span>
                  <span className="text-gray-900 dark:text-white">${tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xl font-bold pt-3 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-gray-900 dark:text-white">Total</span>
                  <span className="text-emerald-600 dark:text-emerald-400">${total.toFixed(2)}</span>
                </div>
              </div>
            </div>
            
            {/* Payment Form */}
            <div className="md:w-3/5 p-1 overflow-y-auto">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Payment Method</h3>
              
              {/* Payment Method Tabs */}
              <div className="flex gap-1 mb-1">
                <button
                  onClick={() => setPaymentMethod('card')}
                  className={`flex-1 py-2 px-4 rounded-xl border-2 flex items-center justify-center gap-2 transition-all ${
                    paymentMethod === 'card' 
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' 
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <CreditCardIcon className="h-5 w-5" />
                  <span className="font-medium">Card</span>
                </button>
                <button
                  onClick={() => setPaymentMethod('cash')}
                  className={`flex-1 py-2 px-4 rounded-xl border-2 flex items-center justify-center gap-2 transition-all ${
                    paymentMethod === 'cash' 
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' 
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <BanknotesIcon className="h-5 w-5" />
                  <span className="font-medium">Cash</span>
                </button>
              </div>
              
              {paymentMethod === 'card' ? (
                <div className="space-y-2">
                  {/* Card Number */}
                  <div className="input-group">
                    <span className="input-group-text">
                      <CreditCardIcon className="h-5 w-5 text-gray-400" />
                    </span>
                    <div className="form-floating">
                      <input
                        type="text"
                        id="cardNumber"
                        value={cardNumber}
                        onChange={handleCardNumberChange}
                        placeholder="Card Number"
                        className="form-control form-control-sm"
                      />
                      <label htmlFor="cardNumber">Card Number</label>
                    </div>
                  </div>

                  {/* Cardholder Name */}
                  <div className="form-floating">
                    <input
                      type="text"
                      id="cardName"
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      placeholder="Cardholder Name"
                      className="form-control form-control-sm"
                    />
                    <label htmlFor="cardName">Cardholder Name</label>
                  </div>

                  {/* Expiry & CVC */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="form-floating">
                      <input
                        type="text"
                        id="cardExpiry"
                        value={cardExpiry}
                        onChange={handleExpiryChange}
                        placeholder="MM/YY"
                        className="form-control form-control-sm"
                      />
                      <label htmlFor="cardExpiry">Expiry Date</label>
                    </div>
                    <div className="form-floating">
                      <input
                        type="text"
                        id="cardCVC"
                        value={cardCVC}
                        onChange={handleCVCChange}
                        placeholder="CVC"
                        className="form-control form-control-sm"
                      />
                      <label htmlFor="cardCVC">CVC</label>
                    </div>
                  </div>
                  
                  <button
                    onClick={handleSubmit}
                    disabled={!isCardValid() || isProcessing}
                    className={`w-full py-4 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 mt-2 ${
                      isCardValid() && !isProcessing
                        ? 'bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20'
                        : 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
                    }`}
                  >
                    {isProcessing ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircleIcon className="h-5 w-5" />
                        Pay ${total.toFixed(2)}
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                    <BanknotesIcon className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 mb-2">Amount to collect</p>
                  <p className="text-4xl font-bold text-emerald-600 dark:text-emerald-400 mb-6">
                    ${total.toFixed(2)}
                  </p>
                  <button
                    onClick={handleSubmit}
                    disabled={isProcessing}
                    className="w-full py-4 rounded-xl font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
                  >
                    {isProcessing ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircleIcon className="h-5 w-5" />
                        Confirm Cash Payment
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
