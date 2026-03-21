import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authAPI } from '../services/api'
import useStore from '../store/useStore'

export default function Register() {
  const navigate = useNavigate()
  const setAuth  = useStore(s => s.setAuth)

  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', phone: '', company_id: '' })
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
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white font-bold text-2xl">C</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Create Account</h1>
          <p className="text-sm text-gray-500 mt-1">Join the client portal</p>
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
            <div>
              <label className="form-label">Company ID</label>
              <input className="form-input" placeholder="acme-corp" required {...f('company_id')} />
            </div>
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
