import React, { useState, useEffect } from 'react';
import useStore from '../store/useStore';

export default function AssetForm({ asset, onSubmit, onCancel }) {
  const { employees } = useStore();
  
  const [formData, setFormData] = useState({
    name: '',
    asset_type: '',
    serial_number: '',
    purchase_date: '',
    purchase_price: '',
    assigned_employee_id: '',
    status: 'active'
  });

  useEffect(() => {
    if (asset) {
      setFormData({
        name: asset.name || '',
        asset_type: asset.asset_type || '',
        serial_number: asset.serial_number || '',
        purchase_date: asset.purchase_date ? new Date(asset.purchase_date).toISOString().split('T')[0] : '',
        purchase_price: asset.purchase_price?.toString() || '',
        assigned_employee_id: asset.assigned_employee_id || '',
        status: asset.status || 'active'
      });
    }
  }, [asset]);

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
      purchase_date: formData.purchase_date ? new Date(formData.purchase_date).toISOString() : null,
      purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
      assigned_employee_id: formData.assigned_employee_id || null
    };
    onSubmit(submitData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          {asset ? 'Edit Asset' : 'Add New Asset'}
        </h3>
      </div>

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Asset Name *
        </label>
        <input
          type="text"
          id="name"
          name="name"
          required
          value={formData.name}
          onChange={handleChange}
          className="input-field mt-1"
          placeholder="Enter asset name"
        />
      </div>

      <div>
        <label htmlFor="asset_type" className="block text-sm font-medium text-gray-700">
          Asset Type *
        </label>
        <select
          id="asset_type"
          name="asset_type"
          required
          value={formData.asset_type}
          onChange={handleChange}
          className="input-field mt-1"
        >
          <option value="">Select asset type</option>
          <option value="Computer">Computer</option>
          <option value="Laptop">Laptop</option>
          <option value="Phone">Phone</option>
          <option value="Tablet">Tablet</option>
          <option value="Vehicle">Vehicle</option>
          <option value="Equipment">Equipment</option>
          <option value="Furniture">Furniture</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <div>
        <label htmlFor="serial_number" className="block text-sm font-medium text-gray-700">
          Serial Number
        </label>
        <input
          type="text"
          id="serial_number"
          name="serial_number"
          value={formData.serial_number}
          onChange={handleChange}
          className="input-field mt-1"
          placeholder="Enter serial number"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="purchase_date" className="block text-sm font-medium text-gray-700">
            Purchase Date
          </label>
          <input
            type="date"
            id="purchase_date"
            name="purchase_date"
            value={formData.purchase_date}
            onChange={handleChange}
            className="input-field mt-1"
          />
        </div>

        <div>
          <label htmlFor="purchase_price" className="block text-sm font-medium text-gray-700">
            Purchase Price
          </label>
          <input
            type="number"
            id="purchase_price"
            name="purchase_price"
            min="0"
            step="0.01"
            value={formData.purchase_price}
            onChange={handleChange}
            className="input-field mt-1"
            placeholder="0.00"
          />
        </div>
      </div>

      <div>
        <label htmlFor="assigned_employee_id" className="block text-sm font-medium text-gray-700">
          Assigned Employee
        </label>
        <select
          id="assigned_employee_id"
          name="assigned_employee_id"
          value={formData.assigned_employee_id}
          onChange={handleChange}
          className="input-field mt-1"
        >
          <option value="">No assignment</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.first_name} {employee.last_name} - {employee.role}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="status" className="block text-sm font-medium text-gray-700">
          Status *
        </label>
        <select
          id="status"
          name="status"
          required
          value={formData.status}
          onChange={handleChange}
          className="input-field mt-1"
        >
          <option value="active">Active</option>
          <option value="maintenance">Maintenance</option>
          <option value="retired">Retired</option>
        </select>
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
          {asset ? 'Update Asset' : 'Create Asset'}
        </button>
      </div>
    </form>
  );
}
