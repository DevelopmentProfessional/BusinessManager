/*
 * ============================================================
 * FILE: FilterDropup_Schedule.jsx
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
 * ============================================================
 */

import React, { useState, useRef, useEffect } from "react";
import { XMarkIcon, CheckIcon, TrashIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import Button_Toolbar from "./Button_Toolbar";
import Footer_Actions from "./Footer_Actions";
import Modal from "./Modal";

// ─── FILTER DROPUP SUB-COMPONENT ────────────────────────────────────────────
function FilterDropup({ label, options, selectedIds, onToggle, onClear, placeholder = "Search..." }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropupRef = useRef(null);
  const inputRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropupRef.current && !dropupRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const filteredOptions = searchTerm
    ? options.filter((opt) => opt.label.toLowerCase().includes(searchTerm.toLowerCase()))
    : options;

  const selectedCount = selectedIds.length;

  return (
    <div ref={dropupRef} className="position-relative">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`btn btn-sm d-flex align-items-center justify-content-between gap-2 w-100 ${
          selectedCount > 0 ? "btn-primary" : "btn-outline-secondary"
        }`}
        style={{ fontSize: "var(--app-btn-label-font-size, 0.875rem)" }}
      >
        <span className="text-truncate">
          {label}
          {selectedCount > 0 && (
            <span className="badge bg-white text-primary rounded-pill ms-1" style={{ fontSize: "0.65rem" }}>
              {selectedCount}
            </span>
          )}
        </span>
        <span>{isOpen ? "▲" : "▼"}</span>
      </button>

      {/* Dropup Panel */}
      {isOpen && (
        <div
          className="position-absolute bottom-100 start-0 w-100 mb-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg"
          style={{ zIndex: 1000, maxHeight: "300px" }}
        >
          {/* Search Input */}
          <div className="p-2 border-bottom border-gray-200 dark:border-gray-700">
            <div className="position-relative">
              <span className="position-absolute top-50 start-0 translate-middle-y ps-2 text-muted">
                <MagnifyingGlassIcon className="h-4 w-4" />
              </span>
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={placeholder}
                className="form-control form-control-sm ps-5"
              />
            </div>
            {selectedCount > 0 && (
              <button
                type="button"
                onClick={onClear}
                className="btn btn-link btn-sm p-0 text-muted mt-1"
                style={{ fontSize: "0.75rem" }}
              >
                Clear all ({selectedCount})
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="overflow-y-auto" style={{ maxHeight: "200px" }}>
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">No matches</div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = selectedIds.includes(option.id);
                return (
                  <label
                    key={option.id}
                    className={`d-flex align-items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      isSelected ? "bg-blue-50 dark:bg-blue-900/30" : ""
                    }`}
                    style={{ cursor: "pointer" }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggle(option.id)}
                      className="form-check-input"
                    />
                    <span style={{ fontSize: "0.875rem" }}>{option.label}</span>
                  </label>
                );
              })
            )}
          </div>

          {/* Close Button */}
          <div className="p-2 border-top border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="btn btn-sm btn-outline-secondary w-100"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────
export default function FilterDropup_Schedule({
  isOpen,
  onClose,
  employees,
  clients,
  services,
  filters,
  onApply,
  onClear,
}) {
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
      const exists = current.includes(id);
      return {
        ...prev,
        [key]: exists ? current.filter((item) => item !== id) : [...current, id],
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
  const employeeOptions = employees.map((e) => ({
    id: e.id,
    label: `${e.first_name || ""} ${e.last_name || ""}`.trim() || e.username,
  }));

  const clientOptions = clients.map((c) => ({
    id: c.id,
    label: c.name,
  }));

  const serviceOptions = services.map((s) => ({
    id: s.id,
    label: s.name,
  }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Filter Schedule"
      footer={
        <Footer_Actions
          start={<Button_Toolbar icon={CheckIcon} label="Apply" onClick={handleApply} className="btn-outline-secondary" title="Apply filters" />}
          center={<Button_Toolbar icon={XMarkIcon} label="Cancel" onClick={onClose} className="btn-outline-secondary" title="Cancel" />}
          end={<Button_Toolbar icon={TrashIcon} label="Clear" onClick={handleClear} className="btn-outline-secondary" title="Clear all filters" />}
        />
      }
    >
      <div className="d-flex flex-column gap-3 p-2">
        {/* Employees Dropup */}
        <FilterDropup
          label="Employees"
          options={employeeOptions}
          selectedIds={localFilters.employeeIds}
          onToggle={(id) => toggleId("employeeIds", id)}
          onClear={() => clearSection("employeeIds")}
          placeholder="Search employees..."
        />

        {/* Clients Dropup */}
        <FilterDropup
          label="Clients"
          options={clientOptions}
          selectedIds={localFilters.clientIds}
          onToggle={(id) => toggleId("clientIds", id)}
          onClear={() => clearSection("clientIds")}
          placeholder="Search clients..."
        />

        {/* Services Dropup */}
        <FilterDropup
          label="Services"
          options={serviceOptions}
          selectedIds={localFilters.serviceIds}
          onToggle={(id) => toggleId("serviceIds", id)}
          onClear={() => clearSection("serviceIds")}
          placeholder="Search services..."
        />

        {/* Info text */}
        <div className="text-muted small mt-2">
          Click a filter to open the selection panel. Use search to find specific items.
        </div>
      </div>
    </Modal>
  );
}
