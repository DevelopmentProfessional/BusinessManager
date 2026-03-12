/*
 * ============================================================
 * FILE: Form_Client.jsx
 *
 * PURPOSE:
 *   Renders a create/edit form for a single client record. Handles
 *   contact details, membership tier and date fields, address, and
 *   notes. Surfaces field-level validation errors returned by the
 *   parent (e.g. duplicate name) and provides Cancel / Save actions.
 *
 * FUNCTIONAL PARTS:
 *   [1] Constants          — MEMBERSHIP_TIERS lookup array
 *   [2] State & Effects    — form data initialisation, error mapping
 *   [3] Handlers           — handleChange, handleSubmit
 *   [4] Render: Header     — title ("Add Client" / "Edit Client")
 *   [5] Render: Form Body  — contact fields, membership section, address/notes
 *   [6] Render: Footer     — Cancel and Save/Create action buttons
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-03-01 | Claude  | Added section comments and top-level documentation
 *   2026-03-07 | Claude  | Converted membership tier select to custom dropdown with per-option help
 * ============================================================
 */

import React, { useState, useEffect } from 'react';
import { XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';
import Button_Toolbar from './Button_Toolbar';

// ─── 1 CONSTANTS ───────────────────────────────────────────────────────────────
const MEMBERSHIP_TIERS = [
  { value: 'none', label: 'None', description: 'No membership tier. Standard pricing and access apply.' },
  { value: 'bronze', label: 'Bronze', description: 'Entry-level membership with basic benefits and discounts.' },
  { value: 'silver', label: 'Silver', description: 'Mid-tier membership with enhanced benefits and priority booking.' },
  { value: 'gold', label: 'Gold', description: 'Premium membership with exclusive perks and significant discounts.' },
  { value: 'platinum', label: 'Platinum', description: 'Top-tier membership with maximum benefits and VIP treatment.' }
];

// ─── 2 STATE & EFFECTS ─────────────────────────────────────────────────────────
export default function Form_Client({ client, onSubmit, onCancel, error = null }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
    membership_tier: 'none',
    membership_since: '',
    membership_expires: '',
    membership_points: 0
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [isTierDropdownOpen, setIsTierDropdownOpen] = useState(false);
  const [tierHelpKey, setTierHelpKey] = useState(null);
  const [tierHelpPos, setTierHelpPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (client) {
      setFormData({
        name: client.name || '',
        email: client.email || '',
        phone: client.phone || '',
        address: client.address || '',
        notes: client.notes || '',
        membership_tier: client.membership_tier || 'none',
        membership_since: client.membership_since ? client.membership_since.split('T')[0] : '',
        membership_expires: client.membership_expires ? client.membership_expires.split('T')[0] : '',
        membership_points: client.membership_points || 0
      });
    }
  }, [client]);

  // ─── 3 HANDLERS ──────────────────────────────────────────────────────────────
  const formatPhone = (raw) => {
    const digits = raw.replace(/\D/g, '').slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'phone'
        ? formatPhone(value)
        : type === 'number' ? parseInt(value, 10) || 0 : value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setFieldErrors({});
    const submitData = { ...formData };
    if (!submitData.membership_since) submitData.membership_since = null;
    if (!submitData.membership_expires) submitData.membership_expires = null;
    onSubmit(submitData);
  };

  useEffect(() => {
    if (error) {
      const newFieldErrors = {};
      if (error.includes('name') && error.includes('already exists')) {
        newFieldErrors.name = 'This client name already exists';
      }
      setFieldErrors(newFieldErrors);
    }
  }, [error]);

  // ─── 4 RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="d-flex flex-column bg-white dark:bg-gray-900" style={{ height: '100%' }}>

      {/* Header */}
      <div className="flex-shrink-0 p-2 border-bottom border-gray-200 dark:border-gray-700 d-flex align-items-center bg-white dark:bg-gray-900">
        <h6 className="mb-0 fw-semibold text-gray-900 dark:text-gray-100">
          {client ? 'Edit Client' : 'Add Client'}
        </h6>
      </div>

      {/* ─── 5 RENDER: FORM BODY ────────────────────────────────────────────────── */}
      {/* Scrollable content */}
      <div className="flex-grow-1 overflow-auto no-scrollbar px-3 pt-3 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <form id="client-form" onSubmit={handleSubmit}>

          <div className="form-floating mb-2">
            <input
              type="text"
              id="fc_name"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              className={`form-control form-control-sm ${fieldErrors.name ? 'is-invalid' : ''}`}
              placeholder="Name"
            />
            <label htmlFor="fc_name">Name *</label>
            {fieldErrors.name && <div className="invalid-feedback">{fieldErrors.name}</div>}
          </div>

          <div className="form-floating mb-2">
            <input
              type="email"
              id="fc_email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="form-control form-control-sm"
              placeholder="Email"
            />
            <label htmlFor="fc_email">Email</label>
          </div>

          <div className="form-floating mb-2">
            <input
              type="tel"
              id="fc_phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="form-control form-control-sm"
              placeholder="(555) 555-5555"
              pattern="\(\d{3}\) \d{3}-\d{4}"
              title="Phone number format: (555) 555-5555"
            />
            <label htmlFor="fc_phone">Phone</label>
          </div>

          {/* Membership section - below phone */}
          <hr className="my-2" />
          <div className="small fw-semibold text-muted mb-2">Membership</div>

          <div className="row g-2 mb-2">
            <div className="col-6">
              <div className="position-relative">
                <label htmlFor="fc_tier" className="form-label" style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>Tier</label>
                <div className="position-relative">
                  <button
                    type="button"
                    onClick={() => {
                      const nextOpen = !isTierDropdownOpen;
                      setIsTierDropdownOpen(nextOpen);
                      if (!nextOpen) setTierHelpKey(null);
                    }}
                    className="form-select form-select-sm text-start d-flex align-items-center justify-content-between"
                    style={{ cursor: 'pointer' }}
                  >
                    <span>{MEMBERSHIP_TIERS.find(opt => opt.value === formData.membership_tier)?.label || 'Select Tier'}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16" style={{ marginLeft: '8px' }}>
                      <path fillRule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
                    </svg>
                  </button>
                  {isTierDropdownOpen && (
                    <div
                      className="position-absolute w-100 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg"
                      style={{ top: 'calc(100% + 4px)', zIndex: 1000, maxHeight: '300px', overflowY: 'auto' }}
                    >
                      {MEMBERSHIP_TIERS.map((option, index) => {
                        const isHelpOpen = tierHelpKey === option.value;
                        return (
                          <div key={option.value} className="d-flex align-items-center gap-1 px-2 py-1 border-bottom border-gray-100 dark:border-gray-700">
                            <button
                              type="button"
                              onClick={() => {
                                handleChange({ target: { name: 'membership_tier', value: option.value } });
                                setIsTierDropdownOpen(false);
                                setTierHelpKey(null);
                              }}
                              className="btn btn-link text-start p-1 flex-grow-1 text-decoration-none text-gray-900 dark:text-gray-100"
                              style={{ fontSize: '0.875rem' }}
                            >
                              {option.label}
                            </button>
                            <div className="flex-shrink-0">
                              <button
                                type="button"
                                className="btn btn-link btn-sm p-0 text-primary border-0"
                                aria-label={`${option.label} help`}
                                onMouseEnter={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setTierHelpPos({ top: rect.top, left: rect.right + 8 });
                                  setTierHelpKey(option.value);
                                }}
                                onMouseLeave={() => setTierHelpKey(prev => prev === option.value ? null : prev)}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setTierHelpPos({ top: rect.top, left: rect.right + 8 });
                                  setTierHelpKey(prev => prev === option.value ? null : option.value);
                                }}
                                style={{ width: '1.75rem', height: '1.75rem', lineHeight: 1, fontWeight: 700, fontSize: '0.75rem', border: 'none', outline: 'none' }}
                              >?</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                {/* Fixed-position tooltip — escapes overflow:auto container */}
                {tierHelpKey && (() => {
                  const opt = MEMBERSHIP_TIERS.find(o => o.value === tierHelpKey);
                  if (!opt) return null;
                  return (
                    <div
                      style={{ position: 'fixed', top: tierHelpPos.top, left: tierHelpPos.left, width: 240, maxWidth: 'calc(100vw - 1rem)', zIndex: 9999, pointerEvents: 'none' }}
                      className="p-2 rounded-lg shadow-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700"
                    >
                      <div className="fw-semibold" style={{ fontSize: '0.8rem' }}>{opt.label}</div>
                      <div className="small text-gray-600 dark:text-gray-300">{opt.description}</div>
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="col-6">
              <div className="form-floating">
                <input
                  type="number"
                  id="fc_points"
                  name="membership_points"
                  min="0"
                  value={formData.membership_points}
                  onChange={handleChange}
                  className="form-control form-control-sm"
                  placeholder="0"
                />
                <label htmlFor="fc_points">Points</label>
              </div>
            </div>
            <div className="col-6">
              <div className="form-floating">
                <input
                  type="date"
                  id="fc_since"
                  name="membership_since"
                  value={formData.membership_since}
                  onChange={handleChange}
                  className="form-control form-control-sm"
                  placeholder="Member Since"
                />
                <label htmlFor="fc_since">Member Since</label>
              </div>
            </div>
            <div className="col-6">
              <div className="form-floating">
                <input
                  type="date"
                  id="fc_expires"
                  name="membership_expires"
                  value={formData.membership_expires}
                  onChange={handleChange}
                  className="form-control form-control-sm"
                  placeholder="Expires"
                />
                <label htmlFor="fc_expires">Expires</label>
              </div>
            </div>
          </div>

          {/* Address & Notes - border-top above */}
          <hr className="my-2" />
          <div className="form-floating mb-2">
            <textarea
              id="fc_address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              className="form-control form-control-sm border-0"
              placeholder="Address"
              style={{ height: '60px' }}
            />
            <label htmlFor="fc_address">Address</label>
          </div>

          <div className="form-floating mb-2">
            <textarea
              id="fc_notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              className="form-control form-control-sm border-0"
              placeholder="Notes"
              style={{ height: '80px' }}
            />
            <label htmlFor="fc_notes">Notes</label>
          </div>

        </form>
      </div>

      {/* ─── 6 RENDER: FOOTER ───────────────────────────────────────────────────── */}
      {/* Footer */}
      <div className="flex-shrink-0 pt-2 pb-4 px-3 border-top border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="d-flex align-items-center">
          <div style={{ width: 40 }} />
          <div className="flex-grow-1 d-flex gap-3 justify-content-center">
            <Button_Toolbar
              icon={XMarkIcon}
              label="Cancel"
              onClick={onCancel}
              className="btn-outline-secondary"
            />
            <Button_Toolbar
              icon={CheckIcon}
              label={client ? 'Save Changes' : 'Create Client'}
              type="submit"
              form="client-form"
              className="btn-primary"
            />
          </div>
          <div style={{ width: 40 }} />
        </div>
      </div>

    </div>
  );
}
