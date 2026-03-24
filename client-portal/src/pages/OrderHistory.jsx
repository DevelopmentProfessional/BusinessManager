/**
 * ORDER HISTORY — Lists all past orders + booking history.
 */
import React, { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { ClipboardDocumentListIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import Layout from './components/Layout'
import { ordersAPI, bookingsAPI } from '../services/api'
import useStore from '../store/useStore'

const STATUS_CLS = {
  payment_pending: 'bg-warning text-dark',
  ordered: 'bg-primary',
  processing: 'bg-info text-dark',
  ready_for_pickup: 'bg-secondary',
  out_for_delivery: 'bg-dark',
  delivered: 'bg-success',
  picked_up: 'bg-success',
  confirmed: 'bg-success',
  cancelled: 'bg-danger',
  refunded:  'bg-info text-dark',
  completed: 'bg-success',
  no_show:   'bg-secondary',
}

const STATUS_LABELS = {
  payment_pending: 'Payment Pending',
  ordered: 'Ordered',
  processing: 'Processing',
  ready_for_pickup: 'Ready for Pickup',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  picked_up: 'Picked Up',
}

function parseOptions(value) {
  if (!value) return []
  if (Array.isArray(value)) return value
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function printInvoice(order, items, clientName) {
  const orderNumber = order.id.split('-')[0].toUpperCase()
  const rows = items.map((item) => {
    const optionNames = parseOptions(item.options_json)
      .map((option) => option?.option_name || option?.name)
      .filter(Boolean)
      .join(', ')
    return `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${item.item_name}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${optionNames || '-'}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.quantity}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">$${Number(item.unit_price || 0).toFixed(2)}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">$${Number(item.line_total || 0).toFixed(2)}</td>
      </tr>
    `
  }).join('')

  const popup = window.open('', '_blank', 'width=900,height=700')
  if (!popup) return

  popup.document.write(`
    <html>
      <head>
        <title>Invoice ${orderNumber}</title>
      </head>
      <body style="font-family:Arial,sans-serif;padding:32px;color:#111827;">
        <h1 style="margin:0 0 8px;">Invoice</h1>
        <div style="margin-bottom:24px;color:#4b5563;">
          <div>Order: ${orderNumber}</div>
          <div>Date: ${format(new Date(order.created_at), 'MMM d, yyyy h:mm a')}</div>
          <div>Customer: ${clientName || 'Customer'}</div>
          <div>Status: ${STATUS_LABELS[order.status] || order.status}</div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <thead>
            <tr style="text-align:left;background:#f3f4f6;">
              <th style="padding:8px;">Item</th>
              <th style="padding:8px;">Options</th>
              <th style="padding:8px;text-align:center;">Qty</th>
              <th style="padding:8px;text-align:right;">Price</th>
              <th style="padding:8px;text-align:right;">Line Total</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="margin-top:24px;display:flex;justify-content:flex-end;">
          <div style="min-width:240px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>Subtotal</span><strong>$${Number(order.subtotal || 0).toFixed(2)}</strong></div>
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>Tax</span><strong>$${Number(order.tax_amount || 0).toFixed(2)}</strong></div>
            <div style="display:flex;justify-content:space-between;font-size:18px;"><span>Total</span><strong>$${Number(order.total || 0).toFixed(2)}</strong></div>
          </div>
        </div>
      </body>
    </html>
  `)
  popup.document.close()
  popup.focus()
  popup.print()
}

export default function OrderHistory() {
  const addToast  = useStore(s => s.addToast)
  const client = useStore(s => s.client)

  const [orders,   setOrders]   = useState([])
  const [bookings, setBookings] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [tab,      setTab]      = useState('orders')
  const [expanded, setExpanded] = useState({})

  useEffect(() => {
    Promise.all([ordersAPI.getAll(), bookingsAPI.getAll()])
      .then(([o, b]) => { setOrders(o); setBookings(b) })
      .catch(() => addToast('Failed to load history.', 'error'))
      .finally(() => setLoading(false))
  }, [addToast])

  async function handleCancelBooking(id) {
    if (!window.confirm('Cancel this booking? A cancellation fee may apply.')) return
    try {
      await bookingsAPI.cancel(id)
      setBookings(b => b.map(x => x.id === id ? { ...x, status: 'cancelled' } : x))
      addToast('Booking cancelled.', 'success')
    } catch (err) {
      addToast(err.response?.data?.detail || 'Cancel failed.', 'error')
    }
  }

  function toggleExpand(id) {
    setExpanded(e => ({ ...e, [id]: !e[id] }))
  }

  async function handlePayOrder(orderId) {
    try {
      const updated = await ordersAPI.pay(orderId)
      setOrders((current) => current.map((order) => order.id === orderId ? updated : order))
      addToast('Payment recorded. Your order is now in the ordered queue.', 'success')
    } catch (err) {
      addToast(err.response?.data?.detail || 'Payment failed.', 'error')
    }
  }

  return (
    <Layout>
      <div className="p-3" style={{ paddingBottom: '5rem' }}>
        <div className="d-flex align-items-center justify-content-between mb-4">
          <h5 className="fw-bold mb-0">History</h5>
          <div className="btn-group btn-group-sm">
            {[['orders','Orders'],['bookings','Bookings']].map(([v, l]) => (
              <button
                key={v}
                className={`btn ${tab === v ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setTab(v)}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="d-flex align-items-center justify-content-center" style={{ height: 260 }}>
            <div className="spinner-border text-primary" />
          </div>
        ) : (
          <>
            {/* ── Orders ───────────────────────────────────────────── */}
            {tab === 'orders' && (
              <div>
                {orders.length === 0 && (
                  <div className="text-center text-muted py-5">
                    <ClipboardDocumentListIcon style={{ width: 48, height: 48, opacity: 0.2, margin: '0 auto 12px' }} />
                    <p className="fw-medium">No orders yet</p>
                  </div>
                )}
                {orders.map(order => (
                  <div key={order.id} className="card mb-2">
                    <div
                      className="card-body d-flex align-items-center justify-content-between"
                      style={{ cursor: 'pointer' }}
                      onClick={() => toggleExpand(order.id)}
                    >
                      <div className="d-flex align-items-center gap-3">
                        <div>
                          <p className="fw-semibold small mb-0">
                            Order #{order.id.split('-')[0].toUpperCase()}
                          </p>
                          <p className="text-muted" style={{ fontSize: '0.75rem', marginBottom: 0 }}>
                            {format(new Date(order.created_at), 'MMM d, yyyy · h:mm a')}
                          </p>
                        </div>
                        <span className={`badge ${STATUS_CLS[order.status] || 'bg-secondary'} text-capitalize`}>
                          {STATUS_LABELS[order.status] || order.status}
                        </span>
                      </div>
                      <div className="d-flex align-items-center gap-3">
                        <span className="fw-bold">${order.total?.toFixed(2)}</span>
                        {expanded[order.id]
                          ? <ChevronDownIcon style={{ width: 16, height: 16, color: '#9ca3af' }} />
                          : <ChevronRightIcon style={{ width: 16, height: 16, color: '#9ca3af' }} />
                        }
                      </div>
                    </div>
                    {expanded[order.id] && (
                      <OrderItems
                        order={order}
                        clientName={client?.full_name}
                        onPay={handlePayOrder}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ── Bookings ─────────────────────────────────────────── */}
            {tab === 'bookings' && (
              <div>
                {bookings.length === 0 && (
                  <div className="text-center text-muted py-5">
                    <ClipboardDocumentListIcon style={{ width: 48, height: 48, opacity: 0.2, margin: '0 auto 12px' }} />
                    <p className="fw-medium">No bookings yet</p>
                  </div>
                )}
                {bookings.map(b => (
                  <div key={b.id} className="card mb-2">
                    <div className="card-body d-flex align-items-center justify-content-between">
                      <div>
                        <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                          <p className="fw-semibold small mb-0">
                            {format(new Date(b.appointment_date), 'EEEE, MMM d · h:mm a')}
                          </p>
                          <span className={`badge ${STATUS_CLS[b.status] || 'bg-secondary'}`}>{b.status}</span>
                          <span className={`badge ${b.booking_mode === 'locked' ? 'bg-success' : 'bg-warning text-dark'}`}>
                            {b.booking_mode === 'locked' ? 'Locked' : 'Soft'}
                          </span>
                        </div>
                        <p className="text-muted small mb-0">{b.duration_minutes} min</p>
                        {b.cancellation_charge > 0 && (
                          <p className="small text-warning mb-0">Cancellation fee: ${b.cancellation_charge.toFixed(2)}</p>
                        )}
                        {b.refund_amount > 0 && (
                          <p className="small text-success mb-0">Refunded: ${b.refund_amount.toFixed(2)}</p>
                        )}
                      </div>
                      {['pending','confirmed'].includes(b.status) && (
                        <button
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => handleCancelBooking(b.id)}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}

// Lazy-loaded order line items
function OrderItems({ order, clientName, onPay }) {
  const [items, setItems] = useState(null)
  useEffect(() => {
    ordersAPI.getItems(order.id).then(setItems).catch(() => setItems([]))
  }, [order.id])

  if (!items) return (
    <div className="px-3 pb-3 small text-muted">Loading items…</div>
  )

  return (
    <div className="px-3 pb-3 border-top pt-3">
      <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-3">
        <div className="small text-muted">
          <div>Payment Method: {order.payment_method || 'card'}</div>
          {order.paid_at && <div>Paid: {format(new Date(order.paid_at), 'MMM d, yyyy h:mm a')}</div>}
          {order.fulfilled_at && <div>Fulfilled: {format(new Date(order.fulfilled_at), 'MMM d, yyyy h:mm a')}</div>}
        </div>
        <div className="d-flex gap-2">
          {order.status === 'payment_pending' && (
            <button className="btn btn-primary btn-sm" onClick={() => onPay(order.id)}>
              Pay Now
            </button>
          )}
          <button className="btn btn-outline-secondary btn-sm" onClick={() => printInvoice(order, items, clientName)}>
            Print Invoice
          </button>
        </div>
      </div>
      {items.map(item => (
        <div key={item.id} className="border rounded px-3 py-2 mb-2 small">
          <div className="d-flex justify-content-between gap-3">
            <div>
              <div className="fw-medium text-dark">{item.item_name}</div>
              <div className="text-muted text-capitalize">{item.item_type}</div>
              {parseOptions(item.options_json).length > 0 && (
                <div className="text-muted">
                  Options: {parseOptions(item.options_json)
                    .map((option) => option?.option_name || option?.name)
                    .filter(Boolean)
                    .join(', ')}
                </div>
              )}
            </div>
            <div className="text-end">
              <div>Qty: {item.quantity}</div>
              <div>${Number(item.unit_price || 0).toFixed(2)} each</div>
              <div className="fw-medium">${Number(item.line_total || 0).toFixed(2)}</div>
            </div>
          </div>
        </div>
      ))}
      <div className="d-flex justify-content-end pt-2 border-top mt-3">
        <div className="small" style={{ minWidth: 220 }}>
          <div className="d-flex justify-content-between mb-1"><span className="text-muted">Subtotal</span><span>${Number(order.subtotal || 0).toFixed(2)}</span></div>
          <div className="d-flex justify-content-between mb-1"><span className="text-muted">Tax</span><span>${Number(order.tax_amount || 0).toFixed(2)}</span></div>
          <div className="d-flex justify-content-between fw-bold"><span>Total</span><span>${Number(order.total || 0).toFixed(2)}</span></div>
        </div>
      </div>
    </div>
  )
}
