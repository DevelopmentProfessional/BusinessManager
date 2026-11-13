// FILE: Modal_Documents_Settings.jsx
// Dedicated settings/controls modal for the Documents page
import React from "react";
import { TagIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import PageControlsModal from "./Page_ControlsModal";
import Button_Toolbar from "../buttons/Button_Toolbar";
import TableSettingsControls from "../tables/TableSettingsControls";

export default function Modal_Documents_Settings({
  isOpen,
  onClose,
  onSave,
  onOpenCategories,
  onOpenStatuses,
  pendingSettings,
  setPendingSettings,
}) {
  return (
    <PageControlsModal
      isOpen={isOpen}
      onClose={onClose}
      title="Document Page Controls"
      onSave={onSave}
    >
      <div className="ui-small-muted">Use these controls to manage document and template views.</div>
      <div className="small">Search, filters, upload, and templates are in the page footer. Open Categories to add or edit category labels.</div>
      <div className="page-controls-actions-group">
        <Button_Toolbar
          icon={TagIcon}
          label="Cats"
          title="Manage document categories"
          onClick={() => {
            onClose();
            onOpenCategories?.();
          }}
          className="btn-primary"
        />
        <Button_Toolbar
          icon={CheckCircleIcon}
          label="Status"
          title="Manage document statuses"
          onClick={() => {
            onClose();
            onOpenStatuses?.();
          }}
          className="btn-primary"
        />
      </div>
      <TableSettingsControls
        settings={pendingSettings}
        onChange={(patch) => setPendingSettings?.((prev) => ({ ...prev, ...patch }))}
        toggles={[
          { key: "showCategory", label: "Show Category", description: "Display category badge on document row items" },
          { key: "showType", label: "Show Document Type", description: "Display document entity type under filename" },
          { key: "showTags", label: "Show Document Tags", description: "Display tag badges on row items" },
          { key: "showActions", label: "Show View Action", description: "Display quick-view button column" },
        ]}
      />
    </PageControlsModal>
  );
}
