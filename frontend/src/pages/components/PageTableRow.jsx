import React from 'react';

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
export default function PageTableRow({ onClick, children }) {
  return (
    <tr
      className="align-middle border-bottom app-table-row"
      onClick={onClick}
    >
      {children}
    </tr>
  );
}
