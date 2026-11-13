// FILE: Modal_Services_Settings.jsx
// Dedicated settings/controls modal for the Services page
import React from "react";
import { FolderOpenIcon } from "@heroicons/react/24/outline";
import PageControlsModal from "./Page_ControlsModal";
import Button_Toolbar from "../buttons/Button_Toolbar";
import TableSettingsControls from "../tables/TableSettingsControls";

export default function Modal_Services_Settings({
  isOpen,
  onClose,
  onSave,
  onOpenCategories,
  pendingSettings,
  setPendingSettings,
}) {
  return (
    <PageControlsModal
      isOpen={isOpen}
      onClose={onClose}
      title="Service Page Controls"
      onSave={onSave}
    >
      <div className="ui-small-muted">Use these controls to manage the Services page view.</div>
      <div className="small">Search, category filter, and add actions are available.</div>
      <div className="page-controls-actions-group">
        <Button_Toolbar
          icon={FolderOpenIcon}
          label="Cats"
          onClick={() => {
            onClose();
            onOpenCategories?.();
          }}
          className="btn-primary"
          title="Manage service categories"
        />
      </div>
      <TableSettingsControls
        settings={pendingSettings}
        onChange={(patch) => setPendingSettings?.((prev) => ({ ...prev, ...patch }))}
        toggles={[
          { key: "showCategory", label: "Show Category", description: "Display category badge under service name" },
          { key: "showPrice", label: "Show Price Column", description: "Display service price column" },
          { key: "showDuration", label: "Show Duration Column", description: "Display service duration column" },
        ]}
      />
    </PageControlsModal>
  );
}
