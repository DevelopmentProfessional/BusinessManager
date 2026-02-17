import React, { useState, useEffect } from 'react';
import useStore from '../../services/useStore';
import { isudAPI } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, CalendarDaysIcon, ClockIcon, XMarkIcon, CheckIcon, TrashIcon } from '@heroicons/react/24/outline';
import PermissionGate from './PermissionGate';
import CustomDropdown from './CustomDropdown';
import IconButton from './IconButton';
import ActionFooter from './ActionFooter';

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

export default function ScheduleForm({ appointment, onSubmit, onCancel, onDelete, clients: clientsProp, services: servicesProp, employees: employeesProp }) {
  const { closeModal, hasPermission, user, openAddClientModal } = useStore();
  const [clients, setClients] = useState(clientsProp || []);
  const [services, setServices] = useState(servicesProp || []);
  const [employees, setEmployees] = useState(employeesProp || []);
  const [timeError, setTimeError] = useState('');
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientsLoaded, setClientsLoaded] = useState(false);
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
          if (!cancelled) console.error('ScheduleForm failed to load services/employees', err);
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
        duration_minutes: appointment.duration_minutes || 60
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
      duration_minutes: 60
    };
  };

  const [formData, setFormData] = useState(getInitialFormData);

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

    // Submit a naive local ISO string (no timezone) to avoid shifts server-side
    const timeText = `${hourText}:${minuteText}`;
    const appointmentDateStr = `${dateText}T${timeText}:00`;

    // Get config for current type to determine required fields
    const config = APPOINTMENT_TYPE_CONFIG[formData.appointment_type] || APPOINTMENT_TYPE_CONFIG.one_time;

    const employeeIds = Array.isArray(formData.employee_ids) ? formData.employee_ids.filter(Boolean) : [];
    const clientIds = Array.isArray(formData.client_ids) ? formData.client_ids.filter(Boolean) : [];

    const submitData = {
      employee_id: employeeIds[0] || '',
      employee_ids: employeeIds,
      appointment_date: appointmentDateStr,
      notes: formData.notes,
      appointment_type: formData.appointment_type,
      recurrence_frequency: formData.appointment_type === 'series' ? formData.recurrence_frequency : null,
      duration_minutes: parseInt(formData.duration_minutes) || 60
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

  // Contextual titles and descriptions per type
  const typeLabels = {
    one_time: { title: appointment ? 'Edit' : 'New', subtitle: '' },
    series: { title: appointment ? 'Edit' : 'New', subtitle: '' },
    meeting: { title: appointment ? 'Edit' : 'New', subtitle: '' },
    task: { title: appointment ? 'Edit' : 'New', subtitle: '' },
  };
  const currentLabels = typeLabels[formData.appointment_type] || typeLabels.one_time;

  return (
    <form onSubmit={handleSubmit} className="space-y-1">
      <div className="mb-1">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-0">
          {currentLabels.title}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{currentLabels.subtitle}</p>
      </div>

      {/* Appointment Type - FIRST so it controls what fields show */}
      <div className="mb-3">
        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
          Event Type
        </label>
        <CustomDropdown
          name="appointment_type"
          value={formData.appointment_type}
          onChange={handleChange}
          options={APPOINTMENT_TYPES.map((type) => ({
            value: type.value,
            label: type.label
          }))}
          placeholder="Select event type"
          required
        />
      </div>

      {/* Meeting Title - shown first for meetings */}
      {formData.appointment_type === 'meeting' && (
        <div className="form-floating mb-2">
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

      {/* Task Description - shown first for tasks */}
      {formData.appointment_type === 'task' && (
        <div className="form-floating mb-2">
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

      {/* Client Selection - only for appointments/series */}
      {typeConfig.needsClient && (
        <div className="input-group">
         
          <CustomDropdown
            name="client_id"
            value={typeConfig.clientMultiple ? formData.client_ids : (formData.client_ids[0] || '')}
            onChange={handleClientChange}
            options={clients.map((client) => ({
              value: client.id,
              label: client.name
            }))}
            placeholder={typeConfig.clientMultiple ? 'Select clients' : 'Select a client'}
            required
            className="flex-1"
            searchable={true}
            onOpen={handleClientDropdownOpen}
            loading={clientsLoading}
            multiSelect={typeConfig.clientMultiple}
          />
        </div>
      )}

      {/* Service Selection - only for appointments/series */}
      {typeConfig.needsService && (
 
          <CustomDropdown
            name="service_id"
            value={formData.service_id}
            onChange={handleChange}
            options={services.map((service) => ({
              value: service.id,
              label: `${service.name} - $${service.price}`
            }))}
            placeholder="Select a service"
            required
            className="flex-1"
            searchable={true}
          /> 
      )}

      {/* Employee Selection */}
      {typeConfig.needsEmployee && (
        <div>
       
            <CustomDropdown
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
            <p className="text-xs text-gray-500 mt-1">
              You can only schedule for yourself
            </p>
          )}
        </div>
      )}

      {/* Recurrence (only for series) */}
      {formData.appointment_type === 'series' && (
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
            Recurrence Frequency
          </label>
          <CustomDropdown
            name="recurrence_frequency"
            value={formData.recurrence_frequency}
            onChange={handleChange}
            options={RECURRENCE_OPTIONS}
            placeholder="Select frequency"
            required
          />
        </div>
      )}

      {/* Duration */}
      <div>
        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
          <ClockIcon className="h-4 w-4 inline mr-1" />
          Duration
        </label>
        <CustomDropdown
          name="duration_minutes"
          value={formData.duration_minutes?.toString() || '60'}
          onChange={handleChange}
          options={[15, 30, 45, 60, 90, 120, 180].map(m => ({ value: m.toString(), label: `${m} min` }))}
          placeholder="Duration"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
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
        <div>
          <div className="input-group mt-1">
            <CustomDropdown
              name="appointment_hour"
              value={formData.appointment_hour || ''}
              onChange={handleChange}
              options={[6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21].map(hour => ({
                value: hour.toString().padStart(2, '0'),
                label: hour.toString().padStart(2, '0')
              }))}
              placeholder="Hour"
              required
              className={`flex-1 ${timeError ? 'border-red-500' : ''}`}
            />
            <span className="input-group-text">:</span>
            <CustomDropdown
              name="appointment_minute"
              value={formData.appointment_minute || ''}
              onChange={handleChange}
              options={[0, 15, 30, 45].map(minute => ({
                value: minute.toString().padStart(2, '0'),
                label: minute.toString().padStart(2, '0')
              }))}
              placeholder="Minute"
              required
              className={`flex-1 ${timeError ? 'border-red-500' : ''}`}
            />
          </div>
        </div>
      </div>
      {timeError && <p className="text-red-500 text-xs mt-1">{timeError}</p>}

      {/* Notes - only for appointments/series (meetings/tasks use notes for title) */}
      {(formData.appointment_type === 'one_time' || formData.appointment_type === 'series') && (
        <div className="form-floating mb-2">
          <textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            className="form-control form-control-sm"
            placeholder="Notes"
            style={{ height: '60px' }}
          />
          <label htmlFor="notes">Notes (optional)</label>
        </div>
      )}

      <ActionFooter className="justify-center">
        {appointment?.id && onDelete && (
          <IconButton icon={TrashIcon} label="Delete" onClick={onDelete} variant="danger" />
        )}
        <IconButton icon={XMarkIcon} label="Cancel" onClick={onCancel} variant="secondary" />
        <IconButton
          icon={CheckIcon}
          label={appointment
            ? `Update ${formData.appointment_type === 'meeting' ? 'Meeting' : formData.appointment_type === 'task' ? 'Task' : 'Appointment'}`
            : formData.appointment_type === 'meeting' ? 'Schedule Meeting'
            : formData.appointment_type === 'task' ? 'Create Task'
            : 'Book Appointment'
          }
          type="submit"
          variant="primary"
        />
      </ActionFooter>
    </form>
  );
}
