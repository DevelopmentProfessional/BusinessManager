import React from "react";
import { ArrowUpIcon, ArrowDownIcon } from "@heroicons/react/24/outline";

/**
 * PageTableHeader
 *
 * Renders a sticky column-header row at the top of the page content area.
 * Mirrors the column widths used in the data rows so headers align with content.
 *
 * Props:
 *   columns: Array<{ label: string|ReactNode, width?: number, className?: string, sortKey?: string }>
 *   sortColumn: string (the current sort key, or null)
 *   sortAsc: boolean (true for ascending, false for descending)
 *   onSort: func(sortKey: string) — called when a header with sortKey is clicked
 */
export default function PageTableHeader({ columns, sortColumn = null, sortAsc = true, onSort = null, className = "" }) {
  const handleHeaderClick = (sortKey) => {
    if (!sortKey || !onSort) return;
    onSort(sortKey);
  };

  return (
    <div className={`app-table-header bg-gray-100 border-bottom dark:bg-gray-700 flex-shrink-0 ${className}`.trim()}>
      <table className="app-main-page-table app-table bg-gray-100 dark:bg-gray-700 dark:text-gray-100 mb-0 table table-borderless text-gray-900 w-100">
        <colgroup>
          {columns.map((col, i) => (
            <col key={i} className={col.className} style={col.width ? { width: col.width } : undefined} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((col, i) => {
              const isSortable = col.sortKey && onSort;
              const isActive = isSortable && sortColumn === col.sortKey;
              const isString = typeof col.label === "string";

              return (
                <th
                  key={i}
                  className={["app-table-th", col.className, isSortable ? "app-table-th--sortable user-select-none" : ""].filter(Boolean).join(" ")}
                  style={isSortable ? { cursor: "pointer" } : undefined}
                  onClick={() => handleHeaderClick(col.sortKey)}
                  title={isSortable ? "Click to sort" : undefined}
                >
                  {isString && isSortable ? (
                    <span className="align-items-center d-inline-flex gap-2">
                      {col.label}
                      <span className="app-sort-indicator d-inline-flex" style={{ opacity: isActive ? 1 : 0.4 }}>
                        {isActive ? sortAsc ? <ArrowUpIcon className="app-icon-14" /> : <ArrowDownIcon className="app-icon-14" /> : <ArrowUpIcon className="app-icon-14" />}
                      </span>
                    </span>
                  ) : (
                    col.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
      </table>
    </div>
  );
}
