import React, { useState, useEffect } from 'react';
import { XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';
import IconButton from './IconButton';
import ActionFooter from './ActionFooter';

const MEMBERSHIP_TIERS = [
  { value: 'none', label: 'None' },
  { value: 'bronze', label: 'Bronze' },
  { value: 'silver', label: 'Silver' },
  { value: 'gold', label: 'Gold' },
  { value: 'platinum', label: 'Platinum' }
];

export default function ClientForm({ client, onSubmit, onCancel, error = null }) {
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

    // Prepare data for submission
    const submitData = { ...formData };

    // Convert empty dates to null
    if (!submitData.membership_since) {
      submitData.membership_since = null;
    }
    if (!submitData.membership_expires) {
      submitData.membership_expires = null;
    }

    onSubmit(submitData);
  };

  // Parse error message to highlight specific fields
  useEffect(() => {
    if (error) {
      const newFieldErrors = {};
      if (error.includes("name") && error.includes("already exists")) {
        newFieldErrors.name = "This client name already exists";
      }
      setFieldErrors(newFieldErrors);
    }
  }, [error]);

  return (
    <form onSubmit={handleSubmit} className="space-y-1">
      <div className="mb-1">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
          {client ? 'Edit Client' : 'Add New Client'}
        </h3>
      </div>

      <div className="form-floating mb-2">
        <input
          type="text"
          id="name"
          name="name"
          required
          value={formData.name}
          onChange={handleChange}
          className={`form-control form-control-sm ${fieldErrors.name ? 'border-red-500' : ''}`}
          placeholder="Name"
        />
        <label htmlFor="name">Name *</label>
        {fieldErrors.name && (
          <p className="text-red-500 text-sm mt-1">{fieldErrors.name}</p>
        )}
      </div>

      <div className="form-floating mb-2">
        <input
          type="email"
          id="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          className="form-control form-control-sm"
          placeholder="Email"
        />
        <label htmlFor="email">Email</label>
      </div>

      <div className="form-floating mb-2">
        <input
          type="tel"
          id="phone"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          className="form-control form-control-sm"
          placeholder="Phone"
        />
        <label htmlFor="phone">Phone</label>
      </div>

      <div className="form-floating mb-2">
        <textarea
          id="address"
          name="address"
          value={formData.address}
          onChange={handleChange}
          className="form-control form-control-sm"
          placeholder="Address"
          style={{ height: '60px' }}
        />
        <label htmlFor="address">Address</label>
      </div>

      <div className="form-floating mb-2">
        <textarea
          id="notes"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          className="form-control form-control-sm"
          placeholder="Notes"
          style={{ height: '60px' }}
        />
        <label htmlFor="notes">Notes</label>
      </div>

      {/* Membership Section */}
      <div className="border-t pt-1 mt-1">
        <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-1">Membership</h4>

        <div className="grid grid-cols-2 gap-2">
          <div className="form-floating">
            <select
              id="membership_tier"
              name="membership_tier"
              value={formData.membership_tier}
              onChange={handleChange}
              className="form-select form-select-sm"
            >
              {MEMBERSHIP_TIERS.map(tier => (
                <option key={tier.value} value={tier.value}>
                  {tier.label}
                </option>
              ))}
            </select>
            <label htmlFor="membership_tier">Membership Tier</label>
          </div>

          <div className="form-floating">
            <input
              type="number"
              id="membership_points"
              name="membership_points"
              min="0"
              value={formData.membership_points}
              onChange={handleChange}
              className="form-control form-control-sm"
              placeholder="0"
            />
            <label htmlFor="membership_points">Membership Points</label>
          </div>

          <div className="form-floating">
            <input
              type="date"
              id="membership_since"
              name="membership_since"
              value={formData.membership_since}
              onChange={handleChange}
              className="form-control form-control-sm"
              placeholder="Member Since"
            />
            <label htmlFor="membership_since">Member Since</label>
          </div>

          <div className="form-floating">
            <input
              type="date"
              id="membership_expires"
              name="membership_expires"
              value={formData.membership_expires}
              onChange={handleChange}
              className="form-control form-control-sm"
              placeholder="Membership Expires"
            />
            <label htmlFor="membership_expires">Membership Expires</label>
          </div>
        </div>
      </div>

      <ActionFooter>
        <IconButton icon={XMarkIcon} label="Cancel" onClick={onCancel} variant="secondary" />
        <IconButton icon={CheckIcon} label={client ? 'Update Client' : 'Create Client'} type="submit" variant="primary" />
      </ActionFooter>
    </form>
  );
}
