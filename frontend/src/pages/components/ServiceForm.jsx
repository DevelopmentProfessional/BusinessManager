import React, { useState, useEffect } from 'react';
import { XMarkIcon, CheckIcon, PhotoIcon } from '@heroicons/react/24/outline';
import IconButton from './IconButton';
import ActionFooter from './ActionFooter';

export default function ServiceForm({ service, onSubmit, onCancel, onDelete, canDelete }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    price: '',
    duration_minutes: '60',
    image_url: ''
  });

  useEffect(() => {
    if (service) {
      setFormData({
        name: service.name || '',
        description: service.description || '',
        category: service.category || '',
        price: service.price?.toString() || '',
        duration_minutes: service.duration_minutes?.toString() || '60',
        image_url: service.image_url || ''
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
    const submitData = {
      ...formData,
      price: parseFloat(formData.price),
      duration_minutes: parseInt(formData.duration_minutes)
    };
    // Only include image_url if it has a value
    if (!submitData.image_url) delete submitData.image_url;
    if (!submitData.category) delete submitData.category;
    onSubmit(submitData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-1">
      <div className="mb-1">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
          {service ? 'Edit Service' : 'Add New Service'}
        </h3>
      </div>

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
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
        <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Category
        </label>
        <input
          type="text"
          id="category"
          name="category"
          value={formData.category}
          onChange={handleChange}
          className="input-field mt-1"
          placeholder="e.g., Hair, Nails, Spa"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
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
        <label htmlFor="price" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
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
        <label htmlFor="duration_minutes" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
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

      <div>
        <label htmlFor="image_url" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          <PhotoIcon className="h-4 w-4 inline mr-1" />
          Image URL
        </label>
        <input
          type="url"
          id="image_url"
          name="image_url"
          value={formData.image_url}
          onChange={handleChange}
          className="input-field mt-1"
          placeholder="https://example.com/image.jpg"
        />
        {formData.image_url && (
          <div className="mt-2">
            <img 
              src={formData.image_url} 
              alt="Preview" 
              className="h-20 w-20 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
              onError={(e) => e.target.style.display = 'none'}
            />
          </div>
        )}
      </div>

      <div className="d-flex justify-content-between align-items-center mt-4">
        <div>
          {service && canDelete && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Are you sure you want to delete this service?')) {
                  onDelete(service.id);
                }
              }}
              className="btn btn-outline-danger"
            >
              Delete Service
            </button>
          )}
        </div>
        <div className="d-flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-outline-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
          >
            {service ? 'Update Service' : 'Create Service'}
          </button>
        </div>
      </div>
    </form>
  );
}
