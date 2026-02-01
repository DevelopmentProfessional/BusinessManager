import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { PlusIcon, MagnifyingGlassIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import useStore from '../services/useStore';
import { servicesAPI } from '../services/api';
import Modal from './components/Modal';
import ServiceForm from './components/ServiceForm';
import PermissionGate from './components/PermissionGate';
import CSVImportButton from './components/CSVImportButton';

export default function Services() {
  const {
    services, setServices, addService, updateService, removeService,
    loading, setLoading, error, setError, clearError,
    isModalOpen, modalContent, openModal, closeModal, hasPermission
  } = useStore();

  // Check permissions at page level
  if (!hasPermission('services', 'read') &&
      !hasPermission('services', 'write') &&
      !hasPermission('services', 'delete') &&
      !hasPermission('services', 'admin')) {
    return <Navigate to="/profile" replace />;
  }

  const [editingService, setEditingService] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const scrollRef = useRef(null);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    loadServices();
  }, []);

  const loadServices = async () => {
    setLoading(true);
    try {
      const response = await servicesAPI.getAll();
      const servicesData = response?.data ?? response;
      if (Array.isArray(servicesData)) {
        setServices(servicesData);
        clearError();
      } else {
        console.error('Invalid services data format:', servicesData);
        setServices([]);
      }
    } catch (err) {
      setError('Failed to load services');
      console.error('Error loading services:', err);
      setServices([]);
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
    try {
      await servicesAPI.delete(serviceId);
      removeService(serviceId);
      clearError();
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || 'Failed to delete service';
      setError(String(detail));
    }
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

  const handleCSVImport = async (records) => {
    let success = 0;
    let failed = 0;
    const errors = [];

    for (const record of records) {
      try {
        const serviceData = {
          name: record.name,
          description: record.description || '',
          price: parseFloat(record.price) || 0,
          duration_minutes: parseInt(record.duration_minutes) || parseInt(record.duration) || 30,
          category: record.category || '',
        };
        await servicesAPI.create(serviceData);
        success++;
      } catch (err) {
        failed++;
        const detail = err?.response?.data?.detail || err?.message || 'Unknown error';
        errors.push(`Row ${success + failed}: ${record.name || 'Unknown'} - ${detail}`);
      }
    }
    return { success, failed, errors };
  };

  // Get unique categories for filter
  const categories = useMemo(() => {
    const cats = new Set(services.map(s => s.category).filter(Boolean));
    return ['all', ...Array.from(cats)];
  }, [services]);

  // Filtered services based on search and category
  const filteredServices = useMemo(() => {
    return services.filter((svc) => {
      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesName = (svc.name || '').toLowerCase().includes(term);
        const matchesDesc = (svc.description || '').toLowerCase().includes(term);
        const matchesCat = (svc.category || '').toLowerCase().includes(term);
        if (!matchesName && !matchesDesc && !matchesCat) return false;
      }

      // Category filter
      if (categoryFilter !== 'all') {
        if ((svc.category || '') !== categoryFilter) return false;
      }

      return true;
    });
  }, [services, searchTerm, categoryFilter]);

  // Scroll to bottom when data loads
  useEffect(() => {
    if (scrollRef.current && filteredServices.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredServices.length]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="d-flex flex-column vh-100 overflow-hidden bg-body">

      {/* Header */}
      <div className="flex-shrink-0 border-bottom p-3">
        <h1 className="h-4 mb-0 fw-bold text-body-emphasis">Services</h1>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex-shrink-0 alert alert-danger border-0 rounded-0 m-0">
          {error}
        </div>
      )}

      {/* Main table container */}
      <div className="flex-grow-1 d-flex flex-column overflow-hidden">

        {/* Scrollable rows */}
        <div
          ref={scrollRef}
          className="flex-grow-1 overflow-auto d-flex flex-column-reverse bg-white"
          style={{ background: 'var(--bs-body-bg)' }}
        >
          {filteredServices.length > 0 ? (
            <table className="table table-borderless table-hover mb-0 table-fixed">
              <colgroup>
                <col style={{ width: '60px' }} />
                <col />
                <col style={{ width: '120px' }} />
                <col style={{ width: '100px' }} />
                <col style={{ width: '80px' }} />
                <col style={{ width: '60px' }} />
              </colgroup>
              <tbody>
                {filteredServices.map((svc, index) => (
                  <tr
                    key={svc.id || index}
                    className="align-middle border-bottom"
                    style={{ height: '56px' }}
                  >
                    {/* Delete */}
                    <td className="text-center px-2">
                      <PermissionGate page="services" permission="delete">
                        <button
                          onClick={() => handleDeleteService(svc.id)}
                          className="btn btn-sm btn-outline-danger border-0 p-1"
                          title="Delete"
                        >
                          ×
                        </button>
                      </PermissionGate>
                    </td>

                    {/* Name */}
                    <td className="px-3">
                      <div className="fw-medium text-truncate" style={{ maxWidth: '100%' }}>
                        {svc.name}
                      </div>
                      {svc.description && (
                        <div className="text-muted small text-truncate" style={{ maxWidth: '100%' }}>
                          {svc.description}
                        </div>
                      )}
                    </td>

                    {/* Category */}
                    <td className="px-3">
                      {svc.category && (
                        <span className="badge rounded-pill bg-secondary-subtle text-secondary">
                          {svc.category}
                        </span>
                      )}
                    </td>

                    {/* Price */}
                    <td className="text-center px-3">
                      <span className="badge rounded-pill bg-success-subtle text-success">
                        ${svc.price?.toFixed(2) || '0.00'}
                      </span>
                    </td>

                    {/* Duration */}
                    <td className="text-center px-3 text-muted small">
                      {svc.duration_minutes || 0} min
                    </td>

                    {/* Edit */}
                    <td className="text-center px-2">
                      <PermissionGate page="services" permission="write">
                        <button
                          onClick={() => handleEditService(svc)}
                          className="btn btn-sm btn-outline-primary border-0 p-1"
                          title="Edit"
                        >
                          ✎
                        </button>
                      </PermissionGate>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="d-flex align-items-center justify-content-center flex-grow-1 text-muted">
              No services found
            </div>
          )}
        </div>

        {/* Fixed bottom – headers + controls */}
        <div className="flex-shrink-0 bg-light border-top shadow-sm" style={{ zIndex: 10 }}>
          {/* Column Headers */}
          <table className="table table-borderless mb-0 bg-light">
            <colgroup>
              <col style={{ width: '60px' }} />
              <col />
              <col style={{ width: '120px' }} />
              <col style={{ width: '100px' }} />
              <col style={{ width: '80px' }} />
              <col style={{ width: '60px' }} />
            </colgroup>
            <tfoot>
              <tr className="bg-secondary-subtle">
                <th className="text-center"></th>
                <th>Service</th>
                <th>Category</th>
                <th className="text-center">Price</th>
                <th className="text-center">Duration</th>
                <th className="text-center"></th>
              </tr>
            </tfoot>
          </table>

          {/* Controls */}
          <div className="p-2 border-top">
            {/* Filters row */}
            <div className="d-flex flex-wrap gap-2 mb-2 align-items-center">
              <div className="flex-grow-1 position-relative" style={{ minWidth: '180px' }}>
                <span className="position-absolute top-50 start-0 translate-middle-y ps-2 text-muted">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0"/>
                  </svg>
                </span>
                <input
                  type="text"
                  placeholder="Search services..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="form-control ps-5"
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="form-select"
                style={{ maxWidth: '160px' }}
              >
                <option value="all">All Categories</option>
                {categories.filter(c => c !== 'all').map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              <span className="text-muted small ms-2">
                {filteredServices.length} / {services.length}
              </span>
            </div>

            {/* Action buttons */}
            <PermissionGate page="services" permission="write">
              <div className="d-flex gap-2">
                <div className="btn-group">
                  <CSVImportButton
                    entityName="Services"
                    onImport={handleCSVImport}
                    onComplete={loadServices}
                    requiredFields={['name']}
                    fieldMapping={{
                      'service name': 'name',
                      'service': 'name',
                      'duration': 'duration_minutes',
                      'time': 'duration_minutes',
                    }}
                    className="btn btn-outline-secondary"
                  />
                  <button
                    type="button"
                    onClick={handleCreateService}
                    className="btn btn-primary"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" className="me-1">
                      <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4"/>
                    </svg>
                    Add
                  </button>
                </div>
              </div>
            </PermissionGate>
          </div>
        </div>
      </div>

      {/* Service Form Modal */}
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
