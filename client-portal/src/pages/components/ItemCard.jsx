/**
 * ITEM CARD — Bootstrap version mirroring the internal Sales page cards.
 */
import React from 'react'
import { PlusIcon, MinusIcon } from '@heroicons/react/24/outline'
import useStore from '../../store/useStore'

// Deterministic color from item name for the fallback tile
const COLORS = ['#7c3aed','#2563eb','#059669','#dc2626','#d97706']
function tileColor(name = '') {
  return COLORS[name.charCodeAt(0) % COLORS.length]
}

export default function ItemCard({ item, itemType = 'product', onSelect }) {
  const addToCart      = useStore(s => s.addToCart)
  const removeFromCart = useStore(s => s.removeFromCart)
  const updateCartQty  = useStore(s => s.updateCartQty)
  const cart           = useStore(s => s.cart)

  const key    = `${item.id}_${itemType}`
  const inCart = cart.find(c => c._key === key)
  const qty    = inCart?.quantity || 0

  function handleAdd(e) {
    e.stopPropagation()
    addToCart({ ...item, item_type: itemType, price: item.price })
  }
  function handleInc(e) {
    e.stopPropagation()
    updateCartQty(key, qty + 1)
  }
  function handleDec(e) {
    e.stopPropagation()
    if (qty <= 1) removeFromCart(key)
    else updateCartQty(key, qty - 1)
  }

  return (
    <div
      className={`card h-100 ${inCart ? 'border-primary' : ''}`}
      style={{ cursor: 'pointer', transition: 'box-shadow 0.15s' }}
      onClick={() => onSelect?.(item, itemType)}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.1)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = ''}
    >
      {/* Image / colour tile */}
      <div className="overflow-hidden" style={{ height: 130, borderRadius: '0.375rem 0.375rem 0 0' }}>
        {item.image_url ? (
          <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div
            className="d-flex align-items-center justify-content-center h-100"
            style={{ background: tileColor(item.name) }}
          >
            <span style={{ color: '#fff', fontSize: 32, fontWeight: 800 }}>{item.name?.[0]}</span>
          </div>
        )}
      </div>

      <div className="card-body d-flex flex-column p-2">
        {/* Info */}
        <p className="fw-semibold small mb-0 text-truncate">{item.name}</p>
        {item.category && (
          <p className="text-muted mb-0" style={{ fontSize: '0.7rem' }}>{item.category}</p>
        )}
        {itemType === 'service' && item.duration_minutes && (
          <p className="text-muted mb-0" style={{ fontSize: '0.7rem' }}>{item.duration_minutes} min</p>
        )}

        {/* Price + cart controls */}
        <div className="d-flex align-items-center justify-content-between mt-auto pt-2">
          <span className="fw-bold small">${item.price?.toFixed(2)}</span>

          {qty === 0 ? (
            <button
              className="btn btn-primary btn-sm py-0 px-2"
              style={{ fontSize: '0.72rem' }}
              onClick={handleAdd}
            >
              {itemType === 'service' ? 'Book' : 'Add'}
            </button>
          ) : (
            <div className="d-flex align-items-center gap-1" onClick={e => e.stopPropagation()}>
              <button className="btn btn-outline-secondary btn-sm px-1 py-0 lh-1" onClick={handleDec}>
                <MinusIcon style={{ width: 12, height: 12 }} />
              </button>
              <span className="fw-semibold small" style={{ minWidth: 18, textAlign: 'center' }}>{qty}</span>
              <button className="btn btn-primary btn-sm px-1 py-0 lh-1" onClick={handleInc}>
                <PlusIcon style={{ width: 12, height: 12 }} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
