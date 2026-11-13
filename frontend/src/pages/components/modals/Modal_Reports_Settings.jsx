// FILE: Modal_Reports_Settings.jsx
// Dedicated settings/controls modal for the Reports page
import React from "react";
import PageControlsModal from "./Page_ControlsModal";
import TableSettingsControls from "../tables/TableSettingsControls";

export default function Modal_Reports_Settings({
  isOpen,
  onClose,
  onSave,
  kpiVisibility = {},
  setKpiVisibility,
  pendingReportsSettings,
  setPendingReportsSettings,
}) {
  return (
    <PageControlsModal
      isOpen={isOpen}
      onClose={onClose}
      title="Report Page Controls"
      onSave={onSave}
    >
      <div className="mb-2 ui-small-muted">Configure report display and export options.</div>
      <div className="fw-semibold mb-1 small">Summary Cards</div>
      {Object.keys(kpiVisibility).map((label) => (
        <div key={label} className="form-check mb-1">
          <input
            type="checkbox"
            id={`kpi-vis-${label}`}
            className="form-check-input"
            checked={kpiVisibility[label] ?? false}
            onChange={(e) => setKpiVisibility?.((prev) => ({ ...prev, [label]: e.target.checked }))}
          />
          <label className="form-check-label small" htmlFor={`kpi-vis-${label}`}>
            {label}
          </label>
        </div>
      ))}
      <TableSettingsControls
        settings={pendingReportsSettings}
        onChange={(patch) => setPendingReportsSettings?.((prev) => ({ ...prev, ...patch }))}
      />
    </PageControlsModal>
  );
}
