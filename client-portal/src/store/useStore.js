/**
 * CLIENT PORTAL GLOBAL STATE (Zustand)
 * Same pattern as the internal app's useStore.js.
 */
import { create } from 'zustand'

const useStore = create((set, get) => ({
  // Auth
  client: null,
  token: null,
  companyId: null,

  setAuth: (client, token, companyId) => {
    set({ client, token, companyId })
    localStorage.setItem('cp_client', JSON.stringify(client))
    localStorage.setItem('cp_token', token)
    localStorage.setItem('cp_company', companyId)
  },
  clearAuth: () => {
    set({ client: null, token: null, companyId: null, cart: [] })
    localStorage.removeItem('cp_client')
    localStorage.removeItem('cp_token')
    localStorage.removeItem('cp_company')
    localStorage.removeItem('cp_cart')
  },
  restoreAuth: () => {
    const client    = JSON.parse(localStorage.getItem('cp_client') || 'null')
    const token     = localStorage.getItem('cp_token')
    const companyId = localStorage.getItem('cp_company')
    if (client && token) set({ client, token, companyId })
  },

  // Cart (persisted)
  cart: [],
  addToCart: (item) => {
    const cart = get().cart
    const key  = `${item.id}_${item.item_type}`
    const existing = cart.find(c => c._key === key)
    let next
    if (existing) {
      next = cart.map(c => c._key === key ? { ...c, quantity: c.quantity + 1 } : c)
    } else {
      next = [...cart, { ...item, _key: key, quantity: 1 }]
    }
    set({ cart: next })
    localStorage.setItem('cp_cart', JSON.stringify(next))
  },
  removeFromCart: (key) => {
    const next = get().cart.filter(c => c._key !== key)
    set({ cart: next })
    localStorage.setItem('cp_cart', JSON.stringify(next))
  },
  updateCartQty: (key, quantity) => {
    if (quantity < 1) { get().removeFromCart(key); return }
    const next = get().cart.map(c => c._key === key ? { ...c, quantity } : c)
    set({ cart: next })
    localStorage.setItem('cp_cart', JSON.stringify(next))
  },
  clearCart: () => {
    set({ cart: [] })
    localStorage.removeItem('cp_cart')
  },
  restoreCart: () => {
    const cart = JSON.parse(localStorage.getItem('cp_cart') || '[]')
    set({ cart })
  },

  cartTotal: () => get().cart.reduce((sum, c) => sum + c.price * c.quantity, 0),
  cartCount: () => get().cart.reduce((sum, c) => sum + c.quantity, 0),

  // Nav alignment preference
  navAlignment: localStorage.getItem('cp_nav_align') || 'right',
  setNavAlignment: (val) => {
    set({ navAlignment: val })
    localStorage.setItem('cp_nav_align', val)
  },

  // Toast
  toasts: [],
  addToast: (message, type = 'success') => {
    const id = Date.now()
    set(s => ({ toasts: [...s.toasts, { id, message, type }] }))
    setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), 3500)
  },
}))

export default useStore
