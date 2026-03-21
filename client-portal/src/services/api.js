/**
 * CLIENT PORTAL API SERVICE
 * Axios client that talks to the client-api service.
 * Same patterns as the internal app's api.js.
 */
import axios from 'axios'

const isDev = import.meta.env.DEV
const BASE   = isDev
  ? '/api/client'                                                  // Proxied by Vite dev server
  : (import.meta.env.VITE_CLIENT_API_URL || 'https://businessmanager-client-api.onrender.com/api/client')

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
  getAll: () => api.get('/companies').then(r => r.data),
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
export const catalogAPI = {
  getProducts: (params) => api.get('/catalog/products',  { params }).then(r => r.data),
  getProduct:  (id, companyId) => api.get(`/catalog/products/${id}`, { params: { company_id: companyId } }).then(r => r.data),
  getServices: (params) => api.get('/catalog/services',  { params }).then(r => r.data),
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
  getAll:   ()     => api.get('/orders').then(r => r.data),
  getOne:   (id)   => api.get(`/orders/${id}`).then(r => r.data),
  getItems: (id)   => api.get(`/orders/${id}/items`).then(r => r.data),
}

export default api
