import React from "react";
import { ChevronLeftIcon } from "../../../icons";
import Button_Toolbar from "../buttons/Button_Toolbar";

export function SettingsMasterDetailTable({ columns, children }) {
  return (
    <div className="border rounded table-responsive">
      <table className="align-middle mb-0 table table-hover table-sm text-size-small" style={{ fontSize: "var(--app-text-size-small, 0.75rem)" }}>
        <thead className="table-light">
          <tr>
            {columns.map((column, index) => (
              <th key={column.key || `${column.label}-${index}`} className={column.className || ""} style={column.style}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export default function Settings_MasterDetail({ list, detail, detailOpen = false, onBack, className = "" }) {
  return (
    <div
      className={`settings-master-detail ${detailOpen ? "settings-master-detail--detail-open" : ""} ${className}`.trim()}
      style={{ minHeight: detailOpen ? "min(68vh, 42rem)" : "min(40vh, 24rem)" }}
    >
      <section className="settings-master-detail-list">{list}</section>
      {detailOpen && (
        <section className="settings-master-detail-detail">
          <div className="settings-master-detail-detail-header">
            <Button_Toolbar icon={ChevronLeftIcon} label="Back" onClick={onBack} className="btn-outline-secondary btn-sm" title="Back to list" />
          </div>
          <div className="settings-master-detail-detail-content">{detail}</div>
        </section>
      )}
    </div>
  );
}
