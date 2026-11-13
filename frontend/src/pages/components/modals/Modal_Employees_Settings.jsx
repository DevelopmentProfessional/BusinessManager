// FILE: Modal_Employees_Settings.jsx
// Dedicated settings/controls modal for the Employees page
import React from "react";
import { UserGroupIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import PageControlsModal from "./Page_ControlsModal";
import Button_Toolbar from "../buttons/Button_Toolbar";
import TableSettingsControls from "../tables/TableSettingsControls";

export default function Modal_Employees_Settings({
  isOpen,
  onClose,
  onSave,
  onOpenRoles,
  onOpenStatuses,
  pendingSettings,
  setPendingSettings,
}) {
  return (
    <PageControlsModal
      isOpen={isOpen}
      onClose={onClose}
      title="Employee Page Controls"
      onSave={onSave}
    >
      <div className="ui-small-muted">Use these controls to manage employee views and actions.</div>
      <div className="small">Search, role/status filters, and add actions are available.</div>
      <div className="page-controls-actions-group">
        <Button_Toolbar
          icon={UserGroupIcon}
          label="Roles"
          onClick={() => {
            onClose();
            onOpenRoles?.();
          }}
          className="btn-primary"
          title="Manage roles"
        />
        <Button_Toolbar
          icon={CheckCircleIcon}
          label="Status"
          onClick={() => {
            onClose();
            onOpenStatuses?.();
          }}
          className="btn-primary"
          title="Manage employee statuses"
        />
      </div>
      <TableSettingsControls
        settings={pendingSettings}
        onChange={(patch) => setPendingSettings?.((prev) => ({ ...prev, ...patch }))}
        toggles={[
          { key: "showRole", label: "Show Role Column", description: "Display employee role column in table" },
          { key: "showDepartment", label: "Show Department Badge", description: "Display department badge under employee name" },
          { key: "showChat", label: "Show Chat Action", description: "Display quick-chat button column" },
        ]}
      />
    </PageControlsModal>
  );
}
