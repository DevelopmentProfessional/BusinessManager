/**
 * LOGIN PAGE
 * Same visual structure as the internal app's Login.jsx —
 * single-card centered layout with brand gradient header.
 */
import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { authAPI, companiesAPI } from '../services/api'
import useStore from '../store/useStore'

export default function Login() {
  const navigate   = useNavigate()
  const location   = useLocation()
  const setAuth    = useStore(s => s.setAuth)
  const addToast   = useStore(s => s.addToast)

  // Company passed from CompanySelect page
  const preselected = location.state?.company || null

  const [form, setForm] = useState({
    email:      '',
    password:   '',
    company_id: preselected?.company_id || '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const logoSrc = preselected?.has_logo_data
    ? companiesAPI.logoUrl(preselected.company_id)
    : preselected?.logo_url

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const data = await authAPI.login(form)
      setAuth(
        { id: data.client_id, name: data.name, email: data.email, membership_tier: data.membership_tier },
        data.access_token,
        form.company_id
      )
      navigate('/shop')
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">

        {/* Back to company select */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors mb-6"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          All businesses
        </button>

        {/* Company header */}
        <div className="text-center mb-8">
          {preselected ? (
            <>
              {logoSrc && (
                <div className="w-20 h-20 rounded-2xl overflow-hidden mx-auto mb-4 shadow-lg">
                  <img src={logoSrc} alt={preselected.name} className="w-full h-full object-contain" />
                </div>
              )}
              <h1 className="text-2xl font-bold text-gray-900">{preselected.name}</h1>
              <p className="text-sm text-gray-500 mt-1">Sign in to your account</p>
            </>
          ) : (
            <>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-4 shadow-lg">
                <span className="text-white font-bold text-2xl">C</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Client Portal</h1>
              <p className="text-sm text-gray-500 mt-1">Sign in to your account</p>
            </>
          )}
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="form-label">Email</label>
              <input
                className="form-input"
                type="email"
                placeholder="jane@example.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="form-label">Password</label>
              <input
                className="form-input"
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
              />
            </div>

            {/* Company ID — hidden if pre-selected, editable otherwise */}
            {!preselected ? (
              <div>
                <label className="form-label">Company ID</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="acme-corp"
                  value={form.company_id}
                  onChange={e => setForm(f => ({ ...f, company_id: e.target.value }))}
                  required
                />
              </div>
            ) : (
              <input type="hidden" value={form.company_id} readOnly />
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-2.5 disabled:opacity-50"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-4">
            Don't have an account?{' '}
            <Link
              to="/register"
              state={{ company: preselected }}
              className="text-primary font-medium hover:underline"
            >
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
