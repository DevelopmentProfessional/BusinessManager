// FILE: Modal_Clients_Settings.jsx
// Dedicated settings/controls modal for the Clients page
import React from "react";
import { TicketIcon, CheckCircleIcon } from "../../../icons";
import PageControlsModal from "./Page_ControlsModal";
import { Accordion } from "../accordions";
import Button_Toolbar from "../buttons/Button_Toolbar";
import TableSettingsControls from "../tables/TableSettingsControls";

export default function Modal_Clients_Settings({
  isOpen,
  onClose,
  onSave,
  onOpenSubscriptions,
  onOpenStatuses,
  pendingSettings,
  setPendingSettings,
}) {
  return (
    <PageControlsModal
      isOpen={isOpen}
      onClose={onClose}
      title="Client Page Controls"
      onSave={onSave}
    >
      <Accordion variant="settings" header="Table preferences" defaultOpen>
        <div className="ui-small-muted mb-2">Configure the Clients page table view.</div>
        <TableSettingsControls
          settings={pendingSettings}
          showHeading={false}
          onChange={(patch) => setPendingSettings?.((prev) => ({ ...prev, ...patch }))}
          toggles={[
            { key: "showEmail", label: "Show Client Email", description: "Display client email address under client name" },
            { key: "showSubs", label: "Show Subscription Column", description: "Display client membership tier column" },
          ]}
        />
      </Accordion>
      <Accordion variant="settings" header="Client actions">
        <div className="ui-small-muted mb-2">Manage subscription and status lists.</div>
        <div className="page-controls-actions-group">
          <Button_Toolbar
            icon={TicketIcon}
            label="Subs"
            onClick={() => {
              onClose();
              onOpenSubscriptions?.();
            }}
            className="btn-primary"
            title="Manage subscriptions"
          />
          <Button_Toolbar
            icon={CheckCircleIcon}
            label="Status"
            onClick={() => {
              onClose();
              onOpenStatuses?.();
            }}
            className="btn-primary"
            title="Manage client statuses"
          />
        </div>
      </Accordion>
    </PageControlsModal>
  );
}
