/*
 * ============================================================
 * FILE: Services.jsx
 *
 * PURPOSE:
 *   Admin page for managing the business's service catalogue. Displays all
 *   services in a scrollable table and allows authorised users to create,
 *   edit, and delete services via a full-screen form modal. Supports free-text
 *   search and category filtering from the sticky footer toolbar.
 *
 * FUNCTIONAL PARTS:
 *   [1]  Imports                   — React, router, icons, store, API, and child components
 *   [2]  Services Component        — Page shell with permission guard and store bindings
 *   [3]  State / Ref Declarations  — Search term, category filter, editing service, scroll ref, fetch guard
 *   [4]  Lifecycle / useEffect     — Initial service load and scroll-to-bottom after data arrives
 *   [5]  Data Loading              — loadServices fetches all services from the API
 *   [6]  CRUD Handlers             — handleCreateService, handleEditService, handleDeleteService, handleSubmitService
 *   [7]  Derived / Computed Values — useMemo for unique categories list and filtered services
 *   [8]  Render / Return           — Table layout, sticky footer with search/add/filter, and form modal
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-03-01 | Claude  | Added section comments and top-level documentation
 * ============================================================
 */

// ─── 1  IMPORTS ────────────────────────────────────────────────────────────
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { PlusIcon, FolderOpenIcon, XMarkIcon } from '@heroicons/react/24/outline';
import Button_Toolbar from './components/Button_Toolbar';
import useStore from '../services/useStore';
import { servicesAPI } from '../services/api';
import Modal from './components/Modal';
import Form_Service from './components/Form_Service';
import Gate_Permission from './components/Gate_Permission';

