/**
 * CART PAGE — Modern cart with order review + checkout flow.
 */
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrashIcon, ShoppingBagIcon, PlusIcon, MinusIcon, ShoppingCartIcon } from '@heroicons/react/24/outline'
import Layout from './components/Layout'
import { ordersAPI, bookingsAPI } from '../services/api'
import useStore from '../store/useStore'

const GRADIENTS = [
  'linear-gradient(135deg, #6366f1, #8b5cf6)',
  'linear-gradient(135deg, #0ea5e9, #06b6d4)',
  'linear-gradient(135deg, #10b981, #14b8a6)',
  'linear-gradient(135deg, #f59e0b, #ef4444)',
]
function tileGrad(name = '') {
  return GRADIENTS[name.charCodeAt(0) % GRADIENTS.length]
}

export default function Cart() {
  const navigate       = useNavigate()
  const cart           = useStore(s => s.cart)
  const removeFromCart = useStore(s => s.removeFromCart)
  const updateCartQty  = useStore(s => s.updateCartQty)
  const clearCart      = useStore(s => s.clearCart)
  const cartTotal      = useStore(s => s.cartTotal())
  const companyId      = useStore(s => s.companyId)
  const addToast       = useStore(s => s.addToast)
  const isOnline       = useStore(s => s.isOnline)

  const [checking, setChecking]           = useState(false)
  const [currentOrderId, setCurrentOrderId] = useState(null)
  const [currentOrderTotal, setCurrentOrderTotal] = useState(null)
  const [paying, setPaying]               = useState(false)
  const [error, setError]                 = useState(null)

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
          items.push({ item_id: c.id, item_type: 'service', item_name: c.name, unit_price: c.price, quantity: 1, booking_id: booking.id })
        } else {
          items.push({ item_id: c.id, item_type: c.item_type || 'product', item_name: c.name, unit_price: c.price, quantity: c.quantity })
        }
      }
      const result = await ordersAPI.checkout({ items, payment_method: 'card' })
      setCurrentOrderId(result.order_id)
      setCurrentOrderTotal(result.total)
      clearCart()
      addToast('Order created!', 'success')
    } catch (err) {
      setError(err.response?.data?.detail || 'Checkout failed. Please try again.')
    } finally {
      setChecking(false)
    }
  }

  async function handlePayNow() {
    if (!currentOrderId) return
    setPaying(true)
    setError(null)
    try {
      await ordersAPI.pay(currentOrderId)
      addToast('Payment recorded!', 'success')
      navigate('/orders')
    } catch (err) {
      setError(err.response?.data?.detail || 'Payment failed.')
    } finally {
      setPaying(false)
    }
  }

  // Empty state
  if (cart.length === 0 && !currentOrderId) {
    return (
      <Layout>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '60px 20px', textAlign: 'center',
          color: '#9ca3af', height: '60vh',
        }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: '#f3f4f6', display: 'flex', alignItems: 'center',
            justifyContent: 'center', marginBottom: 16,
          }}>
            <ShoppingCartIcon style={{ width: 36, height: 36, opacity: 0.35 }} />
          </div>
          <p style={{ fontWeight: 700, color: '#374151', fontSize: '1rem', marginBottom: 6 }}>Your cart is empty</p>
          <p style={{ fontSize: '0.85rem', marginBottom: 20 }}>Add products or book services to get started.</p>
          <button
            onClick={() => navigate('/shop')}
            style={{
              padding: '9px 20px', background: '#4f46e5', color: '#fff',
              border: 'none', borderRadius: '0.6rem',
              fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
            }}
          >
            Browse Catalog
          </button>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div style={{ padding: '20px 16px', paddingBottom: '5.5rem', maxWidth: 600, margin: '0 auto' }}>

        <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#111827', marginBottom: 16 }}>
          Your Cart
        </h2>

        {/* ── Line items ─────────────────────────────────────── */}
        <div style={{ marginBottom: 16 }}>
          {cart.map(item => (
            <div key={item._key} style={{
              background: '#fff', borderRadius: '0.9rem',
              boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
              marginBottom: 10, padding: '12px 14px',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              {/* Thumbnail */}
              <div style={{
                width: 52, height: 52, borderRadius: '0.6rem',
                overflow: 'hidden', flexShrink: 0,
                background: item.image_url ? '#000' : tileGrad(item.name),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {item.image_url
                  ? <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ color: '#fff', fontWeight: 800, fontSize: '1.1rem' }}>{item.name?.[0]}</span>
                }
              </div>

              {/* Details */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 700, fontSize: '0.88rem', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.name}
                </p>
                <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '1px 0 0', textTransform: 'capitalize' }}>
                  {item.item_type}
                  {item.booking_slot && ` · ${new Date(item.booking_slot.start).toLocaleString()}`}
                </p>
              </div>

              {/* Qty + price + remove */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                {item.item_type !== 'service' && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: '#f3f4f6', borderRadius: '999px', padding: '3px 8px',
                  }}>
                    <button
                      onClick={() => updateCartQty(item._key, item.quantity - 1)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#6b7280', display: 'flex', alignItems: 'center' }}
                    >
                      <MinusIcon style={{ width: 12, height: 12 }} />
                    </button>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#111827', minWidth: 16, textAlign: 'center' }}>
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateCartQty(item._key, item.quantity + 1)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#6b7280', display: 'flex', alignItems: 'center' }}
                    >
                      <PlusIcon style={{ width: 12, height: 12 }} />
                    </button>
                  </div>
                )}
                <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#111827', minWidth: 58, textAlign: 'right' }}>
                  ${(item.price * (item.quantity || 1)).toFixed(2)}
                </span>
                <button
                  onClick={() => removeFromCart(item._key)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', padding: 4, display: 'flex', alignItems: 'center' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                  onMouseLeave={e => e.currentTarget.style.color = '#d1d5db'}
                >
                  <TrashIcon style={{ width: 16, height: 16 }} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* ── Summary + checkout ─────────────────────────────── */}
        {!currentOrderId && (
          <div style={{
            background: '#fff', borderRadius: '1rem',
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
            padding: '16px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#6b7280', marginBottom: 6 }}>
              <span>Subtotal</span>
              <span>${cartTotal.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#9ca3af', marginBottom: 12 }}>
              <span>Tax</span>
              <span>Calculated at checkout</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1rem', color: '#111827', paddingTop: 12, borderTop: '1px solid #f3f4f6', marginBottom: 14 }}>
              <span>Estimated Total</span>
              <span>${cartTotal.toFixed(2)}</span>
            </div>

            {!isOnline && (
              <div style={{ background: '#fef3c7', color: '#92400e', borderRadius: '0.5rem', padding: '8px 12px', fontSize: '0.78rem', marginBottom: 12 }}>
                You're offline. Connect to the internet to checkout.
              </div>
            )}

            {error && (
              <div style={{ background: '#fef2f2', color: '#dc2626', borderRadius: '0.5rem', padding: '8px 12px', fontSize: '0.78rem', marginBottom: 12 }}>
                {error}
              </div>
            )}

            <button
              onClick={handleCheckout}
              disabled={checking || !isOnline}
              style={{
                width: '100%', height: '3rem', padding: '0 1.25rem',
                background: checking || !isOnline ? '#a5b4fc' : '#4f46e5',
                color: '#fff', border: 'none', borderRadius: '999px',
                fontWeight: 700, fontSize: '0.9rem',
                cursor: checking || !isOnline ? 'not-allowed' : 'pointer',
              }}
            >
              {checking ? 'Preparing order…' : 'Order'}
            </button>
          </div>
        )}

        {/* Order ready */}
        {currentOrderId && (
          <div style={{
            background: '#fff', borderRadius: '1rem',
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
            padding: '20px',
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: '#f0fdf4', display: 'flex', alignItems: 'center',
              justifyContent: 'center', margin: '0 auto 12px',
            }}>
              <ShoppingBagIcon style={{ width: 24, height: 24, color: '#16a34a' }} />
            </div>
            <h3 style={{ textAlign: 'center', fontWeight: 800, fontSize: '1rem', color: '#111827', marginBottom: 8 }}>Order Ready</h3>
            <p style={{ textAlign: 'center', fontSize: '0.82rem', color: '#6b7280', marginBottom: 16 }}>
              Your order has been submitted. Complete payment to confirm.
            </p>
            <div style={{ background: '#f9fafb', borderRadius: '0.6rem', padding: '10px 14px', marginBottom: 16, fontSize: '0.82rem', color: '#374151' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: '#6b7280' }}>Order ID</span>
                <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{String(currentOrderId).slice(0, 8)}…</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6b7280' }}>Total</span>
                <span style={{ fontWeight: 700 }}>${Number(currentOrderTotal || 0).toFixed(2)}</span>
              </div>
            </div>

            {error && (
              <div style={{ background: '#fef2f2', color: '#dc2626', borderRadius: '0.5rem', padding: '8px 12px', fontSize: '0.78rem', marginBottom: 12 }}>
                {error}
              </div>
            )}

            <button
              onClick={handlePayNow}
              disabled={paying || !isOnline}
              style={{
                width: '100%', padding: '12px', marginBottom: 8,
                background: paying ? '#a5b4fc' : '#4f46e5',
                color: '#fff', border: 'none', borderRadius: '0.7rem',
                fontWeight: 700, fontSize: '0.9rem',
                cursor: paying ? 'not-allowed' : 'pointer',
              }}
            >
              {paying ? 'Recording payment…' : 'Pay Now'}
            </button>
            <button
              onClick={() => navigate('/orders')}
              style={{
                width: '100%', padding: '11px',
                background: 'none', color: '#6b7280',
                border: '1.5px solid #e5e7eb', borderRadius: '0.7rem',
                fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
              }}
            >
              View Order History
            </button>
          </div>
        )}
      </div>
    </Layout>
  )
}
