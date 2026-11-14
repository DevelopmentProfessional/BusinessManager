// FILE: Report_SelectorDropup.jsx
// Static report picker dropup for Reports page footer (not affected by profile align / view mode).

import React, { useEffect, useRef } from "react";
import { ChartBarIcon, CurrencyDollarIcon } from "@heroicons/react/24/outline";
import Button_Toolbar from "../buttons/Button_Toolbar";

const ITEM_STYLE = {
  fontSize: "var(--app-input-font-size, 0.875rem)",
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
    <div ref={rootRef} className="app-dropup position-relative reports-selector-dropup w-100" style={{ textAlign: "left" }}>
      <Button_Toolbar icon={ChartBarIcon} label="Reports" onClick={() => onToggle(!open)} className="btn-outline-secondary app-menu-trigger" style={{ whiteSpace: "nowrap" }} aria-expanded={open} aria-haspopup="listbox" title={selectedTitle || "Reports"} />

      {open && (
        <div
          role="listbox"
          className="app-menu-panel bg-white bottom-100 dark:bg-gray-900 mb-2 position-absolute shadow-lg start-50 translate-middle-x"
          style={{
            zIndex: 1050,
            width: "100%",
            minWidth: "14rem",
            maxWidth: "22rem",
          }}
        >
          <div className="flex-grow-1 overflow-y-auto reports-selector-dropup__list" style={{ maxHeight: "min(50vh, 22rem)" }}>
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
              className="border-bottom reports-selector-dropup__item text-body"
              style={ITEM_STYLE}
            >
              <CurrencyDollarIcon className="flex-shrink-0 text-green-600" style={{ width: "1.125rem", height: "1.125rem" }} />
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
