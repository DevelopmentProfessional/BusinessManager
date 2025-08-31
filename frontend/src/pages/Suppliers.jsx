import React, { useEffect, useState } from 'react';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import useStore from '../store/useStore';
import { usePermissionRefresh } from '../hooks/usePermissionRefresh';
import { suppliersAPI } from '../services/api';
import Modal from '../components/Modal';
import MobileTable from '../components/MobileTable';
import MobileAddButton from '../components/MobileAddButton';
import PermissionGate from '../components/PermissionGate';
import { useLocation, useNavigate } from 'react-router-dom';

export default function Suppliers() {
  const { 
    loading, setLoading, error, setError, clearError,
    isModalOpen, modalContent, openModal, closeModal, hasPermission
  } = useStore();

  // Use the permission refresh hook
  usePermissionRefresh();

  const [suppliers, setSuppliers] = useState([]);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    loadSuppliers();
  }, []);

  // Auto-open create modal when navigated with ?new=1 and then clean the URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('new') === '1') {
      setEditingSupplier(null);
      openModal('supplier-form');
      params.delete('new');
      navigate({ pathname: location.pathname, search: params.toString() ? `?${params.toString()}` : '' }, { replace: true });
    }
  }, [location.search]);

  const loadSuppliers = async () => {
    setLoading(true);
    try {
      const response = await suppliersAPI.getAll();
      setSuppliers(response.data);
      clearError();
    } catch (err) {
      setError('Failed to load suppliers');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSupplier = () => {
    if (!hasPermission('suppliers', 'write')) {
      setError('You do not have permission to create suppliers');
      return;
    }
    setEditingSupplier(null);
    openModal('supplier-form');
  };

  const handleEditSupplier = (supplier) => {
    if (!hasPermission('suppliers', 'write')) {
      setError('You do not have permission to edit suppliers');
      return;
    }
    setEditingSupplier(supplier);
    openModal('supplier-form');
  };

  const handleDeleteSupplier = async (supplierId) => {
    if (!hasPermission('suppliers', 'delete')) {
      setError('You do not have permission to delete suppliers');
      return;
    }
    
    if (!window.confirm('Are you sure you want to delete this supplier?')) return;

    try {
      await suppliersAPI.delete(supplierId);
      setSuppliers(suppliers.filter(s => s.id !== supplierId));
      clearError();
    } catch (err) {
      setError('Failed to delete supplier');
      console.error(err);
    }
  };

  const handleSubmitSupplier = async (supplierData) => {
    try {
      if (editingSupplier) {
        const response = await suppliersAPI.update(editingSupplier.id, supplierData);
        setSuppliers(suppliers.map(s => s.id === editingSupplier.id ? response.data : s));
      } else {
        const response = await suppliersAPI.create(supplierData);
        setSuppliers([...suppliers, response.data]);
      }
      closeModal();
      clearError();
    } catch (err) {
      setError('Failed to save supplier');
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <PermissionGate page="suppliers" permission="write">
            <button
              type="button"
              onClick={handleCreateSupplier}
              className="btn-primary flex items-center"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Add Supplier
            </button>
          </PermissionGate>
        </div>
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Mobile view */}
      <div className="mt-6 md:hidden">
        <MobileTable
          data={suppliers}
          columns={[
            { key: 'name', title: 'Name' },
            { key: 'email', title: 'Email' },
            { key: 'phone', title: 'Phone' },
          ]}
          onEdit={(item) => handleEditSupplier(item)}
          onDelete={(item) => handleDeleteSupplier(item.id)}
          editPermission={{ page: 'suppliers', permission: 'write' }}
          deletePermission={{ page: 'suppliers', permission: 'delete' }}
          emptyMessage="No suppliers found"
        />
        <PermissionGate page="suppliers" permission="write">
          <MobileAddButton onClick={handleCreateSupplier} label="Add" />
        </PermissionGate>
      </div>

      {/* Desktop table */}
      <div className="mt-8 flow-root hidden md:block">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Phone
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Address
                    </th>
                    <th className="relative px-6 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {suppliers.map((supplier) => (
                    <tr key={supplier.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {supplier.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {supplier.email || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {supplier.phone || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {supplier.address || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                        <PermissionGate page="suppliers" permission="delete">
                          <button
                            onClick={() => handleDeleteSupplier(supplier.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </PermissionGate>
                        <PermissionGate page="suppliers" permission="write">
                          <button
                            onClick={() => handleEditSupplier(supplier)}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="Edit"
                          >
                            <PencilIcon className="h-5 w-5" />
                          </button>
                        </PermissionGate>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {suppliers.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500">No suppliers found. Add your first supplier to get started.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal for Supplier Form */}
      <Modal isOpen={isModalOpen && modalContent === 'supplier-form'} onClose={closeModal}>
        {isModalOpen && modalContent === 'supplier-form' && (
          <SupplierForm
            supplier={editingSupplier}
            onSubmit={handleSubmitSupplier}
            onCancel={closeModal}
          />
        )}
      </Modal>
    </div>
  );
}

// Simple Supplier Form Component
function SupplierForm({ supplier, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    name: supplier?.name || '',
    email: supplier?.email || '',
    phone: supplier?.phone || '',
    address: supplier?.address || '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">
        {supplier ? 'Edit Supplier' : 'Add Supplier'}
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Name *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
        
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
        
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
            Phone
          </label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
        
        <div>
          <label htmlFor="address" className="block text-sm font-medium text-gray-700">
            Address
          </label>
          <textarea
            id="address"
            name="address"
            value={formData.address}
            onChange={handleChange}
            rows={3}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
        
        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            {supplier ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}
