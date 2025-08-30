import React, { useState, useEffect } from 'react';
import useStore from '../store/useStore';
import { useNavigate } from 'react-router-dom';
import { PlusIcon } from '@heroicons/react/24/outline';

export default function ScheduleForm({ appointment, onSubmit, onCancel }) {
  const { clients, services, employees, closeModal } = useStore();
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
      return {
        client_id: appointment.client_id || '',
        service_id: appointment.service_id || '',
        employee_id: appointment.employee_id || '',
        appointment_date: date,
        appointment_time: time,
        notes: appointment.notes || ''
      };
    }
    return {
      client_id: '',
      service_id: '',
      employee_id: '',
      appointment_date: '',
      appointment_time: '',
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

    // Use time from input; if empty (user didn't touch), fallback to selected slot's time
    const timeText = formData.appointment_time || (appointment?.appointment_date ? extractLocalParts(appointment.appointment_date).time : '');
    const dateText = formData.appointment_date || (appointment?.appointment_date ? extractLocalParts(appointment.appointment_date).date : '');

    if (!dateText || !timeText) {
      setTimeError('Please select a valid date and time');
      return;
    }

    const [hour, minute] = timeText.split(':').map(Number);
    if (hour < 6 || hour >= 21) {
      setTimeError('Can only schedule between 6AM and 9PM');
      return;
    }
    setTimeError('');

    // Submit a naive local ISO string (no timezone) to avoid shifts server-side
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
        <button
          type="button"
          onClick={() => { closeModal(); navigate('/clients?new=1'); }}
          className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-blue-600"
          title="Add new client"
          aria-label="Add new client"
        >
          <PlusIcon className="h-5 w-5" />
        </button>
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
        <button
          type="button"
          onClick={() => { closeModal(); navigate('/services?new=1'); }}
          className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-blue-600"
          title="Add new service"
          aria-label="Add new service"
        >
          <PlusIcon className="h-5 w-5" />
        </button>
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
        <button
          type="button"
          onClick={() => { closeModal(); navigate('/employees?new=1'); }}
          className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-blue-600"
          title="Add new employee"
          aria-label="Add new employee"
        >
          <PlusIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div> 
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
          <input
            type="time"
            id="appointment_time"
            name="appointment_time"
            required
            value={formData.appointment_time}
            onChange={handleChange}
            min="06:00"
            max="21:00"
            step="300"
            className={`input-field mt-1 ${timeError ? 'border-red-500' : ''}`}
          />
          {timeError && <p className="text-red-500 text-xs mt-1">{timeError}</p>}
        </div>
      </div>

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
