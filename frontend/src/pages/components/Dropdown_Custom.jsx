import React, { useState, useRef, useEffect } from "react";
import { PlusIcon } from "@heroicons/react/24/outline";
import { matchesWildcardText } from "../../utils/searchableSelect";
import { useWordSafeLabel } from "../../utils/wordSafeTruncate";
import { sortOptionsByLabel } from "../../utils/displaySort";

export default function Dropdown_Custom({
  value,
  onChange,
  options = [],
  placeholder = "",
  required = false,
  className="",
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
  openUpward = true,
  closeOnSelect = true,
  useCountLabelForMultiSelect = false,
  showSelectionSummary = false,
  selectionSummaryEmptyLabel = "0 selected",
  showActionFooter = false,
  showClearButton = false,
  allowMultiModeToggle = false,
  isMultiModeActive = false,
  onToggleMultiMode = null,
  wordSafeTruncate = true,
  style,
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

  const sortedOptions = sortOptionsByLabel(options);
  const normalizedValue = multiSelect ? (Array.isArray(value) ? value : value ? [value] : []) : value;
  const selectedOptions = multiSelect ? sortedOptions.filter((option) => normalizedValue.includes(option.value)) : [];
  const selectedOption = !multiSelect ? sortedOptions.find((option) => option.value === value) : null;
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
  const { ref: triggerTextRef, displayLabel: wordSafeDisplayValue } = useWordSafeLabel(displayValue, { enabled: wordSafeTruncate && !isOpen });

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
  const filteredOptions = searchable && searchTerm ? sortedOptions.filter((option) => matchesWildcardText(searchTerm, option.label, option.value)) : sortedOptions;

  return (
    <div ref={dropdownRef} className={`relative ${className}`} style={style}>
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
              w-full px-1 py-0 border rounded-lg 
              focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
              border-gray-300 dark:border-gray-600
              ${disabled ? "bg-gray-100 dark:bg-gray-800 cursor-not-allowed text-gray-500 dark:text-gray-400" : "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:border-gray-400 dark:hover:border-gray-500"}
              ${required && (multiSelect ? normalizedValue.length === 0 : !value) ? "border-red-300 dark:border-red-600 focus:ring-red-500" : ""}
            `}
            disabled={disabled}
          />
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
            w-full px-1 py-0 border rounded-lg 
            focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
            flex items-center justify-start
            border-gray-300 dark:border-gray-600
            ${disabled ? "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed" : "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 cursor-pointer hover:border-gray-400 dark:hover:border-gray-500"}
            ${required && (multiSelect ? normalizedValue.length === 0 : !value) ? "border-red-300 dark:border-red-600 focus:ring-red-500" : ""}
          `}
          disabled={disabled}
        >
          <span ref={triggerTextRef} className={`app-word-safe-label ${(multiSelect ? selectedOptions.length === 0 : !selectedOption) ? "text-gray-500 dark:text-gray-400" : ""}`}>
            {wordSafeDisplayValue}
          </span>
        </button>
      )}

      {multiSelect && showSelectionSummary && <div className="dark:text-gray-300 mt-1 text-gray-600 text-xs">{selectedOptions.length > 0 ? selectedOptions.map((option) => option.label).join(", ") : selectionSummaryEmptyLabel}</div>}

      {isOpen && (
        <div className={`app-menu-panel absolute z-50 w-full border rounded-lg shadow-lg max-h-60 overflow-y-auto bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 flex flex-col ${openUpward ? "bottom-full mb-1" : "mt-1"}`}>
          {searchable && !footerSearch && (
            <div className="app-menu-search bg-gray-50 border-bottom border-gray-200 dark:bg-gray-800 dark:border-gray-600 px-0 py-0">
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="form-control ui-control-sm"
                placeholder={placeholder ? `Search ${placeholder.toLowerCase()}` : "Search options"}
                autoFocus
              />
            </div>
          )}

          {loading ? (
            <div className="app-menu-empty dark:text-gray-400 flex gap-2 items-center px-1 py-0 text-gray-500">
              <span className="animate-spin border-2 border-gray-400 border-t-transparent h-4 rounded-full w-4" />
              Loading...
            </div>
          ) : filteredOptions.length === 0 ? (
            <div className="app-menu-empty dark:text-gray-400 px-1 py-0 text-gray-500">No options available</div>
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
                    app-menu-item w-full px-1 py-0 text-left focus:outline-none
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
            <div className="align-items-center app-menu-search bg-gray-50 border-gray-200 border-top d-flex dark:bg-gray-800 dark:border-gray-600 gap-2 px-0 py-0">
              {typeof onCreateFromSearch === "function" && (
                <button
                  type="button"
                  onClick={() => {
                    if (!searchTerm.trim()) return;
                    setIsOpen(false);
                    onCreateFromSearch(searchTerm.trim());
                  }}
                  className="align-items-center btn btn-outline-secondary btn-sm d-inline-flex justify-content-center"
                  style={{ minWidth: "2rem", minHeight: "2rem", padding: "0.25rem" }}
                  title={createButtonTitle}
                  aria-label={createButtonTitle}
                  disabled={!searchTerm.trim()}
                >
                  <PlusIcon className="ui-icon-4" />
                </button>
              )}
              <input type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="form-control ui-control-sm" placeholder={placeholder ? `Search ${placeholder.toLowerCase()}` : "Search options"} />
            </div>
          )}

          {(multiSelect || showActionFooter || showClearButton || allowMultiModeToggle) && (
            <div className="bg-gray-50 border-gray-200 border-top d-flex dark:bg-gray-800 dark:border-gray-600 gap-2 p-0">
              <button type="button" onClick={() => setIsOpen(false)} className="app-menu-action btn btn-outline-secondary btn-sm flex-grow-1">
                OK
              </button>
              {showClearButton && (
                <button type="button" onClick={handleClearMultiSelect} className="app-menu-action btn btn-outline-secondary btn-sm flex-grow-1" disabled={multiSelect ? selectedOptions.length === 0 : !value}>
                  Clear
                </button>
              )}
              {allowMultiModeToggle && (
                <button type="button" onClick={() => onToggleMultiMode?.()} className={`app-menu-action btn btn-sm flex-grow-1 ${isMultiModeActive ? "btn-primary" : "btn-outline-secondary"}`}>
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
