// FILE: FilterDropdown.jsx
// Reusable filter dropdown with per-option help popovers.
// Replaces repeated inline filter + help-popover pattern in Clients, Employees, Documents.
import React, { useState } from "react";
import Button_Toolbar from "./Button_Toolbar";
import { TagIcon } from "@heroicons/react/24/outline";

export default function FilterDropdown({
  // options: [{ value, label, description }]
  options,
  value,
  onChange,
  icon: Icon = TagIcon,
  label,
  isOpen,
  setIsOpen,
  // CSS class applied to trigger button when a non-default value is active
  activeClass = "bg-primary-600 hover:bg-primary-700 text-white",
  // CSS class applied when value equals options[0].value (the "all" option)
  inactiveClass = "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600",
  // Whether to show the ? help popover buttons
  showHelp = true,
  // Extra style on the dropdown panel
  dropdownStyle,
}) {
  const [helpKey, setHelpKey] = useState(null);
  const defaultValue = options[0]?.value;
  const isActive = value !== defaultValue;

  const handleToggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (!next) setHelpKey(null);
  };

  return (
    <div className="position-relative">
      <Button_Toolbar
        icon={Icon}
        label={label}
        onClick={handleToggle}
        className={`border-0 shadow-lg transition-all ${isActive ? activeClass : inactiveClass}`}
        data-active={isActive}
      />

      {isOpen && (
        <div
          className="position-absolute bottom-100 start-0 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-2 z-50 app-dropdown--min"
          style={dropdownStyle}
        >
          {options.map((option, index) => {
            const isLast = index === options.length - 1;
            const isSelected = value === option.value;
            const isHelpOpen = helpKey === option.value;

            return (
              <div key={option.value} className={`d-flex align-items-center gap-1 ${isLast ? "" : "mb-1"}`}>
                <button
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                    setHelpKey(null);
                  }}
                  className={`d-block w-100 text-start px-3 py-2 rounded-lg transition-colors ${
                    isSelected
                      ? "bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400"
                      : "hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100"
                  }`}
                >
                  {option.label}
                </button>

                {showHelp && option.description && (
                  <div className="position-relative flex-shrink-0">
                    <button
                      type="button"
                      aria-label={`${option.label} help`}
                      className="btn btn-sm text-gray-600 dark:text-gray-300 d-flex align-items-center justify-content-center app-label--bold"
                      style={{ width: "1.75rem", height: "1.75rem" }}
                      onMouseEnter={() => setHelpKey(option.value)}
                      onMouseLeave={() => setHelpKey((prev) => (prev === option.value ? null : prev))}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setHelpKey((prev) => (prev === option.value ? null : option.value));
                      }}
                    >
                      ?
                    </button>

                    {isHelpOpen && (
                      <div
                        className="position-absolute start-50 bottom-100 mb-2 p-2 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-start"
                        style={{ width: "260px", maxWidth: "calc(100vw - 1rem)", transform: "translateX(-55%)" }}
                        onMouseEnter={() => setHelpKey(option.value)}
                        onMouseLeave={() => setHelpKey((prev) => (prev === option.value ? null : prev))}
                      >
                        <div className="fw-semibold text-gray-900 dark:text-gray-100 mb-1">{option.label}</div>
                        <div className="small text-gray-700 dark:text-gray-300">{option.description}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
