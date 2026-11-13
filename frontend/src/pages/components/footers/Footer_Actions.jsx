import React from "react";

/**
 * Standard modal/form footer actions floated to the left in sequence:
 * Float left -> Add Save Edit Cancel Close [Other buttons]
 * (start: Add/Save/Edit, center: Cancel/Close, end: Other buttons)
 */
export default function Footer_Actions({ start, center, end, className = "" }) {
  return (
    <div className={`app-footer-actions d-flex align-items-center gap-2 w-100 justify-content-start ${className}`.trim()}>
      {start && <div className="align-items-center app-footer-actions__start d-flex flex-shrink-0 gap-2">{start}</div>}
      {center && <div className="align-items-center app-footer-actions__center d-flex flex-shrink-0 gap-2">{center}</div>}
      {end && <div className="align-items-center app-footer-actions__end d-flex flex-shrink-0 gap-2">{end}</div>}
    </div>
  );
}
