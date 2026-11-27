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
  headerRef = null,
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const contentId = useId();
  const headerId = `${contentId}-header`;

  if (variant === "settings") {
    const isOpen = typeof open === "boolean" ? open : internalOpen;
    const isAbove = bodyPlacement === "above";
    const placementModifier = isAbove ? "profile-accordion-body--above" : "profile-accordion-body--below";
    const body = isOpen && (
      <div
        id={contentId}
        className={`profile-accordion-body ${placementModifier} ${bodyClassName}`.trim()}
        role="region"
        aria-labelledby={headerId}
        style={bodyStyle}
      >
        {children}
      </div>
    );

    return (
      <div className={`app-accordion-settings ${className}`.trim()}>
        {isAbove && body}
        <button
          ref={headerRef}
          id={headerId}
          type="button"
          className="profile-accordion-header"
          data-active={isOpen}
          aria-expanded={isOpen}
          aria-controls={contentId}
          onClick={() => {
            const nextOpen = !isOpen;
            if (typeof open !== "boolean") setInternalOpen(nextOpen);
            onToggle?.(nextOpen);
          }}
        >
          <div className="align-items-center d-flex flex-nowrap gap-2 min-w-0">
            {Icon && <Icon className={`h-5 w-5 flex-shrink-0 ${iconClassName}`} />}
            <span className="fw-semibold text-truncate">{header}</span>
            {titleExtra}
          </div>
          <ChevronDownIcon className="flex-shrink-0 h-4 text-muted w-4" aria-hidden="true" style={{ transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "none" }} />
        </button>
        {!isAbove && body}
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
