/**
 * CART PAGE — Persistent cart with Stripe checkout.
 * Supports both physical products and bookable services.
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

// ── Stripe payment form ───────────────────────────────────────────────────────
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
    <form onSubmit={handlePay}>
      <PaymentElement className="mb-3" />
      <button type="submit" disabled={submitting || !stripe} className="btn btn-primary w-100">
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

  const isOnline   = useStore(s => s.isOnline)

  const [checking, setChecking]         = useState(false)
  const [clientSecret, setClientSecret] = useState(null)
  const [currentOrderId, setCurrentOrderId] = useState(null)
  const [error, setError]               = useState(null)

  async function handleCheckout() {
    if (cart.length === 0) return
    setChecking(true)
    setError(null)
    try {
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
        setClientSecret(result.client_secret)
        setCurrentOrderId(result.order_id)
      } else {
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
        <div className="d-flex flex-column align-items-center justify-content-center text-muted" style={{ height: 380 }}>
          <ShoppingBagIcon style={{ width: 56, height: 56, opacity: 0.2, marginBottom: 16 }} />
          <p className="fw-medium mb-1">Your cart is empty</p>
          <p className="small mb-4">Add products or book services to get started.</p>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/shop')}>
            Browse Catalog
          </button>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="p-3" style={{ paddingBottom: '5rem' }}>
        <h5 className="fw-bold mb-4">Your Cart</h5>

        <div className="row g-3">
          {/* ── Line items ─────────────────────────────────────── */}
          <div className="col-12 col-lg-8">
            {cart.map(item => (
              <div key={item._key} className="card mb-3">
                <div className="card-body d-flex align-items-center gap-3">
                  {/* Image */}
                  <div
                    className="rounded flex-shrink-0 overflow-hidden bg-light d-flex align-items-center justify-content-center"
                    style={{ width: 60, height: 60 }}
                  >
                    {item.image_url
                      ? <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span className="fw-bold text-secondary" style={{ fontSize: 22 }}>{item.name?.[0]}</span>
                    }
                  </div>

                  {/* Info */}
                  <div className="flex-grow-1 min-w-0">
                    <p className="fw-semibold mb-0 text-truncate">{item.name}</p>
                    <p className="text-muted small text-capitalize mb-0">{item.item_type}</p>
                    {item.booking_slot && (
                      <p className="text-primary small mb-0">
                        Booked: {new Date(item.booking_slot.start).toLocaleString()}
                      </p>
                    )}
                  </div>

                  {/* Qty + price */}
                  <div className="d-flex align-items-center gap-3">
                    {item.item_type !== 'service' && (
                      <div className="d-flex align-items-center gap-1">
                        <button className="btn btn-outline-secondary btn-sm px-2 py-0"
                          onClick={() => updateCartQty(item._key, item.quantity - 1)}>−</button>
                        <span className="fw-semibold" style={{ minWidth: 20, textAlign: 'center' }}>{item.quantity}</span>
                        <button className="btn btn-outline-secondary btn-sm px-2 py-0"
                          onClick={() => updateCartQty(item._key, item.quantity + 1)}>+</button>
                      </div>
                    )}
                    <span className="fw-bold" style={{ minWidth: 70, textAlign: 'right' }}>
                      ${(item.price * item.quantity).toFixed(2)}
                    </span>
                    <button className="btn btn-link text-danger p-0" onClick={() => removeFromCart(item._key)}>
                      <TrashIcon style={{ width: 18, height: 18 }} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Summary + checkout ──────────────────────────────── */}
          <div className="col-12 col-lg-4">
            <div className="card mb-3">
              <div className="card-body">
                <h6 className="fw-semibold mb-3">Order Summary</h6>
                <div className="d-flex justify-content-between small text-muted mb-1">
                  <span>Subtotal</span>
                  <span>${cartTotal.toFixed(2)}</span>
                </div>
                <div className="d-flex justify-content-between small text-muted mb-3">
                  <span>Tax</span>
                  <span>Calculated at checkout</span>
                </div>
                <div className="d-flex justify-content-between fw-bold border-top pt-3">
                  <span>Estimated Total</span>
                  <span>${cartTotal.toFixed(2)}</span>
                </div>

                {!isOnline && (
                  <div className="alert alert-warning py-2 px-3 small mt-3 mb-0">
                    You're offline. Connect to the internet to checkout.
                  </div>
                )}

                {error && (
                  <div className="alert alert-danger py-2 px-3 small mt-3 mb-0">{error}</div>
                )}

                {!clientSecret && (
                  <button
                    className="btn btn-primary w-100 mt-3"
                    onClick={handleCheckout}
                    disabled={checking || !isOnline}
                    title={!isOnline ? 'You are offline' : undefined}
                  >
                    {checking ? 'Preparing checkout…' : 'Proceed to Checkout'}
                  </button>
                )}
              </div>
            </div>

            {/* Stripe Payment Element */}
            {clientSecret && stripePromise && (
              <div className="card">
                <div className="card-body">
                  <h6 className="fw-semibold mb-3">Payment</h6>
                  <Elements stripe={stripePromise} options={{ clientSecret }}>
                    <StripeCheckoutForm
                      clientSecret={clientSecret}
                      orderId={currentOrderId}
                      onSuccess={handlePaySuccess}
                      onError={(msg) => { setError(msg); setClientSecret(null) }}
                    />
                  </Elements>
                </div>
              </div>
            )}

            {clientSecret && !stripePromise && (
              <div className="alert alert-warning small">
                Stripe is not configured. Set VITE_STRIPE_PUBLISHABLE_KEY to enable payments.
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
