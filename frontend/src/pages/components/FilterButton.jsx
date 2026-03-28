// FILE: FilterButton.jsx
// renders a filter dropdown with options list; replaces repeated filter patterns
import React, { useState } from "react";
import Button_Toolbar from "./Button_Toolbar";
import { TagIcon } from "@heroicons/react/24/outline";

export default function FilterButton({ options, value, onChange, label, icon: Icon = TagIcon, className = "" }) {
  const [isOpen, setIsOpen] = useState(false);
  const isActive = value !== options[0]?.value;

  return (
    <div className="position-relative">
      <Button_Toolbar
        icon={Icon}
        label={label}
        onClick={() => setIsOpen((v) => !v)}
        className={`border-0 transition-all ${isActive ? "bg-gray-600 text-white" : "btn-app-secondary"} ${className}`}
        data-active={isActive}
      />
      {isOpen && (
        <div className="position-absolute bottom-100 start-0 mb-2 app-card p-2 z-50 app-dropdown--min">
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`d-block w-100 text-start px-3 py-2 rounded-lg transition-colors ${
                value === option.value
                  ? "bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400"
                  : "hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
