/**
 * ITEM CARD — Modern card design for the client portal shop.
 * Full-bleed image with gradient overlay, smooth hover, and cart controls.
 */
import React, { useState } from 'react'
import { PlusIcon, MinusIcon, ClockIcon, SparklesIcon, CubeIcon, CalendarDaysIcon } from '@heroicons/react/24/outline'
import useStore from '../../store/useStore'

// Deterministic gradient from item name
const GRADIENTS = [
  'linear-gradient(135deg, #6366f1, #8b5cf6)',
  'linear-gradient(135deg, #0ea5e9, #06b6d4)',
  'linear-gradient(135deg, #10b981, #14b8a6)',
  'linear-gradient(135deg, #f59e0b, #ef4444)',
  'linear-gradient(135deg, #ec4899, #8b5cf6)',
]
function tileGradient(name = '') {
  return GRADIENTS[name.charCodeAt(0) % GRADIENTS.length]
}

export default function ItemCard({ item, itemType = 'product', onSelect }) {
  const addToCart      = useStore(s => s.addToCart)
  const removeFromCart = useStore(s => s.removeFromCart)
  const updateCartQty  = useStore(s => s.updateCartQty)
  const cart           = useStore(s => s.cart)

  const [imgErr, setImgErr] = useState(false)

  const key    = `${item.id}_${itemType}`
  const inCart = cart.find(c => c._key === key)
  const qty    = inCart?.quantity || 0
  const isService = itemType === 'service'

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

  const showImg = item.image_url && !imgErr

  return (
    <div
      onClick={() => onSelect?.(item, itemType)}
      style={{
        position: 'relative',
        borderRadius: '1rem',
        overflow: 'hidden',
        cursor: 'pointer',
        aspectRatio: '3/4',
        background: showImg ? '#000' : tileGradient(item.name),
        boxShadow: inCart
          ? '0 0 0 2.5px #4f46e5, 0 8px 24px rgba(79,70,229,0.25)'
          : '0 2px 8px rgba(0,0,0,0.10)',
        transition: 'transform 0.18s ease, box-shadow 0.18s ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-3px)'
        e.currentTarget.style.boxShadow = inCart
          ? '0 0 0 2.5px #4f46e5, 0 16px 40px rgba(79,70,229,0.30)'
          : '0 12px 32px rgba(0,0,0,0.18)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = inCart
          ? '0 0 0 2.5px #4f46e5, 0 8px 24px rgba(79,70,229,0.25)'
          : '0 2px 8px rgba(0,0,0,0.10)'
      }}
    >
      {/* Background image */}
      {showImg && (
        <img
          src={item.image_url}
          alt={item.name}
          onError={() => setImgErr(true)}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}

      {/* Fallback icon */}
      {!showImg && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {isService
            ? <SparklesIcon style={{ width: 56, height: 56, color: 'rgba(255,255,255,0.4)' }} />
            : <CubeIcon     style={{ width: 56, height: 56, color: 'rgba(255,255,255,0.4)' }} />
          }
        </div>
      )}

      {/* Gradient overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: showImg
          ? 'linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.6) 70%, rgba(0,0,0,0.85) 100%)'
          : 'linear-gradient(to bottom, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 100%)',
      }} />

      {/* Type badge */}
      <div style={{ position: 'absolute', top: 10, left: 10 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          background: isService ? 'rgba(79,70,229,0.9)' : 'rgba(14,165,233,0.9)',
          color: '#fff', borderRadius: '999px',
          padding: '2px 8px', fontSize: '0.62rem', fontWeight: 700,
          letterSpacing: '0.05em', textTransform: 'uppercase',
          backdropFilter: 'blur(4px)',
        }}>
          {isService ? <SparklesIcon style={{ width: 10, height: 10 }} /> : <CubeIcon style={{ width: 10, height: 10 }} />}
          {isService ? 'Service' : 'Product'}
        </span>
      </div>

      {/* In-cart indicator */}
      {inCart && (
        <div style={{ position: 'absolute', top: 10, right: 10 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: '#4f46e5', color: '#fff',
            borderRadius: '999px', width: 22, height: 22,
            fontSize: '0.7rem', fontWeight: 700,
          }}>{qty}</span>
        </div>
      )}

      {/* Bottom info */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px 12px' }}>
        <p style={{
          margin: 0, color: '#fff', fontWeight: 700,
          fontSize: '0.85rem', lineHeight: 1.25,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {item.name}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: '0.9rem' }}>
              ${item.price?.toFixed(2)}
            </span>
            {isService && item.duration_minutes && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'rgba(255,255,255,0.75)', fontSize: '0.65rem' }}>
                <ClockIcon style={{ width: 10, height: 10 }} />
                {item.duration_minutes} min
              </span>
            )}
          </div>

          {/* Cart controls */}
          <div onClick={e => e.stopPropagation()}>
            {qty === 0 ? (
              <button
                onClick={handleAdd}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: '#4f46e5', color: '#fff',
                  border: 'none', borderRadius: '999px',
                  padding: '5px 12px', fontSize: '0.72rem', fontWeight: 600,
                  cursor: 'pointer', backdropFilter: 'blur(4px)',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#4338ca'}
                onMouseLeave={e => e.currentTarget.style.background = '#4f46e5'}
              >
                {isService
                  ? <><CalendarDaysIcon style={{ width: 12, height: 12 }} /> Book</>
                  : <><PlusIcon         style={{ width: 12, height: 12 }} /> Add</>
                }
              </button>
            ) : (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(255,255,255,0.95)', borderRadius: '999px',
                padding: '3px 8px',
              }}>
                <button
                  onClick={handleDec}
                  style={{
                    width: 22, height: 22, borderRadius: '50%',
                    border: '1.5px solid #d1d5db', background: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: '#374151',
                  }}
                >
                  <MinusIcon style={{ width: 10, height: 10 }} />
                </button>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#111827', minWidth: 16, textAlign: 'center' }}>
                  {qty}
                </span>
                <button
                  onClick={handleInc}
                  style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: '#4f46e5', border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: '#fff',
                  }}
                >
                  <PlusIcon style={{ width: 10, height: 10 }} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
