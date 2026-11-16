import React, { useCallback, useEffect, useMemo, useState } from "react";
import PageLayout from "./components/layout/Page_Layout";
import PageTableFooter from "./components/footers/Page_TableFooter";
import PageTableHeader from "./components/tables/Page_TableHeader";
import PageTableRow from "./components/tables/Page_TableRow";
import Footer_Actions from "./components/footers/Footer_Actions";
import { InputNumber, InputText, InputTextarea } from "./components/Inputs";
import Button_Toolbar from "./components/buttons/Button_Toolbar";
import Button_Icon from "./components/buttons/Button_Icon";
import Dropdown_Custom from "./components/dropdowns/Dropdown_Custom";
import Toggle_MultiSelectIcon from "./components/buttons/Toggle_MultiSelectIcon";
import Gate_Permission from "./components/layout/Gate_Permission";
import Modal from "./components/modals/Modal";
import Modal_Procurement from "./components/modals/Modal_Procurement";
import Modal_TemplateUse from "./components/modals/Modal_TemplateUse";
import Modal_Suppliers_Settings from "./components/modals/Modal_Suppliers_Settings";
import { EmptyState, LoadingSpinner } from "./components/feedback";
import Badge from "./components/badges/Badge";
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
  EyeIcon,
  EyeSlashIcon,
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
  const [selectedSupplierIds, setSelectedSupplierIds] = useState([]);
  const [multiSaving, setMultiSaving] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [supplierFormOpen, setSupplierFormOpen] = useState(false);
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [showPageControls, setShowPageControls] = useState(false);
  const [procurementSupplier, setProcurementSupplier] = useState(null);
  const [procurementView, setProcurementView] = useState("orders");
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
      setSelectedSupplierIds((current) => current.filter((id) => sorted.some((supplier) => supplier.id === id)));
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

  useEffect(() => {
    if (pageSettings.showHiddenSuppliers !== false) return;
    const visibleIds = new Set(suppliers.filter((supplier) => !supplier.is_hidden).map((supplier) => supplier.id));
    setSelectedSupplierIds((current) => current.filter((id) => visibleIds.has(id)));
  }, [pageSettings.showHiddenSuppliers, suppliers]);

  const selectionMode = selectedSupplierIds.length > 0;
  const selectedSupplier = selectedSupplierIds.length === 1
    ? suppliers.find((supplier) => supplier.id === selectedSupplierIds[0]) || null
    : null;

  const visibleSuppliers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const filtered = suppliers.filter((supplier) => {
      if (pageSettings.showHiddenSuppliers === false && supplier.is_hidden) return false;
      return !query || [supplier.name, supplier.email, supplier.phone, supplier.address]
        .some((value) => String(value || "").toLowerCase().includes(query));
    });
    return [...filtered].sort((a, b) => {
      const left = String(a[sortColumn] || "").toLowerCase();
      const right = String(b[sortColumn] || "").toLowerCase();
      return (left.localeCompare(right) || String(a.name || "").localeCompare(String(b.name || ""))) * (sortAsc ? 1 : -1);
    });
  }, [pageSettings.showHiddenSuppliers, searchTerm, sortColumn, sortAsc, suppliers]);

  const selectedSuppliers = suppliers.filter((supplier) => selectedSupplierIds.includes(supplier.id));
  const allSelectedHidden = selectedSuppliers.length > 0 && selectedSuppliers.every((supplier) => supplier.is_hidden);
  const allVisibleSelected = visibleSuppliers.length > 0 && visibleSuppliers.every((supplier) => selectedSupplierIds.includes(supplier.id));

  const toggleSupplierSelection = (id) =>
    setSelectedSupplierIds((current) =>
      current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id]
    );

  const handleSelectAllSuppliers = () => {
    setSelectedSupplierIds(
      allVisibleSelected ? [] : visibleSuppliers.map((supplier) => supplier.id)
    );
  };

  const clearSupplierSelection = () => setSelectedSupplierIds([]);

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
      setSelectedSupplierIds([savedSupplier.id]);
      setSupplierFormOpen(false);
      setEditingSupplier(null);
    } catch (error) {
      setFormError(supplierErrorMessage(error, "Failed to save supplier."));
    } finally {
      setSavingSupplier(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedSupplierIds.length === 0) return;
    if (!(await showConfirm(`Delete ${selectedSupplierIds.length} selected supplier${selectedSupplierIds.length === 1 ? "" : "s"}?`))) return;
    setMultiSaving(true);
    try {
      await Promise.all(selectedSupplierIds.map((id) => suppliersAPI.delete(id)));
      setSuppliers((previous) => previous.filter((supplier) => !selectedSupplierIds.includes(supplier.id)));
      clearSupplierSelection();
      setPageError("");
    } catch (error) {
      const message = supplierErrorMessage(error, "Failed to delete selected suppliers.");
      await loadSuppliers();
      setPageError(message);
    } finally {
      setMultiSaving(false);
    }
  };

  const handleSetSelectedHidden = async () => {
    if (selectedSuppliers.length === 0) return;
    const isHidden = !allSelectedHidden;
    setMultiSaving(true);
    try {
      await Promise.all(
        selectedSuppliers.map((supplier) => suppliersAPI.update(supplier.id, { is_hidden: isHidden }))
      );
      setSuppliers((previous) =>
        previous.map((supplier) =>
          selectedSupplierIds.includes(supplier.id) ? { ...supplier, is_hidden: isHidden } : supplier
        )
      );
      clearSupplierSelection();
      setPageError("");
    } catch (error) {
      const message = supplierErrorMessage(error, `Failed to ${isHidden ? "hide" : "show"} selected suppliers.`);
      await loadSuppliers();
      setPageError(message);
    } finally {
      setMultiSaving(false);
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
    setProcurementView(initialCreate ? "create" : "orders");
    setProcurementSupplier(supplier);
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
        ) : pageSettings.showSupplierTable === false ? (
          <div className="align-items-center d-flex flex-grow-1 justify-content-center p-3">
            <EmptyState
              title="Supplier table is hidden"
              description="Use Supplier Page Controls to show the supplier list."
            />
          </div>
        ) : visibleSuppliers.length === 0 ? (
          <div className="align-items-center d-flex flex-grow-1 justify-content-center p-3">
            <EmptyState
              title={suppliers.length === 0 ? "No suppliers found" : "No matching suppliers"}
              description={
                suppliers.length === 0
                  ? "Add your first supplier to get started."
                  : !pageSettings.showHiddenSuppliers && suppliers.every((supplier) => supplier.is_hidden)
                    ? "Enable Show hidden suppliers in page settings to restore a supplier."
                    : "Try a different search."
              }
            />
          </div>
        ) : (
          <table className="app-main-page-table mb-0 table table-borderless table-hover w-100" style={getTextSizeStyle(pageSettings.textSize)}>
            <colgroup>
              <col className="app-col-select" />
              <col className="app-col-flex" />
              {pageSettings.showAddress !== false && <col className="app-col-flex" />}
              <col className="app-col-action-120" />
            </colgroup>
            <tbody>
              {visibleSuppliers.map((supplier) => (
                <PageTableRow
                  key={supplier.id}
                  className={`app-supplier-table-row ${selectedSupplierIds.includes(supplier.id) ? "bg-gray-100 dark:bg-gray-800" : ""}`}
                >
                  <td className="app-col-select app-select-icon-cell" onClick={(event) => event.stopPropagation()}>
                    <Toggle_MultiSelectIcon
                      selected={selectedSupplierIds.includes(supplier.id)}
                      onToggle={() => toggleSupplierSelection(supplier.id)}
                      title={`Select ${supplier.name}`}
                    />
                  </td>
                  <td className="main-page-table-data">
                    <Gate_Permission
                      page="suppliers"
                      permission="write"
                      fallback={<div className={`fw-medium text-wrap-word ${supplier.is_hidden ? "fst-italic" : ""}`}>{supplier.name}</div>}
                    >
                      <button
                        type="button"
                        onClick={() => !selectionMode && openSupplierForm(supplier)}
                        disabled={selectionMode}
                        className={`border-0 btn btn-link dark:text-gray-100 fw-medium p-0 shadow-none text-decoration-none text-gray-900 text-start text-wrap-word ${supplier.is_hidden ? "fst-italic" : ""}`}
                      >
                        {supplier.name}
                      </button>
                    </Gate_Permission>
                    {(pageSettings.showPhone !== false && supplier.phone) || (pageSettings.showEmail !== false && supplier.email) ? (
                      <div className="d-flex flex-wrap gap-1 mt-1">
                        {pageSettings.showPhone !== false && supplier.phone && (
                          <Badge variant="gray" pill label={`Phone: ${supplier.phone}`} className="mw-100 text-truncate" />
                        )}
                        {pageSettings.showEmail !== false && supplier.email && (
                          <Badge variant="gray" pill label={`Email: ${supplier.email}`} className="mw-100 text-truncate" />
                        )}
                      </div>
                    ) : null}
                  </td>
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
                      </Gate_Permission>
                    </div>
                  </td>
                </PageTableRow>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pageSettings.showSupplierTable !== false && <PageTableHeader
        columns={[
          {
            label: <Toggle_MultiSelectIcon selected={allVisibleSelected} onToggle={handleSelectAllSuppliers} title="Select all visible suppliers" />,
            className: "app-col-select p-0 text-center",
          },
          { label: "Supplier", className: "app-col-flex", sortKey: "name" },
          ...(pageSettings.showAddress !== false ? [{ label: "Address", className: "app-col-flex", sortKey: "address" }] : []),
          { label: "Actions", className: "app-col-action-120" },
        ]}
        sortColumn={sortColumn}
        sortAsc={sortAsc}
        onSort={handleSort}
      />}

      <PageTableFooter
        searchTerm={searchTerm}
        onSearch={setSearchTerm}
        searchPlaceholder="Search suppliers..."
        addButton={
          <Gate_Permission page="suppliers" permission="write">
            <Button_Toolbar icon={PlusIcon} label="Add" onClick={() => openSupplierForm()} className="btn-app-primary" title="Add supplier" />
          </Gate_Permission>
        }
      >
        <div className="align-items-center d-flex flex-wrap gap-1 w-100">
          {selectedSupplierIds.length > 0 ? (
            <>
              <span className="ui-small-muted">
                {selectedSupplierIds.length} selected supplier{selectedSupplierIds.length === 1 ? "" : "s"}
              </span>
              <Gate_Permission page="suppliers" permission="write">
                <Button_Toolbar
                  icon={allSelectedHidden ? EyeIcon : EyeSlashIcon}
                  label={allSelectedHidden ? "Show" : "Hide"}
                  onClick={handleSetSelectedHidden}
                  disabled={multiSaving}
                  className="btn-app-secondary"
                  title={`${allSelectedHidden ? "Show" : "Hide"} selected suppliers`}
                />
              </Gate_Permission>
              <Gate_Permission page="suppliers" permission="delete">
                <Button_Toolbar
                  icon={TrashIcon}
                  label="Delete"
                  onClick={handleDeleteSelected}
                  disabled={multiSaving}
                  className="btn-app-danger"
                  title={`Delete ${selectedSupplierIds.length} selected supplier${selectedSupplierIds.length === 1 ? "" : "s"}`}
                />
              </Gate_Permission>
              {selectedSupplier && !selectedSupplier.is_hidden && (
                <Gate_Permission page="suppliers" permission="write">
                  <Button_Toolbar
                    icon={DocumentPlusIcon}
                    label="Purchase Order"
                    onClick={() => openProcurement(selectedSupplier, true)}
                    disabled={pageSettings.showPurchaseOrderForm === false}
                    className="btn-app-secondary"
                    title={pageSettings.showPurchaseOrderForm === false ? "Purchase-order form is hidden in supplier page settings" : `Create a purchase order for ${selectedSupplier.name}`}
                  />
                </Gate_Permission>
              )}
              <Button_Toolbar
                icon={XMarkIcon}
                label="Clear"
                onClick={clearSupplierSelection}
                className="btn-outline-secondary"
                title="Clear supplier selection"
              />
            </>
          ) : (
            <Gate_Permission page="suppliers" permission="write">
              <Button_Toolbar
                icon={DocumentPlusIcon}
                label="Purchase Order"
                onClick={() => selectedSupplier && openProcurement(selectedSupplier, true)}
                disabled={!selectedSupplier || pageSettings.showPurchaseOrderForm === false}
                className="btn-app-secondary"
                title={pageSettings.showPurchaseOrderForm === false ? "Purchase-order form is hidden in supplier page settings" : "Select a supplier first"}
              />
            </Gate_Permission>
          )}
        </div>
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
            center={
              <button
                type="button"
                className="btn btn-bulk-circle btn-outline-secondary btn-sm p-0"
                onClick={closeSupplierForm}
                disabled={savingSupplier}
                title="Cancel"
                aria-label="Cancel"
              >
                <XMarkIcon style={{ width: 14, height: 14 }} />
              </button>
            }
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
        <Modal_Procurement
          isOpen
          onClose={() => setProcurementSupplier(null)}
          supplier={procurementSupplier}
          supplierName={procurementSupplier.name}
          supplierId={procurementSupplier.id}
          settings={pageSettings}
          view={procurementView}
          onViewChange={setProcurementView}
          embedded={false}
          onPOCreated={loadSuppliers}
        />
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
    shipping_rate_type: supplier?.shipping_rate_type || "fixed",
    shipping_rate: supplier?.shipping_rate ?? 0,
  });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit({ ...formData, shipping_rate: Number(formData.shipping_rate) || 0 });
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
      <div className="fw-semibold small">Shipping</div>
      <div className="form-floating ui-form-floating-mb2">
        <Dropdown_Custom
          id="supplier-shipping-rate-type"
          value={formData.shipping_rate_type}
          onChange={(event) => setFormData((previous) => ({ ...previous, shipping_rate_type: event.target.value }))}
          className="form-select ui-control-sm"
          options={[
            { value: "fixed", label: "Fixed amount" },
            { value: "percentage", label: "Percentage of order subtotal" },
          ]}
        />
        <label htmlFor="supplier-shipping-rate-type">Shipping calculation</label>
      </div>
      <div className="form-floating ui-form-floating-mb2">
        <InputNumber
          id="supplier-shipping-rate"
          name="shipping_rate"
          min="0"
          step="0.01"
          value={formData.shipping_rate}
          onChange={handleChange}
          placeholder={formData.shipping_rate_type === "percentage" ? "Shipping percentage" : "Shipping amount"}
        />
        <label htmlFor="supplier-shipping-rate">
          {formData.shipping_rate_type === "percentage" ? "Shipping (%)" : "Shipping amount"}
        </label>
      </div>
    </form>
  );
}
