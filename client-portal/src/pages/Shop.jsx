/**
 * SHOP — The main page after login.
 * Products and services laid out like the internal Sales page.
 * Search, category filter, type tabs, item grid with cart controls.
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { MagnifyingGlassIcon, ShoppingBagIcon } from '@heroicons/react/24/outline'
import Layout from './components/Layout'
import ItemCard from './components/ItemCard'
import BookingCalendar from './components/BookingCalendar'
import BookingConfirmation from './components/BookingConfirmation'
import { catalogAPI, bookingsAPI } from '../services/api'
import useStore from '../store/useStore'

export default function Shop() {
  const navigate  = useNavigate()
  const companyId = useStore(s => s.companyId)
  const addToCart = useStore(s => s.addToCart)
  const addToast  = useStore(s => s.addToast)
  const isOnline  = useStore(s => s.isOnline)

  const [products, setProducts] = useState([])
  const [services, setServices] = useState([])
  const [loading,  setLoading]  = useState(true)

  const [search,   setSearch]   = useState('')
  const [tab,      setTab]      = useState('all')       // all | products | services
  const [category, setCategory] = useState('all')

  const [bookingService,   setBookingService]   = useState(null)
  const [bookingLoading,   setBookingLoading]   = useState(false)
  const [bookingConfirmed, setBookingConfirmed] = useState(null)

  const load = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    try {
      const [prods, svcs] = await Promise.all([
        catalogAPI.getProducts({ company_id: companyId }),
        catalogAPI.getServices({ company_id: companyId }),
      ])
      setProducts(prods)
      setServices(svcs)
    } catch {
      addToast('Failed to load catalog.', 'error')
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => { load() }, [load])

  const allCategories = [...new Set([
    ...products.map(p => p.category).filter(Boolean),
    ...services.map(s => s.category).filter(Boolean),
  ])].sort()

  const match = (item) =>
    item.name.toLowerCase().includes(search.toLowerCase()) &&
    (category === 'all' || item.category === category)

  const showProducts = (tab === 'all' || tab === 'products') ? products.filter(match) : []
  const showServices = (tab === 'all' || tab === 'services') ? services.filter(match) : []

  function handleSelect(item, itemType) {
    if (itemType === 'service') {
      setBookingService(item)
    }
  }

  async function handleSlotSelected(slot) {
    if (!bookingService) return
    setBookingLoading(true)
    try {
      await bookingsAPI.create({
        service_id:       bookingService.id,
        appointment_date: slot.start,
        booking_mode:     slot.booking_mode || 'soft',
        notes:            '',
      })
      const confirmed = { service: bookingService, slot }
      setBookingService(null)
      setBookingConfirmed(confirmed)
    } catch (err) {
      addToast(err?.response?.data?.detail || 'Could not book this slot. Please try again.', 'error')
    } finally {
      setBookingLoading(false)
    }
  }

  return (
    <Layout>
      <div className="p-3" style={{ paddingBottom: '5rem' }}>

        {/* ── Offline banner ──────────────────────────────────────── */}
        {!isOnline && (
          <div className="alert alert-warning py-2 px-3 small mb-3">
            You're offline. Items added to cart will sync when you reconnect.
          </div>
        )}

        {/* ── Search + filters ───────────────────────────────────── */}
        <div className="d-flex flex-wrap gap-2 mb-4">
          <div className="position-relative flex-grow-1" style={{ minWidth: 200 }}>
            <MagnifyingGlassIcon
              style={{ width: 16, height: 16, position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}
            />
            <input
              className="form-control ps-5"
              placeholder="Search products and services..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Type tabs */}
          <div className="btn-group">
            {[['all','All'],['products','Products'],['services','Services']].map(([v, l]) => (
              <button
                key={v}
                className={`btn btn-sm ${tab === v ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setTab(v)}
              >
                {l}
              </button>
            ))}
          </div>

          {/* Category */}
          {allCategories.length > 0 && (
            <select
              className="form-select form-select-sm w-auto"
              value={category}
              onChange={e => setCategory(e.target.value)}
            >
              <option value="all">All Categories</option>
              {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>

        {/* ── Grid ──────────────────────────────────────────────── */}
        {loading ? (
          <div className="d-flex justify-content-center align-items-center" style={{ height: 300 }}>
            <div className="spinner-border text-primary" />
          </div>
        ) : (
          <div>
            {/* Services */}
            {showServices.length > 0 && (
              <section className="mb-4">
                <p className="text-uppercase text-muted fw-semibold mb-2" style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}>
                  Services ({showServices.length})
                </p>
                <div className="row row-cols-2 row-cols-sm-3 row-cols-lg-4 row-cols-xl-5 g-3">
                  {showServices.map(s => (
                    <div className="col" key={s.id}>
                      <ItemCard item={s} itemType="service" onSelect={handleSelect} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Products */}
            {showProducts.length > 0 && (
              <section className="mb-4">
                <p className="text-uppercase text-muted fw-semibold mb-2" style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}>
                  Products ({showProducts.length})
                </p>
                <div className="row row-cols-2 row-cols-sm-3 row-cols-lg-4 row-cols-xl-5 g-3">
                  {showProducts.map(p => (
                    <div className="col" key={p.id}>
                      <ItemCard item={p} itemType="product" onSelect={handleSelect} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {showServices.length === 0 && showProducts.length === 0 && (
              <div className="text-center text-muted py-5">
                <ShoppingBagIcon style={{ width: 48, height: 48, opacity: 0.2, margin: '0 auto 12px' }} />
                <p className="fw-medium">No items found</p>
                <p className="small">Try adjusting your search or filters.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {bookingService && (
        <BookingCalendar
          service={bookingService}
          companyId={companyId}
          onSelect={handleSlotSelected}
          onClose={() => setBookingService(null)}
          submitting={bookingLoading}
        />
      )}

      {bookingConfirmed && (
        <BookingConfirmation
          service={bookingConfirmed.service}
          slot={bookingConfirmed.slot}
          onClose={() => setBookingConfirmed(null)}
          onViewBookings={() => { setBookingConfirmed(null); navigate('/orders') }}
        />
      )}
    </Layout>
  )
}
