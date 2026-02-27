import React, { useEffect, useState } from 'react';
import { XMarkIcon, CheckIcon, TrashIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import Button_Toolbar from './Button_Toolbar';
import Modal from './Modal';

const EMPTY_FILTERS = {
  employeeIds: [],
  clientIds: [],
  serviceIds: [],
  startDate: '',
  endDate: '',
  showOutOfOffice: false,
  oooEmployeeIds: [],
};

function AccordionSection({ label, count, isOpen, onToggle, onClear, children }) {
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

  useEffect(() => {
    setLocalFilters(filters || EMPTY_FILTERS);
  }, [filters, isOpen]);

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
