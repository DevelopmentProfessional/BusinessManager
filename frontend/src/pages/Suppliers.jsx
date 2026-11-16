import React, { useCallback, useEffect, useMemo, useState } from "react";
import PageLayout from "./components/layout/Page_Layout";
import PageTableFooter from "./components/footers/Page_TableFooter";
import PageTableHeader from "./components/tables/Page_TableHeader";
import PageTableRow from "./components/tables/Page_TableRow";
import Footer_Actions from "./components/footers/Footer_Actions";
import { InputText, InputTextarea } from "./components/Inputs";
import Button_Toolbar from "./components/buttons/Button_Toolbar";
import Button_Icon from "./components/buttons/Button_Icon";
import Toggle_MultiSelectIcon from "./components/buttons/Toggle_MultiSelectIcon";
import Gate_Permission from "./components/layout/Gate_Permission";
import Modal from "./components/modals/Modal";
import Modal_Procurement from "./components/modals/Modal_Procurement";
import Modal_TemplateUse from "./components/modals/Modal_TemplateUse";
import Modal_Suppliers_Settings from "./components/modals/Modal_Suppliers_Settings";
import { EmptyState, LoadingSpinner } from "./components/feedback";
import usePagePermission from "../services/usePagePermission";
import useStore from "../services/useStore";
import { getTextSizeStyle, usePageTableSettings } from "../services/useTableSettings";
import { settingsAPI, suppliersAPI } from "../services/api";
import { showConfirm } from "../services/showConfirm";
import { sortItemsAlphabetically } from "../utils/displaySort";
import {
  CheckIcon,
  Cog6ToothIcon,
  DocumentPlusIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from "../icons";

const supplierErrorMessage = (error, fallback) =>
  String(error?.response?.data?.detail || error?.message || fallback);

export default function Suppliers() {
  const { user } = useStore();
  const { settings: pageSettings, savePageSettings } = usePageTableSettings("suppliers");
  const [pendingSettings, setPendingSettings] = useState(pageSettings);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [formError, setFormError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [supplierFormOpen, setSupplierFormOpen] = useState(false);
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [showPageControls, setShowPageControls] = useState(false);
  const [procurementSupplier, setProcurementSupplier] = useState(null);
  const [communicationSupplier, setCommunicationSupplier] = useState(null);
  const [appSettings, setAppSettings] = useState({});
  const [sortColumn, setSortColumn] = useState("name");
  const [sortAsc, setSortAsc] = useState(true);

  usePagePermission("suppliers");

  useEffect(() => {
    if (showPageControls) setPendingSettings(pageSettings);
  }, [showPageControls, pageSettings]);

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await suppliersAPI.getAll();
      const data = response?.data ?? response;
      if (!Array.isArray(data)) throw new Error("Invalid supplier data received from the server.");
      const sorted = sortItemsAlphabetically(data, ["name", "email"]);
      setSuppliers(sorted);
      setSelectedSupplierId((current) => (sorted.some((supplier) => supplier.id === current) ? current : null));
      setPageError("");
    } catch (error) {
      setPageError(supplierErrorMessage(error, "Failed to load suppliers."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  const selectedSupplier = suppliers.find((supplier) => supplier.id === selectedSupplierId) || null;

  const visibleSuppliers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const filtered = query
      ? suppliers.filter((supplier) =>
          [supplier.name, supplier.email, supplier.phone, supplier.address]
            .some((value) => String(value || "").toLowerCase().includes(query))
        )
      : suppliers;
    return [...filtered].sort((a, b) => {
      const left = String(a[sortColumn] || "").toLowerCase();
      const right = String(b[sortColumn] || "").toLowerCase();
      return (left.localeCompare(right) || String(a.name || "").localeCompare(String(b.name || ""))) * (sortAsc ? 1 : -1);
    });
  }, [searchTerm, sortColumn, sortAsc, suppliers]);

  const handleSort = (column) => {
    if (sortColumn === column) setSortAsc((current) => !current);
    else {
      setSortColumn(column);
      setSortAsc(true);
    }
  };

  const openSupplierForm = (supplier = null) => {
    setEditingSupplier(supplier);
    setFormError("");
    setSupplierFormOpen(true);
  };

  const closeSupplierForm = () => {
    if (savingSupplier) return;
    setSupplierFormOpen(false);
    setEditingSupplier(null);
    setFormError("");
  };

  const handleSaveSupplier = async (formData) => {
    setSavingSupplier(true);
    setFormError("");
    try {
      const response = editingSupplier
        ? await suppliersAPI.update(editingSupplier.id, formData)
        : await suppliersAPI.create(formData);
      const savedSupplier = response?.data ?? response;
      if (!savedSupplier?.id) throw new Error("The supplier was saved without an ID.");
      setSuppliers((previous) =>
        sortItemsAlphabetically(
          editingSupplier
            ? previous.map((supplier) => (supplier.id === editingSupplier.id ? savedSupplier : supplier))
            : [...previous, savedSupplier],
          ["name", "email"]
        )
      );
      setSelectedSupplierId(savedSupplier.id);
      setSupplierFormOpen(false);
      setEditingSupplier(null);
    } catch (error) {
      setFormError(supplierErrorMessage(error, "Failed to save supplier."));
    } finally {
      setSavingSupplier(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (!selectedSupplier || !(await showConfirm(`Delete supplier "${selectedSupplier.name}"?`))) return;
    try {
      await suppliersAPI.delete(selectedSupplier.id);
      setSuppliers((previous) => previous.filter((supplier) => supplier.id !== selectedSupplier.id));
      setSelectedSupplierId(null);
      setPageError("");
    } catch (error) {
      setPageError(supplierErrorMessage(error, "Failed to delete supplier."));
    }
  };

  const handleOpenCommunication = async (supplier) => {
    try {
      const response = await settingsAPI.getSettings();
      setAppSettings(response?.data ?? response ?? {});
      setPageError("");
      setCommunicationSupplier(supplier);
    } catch (error) {
      setPageError(supplierErrorMessage(error, "Unable to load company settings for the supplier email."));
    }
  };

  const openProcurement = (supplier, initialCreate = false) => {
    setProcurementSupplier({ ...supplier, initialCreate });
  };

  return (
    <PageLayout
      title="Suppliers"
      error={pageError}
      contentGravity="bottom"
      headerRight={
        <Button_Toolbar
          icon={Cog6ToothIcon}
          label="Settings"
          onClick={() => setShowPageControls(true)}
          className="btn-outline-secondary"
          title="Supplier page settings"
        />
      }
    >
      <div className="app-page-scroll-surface bg-white d-flex dark:bg-gray-900 flex-column-reverse flex-grow-1 min-h-0 no-scrollbar overflow-auto">
        {loading ? (
          <div className="align-items-center d-flex flex-grow-1 justify-content-center">
            <LoadingSpinner label="Loading suppliers" size="lg" />
          </div>
        ) : visibleSuppliers.length === 0 ? (
          <div className="align-items-center d-flex flex-grow-1 justify-content-center p-3">
            <EmptyState
              title={suppliers.length === 0 ? "No suppliers found" : "No matching suppliers"}
              description={suppliers.length === 0 ? "Add your first supplier to get started." : "Try a different search."}
            />
          </div>
        ) : (
          <table className="app-main-page-table mb-0 table table-borderless table-hover w-100" style={getTextSizeStyle(pageSettings.textSize)}>
            <colgroup>
              <col className="app-col-select" />
              <col className="app-col-flex" />
              {pageSettings.showEmail !== false && <col className="app-col-action-120" />}
              {pageSettings.showPhone !== false && <col className="app-col-action-120" />}
              {pageSettings.showAddress !== false && <col className="app-col-flex" />}
              <col className="app-col-action-120" />
            </colgroup>
            <tbody>
              {visibleSuppliers.map((supplier) => (
                <PageTableRow
                  key={supplier.id}
                  className={selectedSupplierId === supplier.id ? "bg-gray-100 dark:bg-gray-800" : ""}
                  onClick={() => setSelectedSupplierId((current) => (current === supplier.id ? null : supplier.id))}
                >
                  <td className="app-col-select app-select-icon-cell" onClick={(event) => event.stopPropagation()}>
                    <Toggle_MultiSelectIcon
                      selected={selectedSupplierId === supplier.id}
                      onToggle={() => setSelectedSupplierId((current) => (current === supplier.id ? null : supplier.id))}
                      title={`Select ${supplier.name}`}
                    />
                  </td>
                  <td className="main-page-table-data">
                    <div className="fw-medium text-wrap-word">{supplier.name}</div>
                  </td>
                  {pageSettings.showEmail !== false && (
                    <td className="main-page-table-data text-truncate" title={supplier.email || ""}>
                      {supplier.email || "—"}
                    </td>
                  )}
                  {pageSettings.showPhone !== false && (
                    <td className="main-page-table-data text-truncate" title={supplier.phone || ""}>
                      {supplier.phone || "—"}
                    </td>
                  )}
                  {pageSettings.showAddress !== false && (
                    <td className="main-page-table-data text-truncate" title={supplier.address || ""}>
                      {supplier.address || "—"}
                    </td>
                  )}
                  <td className="main-page-table-data text-center" onClick={(event) => event.stopPropagation()}>
                    <div className="align-items-center d-flex gap-1 justify-content-center">
                      <Gate_Permission page="suppliers" permission="write">
                        <Button_Icon
                          icon={DocumentTextIcon}
                          label={`View products and purchase orders for ${supplier.name}`}
                          variant="ghost"
                          onClick={() => openProcurement(supplier)}
                        />
                        <Button_Icon
                          icon={EnvelopeIcon}
                          label={`Prepare email to ${supplier.name}`}
                          variant="ghost"
                          onClick={() => handleOpenCommunication(supplier)}
                        />
                        <Button_Icon
                          icon={PencilSquareIcon}
                          label={`Edit ${supplier.name}`}
                          variant="ghost"
                          onClick={() => openSupplierForm(supplier)}
                        />
                      </Gate_Permission>
                    </div>
                  </td>
                </PageTableRow>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <PageTableHeader
        columns={[
          { label: "", className: "app-col-select" },
          { label: "Supplier", className: "app-col-flex", sortKey: "name" },
          ...(pageSettings.showEmail !== false ? [{ label: "Email", className: "app-col-action-120", sortKey: "email" }] : []),
          ...(pageSettings.showPhone !== false ? [{ label: "Phone", className: "app-col-action-120", sortKey: "phone" }] : []),
          ...(pageSettings.showAddress !== false ? [{ label: "Address", className: "app-col-flex", sortKey: "address" }] : []),
          { label: "Actions", className: "app-col-action-120" },
        ]}
        sortColumn={sortColumn}
        sortAsc={sortAsc}
        onSort={handleSort}
      />

      <PageTableFooter
        searchTerm={searchTerm}
        onSearch={setSearchTerm}
        searchPlaceholder="Search suppliers..."
        addButton={
          <Gate_Permission page="suppliers" permission="write">
            <Button_Toolbar icon={PlusIcon} label="Add" onClick={() => openSupplierForm()} className="btn-app-primary" title="Add supplier" />
          </Gate_Permission>
        }
        beforeSearch={
          <Gate_Permission page="suppliers" permission="write">
            <Button_Toolbar
              icon={DocumentPlusIcon}
              label="Purchase Order"
              onClick={() => selectedSupplier && openProcurement(selectedSupplier, true)}
              disabled={!selectedSupplier}
              className="btn-app-secondary"
              title={selectedSupplier ? `Create a purchase order for ${selectedSupplier.name}` : "Select a supplier first"}
            />
          </Gate_Permission>
        }
      >
        {selectedSupplier && (
          <>
            <span className="ui-small-muted">Selected: {selectedSupplier.name}</span>
            <Gate_Permission page="suppliers" permission="delete">
              <Button_Toolbar
                icon={TrashIcon}
                label="Delete"
                onClick={handleDeleteSelected}
                className="btn-app-danger"
                title={`Delete ${selectedSupplier.name}`}
              />
            </Gate_Permission>
            <Button_Toolbar
              icon={XMarkIcon}
              label="Clear"
              onClick={() => setSelectedSupplierId(null)}
              className="btn-outline-secondary"
              title="Clear supplier selection"
            />
          </>
        )}
      </PageTableFooter>

      <Modal
        isOpen={supplierFormOpen}
        onClose={closeSupplierForm}
        title={editingSupplier ? "Edit Supplier" : "Add Supplier"}
        footer={
          <Footer_Actions
            start={
              <Button_Toolbar
                icon={CheckIcon}
                label={savingSupplier ? "Saving" : "Save"}
                type="submit"
                form="supplier-form"
                disabled={savingSupplier}
                className="btn-outline-secondary"
                title="Save supplier"
              />
            }
            center={<Button_Toolbar icon={XMarkIcon} label="Cancel" onClick={closeSupplierForm} disabled={savingSupplier} className="btn-outline-secondary" title="Cancel" />}
          />
        }
      >
        <SupplierForm
          key={editingSupplier?.id || "new"}
          supplier={editingSupplier}
          error={formError}
          onSubmit={handleSaveSupplier}
        />
      </Modal>

      {procurementSupplier && (
        <Modal
          isOpen
          onClose={() => setProcurementSupplier(null)}
          title={`${procurementSupplier.initialCreate ? "Create Purchase Order" : "Products & Purchase Orders"} — ${procurementSupplier.name}`}
          fullScreen
          noPadding
          contentGravity="bottom"
          footer={
            <Footer_Actions
              center={
                <Button_Toolbar
                  icon={XMarkIcon}
                  label="Close"
                  onClick={() => setProcurementSupplier(null)}
                  className="btn-outline-secondary"
                  title="Close supplier procurement"
                />
              }
            />
          }
        >
          <div className="d-flex flex-column flex-grow-1 h-100 min-h-0 p-1">
            <Modal_Procurement
              supplierId={procurementSupplier.id}
              initialCreate={procurementSupplier.initialCreate}
              embedded={false}
              onPOCreated={loadSuppliers}
            />
          </div>
        </Modal>
      )}

      {communicationSupplier && (
        <Modal_TemplateUse
          page="suppliers"
          entity={communicationSupplier}
          currentUser={user}
          settings={appSettings}
          onClose={() => setCommunicationSupplier(null)}
        />
      )}

      <Modal_Suppliers_Settings
        isOpen={showPageControls}
        onClose={() => setShowPageControls(false)}
        onSave={async () => {
          await savePageSettings("suppliers", pendingSettings);
        }}
        pendingSettings={pendingSettings}
        setPendingSettings={setPendingSettings}
      />
    </PageLayout>
  );
}

function SupplierForm({ supplier, error, onSubmit }) {
  const [formData, setFormData] = useState({
    name: supplier?.name || "",
    email: supplier?.email || "",
    phone: supplier?.phone || "",
    address: supplier?.address || "",
  });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit(formData);
  };

  return (
    <form id="supplier-form" onSubmit={handleSubmit} className="d-flex flex-column gap-2 p-1">
      {error && <div className="alert alert-danger py-1 small" role="alert">{error}</div>}
      <div className="form-floating ui-form-floating-mb2">
        <InputText id="supplier-name" name="name" value={formData.name} onChange={handleChange} required placeholder="Supplier name" />
        <label htmlFor="supplier-name">Name *</label>
      </div>
      <div className="form-floating ui-form-floating-mb2">
        <input type="email" id="supplier-email" name="email" value={formData.email} onChange={handleChange} className="form-control ui-control-sm" placeholder="Email" />
        <label htmlFor="supplier-email">Email</label>
      </div>
      <div className="form-floating ui-form-floating-mb2">
        <InputText id="supplier-phone" name="phone" value={formData.phone} onChange={handleChange} placeholder="Phone" />
        <label htmlFor="supplier-phone">Phone</label>
      </div>
      <div className="form-floating ui-form-floating-mb2">
        <InputTextarea id="supplier-address" name="address" value={formData.address} onChange={handleChange} className="min-h-[80px]" placeholder="Address" />
        <label htmlFor="supplier-address">Address</label>
      </div>
    </form>
  );
}
