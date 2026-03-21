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
  pending:   'bg-warning text-dark',
  paid:      'bg-success',
  confirmed: 'bg-success',
  cancelled: 'bg-danger',
  refunded:  'bg-info text-dark',
  completed: 'bg-success',
  no_show:   'bg-secondary',
}

export default function OrderHistory() {
  const addToast  = useStore(s => s.addToast)

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
  }, [])

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
                          {order.status}
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
                    {expanded[order.id] && <OrderItems orderId={order.id} />}
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
function OrderItems({ orderId }) {
  const [items, setItems] = useState(null)
  useEffect(() => {
    ordersAPI.getItems(orderId).then(setItems).catch(() => setItems([]))
  }, [orderId])

  if (!items) return (
    <div className="px-3 pb-3 small text-muted">Loading items…</div>
  )

  return (
    <div className="px-3 pb-3 border-top pt-3">
      {items.map(item => (
        <div key={item.id} className="d-flex justify-content-between small">
          <span className="text-muted">{item.item_name} × {item.quantity}</span>
          <span className="fw-medium">${item.line_total?.toFixed(2)}</span>
        </div>
      ))}
    </div>
  )
}
