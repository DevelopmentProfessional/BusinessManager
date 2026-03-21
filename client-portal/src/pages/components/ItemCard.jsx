/**
 * ITEM CARD
 * Directly mirrors the ItemCard component from the internal Sales.jsx.
 * Same visual structure, same hover animations, same cart controls.
 */
import React from 'react'
import { PlusIcon, MinusIcon } from '@heroicons/react/24/outline'
import useStore from '../../store/useStore'

const GRADIENTS = [
  'from-violet-500 to-purple-600',
  'from-sky-500 to-blue-600',
  'from-emerald-500 to-green-600',
  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600',
]

function gradient(name = '') {
  const idx = name.charCodeAt(0) % GRADIENTS.length
  return GRADIENTS[idx]
}

export default function ItemCard({ item, itemType = 'product', onSelect }) {
  const addToCart   = useStore(s => s.addToCart)
  const removeFromCart = useStore(s => s.removeFromCart)
  const updateCartQty  = useStore(s => s.updateCartQty)
  const cart        = useStore(s => s.cart)

  const key      = `${item.id}_${itemType}`
  const inCart   = cart.find(c => c._key === key)
  const qty      = inCart?.quantity || 0

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
      className={[
        'card flex flex-col cursor-pointer select-none transition-all duration-150',
        'hover:shadow-md hover:-translate-y-0.5',
        inCart ? 'ring-2 ring-primary/40' : '',
      ].join(' ')}
      onClick={() => onSelect?.(item, itemType)}
    >
      {/* Image / gradient fallback */}
      <div className="rounded-lg overflow-hidden h-36 mb-3 flex-shrink-0">
        {item.image_url ? (
          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradient(item.name)} flex items-center justify-center`}>
            <span className="text-white text-3xl font-bold">{item.name?.[0]}</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm truncate">{item.name}</p>
        {item.category && (
          <p className="text-xs text-gray-400 truncate">{item.category}</p>
        )}
        {itemType === 'service' && item.duration_minutes && (
          <p className="text-xs text-gray-400">{item.duration_minutes} min</p>
        )}
      </div>

      {/* Price + cart controls */}
      <div className="flex items-center justify-between mt-3">
        <span className="font-bold text-gray-900">${item.price?.toFixed(2)}</span>

        {qty === 0 ? (
          <button
            onClick={handleAdd}
            className="btn-primary py-1 px-3 text-xs"
          >
            {itemType === 'service' ? 'Book' : 'Add'}
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <button onClick={handleDec} className="btn-secondary p-1 rounded-lg">
              <MinusIcon className="w-3.5 h-3.5" />
            </button>
            <span className="w-6 text-center text-sm font-semibold">{qty}</span>
            <button onClick={handleInc} className="btn-primary p-1 rounded-lg">
              <PlusIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
