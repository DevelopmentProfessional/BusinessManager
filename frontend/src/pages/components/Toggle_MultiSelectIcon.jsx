import React from "react";
import { CheckCircleIcon as CheckCircleOutline } from "@heroicons/react/24/outline";
import { CheckCircleIcon as CheckCircleSolid } from "@heroicons/react/24/solid";

/**
 * Icon-based multi-select toggle used in row/header bulk-selection controls.
 * Selected state uses the filled icon; unselected uses outline icon.
 */
export default function Toggle_MultiSelectIcon({ selected = false, onToggle, title = "Toggle selection", className = "" }) {
  const baseStyle = {
    width: "2rem",
    height: "2rem",
    borderRadius: "9999px",
    border: `1px solid ${selected ? "var(--app-active-color)" : "var(--bs-border-color)"}`,
    background: selected ? "rgba(var(--app-active-color-rgb),0.16)" : "transparent",
    color: selected ? "var(--app-active-color)" : "var(--bs-secondary-color)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    lineHeight: 1,
    cursor: "pointer",
  };

  const Icon = selected ? CheckCircleSolid : CheckCircleOutline;

  return (
    <button type="button" title={title} aria-label={title} aria-pressed={selected} onClick={onToggle} className={className} style={baseStyle}>
      <Icon style={{ width: 18, height: 18 }} />
    </button>
  );
}
