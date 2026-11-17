import React, { useState } from "react";
import PageControlsModal from "./Page_ControlsModal";
import { Accordion } from "../accordions";
import Modal_SupplierTaxRates from "./Modal_SupplierTaxRates";
import TableSettingsControls from "../tables/TableSettingsControls";
import Dropdown_Custom from "../dropdowns/Dropdown_Custom";
import Button_Toolbar from "../buttons/Button_Toolbar";
import { QuestionMarkCircleIcon } from "../../../icons";

const PROCUREMENT_VISIBILITY = [
  { key: "showSupplierTable", label: "Show supplier table", description: "Display the supplier list." },
  { key: "showProductsTable", label: "Show products table", description: "Display linked products in the supplier editor." },
  { key: "showPurchaseOrdersTable", label: "Show purchase-orders table", description: "Display a supplier's purchase-order history." },
  { key: "showPurchaseOrderForm", label: "Show purchase-order form", description: "Allow opening the purchase-order form." },
];

const TABLE_COLUMNS = [
  { key: "showPODate", label: "Show purchase-order date" },
  { key: "showPOStatus", label: "Show purchase-order status" },
  { key: "showPOAmount", label: "Show purchase-order total" },
  { key: "showPODeliveryDate", label: "Show expected delivery date field" },
  { key: "showPOImportTax", label: "Show import-tax total" },
  { key: "showPOShipping", label: "Show shipping total" },
  { key: "showPONotes", label: "Show notes field" },
];

export default function Modal_Suppliers_Settings({
  isOpen,
  onClose,
  onSave,
  pendingSettings,
  setPendingSettings,
  automationSettings = {},
  setAutomationSettings,
  canManageAutomation = false,
  automationSettingsLoading = false,
  automationSettingsLoaded = false,
  settingsError = "",
}) {
  const [showTaxRates, setShowTaxRates] = useState(false);
  const updateSetting = (key, value) => {
    setPendingSettings?.((previous) => ({ ...previous, [key]: value }));
  };
  const updateAutomationSetting = (key, value) => {
    setAutomationSettings?.((previous) => ({ ...previous, [key]: value }));
  };

  return (
    <>
      <PageControlsModal
        isOpen={isOpen}
        onClose={onClose}
        title="Supplier Page Controls"
        onSave={onSave}
        saveDisabled={automationSettingsLoading}
      >
        {settingsError && <div className="alert alert-danger mb-0 py-2" role="alert">{settingsError}</div>}

        <Accordion variant="settings" header="Table preferences" defaultOpen>
          <TableSettingsControls
            settings={pendingSettings}
            showHeading={false}
            onChange={(patch) => setPendingSettings?.((previous) => ({ ...previous, ...patch }))}
            toggles={[
              { key: "showEmail", label: "Show Email", description: "Display supplier email addresses" },
              { key: "showPhone", label: "Show Phone", description: "Display supplier phone numbers" },
              { key: "showAddress", label: "Show Address", description: "Display supplier mailing addresses" },
              { key: "showHiddenSuppliers", label: "Show hidden suppliers", description: "Include hidden suppliers in the supplier list so they can be restored." },
            ]}
          />
        </Accordion>

        <Accordion variant="settings" header="Procurement visibility">
          <div className="d-flex flex-column gap-2">
            {PROCUREMENT_VISIBILITY.map(({ key, label, description }) => (
              <VisibilityToggle
                key={key}
                id={`supplier-setting-${key}`}
                label={label}
                description={description}
                checked={pendingSettings?.[key] !== false}
                onChange={(value) => updateSetting(key, value)}
              />
            ))}
          </div>
          {canManageAutomation && (
            <div className="border-top mt-3 pt-3">
              <h6 className="fw-semibold mb-2">Purchase order automation</h6>
              {automationSettingsLoading ? (
                <div className="small text-muted">Loading automation settings...</div>
              ) : automationSettingsLoaded ? (
                <>
                  <div className="mb-2">
                    <label className="form-label" htmlFor="supplier-po-mode">Generation</label>
                    <Dropdown_Custom
                      id="supplier-po-mode"
                      className="ui-control-sm"
                      value={automationSettings.inventory_po_generation_mode || "scheduled"}
                      onChange={(event) => updateAutomationSetting("inventory_po_generation_mode", event.target.value)}
                      options={[
                        { value: "immediate", label: "When stock reaches threshold" },
                        { value: "scheduled", label: "On a schedule" },
                        { value: "both", label: "Immediate and scheduled" },
                      ]}
                      closeOnSelect
                    />
                  </div>
                  <div>
                    <label className="form-label" htmlFor="supplier-po-frequency">Schedule</label>
                    <Dropdown_Custom
                      id="supplier-po-frequency"
                      className="ui-control-sm"
                      value={automationSettings.inventory_po_frequency || "monthly"}
                      onChange={(event) => updateAutomationSetting("inventory_po_frequency", event.target.value)}
                      options={[
                        { value: "daily", label: "Daily" },
                        { value: "weekly", label: "Weekly" },
                        { value: "monthly", label: "Monthly (default)" },
                        { value: "quarterly", label: "Quarterly" },
                        { value: "semiannual", label: "Every six months" },
                        { value: "annual", label: "Annually" },
                      ]}
                      closeOnSelect
                    />
                  </div>
                </>
              ) : (
                <div className="small text-muted">Automation settings could not be loaded and will not be changed.</div>
              )}
            </div>
          )}
        </Accordion>

        <Accordion variant="settings" header="Table columns">
          <div className="d-flex flex-column gap-2">
            {TABLE_COLUMNS.map(({ key, label }) => (
              <VisibilityToggle
                key={key}
                id={`supplier-setting-${key}`}
                label={label}
                checked={pendingSettings?.[key] !== false}
                onChange={(value) => updateSetting(key, value)}
              />
            ))}
          </div>
        </Accordion>

        <Accordion variant="settings" header="Tax">
          <div className="d-flex align-items-center justify-content-between gap-2">
            <div>
              <div className="fw-medium small">Import tax by inventory category</div>
              <div className="text-muted text-xxs">Configure rates used to calculate purchase-order tax.</div>
            </div>
            <Button_Toolbar
              icon={QuestionMarkCircleIcon}
              label="Rates"
              className="btn-outline-secondary"
              title="Configure import-tax rates"
              onClick={() => setShowTaxRates(true)}
            />
          </div>
        </Accordion>
      </PageControlsModal>
      <Modal_SupplierTaxRates isOpen={showTaxRates} onClose={() => setShowTaxRates(false)} />
    </>
  );
}

function VisibilityToggle({ id, label, description, checked, onChange }) {
  return (
    <div className="align-items-center d-flex justify-content-between gap-2">
      <div>
        <label className="fw-medium small" htmlFor={id}>{label}</label>
        {description && <div className="text-muted text-xxs">{description}</div>}
      </div>
      <div className="form-check form-switch m-0">
        <input
          id={id}
          type="checkbox"
          role="switch"
          className="form-check-input cursor-pointer"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
      </div>
    </div>
  );
}
