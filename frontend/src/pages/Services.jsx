import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import useStore from '../services/useStore';
import { servicesAPI } from '../services/api';
import Modal from './components/Modal';
import Form_Service from './components/Form_Service';
import Gate_Permission from './components/Gate_Permission';
import Button_ImportCSV from './components/Button_ImportCSV';

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
        closeModal();
      } else {
        // After creating, stay open in edit mode so relations can be managed
        const response = await servicesAPI.create(serviceData);
        const newService = response.data;
        addService(newService);
        setEditingService(newService);
      }
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
      <div className="d-flex justify-content-center align-items-center" style={{ height: '16rem' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
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

        {/* Container_Scrollable rows – grow upwards from bottom */}
        <div
          ref={scrollRef}
          className="flex-grow-1 overflow-auto d-flex flex-column-reverse bg-white"
          style={{ background: 'var(--bs-body-bg)' }}
        >
          {filteredServices.length > 0 ? (
            <table className="table table-borderless table-hover mb-0 table-fixed">
              <colgroup>
                <col />
                <col style={{ width: '100px' }} />
                <col style={{ width: '80px' }} />
                <col style={{ width: '80px' }} />
              </colgroup>
              <tbody>
                {filteredServices.map((service, index) => (
                  <tr
                    key={service.id || index}
                    className="align-middle border-bottom"
                    style={{ height: '56px', cursor: 'pointer' }}
                    onClick={() => handleEditService(service)}
                  >
                    {/* Service Name */}
                    <td className="px-3">
                      <div className="fw-medium text-truncate" style={{ maxWidth: '100%' }}>
                        {service.name}
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-3">
                      <span className="badge bg-secondary-subtle text-secondary rounded-pill">
                        {service.category || 'General'}
                      </span>
                    </td>

                    {/* Price */}
                    <td className="text-center px-3">
                      <span className="fw-medium">
                        ${(service.price || 0).toFixed(2)}
                      </span>
                    </td>

                    {/* Duration */}
                    <td className="text-center px-3">
                      <span className="badge bg-info text-white rounded-pill">
                        {service.duration_minutes || 30}min
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="d-flex align-items-center justify-content-center flex-grow-1 text-muted">
              {searchTerm || categoryFilter !== 'all' ? 'No services found matching filters' : 'No services found'}
            </div>
          )}
        </div>

        {/* Fixed bottom – headers + controls */}
        <div className="app-footer-search flex-shrink-0 bg-white dark:bg-gray-800 border-top border-gray-200 dark:border-gray-700 shadow-sm" style={{ zIndex: 10 }}>
          {/* Column Headers */}
          <table className="table table-borderless mb-0 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
            <colgroup>
              <col />
              <col style={{ width: '100px' }} />
              <col style={{ width: '80px' }} />
              <col style={{ width: '80px' }} />
            </colgroup>
            <tfoot>
              <tr className="bg-gray-100 dark:bg-gray-700">
                <th>Service</th>
                <th>Category</th>
                <th className="text-center">Price</th>
                <th className="text-center">Duration</th>
              </tr>
            </tfoot>
          </table>

          {/* Controls */}
          <div className="p-2 border-top border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            {/* Search row */}
            <div className="position-relative w-100 mb-2">
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
                className="app-search-input form-control ps-5 w-100"
              />
            </div>

            {/* Filters row */}
            <div className="d-flex gap-2 mb-2">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="form-select form-select-sm"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat === 'all' ? 'All Categories' : cat || 'No Category'}
                  </option>
                ))}
              </select>

              <span className="text-muted small text-nowrap">
                {filteredServices.length} / {services.length}
              </span>
            </div>

            {/* Action buttons */}
            <Gate_Permission page="services" permission="write">
              <div className="d-flex gap-2 w-100">
                <Button_ImportCSV
                  entityName="Services"
                  onImport={handleCSVImport}
                  onComplete={loadServices}
                  requiredFields={['name']}
                  fieldMapping={{
                    'service name': 'name',
                    'service': 'name',
                    'cost': 'price',
                    'rate': 'price',
                    'time': 'duration_minutes',
                    'duration': 'duration_minutes',
                    'type': 'category',
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
            </Gate_Permission>
          </div>
        </div>
      </div>

      {/* Service Form Modal */}
      <Modal
        isOpen={isModalOpen && modalContent === 'service-form'}
        onClose={closeModal}
        noPadding={true}
        fullScreen={true}
      >
        {isModalOpen && modalContent === 'service-form' && (
          <Form_Service
            service={editingService}
            onSubmit={handleSubmitService}
            onCancel={closeModal}
            onDelete={editingService && hasPermission('services', 'delete') ? handleDeleteService : null}
            canDelete={editingService && hasPermission('services', 'delete')}
          />
        )}
      </Modal>

    </div>
  );
}
