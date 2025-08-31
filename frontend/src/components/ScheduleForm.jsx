import React, { useState, useEffect } from 'react';
import useStore from '../store/useStore';
import { useNavigate } from 'react-router-dom';
import { PlusIcon } from '@heroicons/react/24/outline';
import PermissionGate from './PermissionGate';

export default function ScheduleForm({ appointment, onSubmit, onCancel }) {
  const { clients, services, employees, closeModal, hasPermission } = useStore();
  const [timeError, setTimeError] = useState('');
  const navigate = useNavigate();
  
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
        notes: appointment.notes || ''
      };
    }
    return {
      client_id: '',
      service_id: '',
      employee_id: '',
      appointment_date: '',
      appointment_hour: '',
      appointment_minute: '',
      notes: ''
    };
  };

  const [formData, setFormData] = useState(getInitialFormData);

  useEffect(() => {
    setFormData(getInitialFormData());
  }, [appointment]);

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
      notes: formData.notes
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          {appointment ? 'Edit Appointment' : 'Book New Appointment'}
        </h3>
      </div>

      <div className="flex items-center gap-2"> 
        <select
          id="client_id"
          name="client_id"
          required
          value={formData.client_id}
          onChange={handleChange}
          className="input-field mt-1 flex-1"
        >
          <option value="">Select a client</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
        <PermissionGate page="clients" permission="write">
          <button
            type="button"
            onClick={() => { closeModal(); navigate('/clients?new=1'); }}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-blue-600"
            title="Add new client"
            aria-label="Add new client"
          >
            <PlusIcon className="h-5 w-5" />
          </button>
        </PermissionGate>
      </div>

      <div className="flex items-center gap-2"> 
        <select
          id="service_id"
          name="service_id"
          required
          value={formData.service_id}
          onChange={handleChange}
          className="input-field mt-1 flex-1"
        >
          <option value="">Select a service</option>
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name} - ${service.price}
            </option>
          ))}
        </select>
        <PermissionGate page="services" permission="write">
          <button
            type="button"
            onClick={() => { closeModal(); navigate('/services?new=1'); }}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-blue-600"
            title="Add new service"
            aria-label="Add new service"
          >
            <PlusIcon className="h-5 w-5" />
          </button>
        </PermissionGate>
      </div>

      <div className="flex items-center gap-2"> 
        <select
          id="employee_id"
          name="employee_id"
          required
          value={formData.employee_id}
          onChange={handleChange}
          className="input-field mt-1 flex-1"
        >
          <option value="">Select an employee</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.first_name} {employee.last_name} - {employee.role}
            </option>
          ))}
        </select>
        <PermissionGate page="employees" permission="write">
          <button
            type="button"
            onClick={() => { closeModal(); navigate('/employees?new=1'); }}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-blue-600"
            title="Add new employee"
            aria-label="Add new employee"
          >
            <PlusIcon className="h-5 w-5" />
          </button>
        </PermissionGate>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div> 
          <label htmlFor="appointment_date" className="block text-sm font-medium text-gray-700">
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
          <label htmlFor="appointment_hour" className="block text-sm font-medium text-gray-700">
            Hour
          </label>
          <select
            id="appointment_hour"
            name="appointment_hour"
            required
            value={formData.appointment_hour || ''}
            onChange={handleChange}
            className={`input-field mt-1 ${timeError ? 'border-red-500' : ''}`}
          >
             
            {[6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21].map(hour => (
              <option key={hour} value={hour.toString().padStart(2, '0')}>
                {hour.toString().padStart(2, '0')}
              </option>
            ))}
          </select>
        </div>

        <div> 
          <label htmlFor="appointment_minute" className="block text-sm font-medium text-gray-700">
            Minute
          </label>
          <select
            id="appointment_minute"
            name="appointment_minute"
            required
            value={formData.appointment_minute || ''}
            onChange={handleChange}
            className={`input-field mt-1 ${timeError ? 'border-red-500' : ''}`}
          >
            
            {[0, 15, 30, 45].map(minute => (
              <option key={minute} value={minute.toString().padStart(2, '0')}>
                {minute.toString().padStart(2, '0')}
              </option>
            ))}
          </select>
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

      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="btn-primary"
        >
          {appointment ? 'Update Appointment' : 'Book Appointment'}
        </button>
      </div>
    </form>
  );
}
