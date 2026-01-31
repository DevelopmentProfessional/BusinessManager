import React, { useEffect, useState } from 'react';
import { XMarkIcon, CheckIcon, PhotoIcon } from '@heroicons/react/24/outline';
import CustomDropdown from './CustomDropdown';
import IconButton from './IconButton';
import ActionFooter from './ActionFooter';

export default function ItemForm({ onSubmit, onCancel, item = null, initialSku = '', showInitialQuantity = false, onSubmitWithExtras = null }) {
  const [formData, setFormData] = useState({
    name: '',
    sku: initialSku || '',
    price: '',
    description: '',
    // Use enum names expected by backend/DB enum (PRODUCT, RESOURCE, ASSET)
    type: 'PRODUCT',
    image_url: '',
  });
  const [initialQuantity, setInitialQuantity] = useState('0');

  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name || '',
        sku: item.sku || initialSku || '',
        price: item.price != null ? String(item.price) : '',
        description: item.description || '',
        // Accept either value or name from API; normalize to enum NAME for submission
        type: (typeof item.type === 'string'
          ? (['PRODUCT','RESOURCE','ASSET'].includes(item.type.toUpperCase())
              ? item.type.toUpperCase()
              : 'PRODUCT')
          : 'PRODUCT'),
        image_url: item.image_url || '',
      });
    } else if (initialSku) {
      setFormData(prev => ({ ...prev, sku: initialSku }));
    }
  }, [item, initialSku]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Sanitize and validate fields
    const priceNum = Number(formData.price);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      alert('Please enter a valid non-negative price.');
      return;
    }
    const name = (formData.name || '').trim();
    const sku = (formData.sku || '').trim();
    const description = (formData.description || '').trim();
    if (!name || !sku) {
      alert('Name and SKU are required.');
      return;
    }
    const type = typeof formData.type === 'string'
      ? formData.type.toUpperCase()
      : 'PRODUCT';
    const image_url = (formData.image_url || '').trim();
    const payload = {
      name,
      sku,
      price: priceNum,
      description: description || undefined,
      // Backend accepts enum name or value; we send NAME for clarity
      type,
      image_url: image_url || undefined,
    };
    const qty = parseInt(String(initialQuantity || '0'), 10);
    const safeQty = Number.isFinite(qty) && qty >= 0 ? qty : 0;
    if (onSubmitWithExtras) {
      onSubmitWithExtras(payload, { initialQuantity: safeQty });
    } else {
      onSubmit(payload);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          {item ? 'Edit Item' : 'Add New Item'}
        </h3>
      </div>

      {showInitialQuantity && (
        <div>
          <label htmlFor="initialQuantity" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Initial Quantity
          </label>
          <input
            type="number"
            id="initialQuantity"
            name="initialQuantity"
            min="0"
            value={initialQuantity}
            onChange={(e) => setInitialQuantity(e.target.value)}
            className="input-field mt-1"
            placeholder="0"
          />
        </div>
      )}

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Item Name *
        </label>
        <input
          type="text"
          id="name"
          name="name"
          required
          value={formData.name}
          onChange={handleChange}
          className="input-field mt-1"
          placeholder="Enter item name"
        />
      </div>

      <div>
        <label htmlFor="sku" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          SKU *
        </label>
        <input
          type="text"
          id="sku"
          name="sku"
          required
          value={formData.sku}
          onChange={handleChange}
          className="input-field mt-1"
          placeholder="Enter item SKU"
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
        <label htmlFor="type" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Item Type *
        </label>
        <CustomDropdown
          name="type"
          value={formData.type}
          onChange={handleChange}
          options={[
            { value: 'PRODUCT', label: 'Product' },
            { value: 'RESOURCE', label: 'Resource' },
            { value: 'ASSET', label: 'Asset' }
          ]}
          placeholder="Select item type"
          required
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
          placeholder="Item description"
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

      <ActionFooter>
        <IconButton icon={XMarkIcon} label="Cancel" onClick={onCancel} variant="secondary" />
        <IconButton icon={CheckIcon} label={item ? 'Save Changes' : 'Create Item'} type="submit" variant="primary" />
      </ActionFooter>
    </form>
  );
}
