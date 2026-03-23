/**
 * CLIENT PORTAL LAYOUT
 * Mirrors the internal app's Layout.jsx exactly:
 *   - Fixed bottom circle button that expands to nav items
 *   - Position (left / center / right) is a user preference stored in localStorage
 *   - Same Bootstrap + Heroicons style
 */
import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ShoppingBagIcon,
  ShoppingCartIcon,
  ClipboardDocumentListIcon,
  UserCircleIcon,
  EllipsisHorizontalIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline'
import useStore from '../../store/useStore'

const NAV = [
  { name: 'Shop',    href: '/shop',    Icon: ShoppingBagIcon },
  { name: 'Cart',    href: '/cart',    Icon: ShoppingCartIcon },
  { name: 'Orders',  href: '/orders',  Icon: ClipboardDocumentListIcon },
  { name: 'Account', href: '/account', Icon: UserCircleIcon },
]

// Alignment → CSS horizontal position for the fixed button
const ALIGN_STYLE = {
  left:   { left:  '1rem', right: 'auto' },
  center: { left:  '50%',  right: 'auto', transform: 'translateX(-50%)' },
  right:  { right: '1rem', left:  'auto' },
}

export default function Layout({ children }) {
  const location  = useLocation()
  const navigate  = useNavigate()
  const cartCount = useStore(s => s.cartCount())
  const navAlign  = useStore(s => s.navAlignment)
  const clearAuth = useStore(s => s.clearAuth)

  const [menuOpen, setMenuOpen] = useState(false)

  function handleLogout() {
    setMenuOpen(false)
    clearAuth()
    navigate('/', { replace: true })
  }

  const btnPos = ALIGN_STYLE[navAlign] || ALIGN_STYLE.right

  return (
    <div className="app-shell bg-body d-flex flex-column" style={{ minHeight: '100vh' }}>

      {/* Main content */}
      <main className="flex-grow-1 d-flex flex-column min-h-0 overflow-hidden">
        {children}
      </main>

      {/* ── Nav overlay ─────────────────────────────────────────── */}
      {menuOpen && (
        <div className="position-fixed top-0 start-0 w-100 h-100" style={{ zIndex: 1050 }}>
          {/* Backdrop */}
          <div
            className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-25"
            onClick={() => setMenuOpen(false)}
          />

          {/* Nav items — stacked above the toggle button */}
          <div
            className="position-fixed d-flex flex-column gap-2"
            style={{ bottom: '5rem', zIndex: 1051, ...btnPos }}
          >
            {NAV.map(({ name, href, Icon }) => {
              const active = location.pathname === href
              return (
                <Link
                  key={href}
                  to={href}
                  title={name}
                  onClick={() => setMenuOpen(false)}
                  className={[
                    'd-flex align-items-center justify-content-center',
                    'rounded-circle text-decoration-none position-relative',
                    active ? 'btn btn-primary' : 'btn btn-outline-secondary',
                  ].join(' ')}
                  style={{
                    width: '3rem', height: '3rem',
                    backgroundColor: active ? 'var(--bs-primary)' : 'var(--bs-tertiary-bg)',
                    color:           active ? 'var(--bs-white)'   : 'var(--bs-body-color)',
                    borderColor:     active ? 'var(--bs-primary)' : 'var(--bs-border-color)',
                  }}
                >
                  <Icon style={{ width: 20, height: 20 }} />
                  {/* Cart badge */}
                  {name === 'Cart' && cartCount > 0 && (
                    <span
                      className="badge bg-danger rounded-pill position-absolute"
                      style={{ top: -4, right: -4, fontSize: '0.6rem', minWidth: 16, padding: '2px 4px' }}
                    >
                      {cartCount > 9 ? '9+' : cartCount}
                    </span>
                  )}
                </Link>
              )
            })}

            {/* Logout */}
            <button
              title="Sign out"
              onClick={handleLogout}
              className="d-flex align-items-center justify-content-center rounded-circle btn btn-outline-danger"
              style={{ width: '3rem', height: '3rem' }}
            >
              <ArrowRightOnRectangleIcon style={{ width: 20, height: 20 }} />
            </button>
          </div>
        </div>
      )}

      {/* ── Toggle button ────────────────────────────────────────── */}
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        title={menuOpen ? 'Close menu' : 'Open menu'}
        className={[
          'p-0 position-fixed rounded-circle shadow-lg',
          'd-flex align-items-center justify-content-center',
          menuOpen ? 'btn btn-primary' : 'btn btn-outline-secondary',
        ].join(' ')}
        style={{
          width: '3rem', height: '3rem',
          zIndex: 1100,
          bottom: '1.5rem',
          backgroundColor: menuOpen ? 'var(--bs-primary)' : 'var(--bs-tertiary-bg)',
          color:           menuOpen ? 'var(--bs-white)'   : 'var(--bs-body-color)',
          borderColor:     menuOpen ? 'var(--bs-primary)' : 'var(--bs-border-color)',
          ...btnPos,
        }}
      >
        <EllipsisHorizontalIcon style={{ width: 20, height: 20 }} />
        {/* Cart badge on toggle when menu is closed */}
        {!menuOpen && cartCount > 0 && (
          <span
            className="badge bg-danger rounded-pill position-absolute"
            style={{ top: -4, right: -4, fontSize: '0.6rem', minWidth: 16, padding: '2px 4px' }}
          >
            {cartCount > 9 ? '9+' : cartCount}
          </span>
        )}
      </button>

    </div>
  )
}
