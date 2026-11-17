import React, { useId, useState } from "react";
import { ChevronDownIcon } from "../../../icons";

export default function Accordion({
  header,
  children,
  defaultOpen = false,
  className = "",
  variant = "default",
  open,
  onToggle,
  icon: Icon,
  iconClassName = "",
  titleExtra = null,
  bodyPlacement = "above",
  bodyClassName = "",
  bodyStyle = {},
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const contentId = useId();

  if (variant === "settings") {
    const isOpen = typeof open === "boolean" ? open : internalOpen;
    const body = isOpen && (
      <div
        id={contentId}
        className={`px-2 pt-2 pb-1 ${bodyClassName}`.trim()}
        role="region"
        style={{
          borderTop: bodyPlacement === "below" ? "1px solid var(--bs-border-color)" : undefined,
          borderBottom: bodyPlacement === "above" ? "1px solid var(--bs-border-color)" : undefined,
          ...bodyStyle,
        }}
      >
        {children}
      </div>
    );

    return (
      <div className={`app-accordion-settings ${className}`.trim()}>
        {bodyPlacement === "above" && body}
        <button
          type="button"
          className="align-items-center bg-transparent border-0 d-flex justify-content-between px-1 py-0 text-start w-100"
          aria-expanded={isOpen}
          aria-controls={contentId}
          onClick={() => {
            const nextOpen = !isOpen;
            if (typeof open !== "boolean") setInternalOpen(nextOpen);
            onToggle?.(nextOpen);
          }}
        >
          <div className="align-items-center d-flex flex-wrap gap-2 min-w-0">
            {Icon && <Icon className={`h-5 w-5 flex-shrink-0 ${iconClassName}`} />}
            <span className="fw-semibold">{header}</span>
            {titleExtra}
          </div>
          <ChevronDownIcon className="flex-shrink-0 h-4 text-muted w-4" aria-hidden="true" style={{ transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "none" }} />
        </button>
        {bodyPlacement !== "above" && body}
      </div>
    );
  }

  return (
    <details className={`app-accordion ${className}`.trim()} open={defaultOpen}>
      <summary className="app-accordion-summary">{header}</summary>
      <div className="app-accordion-body">{children}</div>
    </details>
  );
}
