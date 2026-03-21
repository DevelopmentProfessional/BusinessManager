/**
 * MY ACCOUNT — Profile + membership info.
 * Same form + card layout as the internal app's Profile.jsx.
 */
import React, { useState } from 'react'
import { UserCircleIcon, StarIcon } from '@heroicons/react/24/outline'
import Layout from './components/Layout'
import { authAPI } from '../services/api'
import useStore from '../store/useStore'

const TIER_COLORS = {
  none:     'badge-gray',
  bronze:   'bg-orange-100 text-orange-700',
  silver:   'bg-gray-100 text-gray-600',
  gold:     'bg-yellow-100 text-yellow-700',
  platinum: 'bg-purple-100 text-purple-700',
}

export default function MyAccount() {
  const client   = useStore(s => s.client)
  const setAuth  = useStore(s => s.setAuth)
  const token    = useStore(s => s.token)
  const companyId = useStore(s => s.companyId)
  const addToast = useStore(s => s.addToast)

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
        companyId
      )
      addToast('Profile updated.', 'success')
    } catch {
      addToast('Update failed.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const tier = client?.membership_tier || 'none'

  return (
    <Layout>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Account</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Membership card ──────────────────────────────── */}
        <div className="card text-center">
          <div className="w-16 h-16 rounded-full bg-primary-light flex items-center justify-center mx-auto mb-3">
            <UserCircleIcon className="w-9 h-9 text-primary" />
          </div>
          <p className="font-bold text-gray-900 text-lg">{client?.name}</p>
          <p className="text-sm text-gray-500">{client?.email}</p>

          <div className="mt-4 pt-4 border-t border-gray-100">
            <span className={`badge ${TIER_COLORS[tier]} capitalize text-sm px-3 py-1`}>
              <StarIcon className="w-3.5 h-3.5 mr-1" />
              {tier} Member
            </span>
            <p className="text-sm text-gray-500 mt-2">{client?.membership_points || 0} points</p>
          </div>

          {client?.membership_expires && (
            <p className="text-xs text-gray-400 mt-2">
              Expires {new Date(client.membership_expires).toLocaleDateString()}
            </p>
          )}
        </div>

        {/* ── Edit profile ─────────────────────────────────── */}
        <div className="lg:col-span-2 card">
          <h2 className="font-semibold text-gray-900 mb-5">Edit Profile</h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="form-label">Full Name</label>
              <input
                className="form-input"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="form-label">Email</label>
              <input className="form-input" value={client?.email || ''} disabled
                title="Email cannot be changed." />
              <p className="text-xs text-gray-400 mt-1">Email address cannot be changed.</p>
            </div>
            <div>
              <label className="form-label">Phone</label>
              <input
                className="form-input"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="555-1234"
              />
            </div>
            <div>
              <label className="form-label">Address</label>
              <textarea
                className="form-input resize-none"
                rows={3}
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                placeholder="123 Main St, City, State"
              />
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  )
}
