import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { authAPI, companiesAPI } from '../services/api'
import useStore from '../store/useStore'

export default function Register() {
  const navigate    = useNavigate()
  const location    = useLocation()
  const setAuth     = useStore(s => s.setAuth)
  const preselected = location.state?.company || null
  const logoSrc     = preselected?.has_logo_data
    ? companiesAPI.logoUrl(preselected.company_id)
    : preselected?.logo_url

  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', phone: '', company_id: preselected?.company_id || '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return }
    setLoading(true)
    try {
      const { confirm, ...payload } = form
      const data = await authAPI.register(payload)
      setAuth(
        { id: data.client_id, name: data.name, email: data.email, membership_tier: data.membership_tier },
        data.access_token,
        form.company_id
      )
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  const f = (field) => ({ value: form[field], onChange: e => setForm(p => ({ ...p, [field]: e.target.value })) })

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors mb-6">
          <ArrowLeftIcon className="w-4 h-4" />All businesses
        </button>
        <div className="text-center mb-8">
          {preselected && logoSrc && (
            <div className="w-20 h-20 rounded-2xl overflow-hidden mx-auto mb-4 shadow-lg">
              <img src={logoSrc} alt={preselected.name} className="w-full h-full object-contain" />
            </div>
          )}
          <h1 className="text-2xl font-bold text-gray-900">Create Account</h1>
          <p className="text-sm text-gray-500 mt-1">{preselected ? `Join ${preselected.name}` : 'Join the client portal'}</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="form-label">Full Name</label>
              <input className="form-input" placeholder="Jane Smith" required {...f('name')} />
            </div>
            <div>
              <label className="form-label">Email</label>
              <input className="form-input" type="email" placeholder="jane@example.com" required {...f('email')} />
            </div>
            <div>
              <label className="form-label">Phone (optional)</label>
              <input className="form-input" placeholder="555-1234" {...f('phone')} />
            </div>
            {!preselected && (
              <div>
                <label className="form-label">Company ID</label>
                <input className="form-input" placeholder="acme-corp" required {...f('company_id')} />
              </div>
            )}
            <div>
              <label className="form-label">Password</label>
              <input className="form-input" type="password" placeholder="••••••••" required {...f('password')} />
            </div>
            <div>
              <label className="form-label">Confirm Password</label>
              <input className="form-input" type="password" placeholder="••••••••" required {...f('confirm')} />
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5 disabled:opacity-50">
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-4">
            Already have an account?{' '}
            <Link to="/login" className="text-primary font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
