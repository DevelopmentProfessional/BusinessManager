/**
 * ORDER HISTORY — Lists all past orders + booking history.
 * Same table/card patterns as the internal app's transaction history.
 */
import React, { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { ClipboardDocumentListIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import Layout from './components/Layout'
import { ordersAPI, bookingsAPI } from '../services/api'
import useStore from '../store/useStore'

const STATUS_BADGE = {
  pending:   'badge-amber',
  paid:      'badge-green',
  confirmed: 'badge-green',
  cancelled: 'badge-red',
  refunded:  'badge-blue',
  completed: 'badge-green',
  no_show:   'badge-gray',
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">History</h1>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm font-medium">
          {[['orders','Orders'],['bookings','Bookings']].map(([v, l]) => (
            <button key={v} onClick={() => setTab(v)}
              className={`px-5 py-2 transition-colors ${tab === v ? 'bg-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ── Orders ─────────────────────────────────────────── */}
          {tab === 'orders' && (
            <div className="space-y-3">
              {orders.length === 0 && (
                <div className="text-center py-20 text-gray-400">
                  <ClipboardDocumentListIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-lg font-medium">No orders yet</p>
                </div>
              )}
              {orders.map(order => (
                <div key={order.id} className="card">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => toggleExpand(order.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">
                          Order #{order.id.split('-')[0].toUpperCase()}
                        </p>
                        <p className="text-xs text-gray-400">
                          {format(new Date(order.created_at), 'MMM d, yyyy · h:mm a')}
                        </p>
                      </div>
                      <span className={`badge ${STATUS_BADGE[order.status] || 'badge-gray'}`}>
                        {order.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-gray-900">${order.total?.toFixed(2)}</span>
                      {expanded[order.id]
                        ? <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                        : <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                      }
                    </div>
                  </div>

                  {expanded[order.id] && <OrderItems orderId={order.id} />}
                </div>
              ))}
            </div>
          )}

          {/* ── Bookings ────────────────────────────────────────── */}
          {tab === 'bookings' && (
            <div className="space-y-3">
              {bookings.length === 0 && (
                <div className="text-center py-20 text-gray-400">
                  <ClipboardDocumentListIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-lg font-medium">No bookings yet</p>
                </div>
              )}
              {bookings.map(b => (
                <div key={b.id} className="card flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <p className="font-semibold text-gray-900 text-sm">
                        {format(new Date(b.appointment_date), 'EEEE, MMM d · h:mm a')}
                      </p>
                      <span className={`badge ${STATUS_BADGE[b.status] || 'badge-gray'}`}>{b.status}</span>
                      <span className={`badge ${b.booking_mode === 'locked' ? 'badge-green' : 'badge-amber'}`}>
                        {b.booking_mode === 'locked' ? 'Locked' : 'Soft'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">{b.duration_minutes} min</p>
                    {b.cancellation_charge > 0 && (
                      <p className="text-xs text-amber-600 mt-1">Cancellation fee: ${b.cancellation_charge.toFixed(2)}</p>
                    )}
                    {b.refund_amount > 0 && (
                      <p className="text-xs text-green-600 mt-1">Refunded: ${b.refund_amount.toFixed(2)}</p>
                    )}
                  </div>
                  {['pending','confirmed'].includes(b.status) && (
                    <button
                      onClick={() => handleCancelBooking(b.id)}
                      className="btn-danger text-xs py-1.5 px-3"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Layout>
  )
}

// Lazy-loaded order line items
function OrderItems({ orderId }) {
  const [items, setItems] = useState(null)
  useEffect(() => {
    ordersAPI.getItems(orderId).then(setItems).catch(() => setItems([]))
  }, [orderId])

  if (!items) return <div className="mt-3 text-sm text-gray-400">Loading items…</div>

  return (
    <div className="mt-4 border-t border-gray-100 pt-4 space-y-2">
      {items.map(item => (
        <div key={item.id} className="flex justify-between text-sm">
          <span className="text-gray-700">{item.item_name} × {item.quantity}</span>
          <span className="font-medium text-gray-900">${item.line_total?.toFixed(2)}</span>
        </div>
      ))}
    </div>
  )
}
