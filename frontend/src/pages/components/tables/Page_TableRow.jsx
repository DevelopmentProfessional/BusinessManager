import React from "react";

/**
 * PageTableRow
 *
 * A standard table row for the upward-scrolling page tables.
 * Applies consistent height, pointer cursor, alignment, and bottom border.
 *
 * Props:
 *   onClick?: () => void  — row click handler
 *   children: <td> cells
 */
export default function PageTableRow({ onClick, children, className = "" }) {
  return (
    <tr className={`main-page-table-row app-table-row pb-1 ${className}`.trim()} onClick={onClick}>
      {children}
    </tr>
  );
}
