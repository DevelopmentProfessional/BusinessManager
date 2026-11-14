import React from "react";

/**
 * Shared table structure for component-owned tables.
 * Header and body content remain caller-owned so domain-specific rows and
 * controls can compose with the common table styling.
 */
export default function Table({ children, className = "", responsive = true, ...props }) {
  const table = (
    <table className={`app-table table mb-0 ${className}`.trim()} {...props}>
      {children}
    </table>
  );
  return responsive ? <div className="table-responsive">{table}</div> : table;
}
