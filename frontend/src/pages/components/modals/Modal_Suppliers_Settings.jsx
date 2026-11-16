import React, { useState } from "react";
import PageControlsModal from "./Page_ControlsModal";
import Modal_SupplierTaxRates from "./Modal_SupplierTaxRates";
import TableSettingsControls from "../tables/TableSettingsControls";
import { QuestionMarkCircleIcon } from "../../../icons";

const PROCUREMENT_VISIBILITY = [
  { key: "showSupplierTable", label: "Show supplier table", description: "Display the supplier list." },
  { key: "showProductsTable", label: "Show products table", description: "Display a supplier's product list." },
  { key: "showPurchaseOrdersTable", label: "Show purchase-orders table", description: "Display a supplier's purchase-order history." },
  { key: "showPurchaseOrderForm", label: "Show purchase-order form", description: "Allow opening the purchase-order form." },
  { key: "showProductModal", label: "Show product modal", description: "Allow opening supplier product management." },
];

const TABLE_COLUMNS = [
  { key: "showProductPack", label: "Show product pack details" },
  { key: "showProductPrice", label: "Show product prices" },
  { key: "showProductPreferred", label: "Show preferred supplier status" },
  { key: "showPODate", label: "Show purchase-order date" },
  { key: "showPOStatus", label: "Show purchase-order status" },
  { key: "showPOAmount", label: "Show purchase-order total" },
  { key: "showProductPurchaseUnitField", label: "Show product purchase-unit field" },
  { key: "showProductPackSizeField", label: "Show product pack-size field" },
  { key: "showProductPriceField", label: "Show product price field" },
  { key: "showProductPreferredField", label: "Show preferred-supplier field" },
  { key: "showPODeliveryDate", label: "Show expected delivery date field" },
  { key: "showPOImportTax", label: "Show import-tax total" },
  { key: "showPOShipping", label: "Show shipping total" },
  { key: "showPONotes", label: "Show notes field" },
];

export default function Modal_Suppliers_Settings({ isOpen, onClose, onSave, pendingSettings, setPendingSettings }) {
  const [showTaxRates, setShowTaxRates] = useState(false);
  const updateSetting = (key, value) => {
    setPendingSettings?.((previous) => ({ ...previous, [key]: value }));
  };

  return (
    <>
      <PageControlsModal isOpen={isOpen} onClose={onClose} title="Supplier Page Controls" onSave={onSave}>
        <div className="ui-small-muted">Choose which supplier details and procurement surfaces are shown.</div>
        <TableSettingsControls
          settings={pendingSettings}
          onChange={(patch) => setPendingSettings?.((previous) => ({ ...previous, ...patch }))}
          toggles={[
            { key: "showEmail", label: "Show Email", description: "Display supplier email addresses" },
            { key: "showPhone", label: "Show Phone", description: "Display supplier phone numbers" },
            { key: "showAddress", label: "Show Address", description: "Display supplier mailing addresses" },
          ]}
        />
        <div className="border-top dark:border-gray-700 mt-2 pt-2">
          <div className="fw-semibold mb-2 small">Procurement visibility</div>
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
        </div>
        <div className="border-top dark:border-gray-700 mt-2 pt-2">
          <div className="fw-semibold mb-2 small">Table columns</div>
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
        </div>
        <div className="border-top dark:border-gray-700 mt-2 pt-2">
          <div className="align-items-center d-flex justify-content-between position-relative">
            <div>
              <div className="fw-semibold small">Import tax by inventory category</div>
              <div className="text-muted text-xxs">Configure rates used to calculate purchase-order tax.</div>
            </div>
            <button
              type="button"
              className="btn btn-bulk-circle btn-outline-secondary p-0 position-absolute"
              style={{ right: 0, top: "50%", transform: "translateY(-50%)" }}
              title="Configure import-tax rates"
              aria-label="Configure import-tax rates"
              onClick={() => setShowTaxRates(true)}
            >
              <QuestionMarkCircleIcon style={{ width: 18, height: 18 }} />
            </button>
          </div>
        </div>
      </PageControlsModal>
      <Modal_SupplierTaxRates isOpen={showTaxRates} onClose={() => setShowTaxRates(false)} />
    </>
  );
}

function VisibilityToggle({ id, label, description, checked, onChange }) {
  return (
    <div className="align-items-center d-flex justify-content-between">
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
