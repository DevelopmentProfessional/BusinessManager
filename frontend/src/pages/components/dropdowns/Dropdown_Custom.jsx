import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { PlusIcon } from "../../../icons";
import { matchesWildcardText } from "../../../utils/searchableSelect";
import { sortOptionsByLabel } from "../../../utils/displaySort";
import { getViewportClampedMenuBounds, getViewportClampedMenuVerticalPosition } from "./menuPosition";

function getDropdownPortalHost() {
  if (typeof document === "undefined" || !document.body) return null;
  let host = document.getElementById("app-dropdown-portal-host");
  if (!host) {
    host = document.createElement("div");
    host.id = "app-dropdown-portal-host";
    document.body.appendChild(host);
  }
  return host;
}

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
  onCreateFromSearch = null,
  createButtonTitle = "Add",
  preserveOptionOrder = false,
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
  style,
  label = "",
  floatingLabel = "",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [helpKey, setHelpKey] = useState(null);
  const [menuPosition, setMenuPosition] = useState(null);
  const [portalTarget, setPortalTarget] = useState(null);
  const dropdownRef = useRef(null);
  const menuRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    setPortalTarget(getDropdownPortalHost());
  }, []);

  // Call onOpen callback when dropdown opens
  const handleOpen = () => {
    if (!disabled) {
      setIsOpen(true);
      setSearchTerm("");
      if (onOpen) onOpen();
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      const clickedTrigger = dropdownRef.current?.contains(event.target);
      const clickedMenu = menuRef.current?.contains(event.target);
      if (!clickedTrigger && !clickedMenu) {
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
      setHelpKey(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !portalTarget) return undefined;
    const focusSearchInput = window.setTimeout(() => searchInputRef.current?.focus(), 0);
    return () => window.clearTimeout(focusSearchInput);
  }, [isOpen, portalTarget]);

  useEffect(() => {
    if (!isOpen || !dropdownRef.current) {
      setMenuPosition(null);
      return undefined;
    }

    const updateMenuPosition = () => {
      const triggerRect = dropdownRef.current.getBoundingClientRect();
      const gap = 4;
      const estimatedMenuHeight = 260;
      const bounds = getViewportClampedMenuBounds(triggerRect, { sideMargin: 8 });
      const verticalPosition = getViewportClampedMenuVerticalPosition(triggerRect, {
        gap,
        maxHeight: estimatedMenuHeight,
        openUpward,
      });
      setMenuPosition({
        left: bounds.left,
        minWidth: bounds.width,
        maxWidth: bounds.maxWidth,
        ...verticalPosition,
      });
    };

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    window.visualViewport?.addEventListener("resize", updateMenuPosition);
    window.visualViewport?.addEventListener("scroll", updateMenuPosition);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
      window.visualViewport?.removeEventListener("resize", updateMenuPosition);
      window.visualViewport?.removeEventListener("scroll", updateMenuPosition);
    };
  }, [isOpen, openUpward]);

  const sortedOptions = preserveOptionOrder ? options : sortOptionsByLabel(options);
  const normalizedValue = multiSelect ? (Array.isArray(value) ? value : value ? [value] : []) : value;
  const selectedOptions = multiSelect ? sortedOptions.filter((option) => normalizedValue.includes(option.value)) : [];
  const selectedOption = !multiSelect ? sortedOptions.find((option) => option.value === value) : null;
  const rawDerived = placeholder ? placeholder.replace(/^(?:—\s*)?Select\s+/i, "").replace(/\s*—$/, "").replace(/[….]+$/, "").trim() : "";
  const derivedPlaceholderLabel = rawDerived ? rawDerived.charAt(0).toUpperCase() + rawDerived.slice(1) : "";
  const effectiveFloatingLabel = floatingLabel === false ? "" : (floatingLabel || label || derivedPlaceholderLabel);
  const hasValue = multiSelect ? selectedOptions.length > 0 : Boolean(selectedOption && selectedOption.value !== "");
  const isFloating = Boolean(effectiveFloatingLabel);

  const displayValue = multiSelect
    ? useCountLabelForMultiSelect
      ? `${selectedOptions.length} selected`
      : selectedOptions.length === 0
        ? (isFloating ? "" : placeholder)
        : selectedOptions.length <= 2
          ? selectedOptions.map((option) => option.label).join(", ")
          : `${selectedOptions.length} selected`
    : selectedOption
      ? selectedOption.label
      : (isFloating ? "" : placeholder);
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
  const filteredOptions = searchable && searchTerm ? sortedOptions.filter((option) => matchesWildcardText(searchTerm, option.label, option.value, option.searchText)) : sortedOptions;

  useEffect(() => {
    if (!isOpen || !menuPosition || !menuRef.current) return;
    const menuWidth = menuRef.current.getBoundingClientRect().width;
    const { left } = getViewportClampedMenuBounds(
      { left: menuPosition.left, width: menuWidth },
      { minWidth: menuWidth, maxWidth: menuWidth, sideMargin: 8 }
    );
    if (Math.abs(left - menuPosition.left) > 0.5) {
      setMenuPosition((current) => current && { ...current, left });
    }
  }, [isOpen, menuPosition, filteredOptions.length]);

  return (
    <div
      ref={dropdownRef}
      className={`app-dropdown-root relative w-full ${isFloating ? "form-floating app-dropdown-floating" : ""} ${hasValue ? "has-value" : ""} ${isOpen ? "is-open" : ""} ${className}`.trim()}
      style={style}
    >
      <input
        id={id || undefined}
        type="search"
        value={displayValue}
        onFocus={() => {
          if (disabled) return;
          if (!isOpen) handleOpen();
        }}
        readOnly
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            setIsOpen(false);
          } else if (event.key === "ArrowDown" && !isOpen) {
            event.preventDefault();
            handleOpen();
          }
        }}
        className={`ui-dropdown-trigger
          w-full border rounded-pill
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
          flex items-center justify-start
          border-gray-300 dark:border-gray-600
          ${isFloating ? "app-dropdown-floating-trigger form-control form-select ui-control-sm" : "px-1 py-0"}
          ${disabled ? "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed" : "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 cursor-pointer hover:border-gray-400 dark:hover:border-gray-500"}
          ${required && (multiSelect ? normalizedValue.length === 0 : !value) ? "border-red-300 dark:border-red-600 focus:ring-red-500" : ""}
        `}
        style={{ fontSize: "var(--app-input-font-size, 0.875rem)", textAlign: "left" }}
        disabled={disabled}
        placeholder={isFloating ? "" : placeholder}
        aria-label={effectiveFloatingLabel || placeholder || undefined}
      />

      {isFloating && (
        <label htmlFor={id || undefined} className="app-floating-label" style={{ fontSize: "var(--app-floating-label-font-size, 0.75rem)" }}>
          {effectiveFloatingLabel}
        </label>
      )}

      {multiSelect && showSelectionSummary && <div className="dark:text-gray-300 mt-1 text-gray-600 text-xs">{selectedOptions.length > 0 ? selectedOptions.map((option) => option.label).join(", ") : selectionSummaryEmptyLabel}</div>}

      {isOpen && menuPosition && portalTarget &&
        createPortal(
        <div
          ref={menuRef}
          className="app-dropdown-portal-menu app-menu-panel fixed shadow-lg max-h-60 overflow-y-auto bg-white dark:bg-gray-700 flex flex-col"
          style={{
            left: `${menuPosition.left}px`,
            top: menuPosition.top === undefined ? "auto" : `${menuPosition.top}px`,
            bottom: menuPosition.bottom === undefined ? "auto" : `${menuPosition.bottom}px`,
            width: "max-content",
            minWidth: `${menuPosition.minWidth}px`,
            maxWidth: `${menuPosition.maxWidth}px`,
            maxHeight: `${menuPosition.maxHeight}px`,
          }}
        >
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
                const isHelpOpen = helpKey === option.value;
                return (
                  <div key={option.value} className="d-flex align-items-center justify-content-between gap-1 w-100 position-relative px-1">
                    <button
                      type="button"
                      onClick={() => handleSelect(option)}
                      className={`
                      app-menu-item flex-grow-1 text-start focus:outline-none rounded
                      hover:bg-gray-100 dark:hover:bg-gray-600 focus:bg-gray-100 dark:focus:bg-gray-600
                      ${isSelected ? "bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-semibold" : "text-gray-900 dark:text-gray-200"}
                    `}
                      style={{ padding: "0.35rem 0.5rem" }}
                      aria-pressed={isSelected}
                    >
                      {option.label}
                    </button>

                    {option.description && (
                      <div className="flex-shrink-0 position-relative">
                        <button
                          type="button"
                          aria-label={`${option.label} help`}
                          className="align-items-center app-label--bold app-menu-action btn btn-sm d-flex justify-content-center text-muted"
                          style={{ width: "1.75rem", height: "1.75rem", lineHeight: 1, fontWeight: 700, fontSize: "0.75rem", border: "none", outline: "none" }}
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
                            className="app-menu-panel app-help-popover bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700 text-start"
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
            </div>
          )}

          <div className="border-gray-200 border-top dark:border-gray-600 p-0">
            <input
              ref={searchInputRef}
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  setIsOpen(false);
                }
              }}
              className="form-control form-control-sm border-0 rounded-0 shadow-none"
              placeholder={placeholder || "Search options..."}
              aria-label={`Search ${effectiveFloatingLabel || "options"}`}
            />
          </div>

          {(multiSelect || showActionFooter || showClearButton || allowMultiModeToggle || typeof onCreateFromSearch === "function") && (
            <div className="bg-gray-50 border-gray-200 border-top d-flex dark:bg-gray-800 dark:border-gray-600 gap-2 p-0">
              {typeof onCreateFromSearch === "function" && (
                <button
                  type="button"
                  onClick={() => {
                    if (!searchTerm.trim()) return;
                    setIsOpen(false);
                    onCreateFromSearch(searchTerm.trim());
                  }}
                  className="align-items-center app-menu-action btn btn-outline-secondary btn-sm d-flex flex-grow-1 justify-content-center"
                  title={createButtonTitle}
                  aria-label={createButtonTitle}
                  disabled={!searchTerm.trim()}
                >
                  <PlusIcon className="ui-icon-4" />
                </button>
              )}
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
        ,
        portalTarget
      )}
    </div>
  );
}
