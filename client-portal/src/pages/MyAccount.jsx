/**
 * MY ACCOUNT — Profile details + portal preferences.
 * Includes nav button alignment setting (left / center / right).
 */
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from './components/Layout'
import { authAPI } from '../services/api'
import useStore from '../store/useStore'

const TIER_BADGE = {
  none:     'bg-secondary',
  bronze:   'bg-warning text-dark',
  silver:   'bg-secondary',
  gold:     'bg-warning text-dark',
  platinum: 'bg-primary',
}

const ALIGN_OPTIONS = [
  { value: 'left',   label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right',  label: 'Right' },
]

export default function MyAccount() {
  const navigate      = useNavigate()
  const client        = useStore(s => s.client)
  const token         = useStore(s => s.token)
  const companyId     = useStore(s => s.companyId)
  const setAuth       = useStore(s => s.setAuth)
  const clearAuth     = useStore(s => s.clearAuth)
  const navAlignment  = useStore(s => s.navAlignment)
  const setNavAlignment = useStore(s => s.setNavAlignment)
  const addToast      = useStore(s => s.addToast)

  const [form, setForm] = useState({
    name:    client?.name    || '',
    phone:   client?.phone   || '',
    address: client?.address || '',
  })
  const [saving, setSaving] = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await authAPI.updateMe(form)
      setAuth(
        { ...client, name: updated.name, phone: updated.phone, address: updated.address },
        token,
        companyId,
      )
      addToast('Profile updated.', 'success')
    } catch {
      addToast('Update failed.', 'error')
    } finally {
      setSaving(false)
    }
  }

  function handleLogout() {
    clearAuth()
    navigate('/')
  }

  const tier = client?.membership_tier || 'none'

  return (
    <Layout>
      <div className="p-3" style={{ paddingBottom: '5rem' }}>
        <h5 className="fw-bold mb-4">My Account</h5>

        <div className="row g-3">

          {/* ── Membership card ────────────────────────────────── */}
          <div className="col-12 col-md-4">
            <div className="card h-100">
              <div className="card-body text-center">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3"
                  style={{ width: 64, height: 64, background: '#eef2ff', fontSize: 28, fontWeight: 800, color: '#4f46e5' }}
                >
                  {client?.name?.[0]?.toUpperCase() || '?'}
                </div>
                <p className="fw-bold mb-0">{client?.name}</p>
                <p className="text-muted small">{client?.email}</p>

                <div className="mt-3 pt-3 border-top">
                  <span className={`badge ${TIER_BADGE[tier]} text-capitalize`}>
                    {tier} Member
                  </span>
                  <p className="text-muted small mt-1">{client?.membership_points || 0} points</p>
                </div>

                {client?.membership_expires && (
                  <p className="text-muted" style={{ fontSize: '0.75rem' }}>
                    Expires {new Date(client.membership_expires).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── Edit profile ───────────────────────────────────── */}
          <div className="col-12 col-md-8">
            <div className="card mb-3">
              <div className="card-body">
                <h6 className="fw-semibold mb-3">Profile Details</h6>
                <form onSubmit={handleSave}>
                  <div className="mb-3">
                    <label className="form-label small fw-medium">Full Name</label>
                    <input
                      className="form-control"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-medium">Email</label>
                    <input className="form-control" value={client?.email || ''} disabled />
                    <div className="form-text">Email cannot be changed.</div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-medium">Phone</label>
                    <input
                      className="form-control"
                      placeholder="555-1234"
                      value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-medium">Address</label>
                    <textarea
                      className="form-control"
                      rows={2}
                      placeholder="123 Main St, City, State"
                      value={form.address}
                      onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                    />
                  </div>
                  <div className="d-flex justify-content-end">
                    <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* ── Portal preferences ─────────────────────────── */}
            <div className="card mb-3">
              <div className="card-body">
                <h6 className="fw-semibold mb-3">Portal Preferences</h6>

                <div className="mb-0">
                  <label className="form-label small fw-medium">Navigation Button Position</label>
                  <div className="d-flex gap-2">
                    {ALIGN_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`btn btn-sm flex-fill ${navAlignment === opt.value ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => {
                          setNavAlignment(opt.value)
                          addToast(`Navigation moved to ${opt.label.toLowerCase()}.`, 'success')
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="form-text">Controls where the navigation button sits at the bottom of the screen.</div>
                </div>
              </div>
            </div>

            {/* ── Sign out ───────────────────────────────────── */}
            <div className="card">
              <div className="card-body">
                <h6 className="fw-semibold mb-3">Session</h6>
                <button className="btn btn-outline-danger btn-sm" onClick={handleLogout}>
                  Sign Out
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </Layout>
  )
}
