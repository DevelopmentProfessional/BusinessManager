import React from 'react'
import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="d-flex flex-column align-items-center justify-content-center text-center px-3" style={{ minHeight: '100vh' }}>
      <p className="fw-black text-primary mb-3" style={{ fontSize: '5rem', opacity: 0.2 }}>404</p>
      <h5 className="fw-bold mb-1">Page Not Found</h5>
      <p className="text-muted mb-4">The page you're looking for doesn't exist.</p>
      <Link to="/shop" className="btn btn-primary">Go to Shop</Link>
    </div>
  )
}
