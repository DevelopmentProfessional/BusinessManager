// FILE: Modal_Employees_Settings.jsx
// Dedicated settings/controls modal for the Employees page
import React from "react";
import { UserGroupIcon, CheckCircleIcon, ClipboardDocumentListIcon, BuildingOfficeIcon, ShieldCheckIcon } from "../../../icons";
import PageControlsModal from "./Page_ControlsModal";
import { Accordion } from "../accordions";
import Button_Toolbar from "../buttons/Button_Toolbar";
import TableSettingsControls from "../tables/TableSettingsControls";

export default function Modal_Employees_Settings({
  isOpen,
  onClose,
  onSave,
  onOpenRoles,
  onOpenStatuses,
  onOpenRequests,
  onOpenDepartments,
  onOpenInsurance,
  subpageContent,
  pendingSettings,
  setPendingSettings,
}) {
  return (
    <PageControlsModal
      isOpen={isOpen}
      onClose={onClose}
      title="Employee Page Settings"
      onSave={onSave}
      subpageContent={subpageContent}
    >
      <Accordion variant="settings" header="Table preferences" defaultOpen>
        <div className="ui-small-muted mb-2">Configure employee table columns and text size.</div>
        <TableSettingsControls
          settings={pendingSettings}
          showHeading={false}
          onChange={(patch) => setPendingSettings?.((prev) => ({ ...prev, ...patch }))}
          toggles={[
            { key: "showRole", label: "Show Role Column", description: "Display employee role column in table" },
            { key: "showDepartment", label: "Show Department Badge", description: "Display department badge under employee name" },
            { key: "showChat", label: "Show Chat Action", description: "Display quick-chat button column" },
          ]}
        />
      </Accordion>
      <Accordion variant="settings" header="Employee actions">
        <div className="ui-small-muted mb-2">Manage employee requests, roles, departments, insurance, and status lists.</div>
        <div className="page-controls-actions-group">
          <Button_Toolbar
            icon={ClipboardDocumentListIcon}
            label="Requests"
            onClick={() => onOpenRequests?.()}
            className="btn-primary"
            title="Review employee requests"
          />
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
            icon={BuildingOfficeIcon}
            label="Departments"
            onClick={() => onOpenDepartments?.()}
            className="btn-primary"
            title="Manage departments"
          />
          <Button_Toolbar
            icon={ShieldCheckIcon}
            label="Insurance"
            onClick={() => onOpenInsurance?.()}
            className="btn-primary"
            title="Manage insurance plans"
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
      </Accordion>
    </PageControlsModal>
  );
}
