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

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300">
          Name *
        </label>
        <input
          type="text"
          id="name"
          name="name"
          required
          value={formData.name}
          onChange={handleChange}
          className={`input-field mt-1 ${fieldErrors.name ? 'border-red-500' : ''}`}
          placeholder="Name"
        />
        {fieldErrors.name && (
          <p className="text-red-500 text-sm mt-1">{fieldErrors.name}</p>
        )}
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Email
        </label>
        <input
          type="email"
          id="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          className="input-field mt-1"
          placeholder="Email"
        />
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Phone
        </label>
        <input
          type="tel"
          id="phone"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          className="input-field mt-1"
          placeholder="Phone"
        />
      </div>

      <div>
        <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Address
        </label>
        <textarea
          id="address"
          name="address"
          rows={2}
          value={formData.address}
          onChange={handleChange}
          className="input-field mt-1"
          placeholder="Address"
        />
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          value={formData.notes}
          onChange={handleChange}
          className="input-field mt-1"
          placeholder="Notes"
        />
      </div>

      {/* Membership Section */}
      <div className="border-t pt-1 mt-1">
        <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-1">Membership</h4>

        <div className="grid grid-cols-2 gap-1">
          <div>
            <label htmlFor="membership_tier" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Membership Tier
            </label>
            <select
              id="membership_tier"
              name="membership_tier"
              value={formData.membership_tier}
              onChange={handleChange}
              className="input-field mt-1"
            >
              {MEMBERSHIP_TIERS.map(tier => (
                <option key={tier.value} value={tier.value}>
                  {tier.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="membership_points" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Membership Points
            </label>
            <input
              type="number"
              id="membership_points"
              name="membership_points"
              min="0"
              value={formData.membership_points}
              onChange={handleChange}
              className="input-field mt-1"
              placeholder="0"
            />
          </div>

          <div>
            <label htmlFor="membership_since" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Member Since
            </label>
            <input
              type="date"
              id="membership_since"
              name="membership_since"
              value={formData.membership_since}
              onChange={handleChange}
              className="input-field mt-1"
            />
          </div>

          <div>
            <label htmlFor="membership_expires" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Membership Expires
            </label>
            <input
              type="date"
              id="membership_expires"
              name="membership_expires"
              value={formData.membership_expires}
              onChange={handleChange}
              className="input-field mt-1"
            />
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
