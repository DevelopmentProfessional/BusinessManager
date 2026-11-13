/*
 * ============================================================
 * FILE: Dropup_ScheduleFilter.jsx
 *
 * PURPOSE:
 *   Dropup-based filter panel for the Schedule page that opens upward from
 *   the footer. Provides filter options for employees, clients, and services
 *   in a searchable dropup format similar to the item type selector.
 *
 *   Unlike the accordion modal, this opens upward from the bottom, keeping
 *   the interface accessible while the user selects filter values.
 *
 * FUNCTIONAL PARTS:
 *   [1] FilterDropup — reusable dropup component with search
 *   [2] State Management — local filter state synced with parent
 *   [3] Filter Handlers — toggle selection, search, apply, clear
 *   [4] JSX Render — three dropup sections for employees/clients/services
 *
 * CHANGE LOG:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-05-21 | Copilot | Created dropup filter based on item type pattern
 *   2026-07-24 | GitHub Copilot | Removed trigger caret icon to match global dropdown/dropup no-arrow behavior
 * ============================================================
 */

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { XMarkIcon, CheckIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import Button_Toolbar from "../buttons/Button_Toolbar";
import Footer_Actions from "../footers/Footer_Actions";
import Modal from "../modals/Modal";
import { sortItemsAlphabetically } from "../../../utils/displaySort";

// ─── FILTER DROPUP SUB-COMPONENT ────────────────────────────────────────────
function FilterDropup({ label, options, selectedIds, onToggle, onClear, placeholder = "Search..." }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [panelStyle, setPanelStyle] = useState({});
  const dropupRef = useRef(null);
  const panelRef = useRef(null);
  const triggerRef = useRef(null);
  const inputRef = useRef(null);

  // Close when clicking outside both trigger and portal panel
  useEffect(() => {
    const handleClickOutside = (event) => {
      const clickedTrigger = dropupRef.current && dropupRef.current.contains(event.target);
      const clickedPanel = panelRef.current && panelRef.current.contains(event.target);
      if (!clickedTrigger && !clickedPanel) {
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

  // Compute fixed position so the panel escapes overflow-clipped ancestors
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const panelWidth = Math.max(288, rect.width); // 18rem = 288px min
      const left = Math.min(rect.left, window.innerWidth - panelWidth - 8);
      const spaceAbove = rect.top;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpward = spaceAbove >= 240 || spaceAbove >= spaceBelow;

      if (openUpward) {
        setPanelStyle({
          position: "fixed",
          bottom: window.innerHeight - rect.top + 4,
          left: Math.max(8, left),
          width: panelWidth,
          maxWidth: "min(30rem, calc(100vw - 2rem))",
          maxHeight: `${Math.min(320, Math.max(160, spaceAbove - 24))}px`,
          zIndex: 9999,
        });
      } else {
        setPanelStyle({
          position: "fixed",
          top: rect.bottom + 4,
          left: Math.max(8, left),
          width: panelWidth,
          maxWidth: "min(30rem, calc(100vw - 2rem))",
          maxHeight: `${Math.min(320, Math.max(160, spaceBelow - 24))}px`,
          zIndex: 9999,
        });
      }
    }
  }, [isOpen]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm("");
    }
  }, [isOpen]);

  const filteredOptions = searchTerm
    ? options.filter((opt) => {
        const haystack = String(opt.searchText || opt.label || "").toLowerCase();
        return haystack.includes(searchTerm.toLowerCase());
      })
    : options;
  const sortedFilteredOptions = sortItemsAlphabetically(filteredOptions, ["label"]);

  const selectedCount = selectedIds.length;

  return (
    <div ref={dropupRef} className="app-dropup position-relative w-100">
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="align-items-center btn-unstyled d-flex gap-2 justify-content-between rounded-pill w-100"
        style={{
          height: "var(--app-input-height, 2rem)",
          minHeight: "var(--app-input-height, 2rem)",
          padding: "0 0.75rem",
          fontSize: "var(--app-btn-label-font-size, 0.875rem)",
          border: `1px solid ${selectedCount > 0 ? "var(--app-active-color, var(--bs-primary))" : "var(--bs-border-color)"}`,
          backgroundColor: selectedCount > 0 ? "var(--app-active-color, var(--bs-primary))" : "var(--bs-body-bg)",
          color: selectedCount > 0 ? "#fff" : "var(--bs-secondary-color)",
        }}
      >
        <span className="text-truncate">
          {label}
          {selectedCount > 0 && (
            <span className="badge bg-white ms-1 rounded-pill text-primary fw-semibold" style={{ fontSize: "0.65rem" }}>
              {selectedCount}
            </span>
          )}
        </span>
      </button>

      {/* Dropup Panel — rendered via portal so it escapes overflow-clipped modal */}
      {isOpen &&
        createPortal(
          <div
            ref={panelRef}
            className="app-menu-panel bg-white dark:bg-gray-800 shadow-lg d-flex flex-column"
            style={panelStyle}
          >
            {/* Search Input */}
            <div className="border-bottom border-gray-200 dark:border-gray-700 p-0">
              <div className="ui-pos-rel">
                <span className="position-absolute ps-0 start-0 text-muted top-50 translate-middle-y">
                  <MagnifyingGlassIcon className="ui-icon-4" />
                </span>
                <input ref={inputRef} type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder={placeholder} className="form-control form-control-sm ps-1" />
              </div>
              {selectedCount > 0 && (
                <button type="button" onClick={onClear} className="app-menu-action btn-unstyled mt-1 p-0 text-muted" style={{ textDecoration: "underline" }}>
                  Clear all ({selectedCount})
                </button>
              )}
            </div>

            {/* Options List */}
            <div className="overflow-y-auto flex-grow-1" style={{ minHeight: "100px", maxHeight: "220px" }}>
              {sortedFilteredOptions.length === 0 ? (
                <div className="app-menu-empty px-1 py-0 text-gray-500">No matches</div>
              ) : (
                sortedFilteredOptions.map((option) => {
                  const isSelected = selectedIds.some((id) => String(id) === String(option.id));
                  return (
                    <label key={option.id} className={`app-menu-item d-flex align-items-center gap-2 px-1 py-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${isSelected ? "bg-blue-50 dark:bg-blue-900/30 text-primary fw-semibold" : ""}`} style={{ cursor: "pointer", userSelect: "none" }}>
                      <input type="checkbox" checked={isSelected} onChange={() => onToggle(option.id)} className="form-check-input m-0 flex-shrink-0" />
                      <span className="flex-grow-1 text-truncate">{option.label}</span>
                    </label>
                  );
                })
              )}
            </div>

            {/* Close Button */}
            <div className="bg-gray-50 border-gray-200 border-top dark:bg-gray-900 dark:border-gray-700 p-0 flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="btn-unstyled rounded-pill w-100"
                style={{
                  height: "var(--app-input-height, 2rem)",
                  border: "1px solid var(--bs-border-color)",
                  backgroundColor: "var(--bs-body-bg)",
                  color: "var(--bs-secondary-color)",
                }}
              >
                Done
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────
export default function Dropup_ScheduleFilter({ isOpen, onClose, employees, clients, services, filters, onApply, onClear }) {
  const [localFilters, setLocalFilters] = useState({
    employeeIds: [],
    clientIds: [],
    serviceIds: [],
  });

  // Sync with parent when opened
  useEffect(() => {
    if (isOpen) {
      setLocalFilters({
        employeeIds: filters?.employeeIds || [],
        clientIds: filters?.clientIds || [],
        serviceIds: filters?.serviceIds || [],
      });
    }
  }, [isOpen, filters]);

  const toggleId = (key, id) => {
    setLocalFilters((prev) => {
      const current = prev[key] || [];
      const idStr = String(id);
      const exists = current.some((item) => String(item) === idStr);
      return {
        ...prev,
        [key]: exists ? current.filter((item) => String(item) !== idStr) : [...current, id],
      };
    });
  };

  const clearSection = (key) => {
    setLocalFilters((prev) => ({ ...prev, [key]: [] }));
  };

  const handleApply = () => {
    onApply(localFilters);
    onClose();
  };

  const handleClear = () => {
    onClear();
    setLocalFilters({ employeeIds: [], clientIds: [], serviceIds: [] });
  };

  // Prepare options for dropups
  const employeeOptions = sortItemsAlphabetically(
    employees.map((e) => ({
      id: e.id,
      label: `${e.first_name || ""} ${e.last_name || ""}`.trim() || e.username,
      searchText: [e.first_name, e.last_name, e.username, e.email, e.role].filter(Boolean).join(" "),
    })),
    ["label"]
  );

  const clientOptions = sortItemsAlphabetically(
    clients.map((c) => ({
      id: c.id,
      label: c.name,
      searchText: [c.name, c.email, c.phone].filter(Boolean).join(" "),
    })),
    ["label"]
  );

  const serviceOptions = sortItemsAlphabetically(
    services.map((s) => ({
      id: s.id,
      label: s.name,
      searchText: [s.name, s.category, s.description].filter(Boolean).join(" "),
    })),
    ["label"]
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Filter Schedule"
      footer={
        <Footer_Actions
          start={<Button_Toolbar icon={CheckIcon} label="Apply" onClick={handleApply} className="btn-outline-secondary" title="Apply filters" />}
          center={<Button_Toolbar icon={XMarkIcon} label="Cancel" onClick={onClose} className="btn-outline-secondary" title="Cancel" />}
          end={<Button_Toolbar icon={XMarkIcon} label="Clear" onClick={handleClear} className="btn-outline-secondary" title="Clear all filters" />}
        />
      }
    >
      <div className="d-flex flex-column gap-3 p-0">
        {/* Employees Dropup */}
        <FilterDropup label="Employees" options={employeeOptions} selectedIds={localFilters.employeeIds} onToggle={(id) => toggleId("employeeIds", id)} onClear={() => clearSection("employeeIds")} placeholder="Search employees..." />

        {/* Clients Dropup */}
        <FilterDropup label="Clients" options={clientOptions} selectedIds={localFilters.clientIds} onToggle={(id) => toggleId("clientIds", id)} onClear={() => clearSection("clientIds")} placeholder="Search clients..." />

        {/* Services Dropup */}
        <FilterDropup label="Services" options={serviceOptions} selectedIds={localFilters.serviceIds} onToggle={(id) => toggleId("serviceIds", id)} onClear={() => clearSection("serviceIds")} placeholder="Search services..." />

        {/* Info text */}
        <div className="mt-2 small text-muted">Click a filter to open the selection panel. Use search to find specific items.</div>
      </div>
    </Modal>
  );
}
