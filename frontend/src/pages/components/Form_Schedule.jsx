import React, { useState, useEffect } from 'react';
import useStore from '../../services/useStore';
import { isudAPI } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { XMarkIcon, CheckIcon, TrashIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
import Button_Toolbar from './Button_Toolbar';
import Gate_Permission from './Gate_Permission';
import Dropdown_Custom from './Dropdown_Custom';

const APPOINTMENT_TYPES = [
  { value: 'one_time', label: 'Appointment', description: 'Client appointment with service' },
  { value: 'series', label: 'Recurring', description: 'Recurring appointment series' },
  { value: 'meeting', label: 'Meeting', description: 'Internal meeting (employees only)' },
  { value: 'task', label: 'Task', description: 'Personal task or reminder' }
];

// Define which fields are needed for each appointment type
const APPOINTMENT_TYPE_CONFIG = {
  one_time: { needsClient: true, needsService: true, needsEmployee: true, clientMultiple: true, employeeMultiple: true },
  series: { needsClient: true, needsService: true, needsEmployee: true, clientMultiple: true, employeeMultiple: true },
  meeting: { needsClient: false, needsService: false, needsEmployee: true, clientMultiple: false, employeeMultiple: true },
  task: { needsClient: false, needsService: false, needsEmployee: true, clientMultiple: false, employeeMultiple: false }
};

const RECURRENCE_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-Weekly' },
  { value: 'monthly', label: 'Monthly' }
];

const ATTENDEE_STATUS_STYLE = {
  pending:  { label: 'Pending',  bg: '#fef3c7', color: '#92400e' },
  accepted: { label: 'Accepted', bg: '#d1fae5', color: '#065f46' },
  declined: { label: 'Declined', bg: '#fee2e2', color: '#991b1b' },
};

