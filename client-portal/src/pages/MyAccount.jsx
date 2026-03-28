/**
 * MY ACCOUNT — Modern profile + membership card.
 */
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from './components/Layout'
import { UserCircleIcon, StarIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline'
import { StarIcon as StarSolid } from '@heroicons/react/24/solid'
import { authAPI } from '../services/api'
import useStore from '../store/useStore'

const TIER_CONFIG = {
  none:     { label: 'Member',   bg: '#f3f4f6', color: '#6b7280', star: false },
  bronze:   { label: 'Bronze',   bg: '#fef3c7', color: '#b45309', star: true  },
  silver:   { label: 'Silver',   bg: '#f1f5f9', color: '#475569', star: true  },
  gold:     { label: 'Gold',     bg: '#fef9c3', color: '#b45309', star: true  },
  platinum: { label: 'Platinum', bg: '#f0f9ff', color: '#0369a1', star: true  },
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '9px 12px',
  fontSize: '0.88rem', border: '1.5px solid #e5e7eb',
  borderRadius: '0.6rem', outline: 'none', boxSizing: 'border-box',
  background: '#fff', color: '#111827',
  transition: 'border-color 0.15s',
}
const inputDisabledStyle = { ...inputStyle, background: '#f9fafb', color: '#9ca3af' }

export default function MyAccount() {
  const navigate    = useNavigate()
  const client      = useStore(s => s.client)
  const token       = useStore(s => s.token)
  const companyId   = useStore(s => s.companyId)
  const setAuth     = useStore(s => s.setAuth)
  const clearAuth   = useStore(s => s.clearAuth)
  const addToast    = useStore(s => s.addToast)

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

  const tier      = client?.membership_tier || 'none'
  const tierCfg   = TIER_CONFIG[tier] || TIER_CONFIG.none
  const initial   = (client?.name || '?')[0].toUpperCase()
  const points    = client?.membership_points || 0

  return (
    <Layout>
      <div style={{ paddingBottom: '5.5rem', maxWidth: 560, margin: '0 auto' }}>

        {/* ── Profile hero card ───────────────────────────────── */}
        <div style={{
          background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
          padding: '28px 20px 20px', textAlign: 'center',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />

          {/* Avatar */}
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px', fontSize: '1.6rem', fontWeight: 800, color: '#fff',
            border: '3px solid rgba(255,255,255,0.3)',
          }}>
            {initial}
          </div>
          <h2 style={{ color: '#fff', fontWeight: 800, fontSize: '1.1rem', margin: 0 }}>{client?.name || 'Account'}</h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.82rem', margin: '3px 0 12px' }}>{client?.email}</p>

          {/* Membership badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: tierCfg.bg, color: tierCfg.color,
              borderRadius: '999px', padding: '4px 12px',
              fontSize: '0.75rem', fontWeight: 700,
            }}>
              {tierCfg.star && <StarSolid style={{ width: 11, height: 11 }} />}
              {tierCfg.label}
            </span>
            <span style={{
              background: 'rgba(255,255,255,0.15)', color: '#fff',
              borderRadius: '999px', padding: '4px 10px',
              fontSize: '0.72rem', fontWeight: 600, backdropFilter: 'blur(4px)',
            }}>
              {points.toLocaleString()} pts
            </span>
          </div>

          {client?.membership_expires && (
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.68rem', marginTop: 6 }}>
              Expires {new Date(client.membership_expires).toLocaleDateString()}
            </p>
          )}
        </div>

        {/* ── Profile form ────────────────────────────────────── */}
        <div style={{ padding: '20px 16px 0' }}>
          <div style={{
            background: '#fff', borderRadius: '1rem',
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
            padding: '20px', marginBottom: 16,
          }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#111827', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserCircleIcon style={{ width: 18, height: 18, color: '#6b7280' }} />
              Profile Details
            </h3>

            <form onSubmit={handleSave}>
              <Field label="Full Name">
                <input
                  style={inputStyle}
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                  onFocus={e => e.target.style.borderColor = '#4f46e5'}
                  onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                />
              </Field>

              <Field label="Email address">
                <input style={inputDisabledStyle} value={client?.email || ''} disabled />
                <p style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: 4 }}>Email cannot be changed.</p>
              </Field>

              <Field label="Phone">
                <input
                  style={inputStyle}
                  placeholder="555-1234"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  onFocus={e => e.target.style.borderColor = '#4f46e5'}
                  onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                />
              </Field>

              <Field label="Address">
                <textarea
                  style={{ ...inputStyle, resize: 'none' }}
                  rows={2}
                  placeholder="123 Main St, City, State"
                  value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  onFocus={e => e.target.style.borderColor = '#4f46e5'}
                  onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                />
              </Field>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '9px 20px', background: saving ? '#a5b4fc' : '#4f46e5',
                    color: '#fff', border: 'none', borderRadius: '0.6rem',
                    fontWeight: 600, fontSize: '0.85rem',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    transition: 'background 0.15s',
                  }}
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>

          {/* ── Sign out ──────────────────────────────────────── */}
          <button
            onClick={() => { clearAuth(); navigate('/') }}
            style={{
              width: '100%', padding: '12px',
              background: '#fff', border: '1.5px solid #fee2e2',
              borderRadius: '0.9rem', color: '#dc2626',
              fontSize: '0.88rem', fontWeight: 600,
              cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
            onMouseLeave={e => e.currentTarget.style.background = '#fff'}
          >
            <ArrowRightOnRectangleIcon style={{ width: 18, height: 18 }} />
            Sign Out
          </button>
        </div>
      </div>
    </Layout>
  )
}
