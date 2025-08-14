import React, { useState, useEffect } from 'react';

export default function ServiceForm({ service, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    duration_minutes: '60'
  });

  useEffect(() => {
    if (service) {
      setFormData({
        name: service.name || '',
        description: service.description || '',
        price: service.price?.toString() || '',
        duration_minutes: service.duration_minutes?.toString() || '60'
      });
    }
  }, [service]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      price: parseFloat(formData.price),
      duration_minutes: parseInt(formData.duration_minutes)
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          {service ? 'Edit Service' : 'Add New Service'}
        </h3>
      </div>

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Service Name *
        </label>
        <input
          type="text"
          id="name"
          name="name"
          required
          value={formData.name}
          onChange={handleChange}
          className="input-field mt-1"
          placeholder="Enter service name"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          value={formData.description}
          onChange={handleChange}
          className="input-field mt-1"
          placeholder="Service description"
        />
      </div>

      <div>
        <label htmlFor="price" className="block text-sm font-medium text-gray-700">
          Price *
        </label>
        <input
          type="number"
          id="price"
          name="price"
          required
          min="0"
          step="0.01"
          value={formData.price}
          onChange={handleChange}
          className="input-field mt-1"
          placeholder="0.00"
        />
      </div>

      <div>
        <label htmlFor="duration_minutes" className="block text-sm font-medium text-gray-700">
          Duration (minutes) *
        </label>
        <input
          type="number"
          id="duration_minutes"
          name="duration_minutes"
          required
          min="1"
          value={formData.duration_minutes}
          onChange={handleChange}
          className="input-field mt-1"
          placeholder="60"
        />
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="btn-primary"
        >
          {service ? 'Update Service' : 'Create Service'}
        </button>
      </div>
    </form>
  );
}