export default function Form_Schedule({ appointment, onSubmit, onCancel, onDelete, onSendReminder, clients: clientsProp, services: servicesProp, employees: employeesProp, attendees = [] }) {
  const { closeModal, hasPermission, user, openAddClientModal } = useStore();
  const [clients, setClients] = useState(clientsProp || []);
  const [services, setServices] = useState(servicesProp || []);
  const [employees, setEmployees] = useState(employeesProp || []);
  const [timeError, setTimeError] = useState('');
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientsLoaded, setClientsLoaded] = useState(false);
  const [durationError, setDurationError] = useState('');
  const navigate = useNavigate();

  // Load services and employees if not provided as props (clients loaded on-demand)
  useEffect(() => {
    // Use props if provided
    if (servicesProp && servicesProp.length > 0) {
      setServices(servicesProp);
    }
    if (employeesProp && employeesProp.length > 0) {
      setEmployees(employeesProp);
    }
    if (clientsProp && clientsProp.length > 0) {
      setClients(clientsProp);
      setClientsLoaded(true);
    }
    
    // Only fetch services and employees if props are not provided
    const needsServices = !servicesProp || servicesProp.length === 0;
    const needsEmployees = !employeesProp || employeesProp.length === 0;
    
    if (needsServices || needsEmployees) {
      let cancelled = false;
      const load = async () => {
        try {
          const promises = [];
          if (needsServices) promises.push(isudAPI.services.getAll());
          if (needsEmployees) promises.push(isudAPI.schedule.getAvailableEmployees());
          
          const results = await Promise.all(promises);
          if (cancelled) return;
          
          let resultIndex = 0;
          if (needsServices) {
            const servicesData = results[resultIndex]?.data ?? results[resultIndex];
            if (Array.isArray(servicesData)) setServices(servicesData);
            resultIndex++;
          }
          if (needsEmployees) {
            const employeesRaw = results[resultIndex]?.data ?? results[resultIndex];
            if (Array.isArray(employeesRaw)) {
              const transformed = employeesRaw.map(emp => ({
                id: emp.id,
                first_name: emp.first_name ?? emp.firstName ?? '',
                last_name: emp.last_name ?? emp.lastName ?? '',
                role: emp.role ?? '',
              }));
              setEmployees(transformed);
            }
          }
        } catch (err) {
          if (!cancelled) console.error('Form_Schedule failed to load services/employees', err);
        }
      };
      load();
      return () => { cancelled = true; };
    }
  }, [servicesProp, employeesProp, clientsProp]);

  // Load clients on-demand when dropdown opens
  const handleClientDropdownOpen = async () => {
    // Skip if already loaded or loading
    if (clientsLoaded || clientsLoading || (clients && clients.length > 0)) return;
    
    setClientsLoading(true);
    try {
      const response = await isudAPI.clients.getAll();
      const clientsData = response?.data ?? response;
      if (Array.isArray(clientsData)) {
        setClients(clientsData);
        setClientsLoaded(true);
      }
    } catch (err) {
      console.error('Failed to load clients:', err);
    } finally {
      setClientsLoading(false);
    }
  };
  
  // Extract local YYYY-MM-DD and HH:mm from a Date or ISO string reliably (no timezone shifts)
  const extractLocalParts = (value) => {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return { date: '', time: '' };
    const pad = (n) => String(n).padStart(2, '0');
    return {
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    };
  };
  
  const getInitialFormData = () => {
    if (appointment && appointment.appointment_date) {
      const { date, time } = extractLocalParts(appointment.appointment_date);
      const [hour, minute] = time.split(':');
      const recEndDate = appointment.recurrence_end_date
        ? extractLocalParts(appointment.recurrence_end_date).date
        : '';
      return {
        client_ids: appointment.client_id ? [appointment.client_id] : [],
        service_id: appointment.service_id || '',
        employee_ids: appointment.employee_id ? [appointment.employee_id] : [],
        appointment_date: date,
        appointment_hour: hour,
        appointment_minute: minute,
        notes: appointment.notes || '',
        appointment_type: appointment.appointment_type || 'one_time',
        recurrence_frequency: appointment.recurrence_frequency || '',
        recurrence_end_type: appointment.recurrence_count ? 'count' : 'date',
        recurrence_end_date: recEndDate,
        recurrence_count: appointment.recurrence_count || '',
        duration_minutes: appointment.duration_minutes || ''
      };
    }
    return {
      client_ids: [],
      service_id: '',
      employee_ids: [],
      appointment_date: '',
      appointment_hour: '',
      appointment_minute: '',
      notes: '',
      appointment_type: 'one_time',
      recurrence_frequency: '',
      recurrence_end_type: 'date',
      recurrence_end_date: '',
      recurrence_count: '',
      duration_minutes: ''
    };
  };

  const [formData, setFormData] = useState(getInitialFormData);
  // Track whether duration was manually changed (independent of service)
  const [durationManuallySet, setDurationManuallySet] = useState(false);

  useEffect(() => {
    setFormData(getInitialFormData());
  }, [appointment]);

  // Auto-select current user if they can only schedule for themselves
  const isWriteAll = hasPermission('schedule', 'write_all') || hasPermission('schedule', 'admin');
  const isWriteOnly = hasPermission('schedule', 'write') && !isWriteAll;

  useEffect(() => {
    if (user && isWriteOnly) {
      // Lock employee selection to current user when write-only
      const self = employees.find(e => e.id === user.id || `${e.first_name} ${e.last_name}`.trim().toLowerCase() === `${user.first_name} ${user.last_name}`.trim().toLowerCase());
      if (self && (!Array.isArray(formData.employee_ids) || formData.employee_ids[0] !== self.id)) {
        setFormData(prev => ({ ...prev, employee_ids: [self.id] }));
      }
    } else if ((!Array.isArray(formData.employee_ids) || formData.employee_ids.length === 0) && employees.length === 1) {
      setFormData(prev => ({ ...prev, employee_ids: [employees[0].id] }));
    }
  }, [employees, formData.employee_ids, isWriteOnly, user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (name === 'duration_minutes') {
      setDurationError('');
    }
  };

  const handleServiceChange = (e) => {
    const { value } = e.target;
    const selectedService = services.find(s => s.id === value);
    setFormData(prev => ({
      ...prev,
      service_id: value,
      duration_minutes: selectedService?.duration_minutes ? selectedService.duration_minutes : prev.duration_minutes
    }));
    setDurationManuallySet(false);
    if (selectedService?.duration_minutes) {
      setDurationError('');
    }
  };

  const handleDurationChange = (e) => {
    const { value } = e.target;
    setFormData(prev => ({
      ...prev,
      duration_minutes: value
    }));
    setDurationManuallySet(true);
    setDurationError('');
  };

  const handleClientChange = (e) => {
    const next = Array.isArray(e.target.value)
      ? e.target.value
      : e.target.value ? [e.target.value] : [];
    setFormData(prev => ({
      ...prev,
      client_ids: next
    }));
  };

  const handleEmployeeChange = (e) => {
    const next = Array.isArray(e.target.value)
      ? e.target.value
      : e.target.value ? [e.target.value] : [];
    setFormData(prev => ({
      ...prev,
      employee_ids: next
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const dateText = formData.appointment_date;
    const hourText = formData.appointment_hour;
    const minuteText = formData.appointment_minute;

    if (!dateText || !hourText || !minuteText) {
      setTimeError('Please select a valid date, hour, and minute');
      return;
    }

    const hour = parseInt(hourText, 10);
    const minute = parseInt(minuteText, 10);
    
    if (hour < 6 || hour > 21) {
      setTimeError('Can only schedule between 6:00 and 21:00');
      return;
    }
    setTimeError('');

    if (!formData.duration_minutes) {
      setDurationError('Please set a duration for this event');
      return;
    }

    // Submit a naive local ISO string (no timezone) to avoid shifts server-side
    const timeText = `${hourText}:${minuteText}`;
    const appointmentDateStr = `${dateText}T${timeText}:00`;

    // Get config for current type to determine required fields
    const config = APPOINTMENT_TYPE_CONFIG[formData.appointment_type] || APPOINTMENT_TYPE_CONFIG.one_time;

    const employeeIds = Array.isArray(formData.employee_ids) ? formData.employee_ids.filter(Boolean) : [];
    const clientIds = Array.isArray(formData.client_ids) ? formData.client_ids.filter(Boolean) : [];

    const isSeries = formData.appointment_type === 'series';
    const submitData = {
      employee_id: employeeIds[0] || '',
      employee_ids: employeeIds,
      appointment_date: appointmentDateStr,
      notes: formData.notes,
      appointment_type: formData.appointment_type,
      recurrence_frequency: isSeries ? formData.recurrence_frequency : null,
      recurrence_end_date: (isSeries && formData.recurrence_end_type === 'date' && formData.recurrence_end_date)
        ? `${formData.recurrence_end_date}T23:59:00`
        : null,
      recurrence_count: (isSeries && formData.recurrence_end_type === 'count' && formData.recurrence_count)
        ? parseInt(formData.recurrence_count)
        : null,
      is_recurring_master: isSeries,
      duration_minutes: parseInt(formData.duration_minutes)
    };

    // Only include client_id and service_id if needed for this type
    if (config.needsClient && clientIds.length > 0) {
      submitData.client_id = clientIds[0];
      submitData.client_ids = clientIds;
    }
    if (config.needsService && formData.service_id) {
      submitData.service_id = formData.service_id;
    }

    onSubmit(submitData);
  };

  // Get config for current appointment type
  const typeConfig = APPOINTMENT_TYPE_CONFIG[formData.appointment_type] || APPOINTMENT_TYPE_CONFIG.one_time;

  const formTitle = appointment
    ? (formData.appointment_type === 'meeting' ? 'Edit Meeting'
      : formData.appointment_type === 'task' ? 'Edit Task'
      : 'Edit Appointment')
    : (formData.appointment_type === 'meeting' ? 'New Meeting'
      : formData.appointment_type === 'task' ? 'New Task'
      : 'New Appointment');

  return (
    <div className="d-flex flex-column bg-white dark:bg-gray-900" style={{ height: '100%' }}>

      {/* Header */}
      <div className="flex-shrink-0 p-2 border-bottom border-gray-200 dark:border-gray-700 d-flex align-items-center bg-white dark:bg-gray-900">
        <h6 className="mb-0 fw-semibold text-gray-900 dark:text-gray-100">{formTitle}</h6>
      </div>

      {/* Scrollable body */}
      <div className="flex-grow-1 overflow-auto no-scrollbar px-3 pt-3 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <form id="schedule-form" onSubmit={handleSubmit} className="d-flex flex-column gap-2">

          {/* Appointment Type */}
          <Dropdown_Custom
            name="appointment_type"
            value={formData.appointment_type}
            onChange={handleChange}
            options={APPOINTMENT_TYPES.map((type) => ({
              value: type.value,
              label: type.label
            }))}
            placeholder="Select event type"
            required
            label="Event Type"
          />

          {/* Meeting Title */}
          {formData.appointment_type === 'meeting' && (
            <div className="form-floating">
              <input
                type="text"
                id="meeting_title"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Meeting Title"
                className="form-control form-control-sm"
                required
              />
              <label htmlFor="meeting_title">Meeting Title</label>
            </div>
          )}

          {/* Task Description */}
          {formData.appointment_type === 'task' && (
            <div className="form-floating">
              <input
                type="text"
                id="task_description"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Task Description"
                className="form-control form-control-sm"
                required
              />
              <label htmlFor="task_description">Task Description</label>
            </div>
          )}

          {/* Client Selection */}
          {typeConfig.needsClient && (
            <Dropdown_Custom
              name="client_id"
              value={typeConfig.clientMultiple ? formData.client_ids : (formData.client_ids[0] || '')}
              onChange={handleClientChange}
              options={clients.map((client) => ({
                value: client.id,
                label: client.name
              }))}
              placeholder={typeConfig.clientMultiple ? 'Select clients' : 'Select a client'}
              required
              searchable={true}
              onOpen={handleClientDropdownOpen}
              loading={clientsLoading}
              multiSelect={typeConfig.clientMultiple}
            />
          )}

          {/* Service Selection */}
          {typeConfig.needsService && (
            <Dropdown_Custom
              name="service_id"
              value={formData.service_id}
              onChange={handleServiceChange}
              options={services.map((service) => ({
                value: service.id,
                label: `${service.name} - $${service.price}`
              }))}
              placeholder="Select a service"
              required
              searchable={true}
            />
          )}

          {/* Employee Selection */}
          {typeConfig.needsEmployee && (
            <div>
              <Dropdown_Custom
                name="employee_id"
                value={typeConfig.employeeMultiple ? formData.employee_ids : (formData.employee_ids[0] || '')}
                onChange={handleEmployeeChange}
                options={((isWriteOnly && user)
                  ? employees.filter(e => e.id === user.id || `${e.first_name} ${e.last_name}`.trim().toLowerCase() === `${user.first_name} ${user.last_name}`.trim().toLowerCase())
                  : employees
                ).map((employee) => ({
                  value: employee.id,
                  label: `${employee.first_name} ${employee.last_name}${employee.role ? ` - ${employee.role}` : ''}`
                }))}
                placeholder={
                  formData.appointment_type === 'meeting' ? 'Select attendees'
                  : formData.appointment_type === 'task' ? 'Assign to'
                  : typeConfig.employeeMultiple ? 'Select employees' : 'Select employee'
                }
                required
                searchable={true}
                disabled={isWriteOnly}
                multiSelect={typeConfig.employeeMultiple}
              />
              {(isWriteOnly || employees.length === 1) && (
                <p className="text-xs text-gray-500 mt-1">You can only schedule for yourself</p>
              )}
            </div>
          )}

          {/* Recurrence */}
          {formData.appointment_type === 'series' && (
            <>
              <Dropdown_Custom
                name="recurrence_frequency"
                value={formData.recurrence_frequency}
                onChange={handleChange}
                options={RECURRENCE_OPTIONS}
                placeholder="Select frequency"
                required
                label="Recurrence"
              />

              {/* End type toggle */}
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className={`btn btn-sm flex-1 ${formData.recurrence_end_type === 'date' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setFormData(prev => ({ ...prev, recurrence_end_type: 'date', recurrence_count: '' }))}
                >
                  End by date
                </button>
                <button
                  type="button"
                  className={`btn btn-sm flex-1 ${formData.recurrence_end_type === 'count' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setFormData(prev => ({ ...prev, recurrence_end_type: 'count', recurrence_end_date: '' }))}
                >
                  End after N times
                </button>
              </div>

              {formData.recurrence_end_type === 'date' && (
                <div className="form-floating">
                  <input
                    type="date"
                    id="recurrence_end_date"
                    name="recurrence_end_date"
                    value={formData.recurrence_end_date}
                    onChange={handleChange}
                    className="form-control form-control-sm"
                    placeholder="End Date"
                    min={formData.appointment_date || undefined}
                  />
                  <label htmlFor="recurrence_end_date">Repeat until</label>
                </div>
              )}

              {formData.recurrence_end_type === 'count' && (
                <div className="form-floating">
                  <input
                    type="number"
                    id="recurrence_count"
                    name="recurrence_count"
                    value={formData.recurrence_count}
                    onChange={handleChange}
                    className="form-control form-control-sm"
                    placeholder="Occurrences"
                    min="1"
                    max="365"
                  />
                  <label htmlFor="recurrence_count">Number of occurrences</label>
                </div>
              )}
            </>
          )}

          {/* Duration */}
          <div>
            <Dropdown_Custom
              name="duration_minutes"
              value={formData.duration_minutes}
              onChange={handleChange}
              options={[15, 30, 45, 60, 90, 120, 180, 240].map((mins) => ({
                value: mins.toString(),
                label: `${mins} min`
              }))}
              placeholder="Select duration"
              required
              label="Duration"
            />
            {durationError && <p className="text-red-500 text-xs mt-1">{durationError}</p>}
          </div>

          {/* Date + Time */}
          <div className="row g-2">
            <div className="col-6">
              <div className="form-floating">
                <input
                  type="date"
                  id="appointment_date"
                  name="appointment_date"
                  required
                  value={formData.appointment_date}
                  onChange={handleChange}
                  className="form-control form-control-sm"
                  placeholder="Date"
                />
                <label htmlFor="appointment_date">Date</label>
              </div>
            </div>
            <div className="col-6">
              <div className="input-group">
                <Dropdown_Custom
                  name="appointment_hour"
                  value={formData.appointment_hour || ''}
                  onChange={handleChange}
                  options={[6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21].map(hour => ({
                    value: hour.toString().padStart(2, '0'),
                    label: hour.toString().padStart(2, '0')
                  }))}
                  placeholder="Hr"
                  required
                  className={`flex-1 ${timeError ? 'border-red-500' : ''}`}
                />
                <span className="input-group-text">:</span>
                <Dropdown_Custom
                  name="appointment_minute"
                  value={formData.appointment_minute || ''}
                  onChange={handleChange}
                  options={[0, 15, 30, 45].map(minute => ({
                    value: minute.toString().padStart(2, '0'),
                    label: minute.toString().padStart(2, '0')
                  }))}
                  placeholder="Min"
                  required
                  className={`flex-1 ${timeError ? 'border-red-500' : ''}`}
                />
              </div>
            </div>
          </div>
          {timeError && <p className="text-red-500 text-xs">{timeError}</p>}

          {/* Attendee status panel — only when editing an existing meeting */}
          {appointment?.id && formData.appointment_type === 'meeting' && attendees.length > 0 && (
            <div className="border rounded p-2" style={{ fontSize: '0.8rem' }}>
              <p className="mb-1 fw-semibold text-gray-700 dark:text-gray-300">Attendees</p>
              <div className="d-flex flex-column gap-1">
                {attendees.map((att) => {
                  const emp = att.user_id ? employees.find(e => e.id === att.user_id) : null;
                  const cli = att.client_id ? clients.find(c => c.id === att.client_id) : null;
                  const name = emp
                    ? `${emp.first_name} ${emp.last_name}`.trim()
                    : cli
                    ? cli.name
                    : 'Unknown';
                  const style = ATTENDEE_STATUS_STYLE[att.attendance_status] || ATTENDEE_STATUS_STYLE.pending;
                  return (
                    <div key={att.id} className="d-flex align-items-center justify-content-between gap-2">
                      <span className="text-gray-800 dark:text-gray-200">{name}</span>
                      <span
                        style={{
                          backgroundColor: style.bg,
                          color: style.color,
                          borderRadius: '9999px',
                          padding: '1px 8px',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {style.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Notes */}
          {(formData.appointment_type === 'one_time' || formData.appointment_type === 'series') && (
            <div className="form-floating">
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                className="form-control form-control-sm border-0"
                placeholder="Notes"
                style={{ height: '60px' }}
              />
              <label htmlFor="notes">Notes (optional)</label>
            </div>
          )}

        </form>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 pt-2 pb-4 px-3 border-top border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="d-flex align-items-center">
          <div style={{ width: 40 }}>
            {appointment?.id && onDelete && (
              <Button_Toolbar
                icon={TrashIcon}
                label="Delete"
                onClick={onDelete}
                className="btn-outline-danger"
              />
            )}
          </div>
          <div className="flex-grow-1 d-flex gap-3 justify-content-center align-items-center">
            {appointment?.id && appointment?.client_id && (formData.appointment_type === 'one_time' || formData.appointment_type === 'series') && onSendReminder && (
              <Button_Toolbar
                icon={EnvelopeIcon}
                label="Send Reminder"
                onClick={onSendReminder}
                className="btn-outline-secondary"
              />
            )}
            <Button_Toolbar
              icon={XMarkIcon}
              label="Cancel"
              onClick={onCancel}
              className="btn-outline-secondary"
            />
            <Button_Toolbar
              icon={CheckIcon}
              label={appointment ? 'Save Changes' : 'Book'}
              type="submit"
              form="schedule-form"
              className="btn-primary"
            />
          </div>
          <div style={{ width: 40 }} />
        </div>
      </div>

    </div>
  );
}
