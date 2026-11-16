import React from "react";
import PageControlsModal from "./Page_ControlsModal";
import TableSettingsControls from "../tables/TableSettingsControls";

export default function Modal_Suppliers_Settings({ isOpen, onClose, onSave, pendingSettings, setPendingSettings }) {
  return (
    <PageControlsModal isOpen={isOpen} onClose={onClose} title="Supplier Page Controls" onSave={onSave}>
      <div className="ui-small-muted">Choose which supplier details are shown on the page.</div>
      <TableSettingsControls
        settings={pendingSettings}
        onChange={(patch) => setPendingSettings?.((previous) => ({ ...previous, ...patch }))}
        toggles={[
          { key: "showEmail", label: "Show Email", description: "Display supplier email addresses" },
          { key: "showPhone", label: "Show Phone", description: "Display supplier phone numbers" },
          { key: "showAddress", label: "Show Address", description: "Display supplier mailing addresses" },
        ]}
      />
    </PageControlsModal>
  );
}
