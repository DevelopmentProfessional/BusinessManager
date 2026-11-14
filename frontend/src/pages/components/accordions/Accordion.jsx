import React from "react";

export default function Accordion({ header, children, defaultOpen = false, className = "" }) {
  return (
    <details className={`app-accordion ${className}`.trim()} open={defaultOpen}>
      <summary className="app-accordion-summary">{header}</summary>
      <div className="app-accordion-body">{children}</div>
    </details>
  );
}
