/**
 * SHOP — Main catalog page with hero banner and modern grid layout.
 * Loads branding from the portal branding endpoint and displays a hero
 * section if configured. Search, category filter, and type tabs.
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { MagnifyingGlassIcon, ShoppingBagIcon, AdjustmentsHorizontalIcon, XMarkIcon } from '@heroicons/react/24/outline'
import Layout from './components/Layout'
import ItemCard from './components/ItemCard'
import BookingCalendar from './components/BookingCalendar'
import BookingConfirmation from './components/BookingConfirmation'
import { catalogAPI, bookingsAPI, companiesAPI } from '../services/api'
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
  const [branding, setBranding] = useState(null)

  const [search,   setSearch]   = useState('')
  const [tab,      setTab]      = useState('all')
  const [category, setCategory] = useState('all')
  const [showFilters, setShowFilters] = useState(false)

  const [bookingService,   setBookingService]   = useState(null)
  const [bookingLoading,   setBookingLoading]   = useState(false)
  const [bookingConfirmed, setBookingConfirmed] = useState(null)

  const load = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    try {
      const [prods, svcs, brand] = await Promise.all([
        catalogAPI.getProducts({ company_id: companyId }),
        catalogAPI.getServices({ company_id: companyId }),
        companiesAPI.getBranding(companyId).catch(() => null),
      ])
      setProducts(prods)
      setServices(svcs)
      if (brand) setBranding(brand)
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
  const totalShown = showProducts.length + showServices.length

  function handleSelect(item, itemType) {
    if (itemType === 'service') setBookingService(item)
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

  // Hero config from branding or defaults
  const heroBg      = branding?.portal_hero_bg_color   || '#4f46e5'
  const heroText    = branding?.portal_hero_text_color  || '#ffffff'
  const heroTitle   = branding?.portal_hero_title       || branding?.company_name || 'Welcome'
  const heroSub     = branding?.portal_hero_subtitle    || 'Browse our products and services'
  const heroTagline = branding?.portal_hero_tagline
  const showHero    = branding?.portal_show_hero !== false  // default true
  const showBanner  = branding?.portal_show_banner && branding?.portal_banner_text

  const logoSrc = branding?.has_logo_data
    ? companiesAPI.logoUrl(companyId)
    : branding?.logo_url

  const primaryColor = branding?.portal_primary_color || '#4f46e5'

  return (
    <Layout>
      <div style={{ paddingBottom: '5.5rem' }}>

        {/* ── Offline banner ─────────────────────────────────────── */}
        {!isOnline && (
          <div style={{
            background: '#fef3c7', color: '#92400e',
            padding: '10px 16px', fontSize: '0.8rem', textAlign: 'center',
            borderBottom: '1px solid #fde68a',
          }}>
            You're offline. Items added to cart will sync when you reconnect.
          </div>
        )}

        {/* ── Announcement banner ────────────────────────────────── */}
        {showBanner && (
          <div style={{
            background: branding.portal_banner_color || '#4f46e5',
            color: '#fff', padding: '8px 16px',
            fontSize: '0.8rem', textAlign: 'center', fontWeight: 500,
          }}>
            {branding.portal_banner_text}
          </div>
        )}

        {/* ── Hero section ───────────────────────────────────────── */}
        {showHero && (
          <div style={{
            background: heroBg,
            padding: '32px 20px 28px',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Hero image background */}
            {branding?.has_hero_image_data && (
              <div style={{
                position: 'absolute', inset: 0,
                backgroundImage: `url(${companiesAPI.heroImageUrl(companyId)})`,
                backgroundSize: 'cover', backgroundPosition: 'center',
                opacity: 0.35,
              }} />
            )}
            {/* decorative blobs */}
            <div style={{
              position: 'absolute', top: -40, right: -40,
              width: 180, height: 180, borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)',
            }} />
            <div style={{
              position: 'absolute', bottom: -30, left: -30,
              width: 120, height: 120, borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)',
            }} />

            <div style={{ position: 'relative' }}>
              {logoSrc && (
                <img
                  src={logoSrc}
                  alt={heroTitle}
                  style={{
                    width: 60, height: 60, borderRadius: '12px',
                    objectFit: 'contain', margin: '0 auto 12px',
                    background: 'rgba(255,255,255,0.15)',
                    padding: 6, display: 'block',
                  }}
                />
              )}
              <h1 style={{
                color: heroText, fontWeight: 800, fontSize: '1.5rem',
                margin: 0, lineHeight: 1.2,
              }}>
                {heroTitle}
              </h1>
              <p style={{
                color: `${heroText}cc`, fontSize: '0.9rem',
                margin: '6px 0 0', fontWeight: 400,
              }}>
                {heroSub}
              </p>
              {heroTagline && (
                <p style={{
                  color: `${heroText}99`, fontSize: '0.78rem',
                  margin: '4px 0 0', fontStyle: 'italic',
                }}>
                  {heroTagline}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Search + filter bar ────────────────────────────────── */}
        <div style={{
          padding: '14px 16px 10px',
          background: '#fff',
          borderBottom: '1px solid #f0f0f0',
          position: 'sticky', top: 0, zIndex: 10,
          boxShadow: '0 1px 8px rgba(0,0,0,0.05)',
        }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: 1 }}>
              <MagnifyingGlassIcon style={{
                width: 16, height: 16, position: 'absolute',
                left: 10, top: '50%', transform: 'translateY(-50%)',
                color: '#9ca3af', pointerEvents: 'none',
              }} />
              <input
                style={{
                  width: '100%', paddingLeft: 34, paddingRight: search ? 32 : 12,
                  paddingTop: 8, paddingBottom: 8,
                  fontSize: '0.85rem', border: '1.5px solid #e5e7eb',
                  borderRadius: '0.6rem', outline: 'none',
                  background: '#f9fafb', color: '#111827',
                  transition: 'border-color 0.15s',
                }}
                placeholder="Search products and services…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onFocus={e => e.target.style.borderColor = primaryColor}
                onBlur={e => e.target.style.borderColor = '#e5e7eb'}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  style={{
                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 2,
                  }}
                >
                  <XMarkIcon style={{ width: 14, height: 14 }} />
                </button>
              )}
            </div>

            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters(f => !f)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '7px 12px', borderRadius: '0.6rem',
                border: `1.5px solid ${showFilters ? primaryColor : '#e5e7eb'}`,
                background: showFilters ? `${primaryColor}15` : '#f9fafb',
                color: showFilters ? primaryColor : '#6b7280',
                fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              <AdjustmentsHorizontalIcon style={{ width: 15, height: 15 }} />
              Filter
            </button>
          </div>

          {/* Expanded filters */}
          {showFilters && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {/* Type tabs */}
              <div style={{ display: 'flex', gap: 4, background: '#f3f4f6', borderRadius: '0.5rem', padding: 3 }}>
                {[['all','All'],['products','Products'],['services','Services']].map(([v, l]) => (
                  <button
                    key={v}
                    onClick={() => setTab(v)}
                    style={{
                      padding: '4px 12px', borderRadius: '0.4rem', border: 'none',
                      background: tab === v ? '#fff' : 'transparent',
                      color: tab === v ? '#111827' : '#6b7280',
                      fontWeight: tab === v ? 600 : 400,
                      fontSize: '0.78rem', cursor: 'pointer',
                      boxShadow: tab === v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      transition: 'all 0.12s',
                    }}
                  >
                    {l}
                  </button>
                ))}
              </div>

              {/* Category */}
              {allCategories.length > 0 && (
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  style={{
                    padding: '4px 28px 4px 10px', borderRadius: '0.5rem',
                    border: '1.5px solid #e5e7eb', background: '#fff',
                    fontSize: '0.78rem', color: '#374151', cursor: 'pointer',
                    outline: 'none', appearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%239CA3AF' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center',
                    backgroundSize: 16,
                  }}
                >
                  <option value="all">All Categories</option>
                  {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </div>
          )}
        </div>

        {/* ── Content ────────────────────────────────────────────── */}
        <div style={{ padding: '16px 16px 0' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 240 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                border: `3px solid ${primaryColor}30`,
                borderTopColor: primaryColor,
                animation: 'spin 0.7s linear infinite',
              }} />
            </div>
          ) : (
            <>
              {/* Services section */}
              {showServices.length > 0 && (
                <section style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em',
                      textTransform: 'uppercase', color: '#9ca3af',
                    }}>
                      Services
                    </span>
                    <span style={{
                      background: '#f3f4f6', color: '#6b7280',
                      borderRadius: '999px', padding: '1px 8px', fontSize: '0.68rem', fontWeight: 600,
                    }}>
                      {showServices.length}
                    </span>
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(145px, 1fr))',
                    gap: 12,
                  }}>
                    {showServices.map(s => (
                      <ItemCard key={s.id} item={s} itemType="service" onSelect={handleSelect} />
                    ))}
                  </div>
                </section>
              )}

              {/* Products section */}
              {showProducts.length > 0 && (
                <section style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em',
                      textTransform: 'uppercase', color: '#9ca3af',
                    }}>
                      Products
                    </span>
                    <span style={{
                      background: '#f3f4f6', color: '#6b7280',
                      borderRadius: '999px', padding: '1px 8px', fontSize: '0.68rem', fontWeight: 600,
                    }}>
                      {showProducts.length}
                    </span>
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(145px, 1fr))',
                    gap: 12,
                  }}>
                    {showProducts.map(p => (
                      <ItemCard key={p.id} item={p} itemType="product" onSelect={handleSelect} />
                    ))}
                  </div>
                </section>
              )}

              {/* Empty state */}
              {totalShown === 0 && (
                <div style={{ textAlign: 'center', padding: '48px 16px', color: '#9ca3af' }}>
                  <ShoppingBagIcon style={{ width: 52, height: 52, margin: '0 auto 12px', opacity: 0.25 }} />
                  <p style={{ fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>No items found</p>
                  <p style={{ fontSize: '0.82rem', marginTop: 0 }}>Try adjusting your search or filters.</p>
                  {(search || tab !== 'all' || category !== 'all') && (
                    <button
                      onClick={() => { setSearch(''); setTab('all'); setCategory('all') }}
                      style={{
                        marginTop: 12, padding: '6px 16px', borderRadius: '0.5rem',
                        border: '1.5px solid #e5e7eb', background: '#fff',
                        color: '#374151', fontSize: '0.8rem', cursor: 'pointer',
                      }}
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer text from branding */}
        {branding?.portal_footer_text && (
          <p style={{
            textAlign: 'center', fontSize: '0.72rem', color: '#9ca3af',
            padding: '16px', marginTop: 8,
          }}>
            {branding.portal_footer_text}
          </p>
        )}
      </div>

      {/* Spin keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

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
