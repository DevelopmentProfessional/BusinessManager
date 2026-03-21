/**
 * CLIENT PORTAL GLOBAL STATE (Zustand)
 * Cart is DB-backed — no localStorage persistence for cart data.
 * localStorage is only used for auth tokens and UI preferences.
 */
import { create } from 'zustand'
import { cartAPI } from '../services/api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function toUpsertPayload(item) {
  return {
    cart_key:   item._key,
    item_id:    item.id,
    item_type:  item.item_type || 'product',
    item_name:  item.name,
    unit_price: item.price,
    quantity:   item.quantity,
    line_total: item.price * item.quantity,
  }
}

const useStore = create((set, get) => ({

  // ── Auth ──────────────────────────────────────────────────────────────────
  client:    null,
  token:     null,
  companyId: null,

  setAuth: (client, token, companyId) => {
    set({ client, token, companyId })
    localStorage.setItem('cp_client',  JSON.stringify(client))
    localStorage.setItem('cp_token',   token)
    localStorage.setItem('cp_company', companyId)
  },
  clearAuth: () => {
    set({ client: null, token: null, companyId: null, cart: [] })
    localStorage.removeItem('cp_client')
    localStorage.removeItem('cp_token')
    localStorage.removeItem('cp_company')
  },
  restoreAuth: () => {
    const client    = JSON.parse(localStorage.getItem('cp_client') || 'null')
    const token     = localStorage.getItem('cp_token')
    const companyId = localStorage.getItem('cp_company')
    if (client && token) set({ client, token, companyId })
  },

  // ── Cart (DB-backed, no localStorage) ────────────────────────────────────
  cart: [],

  // Load cart from the server — call this after login / page restore
  loadCart: async () => {
    const { token } = get()
    if (!token) return
    try {
      const rows = await cartAPI.getAll()
      const cart = rows.map(r => ({
        _key:      r.cart_key,
        id:        r.item_id,
        name:      r.item_name,
        item_type: r.item_type,
        price:     r.unit_price,
        quantity:  r.quantity,
      }))
      set({ cart })
    } catch {
      // offline or error — leave cart empty; user will see items once back online
    }
  },

  addToCart: (item) => {
    const cart  = get().cart
    const key   = `${item.item_type || 'product'}-${item.id}`
    const existing = cart.find(c => c._key === key)
    let next
    if (existing) {
      next = cart.map(c => c._key === key ? { ...c, quantity: c.quantity + 1 } : c)
    } else {
      next = [...cart, { ...item, _key: key, quantity: 1 }]
    }
    set({ cart: next })
    const updated = next.find(c => c._key === key)
    cartAPI.upsert(toUpsertPayload(updated)).catch(() => {})
  },

  removeFromCart: (key) => {
    const next = get().cart.filter(c => c._key !== key)
    set({ cart: next })
    cartAPI.remove(key).catch(() => {})
  },

  updateCartQty: (key, quantity) => {
    if (quantity < 1) { get().removeFromCart(key); return }
    const next = get().cart.map(c => c._key === key ? { ...c, quantity } : c)
    set({ cart: next })
    const updated = next.find(c => c._key === key)
    if (updated) cartAPI.upsert(toUpsertPayload(updated)).catch(() => {})
  },

  clearCart: () => {
    set({ cart: [] })
    cartAPI.clear().catch(() => {})
  },

  // Legacy stub — no-op, kept so nothing breaks if called elsewhere
  restoreCart: () => {},

  cartTotal: () => get().cart.reduce((sum, c) => sum + c.price * c.quantity, 0),
  cartCount: () => get().cart.reduce((sum, c) => sum + c.quantity, 0),

  // ── Offline detection ─────────────────────────────────────────────────────
  isOnline: navigator.onLine,
  setOnline: (val) => set({ isOnline: val }),

  // ── Nav alignment preference ──────────────────────────────────────────────
  navAlignment: localStorage.getItem('cp_nav_align') || 'right',
  setNavAlignment: (val) => {
    set({ navAlignment: val })
    localStorage.setItem('cp_nav_align', val)
  },

  // ── Toast ─────────────────────────────────────────────────────────────────
  toasts: [],
  addToast: (message, type = 'success') => {
    const id = Date.now()
    set(s => ({ toasts: [...s.toasts, { id, message, type }] }))
    setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), 3500)
  },
}))

export default useStore
