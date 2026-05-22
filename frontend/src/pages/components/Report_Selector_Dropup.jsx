// FILE: Report_Selector_Dropup.jsx
// Static report picker dropup for Reports page footer (not affected by profile align / view mode).

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronUpDownIcon, CurrencyDollarIcon } from "@heroicons/react/24/outline";

const ITEM_STYLE = {
  fontSize: "0.875rem",
  lineHeight: 1.35,
  padding: "0.5rem 0.75rem",
  textAlign: "left",
};

export default function Report_Selector_Dropup({ open, onToggle, selectedTitle, reports, selectedReportId, onSelectReport, onOpenFinancial }) {
  const [search, setSearch] = useState("");
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) onToggle(false);
    };
    if (open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open, onToggle]);

  const filteredReports = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return reports;
    return reports.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.description || "").toLowerCase().includes(q) ||
        String(r.id ?? "")
          .toLowerCase()
          .includes(q)
    );
  }, [reports, search]);

  return (
    <div ref={rootRef} className="position-relative reports-selector-dropup" style={{ textAlign: "left" }}>
      <button type="button" onClick={() => onToggle(!open)} className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-2" style={{ fontSize: "0.875rem", whiteSpace: "nowrap" }} aria-expanded={open} aria-haspopup="listbox">
        <ChevronUpDownIcon className="h-4 w-4 flex-shrink-0" style={{ width: "1rem", height: "1rem" }} />
        <span>{selectedTitle || "Report"}</span>
      </button>

      {open && (
        <div
          role="listbox"
          className="position-absolute bottom-100 start-50 translate-middle-x mb-2 border border-gray-200 dark:border-gray-700 rounded-3 shadow-lg bg-white dark:bg-gray-900 d-flex flex-column"
          style={{
            zIndex: 1050,
            width: "max-content",
            maxWidth: "80vw",
            minWidth: "12rem",
          }}
        >
          <div className="reports-selector-dropup__list overflow-y-auto flex-grow-1" style={{ maxHeight: "min(50vh, 22rem)" }}>
            <button
              type="button"
              role="option"
              onClick={() => {
                onOpenFinancial();
                onToggle(false);
              }}
              className="btn w-100 border-0 rounded-0 d-flex align-items-center gap-2 text-start bg-transparent text-body border-bottom"
              style={ITEM_STYLE}
            >
              <CurrencyDollarIcon className="flex-shrink-0 text-green-600" style={{ width: "1.125rem", height: "1.125rem" }} />
              <span className="d-block w-100">Financial</span>
            </button>
            {filteredReports.length === 0 ? (
              <div className="px-3 py-2 text-muted" style={{ fontSize: "0.875rem" }}>
                No reports match your search
              </div>
            ) : (
              filteredReports.map((report) => {
                const Icon = report.icon;
                const isActive = selectedReportId === report.id;
                return (
                  <button
                    key={report.id}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => onSelectReport(report.id)}
                    className={`btn w-100 border-0 rounded-0 d-flex align-items-center gap-2 text-start ${isActive ? "bg-primary text-white" : "bg-transparent text-body"}`}
                    style={ITEM_STYLE}
                  >
                    {Icon && <Icon className="flex-shrink-0" style={{ width: "1.125rem", height: "1.125rem" }} />}
                    <span className="d-block w-100">{report.title}</span>
                  </button>
                );
              })
            )}
          </div>
          <div className="border-top p-2 flex-shrink-0">
            <input type="search" className="form-control form-control-sm" placeholder="Search reports…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ fontSize: "0.875rem" }} aria-label="Search reports" />
          </div>
        </div>
      )}
    </div>
  );
}
