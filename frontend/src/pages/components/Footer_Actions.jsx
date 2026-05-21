import React from "react";

/**
 * Standard modal/form footer actions: primary (Add/Save) on the left, Cancel/Close centered.
 * Optional `end` slot for secondary actions (Clear, Delete) on the right.
 */
export default function Footer_Actions({ start, center, end, className = "" }) {
  return (
    <div className={`app-footer-actions d-flex align-items-center w-100 ${className}`.trim()}>
      <div className="app-footer-actions__start d-flex align-items-center gap-2 flex-shrink-0">{start}</div>
      <div className="app-footer-actions__center flex-grow-1 d-flex justify-content-center align-items-center gap-2">{center}</div>
      <div className="app-footer-actions__end d-flex align-items-center justify-content-end gap-2 flex-shrink-0">{end ?? <span className="app-footer-actions__spacer" aria-hidden="true" />}</div>
    </div>
  );
}
