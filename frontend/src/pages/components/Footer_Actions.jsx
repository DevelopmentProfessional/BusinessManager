import React from "react";

/**
 * Standard modal/form footer actions: primary (Add/Save) on the left, Cancel/Close centered.
 * Optional `end` slot for secondary actions (Clear, Delete) on the right.
 */
export default function Footer_Actions({ start, center, end, className="" }) {
  return (
    <div className={`app-footer-actions d-flex align-items-center w-100 ${className}`.trim()}>
      <div className="align-items-center app-footer-actions__start d-flex flex-shrink-0 gap-2">{start}</div>
      <div className="align-items-center app-footer-actions__center d-flex flex-grow-1 gap-2 justify-content-center">{center}</div>
      <div className="align-items-center app-footer-actions__end d-flex flex-shrink-0 gap-2 justify-content-end">{end ?? <span className="app-footer-actions__spacer" aria-hidden="true" />}</div>
    </div>
  );
}
