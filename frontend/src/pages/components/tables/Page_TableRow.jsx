import React from "react";

/**
 * PageTableRow
 *
 * A standard table row for the upward-scrolling page tables.
 * When a `name` prop is provided, segments the item into two rows:
 *   [1] Top row: Full-width name spanning across the table.
 *   [2] Bottom row: Column cells (select checkbox, details, metadata, actions)
 *       that align with the table headers and colgroup.
 *
 * Props:
 *   onClick?: () => void  — row click handler
 *   name?: ReactNode      — item name/title spanning the full row width
 *   colSpan?: number      — number of columns for the name cell (default 12)
 *   children: <td> cells
 *   className?: string
 *   nameClassName?: string
 *   detailsClassName?: string
 */
export default function PageTableRow({
  onClick,
  name,
  colSpan,
  children,
  className = "",
  nameClassName = "",
  detailsClassName = "",
}) {
  if (!name) {
    return (
      <tr className={`main-page-table-row app-table-row pb-1 ${className}`.trim()} onClick={onClick}>
        {children}
      </tr>
    );
  }

  // Derive exact colSpan from details cells count so fixed-table layout doesn't create ghost columns
  const effectiveColSpan = colSpan ?? Math.max(1, React.Children.toArray(children).filter(Boolean).length);

  return (
    <>
      <tr className={`main-page-table-row app-table-row app-table-row--name ${className} ${nameClassName}`.trim()} onClick={onClick}>
        <td colSpan={effectiveColSpan} className="main-page-table-name-cell">
          {name}
        </td>
      </tr>
      <tr className={`main-page-table-row app-table-row app-table-row--details pb-1 ${className} ${detailsClassName}`.trim()} onClick={onClick}>
        {children}
      </tr>
    </>
  );
}
