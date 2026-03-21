/**
 * DASHBOARD — The FIRST page after login.
 * This IS the sales/catalog page — same product & service browsing experience
 * as the internal Sales.jsx, but adapted for the client portal.
 *
 * Per requirements: "After login, the VERY FIRST page must be the exact
 * existing sales page (reused as dashboard/home)."
 *
 * Reuses: ItemCard (mirrors Sales.jsx ItemCard), same filter UI,
 * same two-column grid, same cart integration.
 */
import React, { useState, useEffect, useCallback } from 'react'
import { MagnifyingGlassIcon, ShoppingCartIcon } from '@heroicons/react/24/outline'
import { useNavigate } from 'react-router-dom'
import Layout from './components/Layout'
import ItemCard from './components/ItemCard'
import BookingCalendar from './components/BookingCalendar'
import { catalogAPI } from '../services/api'
import useStore from '../store/useStore'

export default function Dashboard() {
  const navigate     = useNavigate()
  const companyId    = useStore(s => s.companyId)
  const cartCount    = useStore(s => s.cartCount())
  const addToast     = useStore(s => s.addToast)
  const addToCart    = useStore(s => s.addToCart)

  const [products,       setProducts]       = useState([])
  const [services,       setServices]       = useState([])
  const [loading,        setLoading]        = useState(true)
  const [search,         setSearch]         = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [activeTab,      setActiveTab]      = useState('all')
  const [bookingService, setBookingService] = useState(null)

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

  // Derived filter lists
  const allCategories = [...new Set([
    ...products.map(p => p.category).filter(Boolean),
    ...services.map(s => s.category).filter(Boolean),
  ])].sort()

  const filteredProducts = products.filter(p =>
    (activeTab === 'all' || activeTab === 'products') &&
    (categoryFilter === 'all' || p.category === categoryFilter) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  )
  const filteredServices = services.filter(s =>
    (activeTab === 'all' || activeTab === 'services') &&
    (categoryFilter === 'all' || s.category === categoryFilter) &&
    s.name.toLowerCase().includes(search.toLowerCase())
  )

  function handleItemSelect(item, itemType) {
    if (itemType === 'service') {
      setBookingService(item)   // Opens booking calendar
    }
  }

  function handleSlotSelected(slot) {
    if (!bookingService) return
    addToCart({
      ...bookingService,
      item_type: 'service',
      price: bookingService.price,
      booking_slot: slot,
    })
    setBookingService(null)
    addToast(`${bookingService.name} added to cart.`, 'success')
  }

  return (
    <Layout>
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Browse & Shop</h1>
          <p className="text-sm text-gray-500 mt-0.5">Products, services, and bookings</p>
        </div>
        <button
          onClick={() => navigate('/cart')}
          className="relative btn-secondary"
        >
          <ShoppingCartIcon className="w-5 h-5" />
          Cart
          {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
        </button>
      </div>

      {/* ── Filters ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="form-input pl-9"
            placeholder="Search products & services…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Tab filter */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm font-medium">
          {[['all','All'],['products','Products'],['services','Services']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setActiveTab(val)}
              className={`px-4 py-2 transition-colors ${activeTab === val ? 'bg-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Category */}
        <select
          className="form-input w-auto"
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
        >
          <option value="all">All Categories</option>
          {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* ── Grid ────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Services */}
          {filteredServices.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Services ({filteredServices.length})
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {filteredServices.map(s => (
                  <ItemCard
                    key={s.id}
                    item={s}
                    itemType="service"
                    onSelect={handleItemSelect}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Products */}
          {filteredProducts.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Products ({filteredProducts.length})
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {filteredProducts.map(p => (
                  <ItemCard
                    key={p.id}
                    item={p}
                    itemType="product"
                    onSelect={handleItemSelect}
                  />
                ))}
              </div>
            </section>
          )}

          {filteredProducts.length === 0 && filteredServices.length === 0 && (
            <div className="text-center py-20 text-gray-400">
              <p className="text-lg font-medium">No items found</p>
              <p className="text-sm mt-1">Try adjusting your search or filters.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Booking Calendar Modal ───────────────────────────────── */}
      {bookingService && (
        <BookingCalendar
          service={bookingService}
          companyId={companyId}
          onSelect={handleSlotSelected}
          onClose={() => setBookingService(null)}
        />
      )}
    </Layout>
  )
}
