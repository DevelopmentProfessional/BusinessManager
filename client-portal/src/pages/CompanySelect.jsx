/**
 * COMPANY SELECT — First page clients see.
 * - If the user has saved credentials, auto-redirects to /shop.
 * - If not logged in, wipes ALL stale cache/localStorage (except nav pref)
 *   and fetches the company list fresh every time.
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { BuildingOffice2Icon } from '@heroicons/react/24/outline'
import { companiesAPI } from '../services/api'
import useStore from '../store/useStore'

const CANONICAL_COMPANIES_URL = 'https://businessmanager-client-api.onrender.com/api/client/companies'

// localStorage keys that we intentionally keep across sessions
const PERSISTENT_KEYS = new Set(['cp_client', 'cp_token', 'cp_company', 'cp_nav_align'])

/**
 * Wipe all localStorage keys except credentials + nav pref,
 * and delete any non-precache service-worker runtime caches.
 */
function clearStaleCaches() {
  const toRemove = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && !PERSISTENT_KEYS.has(k)) toRemove.push(k)
  }
  toRemove.forEach(k => localStorage.removeItem(k))

  if ('caches' in window) {
    caches.keys().then(names =>
      names
        .filter(n => !n.startsWith('workbox-precache'))
        .forEach(n => caches.delete(n))
    )
  }
}

function safeParseJson(val) {
  try { return val ? JSON.parse(val) : null } catch { return null }
}

function normalizeCompanies(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.results)) return payload.results
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.companies)) return payload.companies
  if (payload && typeof payload === 'object') {
    const firstArray = Object.values(payload).find(v => Array.isArray(v))
    if (firstArray) return firstArray
  }
  return []
}

function CompanyCard({ company, onClick }) {
  const logoSrc = company.has_logo_data
    ? companiesAPI.logoUrl(company.company_id)
    : company.logo_url

  const [imgError, setImgError] = useState(false)
  const showLogo = logoSrc && !imgError

  return (
    <button
      onClick={() => onClick(company)}
      className="group flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-gray-100
                 bg-white hover:border-primary hover:shadow-lg transition-all duration-200
                 hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-primary/40
                 min-w-[140px]"
    >
      {/* Logo — only shown if one exists */}
      {showLogo && (
        <div className="w-20 h-20 rounded-xl overflow-hidden flex items-center justify-center flex-shrink-0">
          <img
            src={logoSrc}
            alt={company.name}
            className="w-full h-full object-contain"
            onError={() => setImgError(true)}
          />
        </div>
      )}

      {/* Company name */}
      <span className="text-sm font-semibold text-gray-800 text-center leading-snug group-hover:text-primary transition-colors">
        {company.name}
      </span>
    </button>
  )
}

export default function CompanySelect() {
  const navigate    = useNavigate()
  const restoreAuth = useStore(s => s.restoreAuth)

  const [companies, setCompanies] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [search,    setSearch]    = useState('')

  const fetchCompanies = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Always bypass cache — companies must be fresh
      const res = await fetch(`${CANONICAL_COMPANIES_URL}?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) throw new Error(`Server returned ${res.status}`)
      const ct = res.headers.get('content-type') || ''
      if (!ct.includes('application/json')) {
        throw new Error('Unexpected response (not JSON). The API URL may be misconfigured.')
      }
      const payload = await res.json()
      const list = normalizeCompanies(payload)
      setCompanies(list)
      if (list.length === 0) setError('No businesses are currently registered. Contact support.')
    } catch (err) {
      setError(err.message || 'Could not load businesses. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Restore auth from localStorage first (synchronous)
    restoreAuth()

    // Read directly from localStorage so we don't wait for a React re-render
    const savedToken   = localStorage.getItem('cp_token')
    const savedCompany = localStorage.getItem('cp_company')
    const savedClient  = safeParseJson(localStorage.getItem('cp_client'))

    if (savedToken && savedCompany && savedClient) {
      // Valid saved session — skip the picker and go straight to the shop
      navigate('/shop', { replace: true })
      return
    }

    // Not logged in — clear anything that isn't credentials or nav pref,
    // then load the company list fresh with no caching
    clearStaleCaches()
    fetchCompanies()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSelect(company) {
    navigate('/login', { state: { company } })
  }

  const companiesSafe = Array.isArray(companies) ? companies : []
  const filtered = companiesSafe.filter(c =>
    String(c?.name || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-100 px-6 py-5 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary
                          flex items-center justify-center mx-auto mb-2 shadow">
            <BuildingOffice2Icon className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Client Portal</h1>
          <p className="text-sm text-gray-500 mt-0.5">Select your business to continue</p>
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-10">

        {/* Search (only shown when 5+ companies) */}
        {companiesSafe.length >= 5 && (
          <div className="mb-8 max-w-sm mx-auto">
            <input
              className="form-input text-center"
              placeholder="Search businesses…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        )}

        {/* States */}
        {loading && (
          <div className="flex justify-center mt-20">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && error && (
          <div className="text-center mt-20">
            <BuildingOffice2Icon className="w-12 h-12 mx-auto mb-4 opacity-30 text-gray-400" />
            <p className="text-red-500 mb-4">{error}</p>
            <button onClick={fetchCompanies} className="btn-secondary">
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && companies.length === 0 && (
          <div className="text-center mt-20 text-gray-400">
            <BuildingOffice2Icon className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">No businesses available.</p>
            <button onClick={fetchCompanies} className="btn-secondary mt-4">Retry</button>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && search && (
          <p className="text-center mt-20 text-gray-400">No businesses match your search.</p>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5 justify-items-center">
            {filtered.map(company => (
              <CompanyCard
                key={company.company_id}
                company={company}
                onClick={handleSelect}
              />
            ))}
          </div>
        )}
      </main>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="text-center py-6 text-xs text-gray-400">
        Powered by BusinessManager
      </footer>
    </div>
  )
}
