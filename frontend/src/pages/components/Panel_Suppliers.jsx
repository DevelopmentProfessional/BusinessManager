/*
 * ============================================================
 * FILE: Suppliers_Panel.jsx
 *
 * PURPOSE:
 *   Full-screen panel for managing suppliers, accessed from the Inventory
 *   page footer. Replaces the standalone Suppliers.jsx page. Displays a
 *   scrollable supplier list and an inline create/edit form.
 *
 * FUNCTIONAL PARTS:
 *   [1] State & Effects    — suppliers list, loading, form visibility, panel reset on open/close
 *   [2] Data Loading       — loadSuppliers fetches all suppliers from the API
 *   [3] Event Handlers     — handleCreate, handleEdit, handleDelete, handleSubmit, handleCancelForm
 *   [4] Render: Header     — title with count, Add button (list mode) or back arrow (form mode)
 *   [5] Render: Body       — scrollable supplier list OR SupplierForm (toggled by showForm state)
 *   [6] Render: Footer     — Close button (list mode) or Cancel + Submit buttons (form mode)
 *   [7] SupplierForm       — Inline form component for name, email, phone, address
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-03-01 | Claude  | Created — extracted from Suppliers.jsx for Inventory integration
 *   2026-03-14 | Cascade | Moved Add Supplier to header in list mode and centered footer Close button   *   2026-03-15 | Copilot | Wrapped footer buttons in col-10/row g-0 to avoid overlap with bottom-right menu button * ============================================================
 */

import React, { useEffect, useState } from 'react';
import {
  PlusIcon, PencilIcon, TrashIcon,
  XMarkIcon, CheckIcon
} from '@heroicons/react/24/outline';
import useStore from '../../services/useStore';
import { suppliersAPI } from '../../services/api';
import { showConfirm } from '../../services/showConfirm';
import Modal from './Modal';
import Button_Toolbar from './Button_Toolbar';
import Gate_Permission from './Gate_Permission';
import ProcurementUI from './ProcurementUI';

