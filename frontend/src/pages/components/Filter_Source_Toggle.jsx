import React from "react";

const DEFAULT_OPTIONS = [
  ["all", "All"],
  ["pos", "POS"],
  ["portal", "Portal"],
];

/**
 * Compact source filter (All / POS / Portal) — matches Sales History footer pattern.
 */
export default function Filter_Source_Toggle({ value, onChange, options = DEFAULT_OPTIONS, size = "sm", className = "" }) {
  return (
    <div className={`btn-group btn-group-${size} flex-shrink-0 ${className}`.trim()} role="group" aria-label="Sale source">
      {options.map(([optionValue, label]) => (
        <button key={optionValue} type="button" className={`btn ${value === optionValue ? "btn-secondary" : "btn-outline-secondary"}`} onClick={() => onChange?.(optionValue)}>
          {label}
        </button>
      ))}
    </div>
  );
}
