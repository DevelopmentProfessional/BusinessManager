/*
 * ============================================================
 * FILE: Suppliers_Panel.jsx
 *
 * PURPOSE:
 *   Full-screen panel for managing suppliers, accessed from the Inventory
 *   page footer. Supplier name opens edit; right toggle expands procurement (POs) upward.
 * ============================================================
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import { PlusIcon, XMarkIcon, CheckIcon, ChevronUpIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import useStore from "../../services/useStore";
import { suppliersAPI } from "../../services/api";
import { showConfirm } from "../../services/showConfirm";
import Modal from "./Modal";
import Button_Toolbar from "./Button_Toolbar";
import Footer_Actions from "./Footer_Actions";
import Gate_Permission from "./Gate_Permission";
import Modal_Procurement from "./Modal_Procurement";

export default function Suppliers_Panel({ isOpen, onClose }) {
  const { setError, clearError } = useStore();

  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [expandedSupplierId, setExpandedSupplierId] = useState(null);
  const scrollRef = useRef(null);

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await suppliersAPI.getAll();
      const data = response?.data ?? response;
      if (Array.isArray(data)) {
        setSuppliers(data);
        clearError();
      } else {
        setError("Invalid data format received from server");
        setSuppliers([]);
      }
    } catch {
      setError("Failed to load suppliers");
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  }, [clearError, setError]);

  useEffect(() => {
    if (isOpen) {
      loadSuppliers();
    } else {
      setShowForm(false);
      setEditingSupplier(null);
      setExpandedSupplierId(null);
    }
  }, [isOpen, loadSuppliers]);

  useEffect(() => {
    if (scrollRef.current && suppliers.length > 0 && !showForm) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [suppliers.length, showForm, isOpen]);

  const handleCreate = () => {
    setEditingSupplier(null);
    setExpandedSupplierId(null);
    setShowForm(true);
  };

  const handleEdit = (supplier) => {
    setExpandedSupplierId(null);
    setEditingSupplier(supplier);
    setShowForm(true);
  };

  const toggleProcurement = (supplierId) => {
    setShowForm(false);
    setEditingSupplier(null);
    setExpandedSupplierId((prev) => (prev === supplierId ? null : supplierId));
  };

  const handleDelete = async (supplierId) => {
    if (!(await showConfirm("Are you sure you want to delete this supplier?"))) return;
    try {
      await suppliersAPI.delete(supplierId);
      setSuppliers((prev) => prev.filter((s) => s.id !== supplierId));
      if (expandedSupplierId === supplierId) setExpandedSupplierId(null);
      clearError();
    } catch {
      setError("Failed to delete supplier");
    }
  };

  const handleSubmit = async (formData) => {
    try {
      if (editingSupplier) {
        const response = await suppliersAPI.update(editingSupplier.id, formData);
        setSuppliers((prev) => prev.map((s) => (s.id === editingSupplier.id ? response.data : s)));
      } else {
        const response = await suppliersAPI.create(formData);
        setSuppliers((prev) => [...prev, response.data]);
      }
      setShowForm(false);
      setEditingSupplier(null);
      clearError();
    } catch {
      setError("Failed to save supplier");
    }
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingSupplier(null);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} noPadding={true} fullScreen={true} contentGravity={showForm ? "top" : "bottom"}>
      <div className="ui-page-shell">
        <div className="align-items-center bg-white border-bottom d-flex dark:bg-gray-900 flex-shrink-0 gap-2 justify-content-between p-0">
          <h6 className="ui-heading-strong">
            {showForm ? (editingSupplier ? "Edit Supplier" : "Add Supplier") : "Suppliers"}
            {!showForm && <span className="fw-normal ms-1 small text-muted">({suppliers.length})</span>}
          </h6>
        </div>

        <div
          ref={showForm ? undefined : scrollRef}
          className={`flex-grow-1 min-h-0 overflow-auto no-scrollbar ${showForm ? "d-flex flex-column" : "d-flex flex-column-reverse"}`}
          style={showForm ? undefined : { background: "var(--bs-body-bg)" }}
        >
          {showForm ? (
            <SupplierForm supplier={editingSupplier} onSubmit={handleSubmit} onCancel={handleCancelForm} className="flex-grow-1" />
          ) : loading ? (
            <div className="align-items-center d-flex flex-grow-1 justify-content-center">
              <div className="animate-spin border-b-2 border-primary-600 h-10 rounded-full w-10"></div>
            </div>
          ) : suppliers.length === 0 ? (
            <div className="align-items-center d-flex flex-grow-1 justify-content-center text-muted">No suppliers found. Add your first supplier.</div>
          ) : (
            <>
              {suppliers.map((supplier) => {
                const isExpanded = expandedSupplierId === supplier.id;
                return (
                  <div key={supplier.id} className="border-bottom" style={{ background: "var(--bs-body-bg)" }}>
                    {isExpanded && (
                      <div className="border-bottom pb-1 pt-0 px-0 supplier-procurement-accordion" style={{ maxHeight: "min(55vh, 24rem)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                        <Modal_Procurement supplierId={supplier.id} embedded onPOCreated={loadSuppliers} />
                      </div>
                    )}
                    <div className="align-items-center d-flex gap-2 px-1 py-1">
                      <Gate_Permission page="suppliers" permission="delete">
                        <button type="button" onClick={() => handleDelete(supplier.id)} className="align-items-center btn btn-outline-danger btn-sm d-flex flex-shrink-0 justify-content-center" title="Delete">
                          <XMarkIcon className="ui-icon-5" />
                        </button>
                      </Gate_Permission>
                      <div className="flex-grow-1 min-w-0">
                        <Gate_Permission
                          page="suppliers"
                          permission="write"
                          fallback={<div className="dark:text-gray-100 fw-medium text-gray-900">{supplier.name}</div>}
                        >
                          <button type="button" onClick={() => handleEdit(supplier)} className="border-0 btn btn-link dark:text-gray-100 fw-medium p-0 shadow-none text-decoration-none text-gray-900 text-start">
                            {supplier.name}
                          </button>
                        </Gate_Permission>
                        {supplier.email && <div className="ui-small-muted">{supplier.email}</div>}
                        {supplier.phone && <div className="ui-small-muted">{supplier.phone}</div>}
                        {supplier.address && <div className="small text-muted text-truncate">{supplier.address}</div>}
                      </div>
                      <Gate_Permission page="suppliers" permission="write">
                        <button
                          type="button"
                          onClick={() => toggleProcurement(supplier.id)}
                          className={`btn btn-sm d-flex align-items-center justify-content-center flex-shrink-0 ${isExpanded ? "btn-primary" : "btn-outline-secondary"}`}
                          title={isExpanded ? "Hide purchase orders" : "Purchase orders"}
                          aria-expanded={isExpanded}
                          aria-label={isExpanded ? "Hide purchase orders" : "Show purchase orders"}
                        >
                          {isExpanded ? <ChevronDownIcon className="ui-icon-5" /> : <ChevronUpIcon className="ui-icon-5" />}
                        </button>
                      </Gate_Permission>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        <div className="app-standard-footer bg-white border-gray-200 border-t dark:bg-gray-800 dark:border-gray-700 flex-shrink-0">
          <div className="app-footer-padding">
            {showForm ? (
              <Footer_Actions
                start={<Button_Toolbar icon={CheckIcon} label="Save" type="submit" form="supplier-panel-form" className="btn-outline-secondary" title="Save supplier" />}
                center={<Button_Toolbar icon={XMarkIcon} label="Cancel" onClick={handleCancelForm} className="btn-outline-secondary" title="Cancel" />}
              />
            ) : (
              <Footer_Actions
                start={
                  <Gate_Permission page="suppliers" permission="write">
                    <Button_Toolbar icon={PlusIcon} label="Add" onClick={handleCreate} className="btn-outline-secondary" title="Add supplier" />
                  </Gate_Permission>
                }
                center={<Button_Toolbar icon={XMarkIcon} label="Close" onClick={onClose} className="btn-outline-secondary" title="Close" />}
              />
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function SupplierForm({ supplier, onSubmit, className="" }) {
  const [formData, setFormData] = useState({
    name: supplier?.name || "",
    email: supplier?.email || "",
    phone: supplier?.phone || "",
    address: supplier?.address || "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form id="supplier-panel-form" onSubmit={handleSubmit} className={`p-1 d-flex flex-column ${className}`} style={{ minHeight: "100%" }}>
      <div className="mt-auto"></div>
      <div className="form-floating ui-form-floating-mb2">
        <input type="text" id="sp_name" name="name" value={formData.name} onChange={handleChange} required className="form-control ui-control-sm" placeholder="Name" />
        <label htmlFor="sp_name">Name *</label>
      </div>
      <div className="form-floating ui-form-floating-mb2">
        <input type="email" id="sp_email" name="email" value={formData.email} onChange={handleChange} className="form-control ui-control-sm" placeholder="Email" />
        <label htmlFor="sp_email">Email</label>
      </div>
      <div className="form-floating ui-form-floating-mb2">
        <input type="tel" id="sp_phone" name="phone" value={formData.phone} onChange={handleChange} className="form-control ui-control-sm" placeholder="Phone" />
        <label htmlFor="sp_phone">Phone</label>
      </div>
      <div className="form-floating ui-form-floating-mb2">
        <textarea id="sp_address" name="address" value={formData.address} onChange={handleChange} className="form-control form-control-sm min-h-[80px]" placeholder="Address" />
        <label htmlFor="sp_address">Address</label>
      </div>
    </form>
  );
}
