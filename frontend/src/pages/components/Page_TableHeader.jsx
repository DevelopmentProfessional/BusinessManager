import React from "react";

/**
 * PageTableHeader
 *
 * Renders a sticky column-header row at the top of the page content area.
 * Mirrors the column widths used in the data rows so headers align with content.
 *
 * Props:
 *   columns: Array<{ label: string, width?: number, className?: string }>
 */
export default function PageTableHeader({ columns }) {
  return (
    <div className="flex-shrink-0 border-bottom bg-gray-100 dark:bg-gray-700" style={{ zIndex: 5 }}>
      <table className="table table-borderless mb-0 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
        <colgroup>
          {columns.map((col, i) => (
            <col key={i} style={col.width ? { width: col.width } : undefined} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th key={i} className={["text-start", col.className].filter(Boolean).join(" ")}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
      </table>
    </div>
  );
}
