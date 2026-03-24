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
 *   2026-03-07 | Copilot | Added per-option help popovers for category filter options
 * ============================================================
 */

// ─── 1  IMPORTS ────────────────────────────────────────────────────────────
import React, { useEffect, useState, useMemo, useRef } from 'react';
import useFetchOnce from '../services/useFetchOnce';
import usePagePermission from '../services/usePagePermission';
import useViewMode from '../services/useViewMode';
import PageLayout from './components/Page_Layout';
import PageTableFooter from './components/Page_Table_Footer';
import PageTableHeader from './components/Page_Table_Header';
import PageTableRow from './components/Page_Table_Row';
import { PlusIcon, FolderOpenIcon, XMarkIcon } from '@heroicons/react/24/outline';
import Button_Toolbar from './components/Button_Toolbar';
import useStore from '../services/useStore';
import { showConfirm } from '../services/showConfirm';
import { servicesAPI } from '../services/api';
import Modal from './components/Modal';
import Form_Service from './components/Form_Service';
import Gate_Permission from './components/Gate_Permission';
import Modal_Bulk_Import_Sheet from './components/Modal_Import_Sheet';

// ─── 2  SERVICES PAGE COMPONENT ───────────────────────────────────────────
export default function Services() {
  const {
    services, setServices, addService, updateService, removeService,
    loading, setLoading, error, setError, clearError,
    isModalOpen, modalContent, openModal, closeModal, hasPermission
  } = useStore();

  usePagePermission('services');

  // ─── 3  STATE / REF DECLARATIONS ─────────────────────────────────────────
  const [editingService, setEditingService] = useState(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isCategoryFilterOpen, setIsCategoryFilterOpen] = useState(false);
  const [categoryFilterHelpKey, setCategoryFilterHelpKey] = useState(null);
  const { isTrainingMode } = useViewMode();
  const scrollRef = useRef(null);

  // ─── 4  LIFECYCLE / useEffect HOOKS ──────────────────────────────────────
  useFetchOnce(() => loadServices());

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
    if (!await showConfirm('Are you sure you want to delete this service?')) return;
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

  const handleBulkImportServices = async (names) => {
    for (const name of names) {
      const response = await servicesAPI.create({ name });
      const newService = response?.data ?? response;
      addService(newService);
    }
    closeModal();
  };

  const handleBulkImportSheet = async (records) => {
    const result = await servicesAPI.bulkImport(records);
    await loadServices();
    setShowBulkImport(false);
    clearError();
    return result;
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
    <PageLayout title="Services" error={error}>

        <PageTableHeader columns={[{ label: 'Service' }, { label: 'Price', width: 80 }, { label: 'Duration', width: 70 }]} />

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
                  <PageTableRow
                    key={service.id || index}
                    onClick={() => handleEditService(service)}
                  >
                    {/* Name + Category stacked */}
                    <td className="main-page-table-data">
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
                    <td className="main-page-table-data text-center">
                      <span className="fw-medium">
                        ${(service.price || 0).toFixed(2)}
                      </span>
                    </td>

                    {/* Duration */}
                    <td className="main-page-table-data text-center">
                      <span className="badge bg-info-subtle text-info rounded-pill">
                        {service.duration_minutes || 30}m
                      </span>
                    </td>
                  </PageTableRow>
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
        <PageTableFooter
          searchTerm={searchTerm}
          onSearch={setSearchTerm}
          searchPlaceholder="Search services..."
        >
          <Gate_Permission page="services" permission="write">
            <Button_Toolbar
              icon={PlusIcon}
              label="Add Service"
              onClick={handleCreateService}
              className="btn-app-primary"
            />
            <Button_Toolbar
              icon={PlusIcon}
              label="Bulk"
              onClick={() => setShowBulkImport(true)}
              className="btn-app-secondary"
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
              onClick={() => {
                const nextOpen = !isCategoryFilterOpen;
                setIsCategoryFilterOpen(nextOpen);
                if (!nextOpen) setCategoryFilterHelpKey(null);
              }}
              className={`border-0 shadow-lg transition-all ${
                categoryFilter !== 'all'
                  ? 'bg-primary-600 hover:bg-primary-700 text-white'
                  : 'btn-app-secondary'
              }`}
              data-active={categoryFilter !== 'all'}
            />
            {isCategoryFilterOpen && (
              <div className="position-absolute bottom-100 start-0 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-2 z-50" style={{ minWidth: '200px', maxHeight: '300px', overflowY: 'auto' }}>
                {categories.map((cat, index) => {
                  const key = cat ?? '__none__';
                  const label = cat === 'all' ? 'All Categories' : cat || 'No Category';
                  const description =
                    cat === 'all'
                      ? 'Shows services from every category.'
                      : (cat || '').trim() === ''
                        ? 'Shows services that do not have a category assigned.'
                        : `Shows only services in the "${cat}" category.`;
                  const isLast = index === categories.length - 1;
                  const isSelected = categoryFilter === cat;
                  const isHelpOpen = categoryFilterHelpKey === String(key);

                  return (
                    <div key={String(key)} className={`d-flex align-items-center gap-1 ${isLast ? '' : 'mb-1'}`}>
                      <button
                        onClick={() => {
                          setCategoryFilter(cat);
                          setIsCategoryFilterOpen(false);
                          setCategoryFilterHelpKey(null);
                        }}
                        className={`d-block w-100 text-start px-3 py-2 rounded-lg transition-colors ${isSelected ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400' : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100'}`}
                      >
                        {label}
                      </button>

                      {isTrainingMode && (
                        <div className="position-relative flex-shrink-0">
                          <button
                            type="button"
                            aria-label={`${label} help`}
                            className="btn btn-sm text-gray-600 dark:text-gray-300 d-flex align-items-center justify-content-center"
                            style={{ width: '1.75rem', height: '1.75rem', lineHeight: 1, fontWeight: 700 }}
                            onMouseEnter={() => setCategoryFilterHelpKey(String(key))}
                            onMouseLeave={() => setCategoryFilterHelpKey((prev) => (prev === String(key) ? null : prev))}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setCategoryFilterHelpKey((prev) => (prev === String(key) ? null : String(key)));
                            }}
                          >
                            ?
                          </button>

                          {isHelpOpen && (
                            <div
                              className="position-absolute start-50 bottom-100 mb-2 p-2 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-start"
                              style={{ width: '260px', maxWidth: 'calc(100vw - 1rem)', transform: 'translateX(-55%)' }}
                              onMouseEnter={() => setCategoryFilterHelpKey(String(key))}
                              onMouseLeave={() => setCategoryFilterHelpKey((prev) => (prev === String(key) ? null : prev))}
                            >
                              <div className="fw-semibold text-gray-900 dark:text-gray-100 mb-1">{label}</div>
                              <div className="small text-gray-700 dark:text-gray-300">{description}</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </PageTableFooter>

      {/* Bulk Import Sheet Modal */}
      <Modal_Bulk_Import_Sheet
        isOpen={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        onImport={handleBulkImportSheet}
        title="Bulk Add Services"
        entityLabel="service"
        fieldOptions={[
          { value: 'name', label: 'Name (required)' },
          { value: 'category', label: 'Category' },
          { value: 'price', label: 'Price' },
          { value: 'duration_minutes', label: 'Duration (min)' },
          { value: 'description', label: 'Description' },
        ]}
        defaultFieldSequence={['name', 'category', 'price', 'duration_minutes', 'description']}
        buildRecord={(data) => {
          const errors = [];
          if (!data.name?.trim()) errors.push('Name is required.');

          let price = null;
          if (data.price !== undefined && data.price !== '') {
            const p = Number(String(data.price).replace(/,/g, '').trim());
            if (!Number.isFinite(p) || p < 0) errors.push('Price must be a non-negative number.');
            else price = p;
          }

          let duration = null;
          if (data.duration_minutes !== undefined && data.duration_minutes !== '') {
            const d = Number(String(data.duration_minutes).trim());
            if (!Number.isFinite(d) || d <= 0) errors.push('Duration must be a positive number.');
            else duration = Math.round(d);
          }

          return {
            record: errors.length ? null : {
              name: data.name.trim(),
              category: data.category || null,
              price: price ?? 0,
              duration_minutes: duration ?? 30,
              description: data.description || null,
            },
            errors,
          };
        }}
      />

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
            onBulkImport={!editingService ? handleBulkImportServices : null}
          />
        )}
      </Modal>

    </PageLayout>
  );
}
