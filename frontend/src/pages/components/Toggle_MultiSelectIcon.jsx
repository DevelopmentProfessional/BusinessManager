import React from "react";
import { CheckCircleIcon as CheckCircleOutline } from "@heroicons/react/24/outline";
import { CheckCircleIcon as CheckCircleSolid } from "@heroicons/react/24/solid";

/**
 * Icon-based multi-select toggle used in row/header bulk-selection controls.
 * Selected state uses the filled icon; unselected uses outline icon.
 */
export default function Toggle_MultiSelectIcon({ selected = false, onToggle, title = "Toggle selection", className = "" }) {
  const Icon = selected ? CheckCircleSolid : CheckCircleOutline;

  return (
    <button type="button" title={title} aria-label={title} aria-pressed={selected} onClick={onToggle} className={`app-select-icon ${selected ? "app-select-icon--active" : ""} ${className}`.trim()}>
      <Icon />
    </button>
  );
}
