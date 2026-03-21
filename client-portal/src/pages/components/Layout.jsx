/**
 * CLIENT PORTAL LAYOUT
 * Mirrors the internal app's Layout.jsx structure — same sidebar pattern,
 * same icon library (@heroicons/react), same color tokens.
 */
import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  HomeIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  ClipboardDocumentListIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline'
import useStore from '../../store/useStore'

const NAV = [
  { name: 'Home',    href: '/dashboard', Icon: HomeIcon },
  { name: 'Catalog', href: '/catalog',   Icon: ShoppingBagIcon },
  { name: 'Orders',  href: '/orders',    Icon: ClipboardDocumentListIcon },
  { name: 'Account', href: '/account',   Icon: UserCircleIcon },
]

export default function Layout({ children }) {
  const location  = useLocation()
  const navigate  = useNavigate()
  const clearAuth = useStore(s => s.clearAuth)
  const cartCount = useStore(s => s.cartCount())
  const client    = useStore(s => s.client)

  function handleLogout() {
    clearAuth()
    navigate('/login')
  }

  return (
    <div className="app-shell">
      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <nav className="app-nav flex flex-col items-center py-4 gap-2">
        {/* Logo mark */}
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center mb-4">
          <span className="text-white font-bold text-lg">C</span>
        </div>

        {NAV.map(({ name, href, Icon }) => {
          const active = location.pathname === href
          return (
            <Link
              key={href}
              to={href}
              title={name}
              className={[
                'relative w-10 h-10 flex items-center justify-center rounded-xl transition-colors',
                active
                  ? 'bg-primary text-white'
                  : 'text-gray-400 hover:bg-gray-700 hover:text-white',
              ].join(' ')}
            >
              <Icon className="w-5 h-5" />
              {/* Cart badge */}
              {name === 'Cart' && cartCount > 0 && (
                <span className="cart-badge">{cartCount}</span>
              )}
            </Link>
          )
        })}

        {/* Cart shortcut */}
        <Link
          to="/cart"
          title="Cart"
          className={[
            'relative w-10 h-10 flex items-center justify-center rounded-xl transition-colors',
            location.pathname === '/cart'
              ? 'bg-primary text-white'
              : 'text-gray-400 hover:bg-gray-700 hover:text-white',
          ].join(' ')}
        >
          <ShoppingCartIcon className="w-5 h-5" />
          {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
        </Link>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Client initial avatar */}
        {client && (
          <div className="w-8 h-8 rounded-full bg-primary-light text-primary font-semibold text-sm flex items-center justify-center mb-1">
            {client.name?.[0]?.toUpperCase() || '?'}
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          title="Sign out"
          className="w-10 h-10 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
        >
          <ArrowRightOnRectangleIcon className="w-5 h-5" />
        </button>
      </nav>

      {/* ── Main content ─────────────────────────────────────────── */}
      <main className="app-shell-main">
        {children}
      </main>
    </div>
  )
}
