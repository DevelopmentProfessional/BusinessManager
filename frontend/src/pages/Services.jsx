import React, { useEffect, useState } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import useStore from '../store/useStore';
import { usePermissionRefresh } from '../hooks/usePermissionRefresh';
import { servicesAPI } from '../services/api';
import Modal from '../components/Modal';
import ServiceForm from '../components/ServiceForm';
import MobileTable from '../components/MobileTable';
import MobileAddButton from '../components/MobileAddButton';
import PermissionGate from '../components/PermissionGate';
import { useLocation, useNavigate } from 'react-router-dom';

export default function Services() {
  const { 
    services, setServices, addService, updateService, removeService,
    loading, setLoading, error, setError, clearError,
    isModalOpen, modalContent, openModal, closeModal, hasPermission
  } = useStore();

  // Use the permission refresh hook
  usePermissionRefresh();

  const [editingService, setEditingService] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    loadServices();
  }, []);

  // Auto-open create modal when navigated with ?new=1 and then clean the URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('new') === '1') {
      setEditingService(null);
      openModal('service-form');
      params.delete('new');
      navigate({ pathname: location.pathname, search: params.toString() ? `?${params.toString()}` : '' }, { replace: true });
    }
  }, [location.search]);

  const loadServices = async () => {
    setLoading(true);
    try {
      const response = await servicesAPI.getAll();
      setServices(response.data);
      clearError();
    } catch (err) {
      setError('Failed to load services');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateService = () => {
    if (!hasPermission('services', 'write')) {
      setError('You do not have permission to create services');
      return;
    }
    setEditingService(null);
    openModal('service-form');
  };

  const handleEditService = (service) => {
    if (!hasPermission('services', 'write')) {
      setError('You do not have permission to edit services');
      return;
    }
    setEditingService(service);
    openModal('service-form');
  };

  const handleDeleteService = async (serviceId) => {
    if (!hasPermission('services', 'delete')) {
      setError('You do not have permission to delete services');
      return;
    }
    
    if (!window.confirm('Are you sure you want to delete this service?')) return;

    await servicesAPI.delete(serviceId);
    removeService(serviceId);
  };

  const handleImportCSV = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsImporting(true);
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await servicesAPI.uploadCSV(formData);
    if (response?.data) {
      loadServices();
    }
    
    setIsImporting(false);
    event.target.value = '';
  };

  const handleSubmitService = async (serviceData) => {
    try {
      if (editingService) {
        const response = await servicesAPI.update(editingService.id, serviceData);
        updateService(editingService.id, response.data);
      } else {
        const response = await servicesAPI.create(serviceData);
        addService(response.data);
      }
      closeModal();
      clearError();
    } catch (err) {
      setError('Failed to save service');
      console.error(err);
    }
  };

  const handleRefresh = () => {
    loadServices();
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Services</h1>
        
        {/* Search and Add Button Row */}
        <div className="mt-4">
          <div className="input-group">
            <input
              type="text"
              placeholder="Search services by name or category..."
              className="form-control"
            />
            <PermissionGate page="services" permission="write">
              <div className="input-group-append d-flex">
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="btn btn-outline-secondary"
                >
                  <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </button>
                <label className="btn btn-outline-primary cursor-pointer">
                  <ArrowUpTrayIcon className="h-4 w-4 mr-1" />
                  {isImporting ? 'Importing...' : 'Import CSV'}
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleImportCSV}
                    className="hidden"
                    disabled={isImporting}
                  />
                </label>
              </div>
            </PermissionGate>
          </div>
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
          data={services}
          columns={[
            { key: 'name', title: 'Name' },
            { key: 'price', title: 'Price', render: (v) => `$${v.toFixed(2)}` },
            { key: 'duration_minutes', title: 'Duration', render: (v) => `${v} min` },
          ]}
          onEdit={(item) => handleEditService(item)}
          onDelete={(item) => handleDeleteService(item.id)}
          editPermission={{ page: 'services', permission: 'write' }}
          deletePermission={{ page: 'services', permission: 'delete' }}
          emptyMessage="No services found"
        />
        <PermissionGate page="services" permission="write">
          <MobileAddButton onClick={handleCreateService} label="Add" />
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
                      Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="relative px-6 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {services.map((service) => (
                    <tr key={service.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {service.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${service.price.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {service.duration_minutes} min
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {service.description || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                        <PermissionGate page="services" permission="delete">
                          <button
                            onClick={() => handleDeleteService(service.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </PermissionGate>
                        <PermissionGate page="services" permission="write">
                          <button
                            onClick={() => handleEditService(service)}
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
              
              {services.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500">No services found. Add your first service to get started.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal for Service Form */}
      <Modal isOpen={isModalOpen && modalContent === 'service-form'} onClose={closeModal}>
        {isModalOpen && modalContent === 'service-form' && (
          <ServiceForm
            service={editingService}
            onSubmit={handleSubmitService}
            onCancel={closeModal}
          />
        )}
      </Modal>
    </div>
  );
}
