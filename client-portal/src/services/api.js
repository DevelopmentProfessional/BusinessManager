/**
 * CLIENT PORTAL API SERVICE
 * Axios client that talks to the client-api service.
 * Same patterns as the internal app's api.js.
 */
import axios from 'axios'

function normalizeClientApiBase(rawBase) {
  const fallback = 'https://businessmanager-client-api.onrender.com/api/client'
  const trimmed = String(rawBase || '').trim()

  if (!trimmed) return fallback

  // Guard: if the URL points at the portal itself (same origin), fall back to
  // the hardcoded client-api URL so we don't recurse into ourselves.
  try {
    const parsed = new URL(trimmed.endsWith('/api/client') ? trimmed : `${trimmed}/api/client`)
    if (typeof window !== 'undefined' && parsed.origin === window.location.origin) {
      console.warn('[api] VITE_CLIENT_API_URL appears to point at the portal itself. Using fallback:', fallback)
      return fallback
    }
  } catch { /* ignore parse errors */ }

  if (trimmed.endsWith('/api/client')) return trimmed
  if (trimmed.endsWith('/api/client/')) return trimmed.slice(0, -1)
  return `${trimmed.replace(/\/+$/, '')}/api/client`
}

const isDev = import.meta.env.DEV
const CLIENT_API_BASE = normalizeClientApiBase(import.meta.env.VITE_CLIENT_API_URL)
const BASE   = isDev
  ? '/api/client'                                                  // Proxied by Vite dev server
  : CLIENT_API_BASE

const api = axios.create({
  baseURL: BASE,
  timeout: 30_000,
})

// Attach auth token on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cp_token')
  if (token) config.headers['Authorization'] = `Bearer ${token}`
  return config
})

// Handle 401 — token expired → redirect to login
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('cp_token')
      localStorage.removeItem('cp_client')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── Companies (public) ───────────────────────────────────────────────────────
export const companiesAPI = {
  getBranding: async (companyId) => {
    const res = await fetch(`${BASE}/companies/${encodeURIComponent(companyId)}/branding`, {
      cache: 'default',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null
    try { return await res.json() } catch { return null }
  },
  heroImageUrl: (companyId) => `${BASE}/companies/${encodeURIComponent(companyId)}/hero-image`,
  getAll: async () => {
    const response = await fetch(`${BASE}/companies?t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Could not load businesses (${response.status} from ${BASE}/companies).`)
    }

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      throw new Error(
        `Expected JSON from ${BASE}/companies but got "${contentType || 'no content-type'}". ` +
        `Check that the client-api server is running and VITE_CLIENT_API_URL is set correctly.`
      )
    }

    const data = await response.json()
    if (Array.isArray(data)) return data
    if (Array.isArray(data?.data)) return data.data
    if (Array.isArray(data?.results)) return data.results
    if (Array.isArray(data?.items)) return data.items
    if (Array.isArray(data?.companies)) return data.companies
    if (data && typeof data === 'object') {
      const firstArray = Object.values(data).find((value) => Array.isArray(value))
      if (Array.isArray(firstArray)) return firstArray
    }
    return []
  },
  logoUrl: (companyId) => `${BASE}/companies/${companyId}/logo`,
}

// ── Auth ─────────────────────────────────────────────────────────────────────
export const authAPI = {
  register: (data)   => api.post('/auth/register', data).then(r => r.data),
  login:    (data)   => api.post('/auth/login',    data).then(r => r.data),
  me:       ()       => api.get('/auth/me').then(r => r.data),
  updateMe: (data)   => api.patch('/auth/me', data).then(r => r.data),
}

// ── Catalog ───────────────────────────────────────────────────────────────────
function toArray(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.items))   return data.items
  if (Array.isArray(data?.data))    return data.data
  if (Array.isArray(data?.results)) return data.results
  return []
}

export const catalogAPI = {
  getProducts: (params) => api.get('/catalog/products',  { params }).then(r => toArray(r.data)),
  getProduct:  (id, companyId) => api.get(`/catalog/products/${id}`, { params: { company_id: companyId } }).then(r => r.data),
  getServices: (params) => api.get('/catalog/services',  { params }).then(r => toArray(r.data)),
  getService:  (id, companyId) => api.get(`/catalog/services/${id}`, { params: { company_id: companyId } }).then(r => r.data),
  getAvailability: (serviceId, companyId, params = {}) =>
    api.get(`/catalog/services/${serviceId}/availability`, { params: { company_id: companyId, ...params } }).then(r => r.data),
}

// ── Cart (DB-backed) ──────────────────────────────────────────────────────────
export const cartAPI = {
  getAll:     ()       => api.get('/cart').then(r => r.data),
  upsert:     (item)   => api.put('/cart/item', item).then(r => r.data),
  remove:     (key)    => api.delete(`/cart/item/${encodeURIComponent(key)}`).then(r => r.data),
  clear:      ()       => api.delete('/cart').then(r => r.data),
}

// ── Bookings ──────────────────────────────────────────────────────────────────
export const bookingsAPI = {
  create: (data)   => api.post('/bookings', data).then(r => r.data),
  getAll: ()       => api.get('/bookings').then(r => r.data),
  getOne: (id)     => api.get(`/bookings/${id}`).then(r => r.data),
  cancel: (id)     => api.patch(`/bookings/${id}/cancel`).then(r => r.data),
}

// ── Orders ────────────────────────────────────────────────────────────────────
export const ordersAPI = {
  checkout: (data) => api.post('/orders/checkout', data).then(r => r.data),
  pay:      (id)   => api.post(`/orders/${id}/pay`).then(r => r.data),
  getAll:   ()     => api.get('/orders').then(r => r.data),
  getOne:   (id)   => api.get(`/orders/${id}`).then(r => r.data),
  getItems: (id)   => api.get(`/orders/${id}/items`).then(r => r.data),
}

export default api
