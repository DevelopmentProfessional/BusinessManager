/**
 * COMPANY SELECT — First page clients see.
 * Shows all registered companies as logo buttons.
 * Clicking one takes the client to the login page for that company.
 */
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BuildingOffice2Icon } from '@heroicons/react/24/outline'
import { companiesAPI } from '../services/api'

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
  const navigate = useNavigate()
  const [companies, setCompanies] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [search,    setSearch]    = useState('')

  useEffect(() => {
    companiesAPI.getAll()
      .then(setCompanies)
      .catch(() => setError('Could not load companies. Please try again.'))
      .finally(() => setLoading(false))
  }, [])

  function handleSelect(company) {
    // Navigate to login, passing company info via route state
    navigate('/login', { state: { company } })
  }

  const filtered = companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
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
        {companies.length >= 5 && (
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

        {error && (
          <div className="text-center mt-20">
            <p className="text-red-500 mb-4">{error}</p>
            <button onClick={() => window.location.reload()} className="btn-secondary">
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="text-center mt-20 text-gray-400">
            <BuildingOffice2Icon className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">
              {search ? 'No businesses match your search.' : 'No businesses available.'}
            </p>
          </div>
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
