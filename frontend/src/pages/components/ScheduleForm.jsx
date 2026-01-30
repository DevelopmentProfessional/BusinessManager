import React, { useState, useEffect } from 'react';
import useStore from '../../services/useStore';
import { isudAPI } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, CalendarDaysIcon, ClockIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';
import PermissionGate from './PermissionGate';
import CustomDropdown from './CustomDropdown';
import IconButton from './IconButton';
import ActionFooter from './ActionFooter';

const APPOINTMENT_TYPES = [
  { value: 'one_time', label: 'One-Time Appointment' },
  { value: 'series', label: 'Recurring Series' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'task', label: 'Task' }
];

const RECURRENCE_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-Weekly' },
  { value: 'monthly', label: 'Monthly' }
];

export default function ScheduleForm({ appointment, onSubmit, onCancel }) {
  const { closeModal, hasPermission, user, openAddClientModal } = useStore();
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [timeError, setTimeError] = useState('');
  const navigate = useNavigate();

  // Own link to isud DB: fetch data so component works on any page
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [clientsRes, servicesRes, employeesRes] = await Promise.all([
          isudAPI.clients.getAll(),
          isudAPI.services.getAll(),
          isudAPI.schedule.getAvailableEmployees(),
        ]);
        if (cancelled) return;
        const clientsData = clientsRes?.data ?? clientsRes;
        const servicesData = servicesRes?.data ?? servicesRes;
        const employeesRaw = employeesRes?.data ?? employeesRes;
        if (Array.isArray(clientsData)) setClients(clientsData);
        if (Array.isArray(servicesData)) setServices(servicesData);
        if (Array.isArray(employeesRaw)) {
          const transformed = employeesRaw.map(emp => ({
            id: emp.id,
            first_name: emp.first_name ?? emp.firstName ?? '',
            last_name: emp.last_name ?? emp.lastName ?? '',
            role: emp.role ?? '',
          }));
          setEmployees(transformed);
        }
      } catch (err) {
        if (!cancelled) console.error('ScheduleForm failed to load isud data', err);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);
  
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
        client_id: appointment.client_id || '',
        service_id: appointment.service_id || '',
        employee_id: appointment.employee_id || '',
        appointment_date: date,
        appointment_hour: hour,
        appointment_minute: minute,
        notes: appointment.notes || '',
        appointment_type: appointment.appointment_type || 'one_time',
        recurrence_frequency: appointment.recurrence_frequency || '',
        duration_minutes: appointment.duration_minutes || 60,
        attendees: appointment.attendees || []
      };
    }
    return {
      client_id: '',
      service_id: '',
      employee_id: '',
      appointment_date: '',
      appointment_hour: '',
      appointment_minute: '',
      notes: '',
      appointment_type: 'one_time',
      recurrence_frequency: '',
      duration_minutes: 60,
      attendees: []
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
      // Lock employee_id to current user when write-only
      const self = employees.find(e => e.id === user.id || `${e.first_name} ${e.last_name}`.trim().toLowerCase() === `${user.first_name} ${user.last_name}`.trim().toLowerCase());
      if (self && formData.employee_id !== self.id) {
        setFormData(prev => ({ ...prev, employee_id: self.id }));
      }
    } else if (!formData.employee_id && employees.length === 1) {
      setFormData(prev => ({ ...prev, employee_id: employees[0].id }));
    }
  }, [employees, formData.employee_id, isWriteOnly, user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
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

    onSubmit({
      client_id: formData.client_id,
      service_id: formData.service_id,
      employee_id: formData.employee_id,
      appointment_date: appointmentDateStr,
      notes: formData.notes,
      appointment_type: formData.appointment_type,
      recurrence_frequency: formData.appointment_type === 'series' ? formData.recurrence_frequency : null,
      duration_minutes: parseInt(formData.duration_minutes) || 60
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          {appointment ? 'Edit Appointment' : 'Book New Appointment'}
        </h3>
      </div>

      <div className="flex items-center gap-2"> 
      <PermissionGate page="clients" permission="write">
          <button
            type="button"
            onClick={() => openAddClientModal((newClient) => {
              // Auto-select the newly created client
              setFormData(prev => ({ ...prev, client_id: newClient.id }));
              // Refresh local clients list
              setClients(prev => [...prev, newClient]);
            })}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-blue-600 dark:text-blue-400"
            title="Add new client"
            aria-label="Add new client"
          >
            <PlusIcon className="h-5 w-5" />
          </button>
        </PermissionGate>
        <CustomDropdown
          name="client_id"
          value={formData.client_id}
          onChange={handleChange}
          options={clients.map((client) => ({
            value: client.id,
            label: client.name
          }))}
          placeholder="Select a client"
          required
          className="flex-1"
          searchable={true}
        />
    
      </div>

      <div className="flex items-center gap-2"> 
      <PermissionGate page="services" permission="write">
          <button
            type="button"
            onClick={() => { closeModal(); navigate('/sales?new=1'); }}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-blue-600 dark:text-blue-400"
            title="Add new service"
            aria-label="Add new service"
          >
            <PlusIcon className="h-5 w-5" />
          </button>
        </PermissionGate>
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
      
      </div>

      <div className="flex items-center gap-2"> 
      <PermissionGate page="employees" permission="write">
          <button
            type="button"
            onClick={() => { closeModal(); navigate('/employees?new=1'); }}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-blue-600 dark:text-blue-400"
            title="Add new employee"
            aria-label="Add new employee"
          >
            <PlusIcon className="h-5 w-5" />
          </button>
        </PermissionGate>
        <div className="flex-1">
          <CustomDropdown
            name="employee_id"
            value={formData.employee_id}
            onChange={handleChange}
            options={(isWriteOnly && user)
              ? employees.filter(e => e.id === user.id || `${e.first_name} ${e.last_name}`.trim().toLowerCase() === `${user.first_name} ${user.last_name}`.trim().toLowerCase())
              : employees
            .map((employee) => ({
              value: employee.id,
              label: `${employee.first_name} ${employee.last_name} - ${employee.role}`
            }))}
            placeholder="Select an employee"
            required
            searchable={true}
            disabled={isWriteOnly}
          />
          {(isWriteOnly || employees.length === 1) && (
            <p className="text-xs text-gray-500 mt-1">
              You can only schedule appointments for yourself
            </p>
          )}
        </div>
      </div>

      {/* Appointment Type & Duration */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
            <CalendarDaysIcon className="h-4 w-4 inline mr-1" />
            Appointment Type
          </label>
          <CustomDropdown
            name="appointment_type"
            value={formData.appointment_type}
            onChange={handleChange}
            options={APPOINTMENT_TYPES}
            placeholder="Select type"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
            <ClockIcon className="h-4 w-4 inline mr-1" />
            Duration (minutes)
          </label>
          <CustomDropdown
            name="duration_minutes"
            value={formData.duration_minutes?.toString() || '60'}
            onChange={handleChange}
            options={[15, 30, 45, 60, 90, 120, 180].map(m => ({ value: m.toString(), label: `${m} min` }))}
            placeholder="Duration"
          />
        </div>
      </div>

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

      <div className="grid grid-cols-3 gap-4">
        <div> 
          <label htmlFor="appointment_date" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Date
          </label>
          <input
            type="date"
            id="appointment_date"
            name="appointment_date"
            required
            value={formData.appointment_date}
            onChange={handleChange}
            className="input-field mt-1"
          />
        </div>

        <div>
          <label htmlFor="appointment_hour" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Hour
          </label>
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
            className={timeError ? 'border-red-500' : ''}
          />
        </div>

        <div> 
          <label htmlFor="appointment_minute" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Minute
          </label>
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
            className={timeError ? 'border-red-500' : ''}
          />
        </div>
      </div>
      {timeError && <p className="text-red-500 text-xs mt-1">{timeError}</p>}

      <div> 
        <textarea
          id="notes"
          name="notes"
          rows={3}
          value={formData.notes}
          onChange={handleChange}
          className="input-field mt-1"
          placeholder="Additional notes for the appointment"
        />
      </div>

      <ActionFooter>
        <IconButton icon={XMarkIcon} label="Cancel" onClick={onCancel} variant="secondary" />
        <IconButton icon={CheckIcon} label={appointment ? 'Update Appointment' : 'Book Appointment'} type="submit" variant="primary" />
      </ActionFooter>
    </form>
  );
}
