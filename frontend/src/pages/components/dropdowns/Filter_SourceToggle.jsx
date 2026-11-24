import React from "react";
import Button_App from "../buttons/Button_App";

const DEFAULT_OPTIONS = [
  ["all", "All"],
  ["pos", "POS"],
  ["portal", "Portal"],
];

/**
 * Compact source filter (All / POS / Portal) — matches Sales History footer pattern.
 */
export default function Filter_SourceToggle({ value, onChange, options = DEFAULT_OPTIONS, size = "sm", className="" }) {
  return (
    <div className={`btn-group btn-group-${size} flex-shrink-0 ${className}`.trim()} role="group" aria-label="Sale source">
      {options.map(([optionValue, label]) => (
        <Button_App
          key={optionValue}
          label={label}
          showLabel
          variant={value === optionValue ? "primary" : "secondary"}
          aria-pressed={value === optionValue}
          onClick={() => onChange?.(optionValue)}
        />
      ))}
    </div>
  );
}
