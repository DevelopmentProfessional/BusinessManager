/**
 * CLIENT PORTAL LAYOUT
 * Full-text bottom navigation bar — always visible, never compact.
 * Shows icon + label for every nav item at all times.
 */
import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ShoppingBagIcon,
  ShoppingCartIcon,
  ClipboardDocumentListIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline'
import useStore from '../../store/useStore'

const NAV = [
  { name: 'Shop',    href: '/shop',    Icon: ShoppingBagIcon },
  { name: 'Cart',    href: '/cart',    Icon: ShoppingCartIcon },
  { name: 'Orders',  href: '/orders',  Icon: ClipboardDocumentListIcon },
  { name: 'Account', href: '/account', Icon: UserCircleIcon },
]

export default function Layout({ children }) {
  const location  = useLocation()
  const navigate  = useNavigate()
  const cartCount = useStore(s => s.cartCount())
  const clearAuth = useStore(s => s.clearAuth)

  function handleLogout() {
    clearAuth()
    navigate('/', { replace: true })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--cp-bg, #f8f9fa)' }}>

      {/* Main scrollable content */}
      <main style={{ flex: 1, overflowY: 'auto', paddingBottom: '5rem' }}>
        {children}
      </main>

      {/* ── Full-text bottom nav bar ───────────────────────────────────── */}
      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        background: 'var(--cp-nav-bg, #ffffff)',
        borderTop: '1px solid var(--cp-nav-border, #e5e7eb)',
        display: 'flex',
        alignItems: 'stretch',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.08)',
      }}>
        {NAV.map(({ name, href, Icon }) => {
          const active = location.pathname === href
          return (
            <Link
              key={href}
              to={href}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3px',
                padding: '10px 4px 8px',
                textDecoration: 'none',
                color: active ? 'var(--cp-primary, #6366f1)' : 'var(--cp-nav-inactive, #9ca3af)',
                borderBottom: active ? '2px solid var(--cp-primary, #6366f1)' : '2px solid transparent',
                transition: 'color 0.15s, border-color 0.15s',
                position: 'relative',
                fontSize: '0.65rem',
                fontWeight: active ? 600 : 400,
                letterSpacing: '0.02em',
              }}
            >
              <span style={{ position: 'relative', display: 'inline-flex' }}>
                <Icon style={{ width: 22, height: 22 }} />
                {name === 'Cart' && cartCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: -5,
                    right: -7,
                    background: '#ef4444',
                    color: '#fff',
                    borderRadius: '9999px',
                    fontSize: '0.55rem',
                    fontWeight: 700,
                    minWidth: 16,
                    height: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 3px',
                    lineHeight: 1,
                  }}>
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
              </span>
              {name}
            </Link>
          )
        })}

        {/* Sign out */}
        <button
          onClick={handleLogout}
          title="Sign out"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
            padding: '10px 4px 8px',
            background: 'none',
            border: 'none',
            borderBottom: '2px solid transparent',
            color: 'var(--cp-nav-inactive, #9ca3af)',
            cursor: 'pointer',
            fontSize: '0.65rem',
            fontWeight: 400,
            letterSpacing: '0.02em',
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--cp-nav-inactive, #9ca3af)'}
        >
          <ArrowRightOnRectangleIcon style={{ width: 22, height: 22 }} />
          Sign Out
        </button>
      </nav>
    </div>
  )
}