// ─── 1 COMPONENT DEFINITION ──────────────────────────────────────────────────
export default function Suppliers_Panel({ isOpen, onClose }) {
  const { setError, clearError } = useStore();

  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [procurementSupplier, setProcurementSupplier] = useState(null);

  // ─── 2 EFFECTS ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      loadSuppliers();
    } else {
      // Reset form state when panel closes
      setShowForm(false);
      setEditingSupplier(null);
      setProcurementSupplier(null);
    }
  }, [isOpen]);

  // ─── 3 DATA LOADING ────────────────────────────────────────────────────────
  const loadSuppliers = async () => {
    setLoading(true);
    try {
      const response = await suppliersAPI.getAll();
      const data = response?.data ?? response;
      if (Array.isArray(data)) {
        setSuppliers(data);
        clearError();
      } else {
        setError('Invalid data format received from server');
        setSuppliers([]);
      }
    } catch {
      setError('Failed to load suppliers');
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  };

  // ─── 4 EVENT HANDLERS ──────────────────────────────────────────────────────
  const handleCreate = () => {
    setEditingSupplier(null);
    setShowForm(true);
  };

  const handleEdit = (supplier) => {
    setEditingSupplier(supplier);
    setShowForm(true);
  };

  const handleDelete = async (supplierId) => {
    if (!await showConfirm('Are you sure you want to delete this supplier?')) return;
    try {
      await suppliersAPI.delete(supplierId);
      setSuppliers(prev => prev.filter(s => s.id !== supplierId));
      clearError();
    } catch {
      setError('Failed to delete supplier');
    }
  };

  const handleSubmit = async (formData) => {
    try {
      if (editingSupplier) {
        const response = await suppliersAPI.update(editingSupplier.id, formData);
        setSuppliers(prev => prev.map(s => s.id === editingSupplier.id ? response.data : s));
      } else {
        const response = await suppliersAPI.create(formData);
        setSuppliers(prev => [...prev, response.data]);
      }
      setShowForm(false);
      setEditingSupplier(null);
      clearError();
    } catch {
      setError('Failed to save supplier');
    }
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingSupplier(null);
  };

  const handleOpenProcurement = (supplier) => {
    setProcurementSupplier(supplier);
    setShowForm(false);
    setEditingSupplier(null);
  };

  // ─── 5 RENDER ──────────────────────────────────────────────────────────────
  return (
    <Modal isOpen={isOpen} onClose={onClose} noPadding={true} fullScreen={true}>
      <div className="d-flex flex-column bg-white dark:bg-gray-900" style={{ height: '100%' }}>

        {/* ── HEADER ── */}
        <div className="flex-shrink-0 p-2 border-bottom d-flex align-items-center justify-content-between gap-2 bg-white dark:bg-gray-900">
          {showForm ? (
            <h6 className="mb-0 fw-semibold text-gray-900 dark:text-gray-100">
              {editingSupplier ? 'Edit Supplier' : 'Add Supplier'}
            </h6>
          ) : procurementSupplier ? (
            <div className="d-flex align-items-center gap-2">
              <h6 className="mb-0 fw-semibold text-gray-900 dark:text-gray-100">Procurement</h6>
              <span className="text-muted small">{procurementSupplier.name}</span>
            </div>
          ) : (
            <div className="d-flex align-items-center gap-2">
              <h6 className="mb-0 fw-semibold text-gray-900 dark:text-gray-100">Suppliers</h6>
              <span className="text-muted small">({suppliers.length})</span>
            </div>
          )}
          {!showForm && !procurementSupplier && (
            <Gate_Permission page="suppliers" permission="write">
              <Button_Toolbar
                icon={PlusIcon}
                label="Add Supplier"
                onClick={handleCreate}
                className="btn-app-primary"
              />
            </Gate_Permission>
          )}
        </div>

        {/* ── BODY ── */}
        <div className="flex-grow-1 overflow-auto no-scrollbar d-flex flex-column">
          {showForm ? (
            <SupplierForm
              supplier={editingSupplier}
              onSubmit={handleSubmit}
              onCancel={handleCancelForm}
              className="flex-grow-1"
            />
          ) : procurementSupplier ? (
            <div className="p-3">
              <ProcurementUI
                supplierId={procurementSupplier.id}
                onPOCreated={loadSuppliers}
              />
            </div>
          ) : loading ? (
            <div className="d-flex justify-content-center align-items-center" style={{ height: '200px' }}>
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
            </div>
          ) : suppliers.length === 0 ? (
            <div className="d-flex align-items-center justify-content-center text-muted" style={{ height: '200px' }}>
              No suppliers found. Add your first supplier.
            </div>
          ) : (
            <div>
              {suppliers.map(supplier => (
                <div
                  key={supplier.id}
                  className="px-3 py-3 d-flex align-items-center gap-2 border-bottom"
                >
                  <Gate_Permission page="suppliers" permission="delete">
                    <button
                      type="button"
                      onClick={() => handleDelete(supplier.id)}
                      className="btn btn-outline-danger btn-sm d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{ width: '3rem', height: '3rem' }}
                      title="Delete"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </Gate_Permission>
                  <div className="min-w-0 flex-1">
                    <div className="fw-medium text-gray-900 dark:text-gray-100">{supplier.name}</div>
                    {supplier.email && (
                      <div className="small text-muted">{supplier.email}</div>
                    )}
                    {supplier.phone && (
                      <div className="small text-muted">{supplier.phone}</div>
                    )}
                    {supplier.address && (
                      <div className="small text-muted text-truncate">{supplier.address}</div>
                    )}
                  </div>
                  <Gate_Permission page="suppliers" permission="write">
                    <button
                      type="button"
                      onClick={() => handleOpenProcurement(supplier)}
                      className="btn btn-outline-primary btn-sm d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{ width: '3rem', height: '3rem' }}
                      title="Procurement"
                    >
                      PO
                    </button>
                  </Gate_Permission>
                  <Gate_Permission page="suppliers" permission="write">
                    <button
                      type="button"
                      onClick={() => handleEdit(supplier)}
                      className="btn btn-outline-secondary btn-sm d-flex align-items-center justify-content-center flex-shrink-0"
                      style={{ width: '3rem', height: '3rem' }}
                      title="Edit"
                    >
                      <PencilIcon className="h-5 w-5" />
                    </button>
                  </Gate_Permission>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── FOOTER ── */}
        <div className="flex-shrink-0 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="row g-0">
            <div className={`col-10 d-flex align-items-center gap-3 px-4 flex-wrap ${showForm ? 'justify-content-between' : 'justify-content-center'}`}>
              {showForm ? (
                <>
                  <Button_Toolbar
                    icon={XMarkIcon}
                    label="Cancel"
                    onClick={handleCancelForm}
                    className="btn-outline-secondary"
                  />
                  <Button_Toolbar
                    icon={CheckIcon}
                    label="Save"
                    type="submit"
                    form="supplier-panel-form"
                    className="bg-secondary-600 hover:bg-secondary-700 text-white border-0 shadow-lg"
                  />
                </>
              ) : procurementSupplier ? (
                <Button_Toolbar
                  icon={XMarkIcon}
                  label="Back"
                  onClick={() => setProcurementSupplier(null)}
                  className="btn-outline-secondary"
                />
              ) : (
                <Button_Toolbar
                  icon={XMarkIcon}
                  label="Close"
                  onClick={onClose}
                  className="btn-outline-secondary"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── 6 SUPPLIER FORM COMPONENT ────────────────────────────────────────────────
function SupplierForm({ supplier, onSubmit, className = '' }) {
  const [formData, setFormData] = useState({
    name: supplier?.name || '',
    email: supplier?.email || '',
    phone: supplier?.phone || '',
    address: supplier?.address || '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form id="supplier-panel-form" onSubmit={handleSubmit} className={`p-3 d-flex flex-column ${className}`} style={{ minHeight: '100%' }}>
      <div className="mt-auto"></div>
      <div className="form-floating mb-2">
        <input
          type="text"
          id="sp_name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          className="form-control form-control-sm"
          placeholder="Name"
        />
        <label htmlFor="sp_name">Name *</label>
      </div>

      <div className="form-floating mb-2">
        <input
          type="email"
          id="sp_email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          className="form-control form-control-sm"
          placeholder="Email"
        />
        <label htmlFor="sp_email">Email</label>
      </div>

      <div className="form-floating mb-2">
        <input
          type="tel"
          id="sp_phone"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          className="form-control form-control-sm"
          placeholder="Phone"
        />
        <label htmlFor="sp_phone">Phone</label>
      </div>

      <div className="form-floating mb-2">
        <textarea
          id="sp_address"
          name="address"
          value={formData.address}
          onChange={handleChange}
          className="form-control form-control-sm min-h-[80px]"
          placeholder="Address"
        />
        <label htmlFor="sp_address">Address</label>
      </div>
    </form>
  );
}
