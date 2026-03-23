import React, { useEffect, Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import useStore from './store/useStore'
import ErrorBoundary from './components/ErrorBoundary'
import Toasts from './pages/components/Toasts'

const CompanySelect = lazy(() => import('./pages/CompanySelect'))
const Login         = lazy(() => import('./pages/Login'))
const Register      = lazy(() => import('./pages/Register'))
const Shop          = lazy(() => import('./pages/Shop'))
const MyAccount     = lazy(() => import('./pages/MyAccount'))
const Cart          = lazy(() => import('./pages/Cart'))
const OrderHistory  = lazy(() => import('./pages/OrderHistory'))
const NotFound      = lazy(() => import('./pages/NotFound'))

function ProtectedRoute({ children }) {
  const token = useStore(s => s.token)
  if (!token) return <Navigate to="/" replace />
  return children
}

function Spinner() {
  return (
    <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
      <div className="spinner-border text-primary" />
    </div>
  )
}

export default function App() {
  const restoreAuth = useStore(s => s.restoreAuth)
  const loadCart    = useStore(s => s.loadCart)
  const setOnline   = useStore(s => s.setOnline)

  useEffect(() => {
    restoreAuth()
    loadCart()

    const onOnline  = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online',  onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online',  onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Toasts />
        <Suspense fallback={<Spinner />}>
          <Routes>
            {/* Public — company picker is the true landing page */}
            <Route path="/"         element={<CompanySelect />} />
            <Route path="/login"    element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected */}
            <Route path="/shop"      element={<ProtectedRoute><Shop /></ProtectedRoute>} />
            <Route path="/dashboard" element={<Navigate to="/shop" replace />} />
            <Route path="/catalog"   element={<Navigate to="/shop" replace />} />
            <Route path="/cart"      element={<ProtectedRoute><Cart /></ProtectedRoute>} />
            <Route path="/orders"    element={<ProtectedRoute><OrderHistory /></ProtectedRoute>} />
            <Route path="/account"   element={<ProtectedRoute><MyAccount /></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
