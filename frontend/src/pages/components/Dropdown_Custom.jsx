import React, { useState, useRef, useEffect } from "react";
import { ChevronDownIcon, PlusIcon } from "@heroicons/react/24/outline";
import { matchesWildcardText } from "../../utils/searchableSelect";

export default function Dropdown_Custom({
  value,
  onChange,
  options = [],
  placeholder = "",
  required = false,
  className = "",
  disabled = false,
  name = "",
  id = "",
  searchable = true,
  onOpen = null,
  loading = false,
  multiSelect = false,
  footerSearch = false,
  onCreateFromSearch = null,
  createButtonTitle = "Add",
  openUpward = false,
  closeOnSelect = true,
  useCountLabelForMultiSelect = false,
  showSelectionSummary = false,
  selectionSummaryEmptyLabel = "0 selected",
  showActionFooter = false,
  showClearButton = false,
  allowMultiModeToggle = false,
  isMultiModeActive = false,
  onToggleMultiMode = null,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);

  // Call onOpen callback when dropdown opens
  const handleOpen = () => {
    if (!disabled) {
      setIsOpen(true);
      if (onOpen) onOpen();
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm("");
    }
  }, [isOpen]);

  const normalizedValue = multiSelect ? (Array.isArray(value) ? value : value ? [value] : []) : value;
  const selectedOptions = multiSelect ? options.filter((option) => normalizedValue.includes(option.value)) : [];
  const selectedOption = !multiSelect ? options.find((option) => option.value === value) : null;
  const displayValue = multiSelect
    ? useCountLabelForMultiSelect
      ? `${selectedOptions.length} selected`
      : selectedOptions.length === 0
        ? placeholder
        : selectedOptions.length <= 2
          ? selectedOptions.map((option) => option.label).join(", ")
          : `${selectedOptions.length} selected`
    : selectedOption
      ? selectedOption.label
      : placeholder;
  const selectedSet = multiSelect ? new Set(normalizedValue) : new Set();

  const handleSelect = (option) => {
    if (multiSelect) {
      const next = new Set(selectedSet);
      if (next.has(option.value)) {
        next.delete(option.value);
      } else {
        next.add(option.value);
      }
      onChange({ target: { name, value: Array.from(next) } });
      if (closeOnSelect) {
        setIsOpen(false);
      }
      setSearchTerm("");
      return;
    }
    onChange({ target: { name, value: option.value } });
    if (closeOnSelect) {
      setIsOpen(false);
    }
    setSearchTerm("");
  };

  const handleClearMultiSelect = () => {
    onChange({ target: { name, value: multiSelect ? [] : "" } });
    setSearchTerm("");
  };

  // Filter options based on search term
  const filteredOptions = searchable && searchTerm ? options.filter((option) => matchesWildcardText(searchTerm, option.label, option.value)) : options;

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {searchable && !footerSearch ? (
        <div className="relative">
          <input
            type="text"
            value={isOpen ? searchTerm : displayValue}
            onChange={(e) => {
              if (isOpen) {
                setSearchTerm(e.target.value);
              }
            }}
            onFocus={() => {
              handleOpen();
              setSearchTerm("");
            }}
            placeholder={placeholder}
            className={`
              w-full px-3 py-2 border rounded-lg 
              focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
              border-gray-300 dark:border-gray-600
              ${disabled ? "bg-gray-100 dark:bg-gray-800 cursor-not-allowed text-gray-500 dark:text-gray-400" : "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:border-gray-400 dark:hover:border-gray-500"}
              ${required && (multiSelect ? normalizedValue.length === 0 : !value) ? "border-red-300 dark:border-red-600 focus:ring-red-500" : ""}
            `}
            disabled={disabled}
          />
          <button type="button" onClick={() => !disabled && setIsOpen(!isOpen)} className="absolute right-2 top-1/2 transform -translate-y-1/2">
            <ChevronDownIcon className={`app-icon app-icon--sm text-gray-400 dark:text-gray-500 app-chevron${isOpen ? " app-chevron--open" : ""}`} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            if (disabled) return;
            if (!isOpen && onOpen) onOpen();
            setIsOpen(!isOpen);
          }}
          className={`
            w-full px-3 py-2 border rounded-lg 
            focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
            flex items-center justify-between
            border-gray-300 dark:border-gray-600
            ${disabled ? "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed" : "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 cursor-pointer hover:border-gray-400 dark:hover:border-gray-500"}
            ${required && (multiSelect ? normalizedValue.length === 0 : !value) ? "border-red-300 dark:border-red-600 focus:ring-red-500" : ""}
          `}
          disabled={disabled}
        >
          <span className={(multiSelect ? selectedOptions.length === 0 : !selectedOption) ? "text-gray-500 dark:text-gray-400" : ""}>{displayValue}</span>
          <ChevronDownIcon className={`app-icon app-icon--sm text-gray-500 dark:text-gray-400 app-chevron${isOpen ? " app-chevron--open" : ""}`} />
        </button>
      )}

      {multiSelect && showSelectionSummary && <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">{selectedOptions.length > 0 ? selectedOptions.map((option) => option.label).join(", ") : selectionSummaryEmptyLabel}</div>}

      {isOpen && (
        <div className={`absolute z-50 w-full border rounded-lg shadow-lg max-h-60 overflow-y-auto bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 flex flex-col ${openUpward ? "bottom-full mb-1" : "mt-1"}`}>
          {loading ? (
            <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
              <span className="animate-spin h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full" />
              Loading...
            </div>
          ) : filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No options available</div>
          ) : (
            <div className="overflow-y-auto">
              {filteredOptions.map((option) => {
                const isSelected = multiSelect ? selectedSet.has(option.value) : option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option)}
                    className={`
                    w-full px-3 py-2 text-left focus:outline-none
                    hover:bg-gray-100 dark:hover:bg-gray-600 focus:bg-gray-100 dark:focus:bg-gray-600
                    ${isSelected ? "bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300" : "text-gray-900 dark:text-gray-200"}
                  `}
                    aria-pressed={isSelected}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          )}

          {searchable && footerSearch && (
            <div className="px-2 py-2 border-top border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 d-flex align-items-center gap-2">
              {typeof onCreateFromSearch === "function" && (
                <button
                  type="button"
                  onClick={() => {
                    if (!searchTerm.trim()) return;
                    setIsOpen(false);
                    onCreateFromSearch(searchTerm.trim());
                  }}
                  className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center justify-content-center"
                  style={{ minWidth: "2rem", minHeight: "2rem", padding: "0.25rem" }}
                  title={createButtonTitle}
                  aria-label={createButtonTitle}
                  disabled={!searchTerm.trim()}
                >
                  <PlusIcon className="h-4 w-4" />
                </button>
              )}
              <input type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="form-control form-control-sm" placeholder={placeholder ? `Search ${placeholder.toLowerCase()}` : "Search options"} />
            </div>
          )}

          {(multiSelect || showActionFooter || showClearButton || allowMultiModeToggle) && (
            <div className="d-flex gap-2 p-2 border-top border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 sticky bottom-0">
              <button type="button" onClick={() => setIsOpen(false)} className="btn btn-sm btn-outline-secondary flex-grow-1">
                OK
              </button>
              {showClearButton && (
                <button type="button" onClick={handleClearMultiSelect} className="btn btn-sm btn-outline-secondary flex-grow-1" disabled={multiSelect ? selectedOptions.length === 0 : !value}>
                  Clear
                </button>
              )}
              {allowMultiModeToggle && (
                <button type="button" onClick={() => onToggleMultiMode?.()} className={`btn btn-sm flex-grow-1 ${isMultiModeActive ? "btn-primary" : "btn-outline-secondary"}`}>
                  Multi
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
