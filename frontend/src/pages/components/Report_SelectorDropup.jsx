// FILE: Report_SelectorDropup.jsx
// Static report picker dropup for Reports page footer (not affected by profile align / view mode).

import React, { useEffect, useRef } from "react";
import { ChartBarIcon, ChevronUpDownIcon, CurrencyDollarIcon } from "@heroicons/react/24/outline";

const ITEM_STYLE = {
  fontSize: "0.875rem",
  lineHeight: 1.35,
  padding: "0.5rem 0.75rem",
  textAlign: "left",
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  whiteSpace: "nowrap",
  width: "100%",
  cursor: "pointer",
};

export default function Report_SelectorDropup({ open, onToggle, selectedTitle, reports, selectedReportId, onSelectReport, onOpenFinancial }) {
  const rootRef = useRef(null);

  const handleOptionKeyDown = (e, onSelect) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      e.currentTarget.nextElementSibling?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      e.currentTarget.previousElementSibling?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onToggle(false);
    }
  };

  useEffect(() => {
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) onToggle(false);
    };
    if (open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open, onToggle]);

  return (
    <div ref={rootRef} className="position-relative reports-selector-dropup w-100" style={{ textAlign: "left" }}>
      <button type="button" onClick={() => onToggle(!open)} className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center justify-content-center gap-1 w-100" style={{ fontSize: "0.875rem", whiteSpace: "nowrap", minHeight: "2rem" }} aria-expanded={open} aria-haspopup="listbox" title={selectedTitle || "Report"}>
        <ChartBarIcon className="h-4 w-4 flex-shrink-0" style={{ width: "1rem", height: "1rem" }} />
        <ChevronUpDownIcon className="h-4 w-4 flex-shrink-0" style={{ width: "1rem", height: "1rem" }} />
      </button>

      {open && (
        <div
          role="listbox"
          className="position-absolute bottom-100 start-50 translate-middle-x mb-2 border border-gray-200 dark:border-gray-700 rounded-3 shadow-lg bg-white dark:bg-gray-900"
          style={{
            zIndex: 1050,
            width: "100%",
            minWidth: "14rem",
            maxWidth: "22rem",
          }}
        >
          <div className="reports-selector-dropup__list overflow-y-auto flex-grow-1" style={{ maxHeight: "min(50vh, 22rem)" }}>
            <div
              role="option"
              tabIndex={0}
              aria-selected={false}
              onClick={() => {
                onOpenFinancial();
                onToggle(false);
              }}
              onKeyDown={(e) =>
                handleOptionKeyDown(e, () => {
                  onOpenFinancial();
                  onToggle(false);
                })
              }
              className="reports-selector-dropup__item text-body border-bottom"
              style={ITEM_STYLE}
            >
              <CurrencyDollarIcon className="text-green-600 flex-shrink-0" style={{ width: "1.125rem", height: "1.125rem" }} />
              <span>Financial</span>
            </div>
            {reports.map((report) => {
              const Icon = report.icon;
              const isActive = selectedReportId === report.id;
              return (
                <div
                  key={report.id}
                  role="option"
                  tabIndex={0}
                  aria-selected={isActive}
                  onClick={() => onSelectReport(report.id)}
                  onKeyDown={(e) => handleOptionKeyDown(e, () => onSelectReport(report.id))}
                  className={`reports-selector-dropup__item ${isActive ? "bg-primary text-white" : "text-body"}`}
                  style={ITEM_STYLE}
                >
                  {Icon && <Icon className="flex-shrink-0" style={{ width: "1.125rem", height: "1.125rem" }} />}
                  <span>{report.title}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
