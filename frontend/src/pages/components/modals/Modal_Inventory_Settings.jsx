// FILE: Modal_Inventory_Settings.jsx
// Dedicated settings/controls modal for the Inventory page
import React from "react";
import { TagIcon } from "../../../icons";
import PageControlsModal from "./Page_ControlsModal";
import Button_Toolbar from "../buttons/Button_Toolbar";
import Dropdown_Custom from "../dropdowns/Dropdown_Custom";
import TableSettingsControls from "../tables/TableSettingsControls";

export default function Modal_Inventory_Settings({
  isOpen,
  onClose,
  onSave,
  onOpenCategories,
  assetUnitsPerPage,
  onAssetUnitsPerPageChange,
  assetUnitsPageSizeOptions = [10, 25, 50, 100],
  pendingSettings,
  setPendingSettings,
  automationSettings,
  setAutomationSettings,
  canManageAutomation,
}) {
  return (
    <PageControlsModal
      isOpen={isOpen}
      onClose={onClose}
      title="Inventory Page Controls"
      onSave={onSave}
    >
      <div className="ui-small-muted">Use these controls to manage inventory views and actions.</div>
      <div className="small">Type, stock, search, suppliers, discounts, and insights controls are available.</div>
      {canManageAutomation && (
        <section className="border rounded p-3 mt-2">
          <h6 className="mb-2">Purchase order automation</h6>
          <div className="small mb-2">Automatically create supplier-grouped draft orders. Review drafts before sending.</div>
          <label className="form-label" htmlFor="inventory-po-mode">Generation</label>
          <Dropdown_Custom
            id="inventory-po-mode"
            className="ui-control-sm mb-2"
            value={automationSettings?.inventory_po_generation_mode || "scheduled"}
            onChange={(e) => setAutomationSettings?.((prev) => ({ ...prev, inventory_po_generation_mode: e.target.value }))}
            options={[
              { value: "immediate", label: "When stock reaches threshold" },
              { value: "scheduled", label: "On a schedule" },
              { value: "both", label: "Immediate and scheduled" },
            ]}
            closeOnSelect
          />
          <label className="form-label" htmlFor="inventory-po-frequency">Schedule</label>
          <Dropdown_Custom
            id="inventory-po-frequency"
            className="ui-control-sm"
            value={automationSettings?.inventory_po_frequency || "monthly"}
            onChange={(e) => setAutomationSettings?.((prev) => ({ ...prev, inventory_po_frequency: e.target.value }))}
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
        </section>
      )}
      <div className="page-controls-actions-group">
        <Button_Toolbar
          icon={TagIcon}
          label="Cats"
          onClick={() => {
            onClose();
            onOpenCategories?.();
          }}
          className="btn-primary"
          title="Manage inventory categories"
        />
      </div>
      <div className="d-flex align-items-center gap-2 mt-1" style={{ maxWidth: "13rem" }}>
        <Dropdown_Custom
          id="inventory-asset-units-per-page"
          className="ui-control-sm"
          style={{ width: "100%", maxWidth: "13rem" }}
          value={String(assetUnitsPerPage)}
          onChange={(e) => onAssetUnitsPerPageChange?.(e.target.value)}
          options={assetUnitsPageSizeOptions.map((size) => ({ value: String(size), label: `${size} per page` }))}
          placeholder="Select page size"
          closeOnSelect
        />
      </div>
      <TableSettingsControls
        settings={pendingSettings}
        onChange={(patch) => setPendingSettings?.((prev) => ({ ...prev, ...patch }))}
        toggles={[
          { key: "showPrice", label: "Show Price", description: "Display item selling price on table rows" },
          { key: "showCost", label: "Show Cost", description: "Display item cost on table rows" },
          { key: "showCategory", label: "Show Category", description: "Display category badge under item name" },
          { key: "showType", label: "Show Type Column", description: "Display item type column (Product, Resource, Asset, etc.)" },
          { key: "showStock", label: "Show Count Column", description: "Display stock count column" },
        ]}
      />
    </PageControlsModal>
  );
}