// ─── 2  SERVICES PAGE COMPONENT ───────────────────────────────────────────
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

  // ─── 3  STATE / REF DECLARATIONS ─────────────────────────────────────────
  const [editingService, setEditingService] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isCategoryFilterOpen, setIsCategoryFilterOpen] = useState(false);
  const scrollRef = useRef(null);
  const hasFetched = useRef(false);

  // ─── 4  LIFECYCLE / useEffect HOOKS ──────────────────────────────────────
  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    loadServices();
  }, []);

  // ─── 5  DATA LOADING ──────────────────────────────────────────────────────
  const loadServices = async () => {
    setLoading(true);
    try {
      const response = await servicesAPI.getAll();
      const servicesData = response?.data ?? response;
      if (Array.isArray(servicesData)) {
        setServices(servicesData);
        clearError();
      } else {
        setServices([]);
      }
    } catch (err) {
      setError('Failed to load services');
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  // ─── 6  CRUD HANDLERS ─────────────────────────────────────────────────────
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
        const response = await servicesAPI.create(serviceData);
        const newService = response.data;
        addService(newService);
        setEditingService(newService);
      }
      clearError();
    } catch (err) {
      setError('Failed to save service');
    }
  };

  // ─── 7  DERIVED / COMPUTED VALUES ────────────────────────────────────────
  // Get unique categories for filter
  const categories = useMemo(() => {
    const cats = new Set(services.map(s => s.category).filter(Boolean));
    return ['all', ...Array.from(cats)];
  }, [services]);

  // Filtered services
  const filteredServices = useMemo(() => {
    return services.filter((svc) => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        if (
          !(svc.name || '').toLowerCase().includes(term) &&
          !(svc.description || '').toLowerCase().includes(term) &&
          !(svc.category || '').toLowerCase().includes(term)
        ) return false;
      }
      if (categoryFilter !== 'all' && (svc.category || '') !== categoryFilter) return false;
      return true;
    });
  }, [services, searchTerm, categoryFilter]);

  // ─── 8  SECONDARY LIFECYCLE ───────────────────────────────────────────────
  // Scroll to bottom when data loads
  useEffect(() => {
    if (scrollRef.current && filteredServices.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredServices.length]);

  // ─── 9  RENDER / RETURN ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="d-flex flex-column overflow-hidden bg-body" style={{ height: '100dvh' }}>

      {/* Header */}
      <div className="flex-shrink-0 border-bottom p-2 bg-body" style={{ zIndex: 5 }}>
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

        {/* Scrollable rows – grow upwards from bottom */}
        <div
          ref={scrollRef}
          className="flex-grow-1 overflow-auto d-flex flex-column-reverse bg-white dark:bg-gray-900 no-scrollbar"
          style={{ background: 'var(--bs-body-bg)' }}
        >
          {filteredServices.length > 0 ? (
            <table className="table table-borderless table-hover mb-0 table-fixed">
              <colgroup>
                <col />
                <col style={{ width: '80px' }} />
                <col style={{ width: '70px' }} />
              </colgroup>
              <tbody>
                {filteredServices.map((service, index) => (
                  <tr
                    key={service.id || index}
                    className="align-middle border-bottom"
                    style={{ height: '56px', cursor: 'pointer' }}
                    onClick={() => handleEditService(service)}
                  >
                    {/* Name + Category stacked */}
                    <td className="px-1">
                      <div className="fw-medium" style={{ wordBreak: 'break-word' }}>
                        {service.name}
                      </div>
                      {service.category && (
                        <span
                          className="badge bg-secondary-subtle text-secondary rounded-pill"
                          style={{ fontSize: '0.68rem', width: 'fit-content' }}
                        >
                          {service.category}
                        </span>
                      )}
                    </td>

                    {/* Price */}
                    <td className="text-center px-1">
                      <span className="fw-medium">
                        ${(service.price || 0).toFixed(2)}
                      </span>
                    </td>

                    {/* Duration */}
                    <td className="text-center px-1">
                      <span className="badge bg-info-subtle text-info rounded-pill">
                        {service.duration_minutes || 30}m
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="d-flex align-items-center justify-content-center flex-grow-1 text-muted">
              {searchTerm || categoryFilter !== 'all' ? 'No services match filters' : 'No services found'}
            </div>
          )}
        </div>

        {/* Fixed footer – headers + controls */}
        <div className="app-footer-search flex-shrink-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-sm" style={{ zIndex: 10 }}>
          {/* Column Headers */}
          <table className="table table-borderless mb-0 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
            <colgroup>
              <col />
              <col style={{ width: '80px' }} />
              <col style={{ width: '70px' }} />
            </colgroup>
            <tfoot>
              <tr className="bg-gray-100 dark:bg-gray-700">
                <th>Service</th>
                <th className="text-center">Price</th>
                <th className="text-center">Duration</th>
              </tr>
            </tfoot>
          </table>

          {/* Controls */}
          <div className="p-3 pt-2 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            {/* Search */}
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
                className="app-search-input form-control ps-5 w-100 rounded-pill"
              />
            </div>

            {/* Add button + category filter */}
            <div className="d-flex align-items-center gap-1 pb-2 flex-wrap" style={{ minHeight: '3rem' }}>
              <Gate_Permission page="services" permission="write">
                <Button_Toolbar
                  icon={PlusIcon}
                  label="Add Service"
                  onClick={handleCreateService}
                  className="btn-app-primary"
                />
              </Gate_Permission>

              {/* Clear Filters Button */}
              {categoryFilter !== 'all' && (
                <Button_Toolbar
                  icon={XMarkIcon}
                  label="Clear"
                  onClick={() => setCategoryFilter('all')}
                  className="btn-app-danger"
                />
              )}

              {/* Category Filter */}
              <div className="position-relative">
                <Button_Toolbar
                  icon={FolderOpenIcon}
                  label="Filter Category"
                  onClick={() => setIsCategoryFilterOpen(!isCategoryFilterOpen)}
                  className={`border-0 shadow-lg transition-all ${
                    categoryFilter !== 'all'
                      ? 'bg-primary-600 hover:bg-primary-700 text-white'
                      : 'btn-app-secondary'
                  }`}
                  data-active={categoryFilter !== 'all'}
                />
                {isCategoryFilterOpen && (
                  <div className="position-absolute bottom-100 start-0 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-2 z-50" style={{ minWidth: '200px', maxHeight: '300px', overflowY: 'auto' }}>
                    {categories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => { setCategoryFilter(cat); setIsCategoryFilterOpen(false); }}
                        className={`d-block w-100 text-start px-3 py-2 rounded-lg mb-1 transition-colors ${categoryFilter === cat ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400' : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100'}`}
                      >
                        {cat === 'all' ? 'All Categories' : cat || 'No Category'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
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
