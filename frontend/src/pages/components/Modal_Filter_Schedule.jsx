/*
 * ============================================================
 * FILE: Modal_Filter_Schedule.jsx
 *
 * PURPOSE:
 *   Modal panel for filtering the Schedule page calendar view.
 *   Allows users to narrow displayed appointments by employee, client,
 *   service, date range, and out-of-office status using accordion sections.
 *
 * FUNCTIONAL PARTS:
 *   [1] Constants — EMPTY_FILTERS default shape
 *   [2] AccordionSection Sub-component — collapsible filter group with clear button
 *   [3] State & Effects — local filter state synced from parent filters prop
 *   [4] Filter Handlers — toggle ID selection, date change, apply, clear
 *   [5] JSX Render — accordion sections for employees/clients/services, date range, OOO toggle
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-03-01 | Claude  | Added section comments and top-level documentation
 *   2026-03-07 | Claude  | Added section-level help popovers for Employees/Clients/Services filters
 * ============================================================
 */

import React, { useEffect, useState } from 'react';
import { XMarkIcon, CheckIcon, TrashIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import Button_Toolbar from './Button_Toolbar';
import Modal from './Modal';

// ─── 1 CONSTANTS ─────────────────────────────────────────────────────────
const EMPTY_FILTERS = {
  employeeIds: [],
  clientIds: [],
  serviceIds: [],
  startDate: '',
  endDate: '',
  showOutOfOffice: false,
  oooEmployeeIds: [],
};

// ─── 2 ACCORDIONSECTION SUB-COMPONENT ────────────────────────────────────
function AccordionSection({ label, count, isOpen, onToggle, onClear, children, helpText, helpKey, showHelp, setShowHelp }) {
  const isHelpOpen = showHelp === helpKey;
  
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded">
      <div
        className="d-flex align-items-center justify-content-between px-3 py-2"
        onClick={onToggle}
        style={{ cursor: 'pointer', userSelect: 'none' }}
      >
        <div className="d-flex align-items-center gap-2">
          <span className="fw-semibold" style={{ fontSize: '0.875rem' }}>{label}</span>
          {count > 0 && (
            <span className="badge bg-primary rounded-pill" style={{ fontSize: '0.65rem' }}>{count}</span>
          )}
          {helpText && (
            <div className="position-relative flex-shrink-0">
              <button
                type="button"
                className="btn btn-link btn-sm p-0 text-primary border-0"
                aria-label={`${label} help`}
                onMouseEnter={() => setShowHelp(helpKey)}
                onMouseLeave={() => setShowHelp(prev => prev === helpKey ? null : prev)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowHelp(prev => prev === helpKey ? null : helpKey);
                }}
                onClick={(e) => e.stopPropagation()}
                style={{ width: '1.5rem', height: '1.5rem', lineHeight: 1, fontWeight: 600, fontSize: '0.8rem', border: 'none', outline: 'none' }}
              >?</button>
              {isHelpOpen && (
                <div
                  className="position-absolute start-50 bottom-100 mb-2 p-2 rounded-lg shadow-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700"
                  style={{ width: '260px', maxWidth: 'calc(100vw - 1rem)', transform: 'translateX(-55%)', zIndex: 1050 }}
                  onMouseEnter={() => setShowHelp(helpKey)}
                  onMouseLeave={() => setShowHelp(prev => prev === helpKey ? null : prev)}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="fw-semibold mb-1">{label}</div>
                  <div className="small">{helpText}</div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="d-flex align-items-center gap-2">
          {count > 0 && (
            <button
              type="button"
              className="btn btn-link btn-sm p-0 text-muted"
              onClick={(e) => { e.stopPropagation(); onClear(); }}
              style={{ fontSize: '0.75rem', textDecoration: 'none' }}
              title={`Clear ${label}`}
            >
              Clear
            </button>
          )}
          <ChevronDownIcon
            style={{
              width: 16,
              height: 16,
              transition: 'transform 0.2s',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
            className="text-gray-500"
          />
        </div>
      </div>
      {isOpen && (
        <div className="px-3 pb-2 pt-1 d-flex flex-column gap-1 border-top border-gray-100 dark:border-gray-700">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── 3 STATE & EFFECTS ───────────────────────────────────────────────────
export default function Modal_Filter_Schedule({
  isOpen,
  onClose,
  employees,
  clients,
  services,
  filters,
  onApply,
  onClear,
  approvedLeaves,
}) {
  const [localFilters, setLocalFilters] = useState(EMPTY_FILTERS);
  const [openSections, setOpenSections] = useState({ employees: true, clients: false, services: false });
  const [showHelp, setShowHelp] = useState(null);

  useEffect(() => {
    setLocalFilters(filters || EMPTY_FILTERS);
  }, [filters, isOpen]);

  // ─── 4 FILTER HANDLERS ───────────────────────────────────────────────────
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

  const handleDateChange = (key, value) => {
    setLocalFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleApply = () => {
    onApply(localFilters);
    onClose();
  };

  const handleClear = () => {
    onClear();
    setLocalFilters(EMPTY_FILTERS);
    onClose();
  };

  const toggleSection = (key) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const clearSection = (key) => {
    setLocalFilters((prev) => ({ ...prev, [key]: [] }));
  };

  // ─── 5 JSX RENDER ────────────────────────────────────────────────────────
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Filter Schedule"
      footer={
        <div className="d-flex align-items-center pb-2">
          <div style={{ width: 40 }}>
            <Button_Toolbar
              icon={TrashIcon}
              label="Clear all filters"
              onClick={handleClear}
              className="btn-outline-danger"
            />
          </div>
          <div className="flex-grow-1 d-flex gap-3 justify-content-center align-items-center">
            <Button_Toolbar
              icon={XMarkIcon}
              label="Cancel"
              onClick={onClose}
              className="btn-outline-secondary"
            />
            <Button_Toolbar
              icon={CheckIcon}
              label="Apply"
              onClick={handleApply}
              className="btn-primary"
            />
          </div>
          <div style={{ width: 40 }} />
        </div>
      }
    >
      <div className="d-flex flex-column gap-2">

        {/* Employees accordion */}
        <AccordionSection
          label="Employees"
          count={localFilters.employeeIds.length}
          isOpen={openSections.employees}
          onToggle={() => toggleSection('employees')}
          onClear={() => clearSection('employeeIds')}
          helpText="Show only appointments for selected employees. Use this to focus on specific team members' schedules."
          helpKey="employees"
          showHelp={showHelp}
          setShowHelp={setShowHelp}
        >
          {employees.map((employee) => (
            <label key={employee.id} className="d-flex align-items-center gap-2 mb-0">
              <input
                type="checkbox"
                checked={localFilters.employeeIds.includes(employee.id)}
                onChange={() => toggleId('employeeIds', employee.id)}
              />
              <span
                className="rounded-circle flex-shrink-0"
                style={{ width: '10px', height: '10px', backgroundColor: employee.color || '#6b7280', display: 'inline-block' }}
              />
              <span style={{ fontSize: '0.875rem' }}>{employee.first_name} {employee.last_name}</span>
            </label>
          ))}
          {employees.length === 0 && <div className="text-muted small">No employees loaded.</div>}
        </AccordionSection>

        {/* Clients accordion */}
        <AccordionSection
          label="Clients"
          count={localFilters.clientIds.length}
          isOpen={openSections.clients}
          onToggle={() => toggleSection('clients')}
          onClear={() => clearSection('clientIds')}
          helpText="Show only appointments for selected clients. Useful for tracking specific client interactions and bookings."
          helpKey="clients"
          showHelp={showHelp}
          setShowHelp={setShowHelp}
        >
          {clients.map((client) => (
            <label key={client.id} className="d-flex align-items-center gap-2 mb-0">
              <input
                type="checkbox"
                checked={localFilters.clientIds.includes(client.id)}
                onChange={() => toggleId('clientIds', client.id)}
              />
              <span style={{ fontSize: '0.875rem' }}>{client.name}</span>
            </label>
          ))}
          {clients.length === 0 && <div className="text-muted small">No clients loaded.</div>}
        </AccordionSection>

        {/* Services accordion */}
        <AccordionSection
          label="Services"
          count={localFilters.serviceIds.length}
          isOpen={openSections.services}
          onToggle={() => toggleSection('services')}
          onClear={() => clearSection('serviceIds')}
          helpText="Show only appointments for selected services. Filter by service type to analyze booking patterns or capacity."
          helpKey="services"
          showHelp={showHelp}
          setShowHelp={setShowHelp}
        >
          {services.map((service) => (
            <label key={service.id} className="d-flex align-items-center gap-2 mb-0">
              <input
                type="checkbox"
                checked={localFilters.serviceIds.includes(service.id)}
                onChange={() => toggleId('serviceIds', service.id)}
              />
              <span style={{ fontSize: '0.875rem' }}>{service.name}</span>
            </label>
          ))}
          {services.length === 0 && <div className="text-muted small">No services loaded.</div>}
        </AccordionSection>

        {/* Date Range - bottom */}
        <div className="px-1 pt-1">
          <div className="fw-semibold mb-1" style={{ fontSize: '0.875rem' }}>Date Range</div>
          <div className="d-flex gap-2">
            <input
              type="date"
              className="form-control form-control-sm"
              value={localFilters.startDate || ''}
              onChange={(e) => handleDateChange('startDate', e.target.value)}
            />
            <input
              type="date"
              className="form-control form-control-sm"
              value={localFilters.endDate || ''}
              onChange={(e) => handleDateChange('endDate', e.target.value)}
            />
          </div>
        </div>

        {/* Out of Office toggle - bottom */}
        <div className="px-1 d-flex align-items-center justify-content-between py-1">
          <span className="fw-semibold" style={{ fontSize: '0.875rem' }}>Out of Office</span>
          <div className="form-check form-switch mb-0">
            <input
              className="form-check-input"
              type="checkbox"
              id="oooToggle"
              checked={localFilters.showOutOfOffice || false}
              onChange={(e) =>
                setLocalFilters((prev) => ({
                  ...prev,
                  showOutOfOffice: e.target.checked,
                  oooEmployeeIds: [],
                }))
              }
            />
          </div>
        </div>

      </div>
    </Modal>
  );
}
