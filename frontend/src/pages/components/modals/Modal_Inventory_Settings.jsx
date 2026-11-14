// FILE: Modal_Inventory_Settings.jsx
// Dedicated settings/controls modal for the Inventory page
import React from "react";
import { TagIcon } from "@heroicons/react/24/outline";
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
