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
 *   2026-05-26 | GitHub Copilot | Standardized left-column delete button style to match Inventory row layout
 *   2026-07-24 | GitHub Copilot | Replaced row delete buttons with selection-first bulk delete action in table mode
 * ============================================================
 */

// ─── 1  IMPORTS ────────────────────────────────────────────────────────────
import React, { useEffect, useState, useMemo, useRef } from "react";
import { S } from "../utils/strings";
import useFetchOnce from "../services/useFetchOnce";
import usePagePermission from "../services/usePagePermission";
import useViewMode from "../services/useViewMode";
import PageLayout from "./components/Page_Layout";
import PageTableFooter from "./components/Page_TableFooter";
import PageTableHeader from "./components/Page_TableHeader";
import PageTableRow from "./components/Page_TableRow";
import { PlusIcon, FolderOpenIcon, XMarkIcon, Cog6ToothIcon, PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import { showConfirm } from "../services/showConfirm";
import Button_Toolbar from "./components/Button_Toolbar";
import useStore from "../services/useStore";
import { servicesAPI } from "../services/api";
import Modal from "./components/Modal";
import PageControlsModal from "./components/Page_ControlsModal";
import Form_Service from "./components/Form_Service";
import Gate_Permission from "./components/Gate_Permission";
import Modal_Bulk_Import_Sheet from "./components/Modal_ImportSheet";
import Modal_MultiEdit from "./components/Modal_MultiEdit";
import Toggle_MultiSelectIcon from "./components/Toggle_MultiSelectIcon";

// ─── 2  SERVICES PAGE COMPONENT ───────────────────────────────────────────
export default function Services() {
  const { services, setServices, addService, updateService, removeService, loading, setLoading, error, setError, clearError, isModalOpen, modalContent, openModal, closeModal, hasPermission } = useStore();

  usePagePermission("services");

  // ─── 3  STATE / REF DECLARATIONS ─────────────────────────────────────────
  const [editingService, setEditingService] = useState(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isCategoryFilterOpen, setIsCategoryFilterOpen] = useState(false);
  const [categoryFilterHelpKey, setCategoryFilterHelpKey] = useState(null);
  const [showPageControls, setShowPageControls] = useState(false);
  const { isTrainingMode } = useViewMode();
  const scrollRef = useRef(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const selectionMode = selectedIds.size > 0;
  const [showMultiEdit, setShowMultiEdit] = useState(false);
  const [multiSaving, setMultiSaving] = useState(false);
  const [sortColumn, setSortColumn] = useState("name");
  const [sortAsc, setSortAsc] = useState(true);

  const svcMultiEditFields = [
    { key: "category", label: "Category", type: "text", placeholder: "e.g. Haircuts" },
    { key: "duration_minutes", label: "Duration (minutes)", type: "number", placeholder: "e.g. 60", min: 1 },
    { key: "price", label: "Price", type: "number", placeholder: "e.g. 25.00", min: 0, step: "0.01" },
  ];

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
      setError("Failed to load services");
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  // ─── 6  CRUD HANDLERS ─────────────────────────────────────────────────────
  const handleCreateService = () => {
    if (!hasPermission("services", "write")) {
      setError("You do not have permission to create services");
      return;
    }
    setEditingService(null);
    openModal("service-form");
  };

  const handleEditService = (service) => {
    if (!hasPermission("services", "write")) {
      setError("You do not have permission to edit services");
      return;
    }
    setEditingService(service);
    openModal("service-form");
  };

  const handleDeleteService = async (serviceId, e) => {
    e?.stopPropagation?.();
    if (!hasPermission("services", "delete")) {
      setError("You do not have permission to delete services");
      return;
    }
    if (!(await showConfirm("Delete this service?"))) return;
    try {
      await servicesAPI.delete(serviceId);
      removeService(serviceId);
      if (editingService?.id === serviceId) {
        setEditingService(null);
        closeModal();
      }
      clearError();
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || "Failed to delete service";
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
      setError("Failed to save service");
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

  const handleDeleteSelectedSvc = async () => {
    if (selectedIds.size === 0) return;
    if (!hasPermission("services", "delete")) {
      setError("You do not have permission to delete services");
      return;
    }
    if (!(await showConfirm(`Delete ${selectedIds.size} selected service${selectedIds.size !== 1 ? "s" : ""}?`))) return;

    try {
      await Promise.all([...selectedIds].map((id) => servicesAPI.delete(id)));
      await loadServices();
      if (editingService && selectedIds.has(editingService.id)) {
        setEditingService(null);
        closeModal();
      }
      clearSelectionSvc();
      clearError();
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || "Failed to delete selected services";
      setError(String(detail));
    }
  };

  // ─── 7  DERIVED / COMPUTED VALUES ────────────────────────────────────────
  // Get unique categories for filter
  const categories = useMemo(() => {
    const cats = new Set(services.map((s) => s.category).filter(Boolean));
    return ["all", ...Array.from(cats)];
  }, [services]);

  // Filtered services
  const filteredServices = useMemo(() => {
    return services.filter((svc) => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        if (!(svc.name || "").toLowerCase().includes(term) && !(svc.description || "").toLowerCase().includes(term) && !(svc.category || "").toLowerCase().includes(term)) return false;
      }
      if (categoryFilter !== "all" && (svc.category || "") !== categoryFilter) return false;
      return true;
    });
  }, [services, searchTerm, categoryFilter]);

  const toggleSelectSvc = (id) =>
    setSelectedIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const allVisibleSelectedSvc = filteredServices.length > 0 && filteredServices.every((s) => selectedIds.has(s.id));
  const handleSelectAllSvc = () => {
    if (allVisibleSelectedSvc) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredServices.map((s) => s.id)));
    }
  };
  const clearSelectionSvc = () => {
    setSelectedIds(new Set());
  };

  const handleSvcMultiEditSave = async (updates) => {
    setMultiSaving(true);
    try {
      const coerced = { ...updates };
      if ("duration_minutes" in coerced) {
        const parsedDuration = parseInt(coerced.duration_minutes, 10);
        if (Number.isNaN(parsedDuration)) delete coerced.duration_minutes;
        else coerced.duration_minutes = parsedDuration;
      }
      if ("price" in coerced) {
        const parsedPrice = parseFloat(coerced.price);
        if (!Number.isFinite(parsedPrice)) delete coerced.price;
        else coerced.price = parsedPrice;
      }
      await Promise.all([...selectedIds].map((id) => servicesAPI.update(id, coerced)));
      await loadServices();
      setShowMultiEdit(false);
      clearSelectionSvc();
    } catch {
      setError("Failed to update some services");
    } finally {
      setMultiSaving(false);
    }
  };

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortAsc(!sortAsc);
    } else {
      setSortColumn(column);
      setSortAsc(true);
    }
  };

  const sortedAndFiltered = useMemo(() => {
    let sorted = [...filteredServices];
    if (sortColumn) {
      sorted.sort((a, b) => {
        let aVal, bVal;
        if (sortColumn === "name") {
          aVal = (a.name || "").toLowerCase();
          bVal = (b.name || "").toLowerCase();
        } else if (sortColumn === "category") {
          aVal = (a.category || "").toLowerCase();
          bVal = (b.category || "").toLowerCase();
        } else if (sortColumn === "price") {
          aVal = parseFloat(a.price || 0);
          bVal = parseFloat(b.price || 0);
        }
        if (aVal === bVal) return 0;
        const cmp = aVal < bVal ? -1 : 1;
        return sortAsc ? cmp : -cmp;
      });
    }
    return sorted;
  }, [filteredServices, sortColumn, sortAsc]);

  // ─── 8  SECONDARY LIFECYCLE ───────────────────────────────────────────────
  // Scroll to bottom when data loads
  useEffect(() => {
    if (scrollRef.current && sortedAndFiltered.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [sortedAndFiltered.length]);

  // ─── 9  RENDER / RETURN ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin border-b-2 border-primary-600 h-12 rounded-full w-12"></div>
      </div>
    );
  }

  return (
    <PageLayout title="Services" error={error} contentGravity="bottom" headerRight={<Button_Toolbar icon={Cog6ToothIcon} label="Settings" onClick={() => setShowPageControls(true)} className="btn-outline-secondary" title="Page settings" />}>
      {/* Scrollable rows – grow upwards from bottom */}
      <div ref={scrollRef} className="bg-white d-flex dark:bg-gray-900 flex-column-reverse flex-grow-1 min-h-0 no-scrollbar overflow-auto" style={{ background: "var(--bs-body-bg)" }}>
        {sortedAndFiltered.length > 0 ? (
          <table className="mb-0 table table-borderless table-hover">
            <colgroup>
              <col style={{ width: "56px" }} />
              <col />
              <col style={{ width: "80px" }} />
              <col style={{ width: "70px" }} />
            </colgroup>
            <tbody>
              {sortedAndFiltered.map((service, index) => (
                <PageTableRow key={service.id || index} onClick={() => !selectionMode && handleEditService(service)}>
                  <td style={{ width: "56px" }} onClick={(e) => e.stopPropagation()}>
                    <Toggle_MultiSelectIcon selected={selectedIds.has(service.id)} onToggle={() => toggleSelectSvc(service.id)} title="Select service" />
                  </td>
                  {/* Name + Category stacked */}
                  <td className="main-page-table-data">
                    <div className="fw-medium text-wrap-word">{service.name}</div>
                    {service.category && (
                      <span className="badge bg-secondary-subtle rounded-pill text-secondary text-xxs" style={{ width: "fit-content" }}>
                        {service.category}
                      </span>
                    )}
                  </td>

                  {/* Price */}
                  <td className="main-page-table-data text-center">
                    <span className="fw-medium">${(service.price || 0).toFixed(2)}</span>
                  </td>

                  {/* Duration */}
                  <td className="main-page-table-data text-center">
                    <span className="badge bg-info-subtle rounded-pill text-info">{service.duration_minutes || 30}m</span>
                  </td>
                </PageTableRow>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="align-items-center d-flex flex-grow-1 justify-content-center text-muted">{S.noResults}</div>
        )}
      </div>

      {selectedIds.size > 0 && (
        <div className="align-items-center border-top d-flex flex-shrink-0 position-relative px-1 py-1" style={{ background: "rgba(var(--app-active-color-rgb),0.08)", borderColor: "rgba(var(--app-active-color-rgb),0.2)" }}>
          <div className="ui-flex-center-gap-2">
            <span className="fw-semibold ui-text-sm" style={{ color: "var(--app-active-color)" }}>
              {selectedIds.size} selected item{selectedIds.size !== 1 ? "s" : ""}
            </span>
            <button type="button" className="btn btn-circle btn-primary" title="Edit selected services" onClick={() => setShowMultiEdit(true)}>
              <PencilSquareIcon style={{ width: 14, height: 14 }} />
            </button>
            <Gate_Permission page="services" permission="delete">
              <button type="button" className="btn btn-circle btn-outline-danger" title="Delete selected services" onClick={handleDeleteSelectedSvc}>
                <TrashIcon style={{ width: 14, height: 14 }} />
              </button>
            </Gate_Permission>
          </div>
          <button type="button" className="btn btn-circle btn-outline-secondary position-absolute" style={{ left: "50%", transform: "translateX(-50%)" }} title="Clear selection" onClick={clearSelectionSvc}>
            <XMarkIcon style={{ width: 14, height: 14 }} />
          </button>
        </div>
      )}
      <PageTableHeader
        columns={[
          { label: <Toggle_MultiSelectIcon selected={allVisibleSelectedSvc} onToggle={handleSelectAllSvc} title="Select all visible services" />, width: 56, className: "p-0 text-center" },
          { label: "Service", sortKey: "name" },
          { label: "Price", width: 80, sortKey: "price" },
          { label: "Duration", width: 70 },
        ]}
        sortColumn={sortColumn}
        sortAsc={sortAsc}
        onSort={handleSort}
      />

      {/* Fixed footer – headers + controls */}
      <PageTableFooter
        searchTerm={searchTerm}
        onSearch={setSearchTerm}
        searchPlaceholder="Search services..."
        addButton={
          <Gate_Permission page="services" permission="write">
            <Button_Toolbar icon={PlusIcon} label="Add" onClick={handleCreateService} className="btn-app-primary" title="Add service" />
          </Gate_Permission>
        }
      >
        <Gate_Permission page="services" permission="write">
          <Button_Toolbar icon={PlusIcon} label="Bulk" onClick={() => setShowBulkImport(true)} className="btn-app-secondary" />
        </Gate_Permission>

        {/* Clear Filters Button */}
        {categoryFilter !== "all" && <Button_Toolbar icon={XMarkIcon} label="Clear" onClick={() => setCategoryFilter("all")} className="btn-app-danger" />}

        {/* Category Filter */}
        <div className="ui-pos-rel">
          <Button_Toolbar
            icon={FolderOpenIcon}
            label="Category"
            title="Filter by category"
            onClick={() => {
              const nextOpen = !isCategoryFilterOpen;
              setIsCategoryFilterOpen(nextOpen);
              if (!nextOpen) setCategoryFilterHelpKey(null);
            }}
            className={`border-0 shadow-lg transition-all ${categoryFilter !== "all" ? "bg-primary-600 hover:bg-primary-700 text-white" : "btn-app-secondary"}`}
            data-active={categoryFilter !== "all"}
          />
          {isCategoryFilterOpen && (
            <div className="app-dropdown--min app-menu-panel bg-white border border-gray-200 bottom-100 dark:bg-gray-800 dark:border-gray-700 mb-2 p-0 position-absolute rounded-xl shadow-lg start-0 z-50" style={{ maxHeight: "300px", overflowY: "auto" }}>
              {categories.map((cat, index) => {
                const key = cat ?? "__none__";
                const label = cat === "all" ? "All Categories" : cat || "No Category";
                const description = cat === "all" ? "Shows services from every category." : (cat || "").trim() === "" ? "Shows services that do not have a category assigned." : `Shows only services in the "${cat}" category.`;
                const isLast = index === categories.length - 1;
                const isSelected = categoryFilter === cat;
                const isHelpOpen = categoryFilterHelpKey === String(key);

                return (
                  <div key={String(key)} className={`d-flex align-items-center gap-1 ${isLast ? "" : "mb-1"}`}>
                    <button
                      onClick={() => {
                        setCategoryFilter(cat);
                        setIsCategoryFilterOpen(false);
                        setCategoryFilterHelpKey(null);
                      }}
                      className={`app-menu-item d-block w-100 text-start px-1 py-0 rounded-lg transition-colors ${isSelected ? "bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400" : "hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100"}`}
                    >
                      {label}
                    </button>

                    {isTrainingMode && (
                      <div className="flex-shrink-0 position-relative">
                        <button
                          type="button"
                          aria-label={`${label} help`}
                          className="align-items-center app-label--bold btn btn-sm d-flex dark:text-gray-300 justify-content-center text-gray-600"
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
                            className="bg-white border border-gray-200 bottom-100 dark:bg-gray-800 dark:border-gray-700 mb-2 p-0 position-absolute rounded-lg shadow-lg start-50 text-start"
                            style={{ width: "260px", maxWidth: "calc(100vw - 1rem)", transform: "translateX(-55%)" }}
                            onMouseEnter={() => setCategoryFilterHelpKey(String(key))}
                            onMouseLeave={() => setCategoryFilterHelpKey((prev) => (prev === String(key) ? null : prev))}
                          >
                            <div className="dark:text-gray-100 fw-semibold mb-1 text-gray-900">{label}</div>
                            <div className="dark:text-gray-300 small text-gray-700">{description}</div>
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
          { value: "name", label: "Name (required)" },
          { value: "category", label: "Category" },
          { value: "price", label: "Price" },
          { value: "duration_minutes", label: "Duration (min)" },
          { value: "description", label: "Description" },
        ]}
        defaultFieldSequence={["name", "category", "price", "duration_minutes", "description"]}
        buildRecord={(data) => {
          const errors = [];
          if (!data.name?.trim()) errors.push("Name is required.");

          let price = null;
          if (data.price !== undefined && data.price !== "") {
            const p = Number(String(data.price).replace(/,/g, "").trim());
            if (!Number.isFinite(p) || p < 0) errors.push("Price must be a non-negative number.");
            else price = p;
          }

          let duration = null;
          if (data.duration_minutes !== undefined && data.duration_minutes !== "") {
            const d = Number(String(data.duration_minutes).trim());
            if (!Number.isFinite(d) || d <= 0) errors.push("Duration must be a positive number.");
            else duration = Math.round(d);
          }

          return {
            record: errors.length
              ? null
              : {
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
      <Modal isOpen={isModalOpen && modalContent === "service-form"} onClose={closeModal} noPadding={true} fullScreen={true} contentGravity="top">
        {isModalOpen && modalContent === "service-form" && <Form_Service service={editingService} onSubmit={handleSubmitService} onCancel={closeModal} onBulkImport={!editingService ? handleBulkImportServices : null} />}
      </Modal>

      <PageControlsModal isOpen={showPageControls} onClose={() => setShowPageControls(false)} title="Service Page Controls">
        <div className="ui-small-muted">Use these controls to manage the Services page view.</div>
        <div className="small">Search, category filter, and add actions are available in the footer.</div>
      </PageControlsModal>

      <Modal_MultiEdit
        isOpen={showMultiEdit}
        onClose={() => setShowMultiEdit(false)}
        title={`Edit ${selectedIds.size} Service${selectedIds.size !== 1 ? "s" : ""}`}
        fields={svcMultiEditFields}
        selectedItems={services.filter((s) => selectedIds.has(s.id))}
        onSave={handleSvcMultiEditSave}
        saving={multiSaving}
      />
    </PageLayout>
  );
}
