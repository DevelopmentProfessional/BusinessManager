import React, { useState, useEffect } from 'react';
import useStore from '../store/useStore';

export default function ScheduleForm({ appointment, onSubmit, onCancel }) {
  const { clients, services, employees } = useStore();
  
  const [formData, setFormData] = useState({
    client_id: '',
    service_id: '',
    employee_id: '',
    appointment_date: '',
    appointment_time: '',
    notes: ''
  });

  useEffect(() => {
    if (appointment) {
      const appointmentDate = new Date(appointment.appointment_date);
      setFormData({
        client_id: appointment.client_id || '',
        service_id: appointment.service_id || '',
        employee_id: appointment.employee_id || '',
        appointment_date: appointmentDate.toISOString().split('T')[0],
        appointment_time: appointmentDate.toTimeString().slice(0, 5),
        notes: appointment.notes || ''
      });
    }
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
    const appointmentDateTime = new Date(`${formData.appointment_date}T${formData.appointment_time}`);
    
    onSubmit({
      client_id: formData.client_id,
      service_id: formData.service_id,
      employee_id: formData.employee_id,
      appointment_date: appointmentDateTime.toISOString(),
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

      <div>
        <label htmlFor="client_id" className="block text-sm font-medium text-gray-700">
          Client *
        </label>
        <select
          id="client_id"
          name="client_id"
          required
          value={formData.client_id}
          onChange={handleChange}
          className="input-field mt-1"
        >
          <option value="">Select a client</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="service_id" className="block text-sm font-medium text-gray-700">
          Service *
        </label>
        <select
          id="service_id"
          name="service_id"
          required
          value={formData.service_id}
          onChange={handleChange}
          className="input-field mt-1"
        >
          <option value="">Select a service</option>
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name} - ${service.price}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="employee_id" className="block text-sm font-medium text-gray-700">
          Employee *
        </label>
        <select
          id="employee_id"
          name="employee_id"
          required
          value={formData.employee_id}
          onChange={handleChange}
          className="input-field mt-1"
        >
          <option value="">Select an employee</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.first_name} {employee.last_name} - {employee.role}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="appointment_date" className="block text-sm font-medium text-gray-700">
            Date *
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
          <label htmlFor="appointment_time" className="block text-sm font-medium text-gray-700">
            Time *
          </label>
          <input
            type="time"
            id="appointment_time"
            name="appointment_time"
            required
            value={formData.appointment_time}
            onChange={handleChange}
            className="input-field mt-1"
          />
        </div>
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
          Notes
        </label>
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
