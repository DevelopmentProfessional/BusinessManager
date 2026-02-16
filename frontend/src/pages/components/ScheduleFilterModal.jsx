import React, { useEffect, useState } from 'react';
import Modal from './Modal';

const EMPTY_FILTERS = {
  employeeIds: [],
  clientIds: [],
  serviceIds: [],
  startDate: '',
  endDate: '',
};

export default function ScheduleFilterModal({
  isOpen,
  onClose,
  employees,
  clients,
  services,
  filters,
  onApply,
  onClear,
}) {
  const [localFilters, setLocalFilters] = useState(EMPTY_FILTERS);

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
    setLocalFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Filter Schedule"
      footer={
        <div className="d-flex justify-content-end gap-2">
          <button type="button" className="btn btn-outline-secondary" onClick={handleClear}>
            Clear
          </button>
          <button type="button" className="btn btn-primary" onClick={handleApply}>
            Apply
          </button>
        </div>
      }
    >
      <div className="d-flex flex-column gap-3">
        <div>
          <div className="fw-semibold mb-1">Date Range</div>
          <div className="d-flex gap-2">
            <input
              type="date"
              className="form-control"
              value={localFilters.startDate || ''}
              onChange={(e) => handleDateChange('startDate', e.target.value)}
            />
            <input
              type="date"
              className="form-control"
              value={localFilters.endDate || ''}
              onChange={(e) => handleDateChange('endDate', e.target.value)}
            />
          </div>
        </div>

        <div>
          <div className="fw-semibold mb-1">Employees</div>
          <div className="d-flex flex-column gap-1" style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {employees.map((employee) => (
              <label key={employee.id} className="d-flex align-items-center gap-2">
                <input
                  type="checkbox"
                  checked={localFilters.employeeIds.includes(employee.id)}
                  onChange={() => toggleId('employeeIds', employee.id)}
                />
                <span
                  className="rounded-circle"
                  style={{
                    width: '10px',
                    height: '10px',
                    backgroundColor: employee.color || '#6b7280',
                    display: 'inline-block',
                  }}
                />
                <span>{employee.first_name} {employee.last_name}</span>
              </label>
            ))}
            {employees.length === 0 && <div className="text-muted">No employees loaded.</div>}
          </div>
        </div>

        <div>
          <div className="fw-semibold mb-1">Clients</div>
          <div className="d-flex flex-column gap-1" style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {clients.map((client) => (
              <label key={client.id} className="d-flex align-items-center gap-2">
                <input
                  type="checkbox"
                  checked={localFilters.clientIds.includes(client.id)}
                  onChange={() => toggleId('clientIds', client.id)}
                />
                <span>{client.name}</span>
              </label>
            ))}
            {clients.length === 0 && <div className="text-muted">No clients loaded.</div>}
          </div>
        </div>

        <div>
          <div className="fw-semibold mb-1">Services</div>
          <div className="d-flex flex-column gap-1" style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {services.map((service) => (
              <label key={service.id} className="d-flex align-items-center gap-2">
                <input
                  type="checkbox"
                  checked={localFilters.serviceIds.includes(service.id)}
                  onChange={() => toggleId('serviceIds', service.id)}
                />
                <span>{service.name}</span>
              </label>
            ))}
            {services.length === 0 && <div className="text-muted">No services loaded.</div>}
          </div>
        </div>
      </div>
    </Modal>
  );
}
