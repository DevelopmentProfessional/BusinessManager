/**
 * CART PAGE — Persistent cart with Stripe checkout.
 * Supports both physical products and bookable services.
 * Stripe Elements are embedded via @stripe/react-stripe-js.
 */
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrashIcon, ShoppingBagIcon } from '@heroicons/react/24/outline'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import Layout from './components/Layout'
import { ordersAPI, bookingsAPI } from '../services/api'
import useStore from '../store/useStore'

const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null

// ── Stripe payment form (shown after clientSecret is returned) ───────────────
function StripeCheckoutForm({ clientSecret, orderId, onSuccess, onError }) {
  const stripe   = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)

  async function handlePay(e) {
    e.preventDefault()
    if (!stripe || !elements) return
    setSubmitting(true)
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/orders` },
      redirect: 'if_required',
    })
    if (error) {
      onError(error.message)
      setSubmitting(false)
    } else {
      onSuccess(orderId)
    }
  }

  return (
    <form onSubmit={handlePay} className="space-y-4">
      <PaymentElement />
      <button type="submit" disabled={submitting || !stripe} className="btn-primary w-full justify-center py-3 disabled:opacity-50">
        {submitting ? 'Processing…' : 'Pay Now'}
      </button>
    </form>
  )
}

// ── Main Cart page ────────────────────────────────────────────────────────────
export default function Cart() {
  const navigate       = useNavigate()
  const cart           = useStore(s => s.cart)
  const removeFromCart = useStore(s => s.removeFromCart)
  const updateCartQty  = useStore(s => s.updateCartQty)
  const clearCart      = useStore(s => s.clearCart)
  const cartTotal      = useStore(s => s.cartTotal())
  const companyId      = useStore(s => s.companyId)
  const addToast       = useStore(s => s.addToast)

  const [checking, setChecking]     = useState(false)
  const [clientSecret, setClientSecret] = useState(null)
  const [currentOrderId, setCurrentOrderId] = useState(null)
  const [error, setError]           = useState(null)

  async function handleCheckout() {
    if (cart.length === 0) return
    setChecking(true)
    setError(null)
    try {
      // For any service cart items that have a booking_slot, create the booking first
      const items = []
      for (const c of cart) {
        if (c.item_type === 'service' && c.booking_slot) {
          const booking = await bookingsAPI.create({
            service_id:       c.id,
            appointment_date: c.booking_slot.start,
            booking_mode:     c.booking_slot.booking_mode || 'soft',
            notes:            c.notes || '',
          })
          items.push({
            item_id:    c.id,
            item_type:  'service',
            item_name:  c.name,
            unit_price: c.price,
            quantity:   1,
            booking_id: booking.id,
          })
        } else {
          items.push({
            item_id:    c.id,
            item_type:  c.item_type || 'product',
            item_name:  c.name,
            unit_price: c.price,
            quantity:   c.quantity,
          })
        }
      }

      const result = await ordersAPI.checkout({ items, payment_method: 'card' })

      if (result.client_secret) {
        // Stripe payment required
        setClientSecret(result.client_secret)
        setCurrentOrderId(result.order_id)
      } else {
        // No payment needed (e.g. soft bookings only)
        clearCart()
        addToast('Order placed successfully!', 'success')
        navigate('/orders')
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Checkout failed. Please try again.')
    } finally {
      setChecking(false)
    }
  }

  function handlePaySuccess(orderId) {
    clearCart()
    addToast('Payment successful! Your order is confirmed.', 'success')
    navigate('/orders')
  }

  if (cart.length === 0 && !clientSecret) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-96 text-gray-400">
          <ShoppingBagIcon className="w-16 h-16 mb-4 opacity-30" />
          <p className="text-lg font-medium">Your cart is empty</p>
          <p className="text-sm mt-1 mb-6">Add products or book services to get started.</p>
          <button onClick={() => navigate('/dashboard')} className="btn-primary">
            Browse Catalog
          </button>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Your Cart</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Line items ────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-3">
          {cart.map(item => (
            <div key={item._key} className="card flex items-center gap-4">
              {/* Image */}
              <div className="w-16 h-16 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden">
                {item.image_url
                  ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                      <span className="text-white font-bold">{item.name?.[0]}</span>
                    </div>
                }
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{item.name}</p>
                <p className="text-xs text-gray-400 capitalize">{item.item_type}</p>
                {item.booking_slot && (
                  <p className="text-xs text-primary mt-0.5">
                    Booked: {new Date(item.booking_slot.start).toLocaleString()}
                  </p>
                )}
              </div>

              {/* Qty + price */}
              <div className="flex items-center gap-4">
                {item.item_type !== 'service' && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateCartQty(item._key, item.quantity - 1)}
                      className="w-7 h-7 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-bold flex items-center justify-center">−</button>
                    <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                    <button onClick={() => updateCartQty(item._key, item.quantity + 1)}
                      className="w-7 h-7 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-bold flex items-center justify-center">+</button>
                  </div>
                )}
                <span className="font-bold text-gray-900 w-20 text-right">
                  ${(item.price * item.quantity).toFixed(2)}
                </span>
                <button onClick={() => removeFromCart(item._key)} className="text-gray-300 hover:text-danger transition-colors">
                  <TrashIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* ── Summary + checkout ────────────────────────────── */}
        <div className="space-y-4">
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4">Order Summary</h2>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>${cartTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax</span>
                <span>Calculated at checkout</span>
              </div>
            </div>
            <div className="border-t border-gray-100 mt-4 pt-4 flex justify-between font-bold text-gray-900">
              <span>Estimated Total</span>
              <span>${cartTotal.toFixed(2)}</span>
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-4">{error}</p>}

            {!clientSecret && (
              <button
                onClick={handleCheckout}
                disabled={checking}
                className="btn-primary w-full justify-center py-3 mt-4 disabled:opacity-50"
              >
                {checking ? 'Preparing checkout…' : 'Proceed to Checkout'}
              </button>
            )}
          </div>

          {/* Stripe Payment Element */}
          {clientSecret && stripePromise && (
            <div className="card">
              <h2 className="font-semibold text-gray-900 mb-4">Payment</h2>
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <StripeCheckoutForm
                  clientSecret={clientSecret}
                  orderId={currentOrderId}
                  onSuccess={handlePaySuccess}
                  onError={(msg) => { setError(msg); setClientSecret(null) }}
                />
              </Elements>
            </div>
          )}

          {clientSecret && !stripePromise && (
            <div className="card">
              <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3">
                Stripe is not configured. Set VITE_STRIPE_PUBLISHABLE_KEY to enable payments.
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
