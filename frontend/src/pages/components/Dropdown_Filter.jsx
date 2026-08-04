// FILE: Dropdown_Filter.jsx
// Reusable filter dropdown with per-option help popovers.
// Replaces repeated inline filter + help-popover pattern in Clients, Employees, Documents.
import React, { useState } from "react";
import Button_Toolbar from "./Button_Toolbar";
import compactButtonLabel from "../../utils/compactButtonLabel";
import { TagIcon } from "@heroicons/react/24/outline";
import { sortOptionsByLabel } from "../../utils/displaySort";

export default function Dropdown_Filter({
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
  const [searchTerm, setSearchTerm] = useState("");
  const sortedOptions = sortOptionsByLabel(options);
  const filteredOptions = searchTerm.trim() ? sortedOptions.filter((option) => String(option?.label || "").toLowerCase().includes(searchTerm.trim().toLowerCase())) : sortedOptions;
  const defaultValue = sortedOptions[0]?.value;
  const isActive = value !== defaultValue;

  const handleToggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (!next) {
      setHelpKey(null);
      setSearchTerm("");
    }
  };

  return (
    <div className="ui-pos-rel">
      <Button_Toolbar icon={Icon} label={compactButtonLabel(label)} title={label} onClick={handleToggle} className={`border-0 shadow-lg transition-all ${isActive ? activeClass : inactiveClass}`} data-active={isActive} />

      {isOpen && (
        <div className="app-dropdown--min app-menu-panel bg-white border border-gray-200 bottom-100 dark:bg-gray-800 dark:border-gray-700 mb-2 p-0 position-absolute rounded-xl shadow-lg start-0 z-50" style={dropdownStyle}>
          <div className="app-menu-search bg-gray-50 border-bottom border-gray-200 dark:bg-gray-800 dark:border-gray-700 px-0 py-0">
            <input type="search" className="form-control ui-control-sm" placeholder={`Search ${String(label || "filter").toLowerCase()}...`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>

          <div className="overflow-auto" style={{ maxHeight: "16rem" }}>
            {filteredOptions.map((option, index) => {
              const isLast = index === filteredOptions.length - 1;
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
                  className={`app-menu-item d-block w-100 text-start px-1 py-0 rounded-lg transition-colors ${isSelected ? "bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400" : "hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100"}`}
                >
                  {option.label}
                </button>

                {showHelp && option.description && (
                  <div className="flex-shrink-0 position-relative">
                    <button
                      type="button"
                      aria-label={`${option.label} help`}
                      className="align-items-center app-label--bold app-menu-action btn btn-sm d-flex dark:text-gray-300 justify-content-center text-gray-600"
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
                        className="app-menu-panel bg-white border border-gray-200 bottom-100 dark:bg-gray-800 dark:border-gray-700 mb-2 p-0 position-absolute rounded-lg shadow-lg start-50 text-start"
                        style={{ width: "260px", maxWidth: "calc(100vw - 1rem)", transform: "translateX(-55%)" }}
                        onMouseEnter={() => setHelpKey(option.value)}
                        onMouseLeave={() => setHelpKey((prev) => (prev === option.value ? null : prev))}
                      >
                        <div className="dark:text-gray-100 fw-semibold mb-1 text-gray-900">{option.label}</div>
                        <div className="dark:text-gray-300 small text-gray-700">{option.description}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
            })}

            {filteredOptions.length === 0 && <div className="app-menu-empty dark:text-gray-400 px-1 py-0 text-gray-500">No matching options</div>}
          </div>
        </div>
      )}
    </div>
  );
}
