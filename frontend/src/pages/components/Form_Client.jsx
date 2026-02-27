import React, { useState, useEffect } from 'react';
import { XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';
import Button_Toolbar from './Button_Toolbar';

const MEMBERSHIP_TIERS = [
  { value: 'none', label: 'None' },
  { value: 'bronze', label: 'Bronze' },
  { value: 'silver', label: 'Silver' },
  { value: 'gold', label: 'Gold' },
  { value: 'platinum', label: 'Platinum' }
];

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

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value, 10) || 0 : value
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

  return (
    <div className="d-flex flex-column bg-white dark:bg-gray-900" style={{ height: '100%' }}>

      {/* Header */}
      <div className="flex-shrink-0 p-2 border-bottom border-gray-200 dark:border-gray-700 d-flex align-items-center bg-white dark:bg-gray-900">
        <h6 className="mb-0 fw-semibold text-gray-900 dark:text-gray-100">
          {client ? 'Edit Client' : 'Add Client'}
        </h6>
      </div>

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
              placeholder="Phone"
            />
            <label htmlFor="fc_phone">Phone</label>
          </div>

          {/* Membership section - below phone */}
          <hr className="my-2" />
          <div className="small fw-semibold text-muted mb-2">Membership</div>

          <div className="row g-2 mb-2">
            <div className="col-6">
              <div className="form-floating">
                <select
                  id="fc_tier"
                  name="membership_tier"
                  value={formData.membership_tier}
                  onChange={handleChange}
                  className="form-select form-select-sm"
                >
                  {MEMBERSHIP_TIERS.map(tier => (
                    <option key={tier.value} value={tier.value}>{tier.label}</option>
                  ))}
                </select>
                <label htmlFor="fc_tier">Tier</label>
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
