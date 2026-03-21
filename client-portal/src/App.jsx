import React, { useEffect, Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import useStore from './store/useStore'
import Toasts from './pages/components/Toasts'

const CompanySelect = lazy(() => import('./pages/CompanySelect'))
const Login         = lazy(() => import('./pages/Login'))
const Register      = lazy(() => import('./pages/Register'))
const Dashboard     = lazy(() => import('./pages/Dashboard'))
const Catalog       = lazy(() => import('./pages/Catalog'))
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
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function App() {
  const restoreAuth = useStore(s => s.restoreAuth)
  const restoreCart = useStore(s => s.restoreCart)

  useEffect(() => {
    restoreAuth()
    restoreCart()
  }, [])

  return (
    <BrowserRouter>
      <Toasts />
      <Suspense fallback={<Spinner />}>
        <Routes>
          {/* Public — company picker is the true landing page */}
          <Route path="/"         element={<CompanySelect />} />
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected */}
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/catalog"   element={<ProtectedRoute><Catalog /></ProtectedRoute>} />
          <Route path="/cart"      element={<ProtectedRoute><Cart /></ProtectedRoute>} />
          <Route path="/orders"    element={<ProtectedRoute><OrderHistory /></ProtectedRoute>} />
          <Route path="/account"   element={<ProtectedRoute><MyAccount /></ProtectedRoute>} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
