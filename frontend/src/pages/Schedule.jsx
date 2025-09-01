import React, { useState, useCallback, useEffect } from 'react';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import enUS from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';

import useStore from '../store/useStore';
import { scheduleAPI, clientsAPI, servicesAPI, employeesAPI } from '../services/api';
import Modal from '../components/Modal';
import ScheduleForm from '../components/ScheduleForm';
import PermissionGate from '../components/PermissionGate';
import '../utils/calendarDebug';

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales: { 'en-US': enUS },
});

const DragAndDropCalendar = withDragAndDrop(Calendar);

export default function Schedule() {
  const { appointments, clients, services, employees, loading, error, setError, clearError, updateAppointment } = useStore();
  
  const [currentView, setCurrentView] = useState('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        clearError();
        await clientsAPI.getAll();
        await servicesAPI.getAll();
        await employeesAPI.getAll();
        await scheduleAPI.getAll();
      } catch (err) {
        console.error('Failed to load schedule data:', err);
        setError('Failed to load schedule data');
      }
    };

    loadData();
  }, [setError, clearError]);

  const events = appointments.map(appointment => ({
    id: appointment.id,
    title: appointment.title || 'Appointment',
    start: new Date(appointment.appointment_date),
    end: new Date(appointment.end_time || appointment.appointment_date),
    resource: appointment,
  }));

  const handleEditAppointment = useCallback((event) => {
    setEditingAppointment(event.resource);
    setIsModalOpen(true);
  }, []);

  const handleSelectSlot = useCallback((slotInfo) => {
    setEditingAppointment({
      appointment_date: slotInfo.start,
      end_time: slotInfo.end || slotInfo.start
    });
    setIsModalOpen(true);
  }, []);

  const handleSubmitAppointment = useCallback(async (appointmentData) => {
    try {
      if (editingAppointment && editingAppointment.id) {
        await scheduleAPI.update(editingAppointment.id, appointmentData);
      } else {
        await scheduleAPI.create(appointmentData);
      }
      setIsModalOpen(false);
      setEditingAppointment(null);
      clearError();
    } catch (err) {
      setError('Failed to save appointment');
    }
  }, [editingAppointment, clearError, setError]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingAppointment(null);
  }, []);

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="h-100 d-flex flex-column">
      {error && <div className="alert alert-danger mb-3">{error}</div>}

      <PermissionGate page="schedule" permission="read">
        <div className="text-center mb-3">
          <h4>{currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h4>
        </div>

        <DragAndDropCalendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: 'calc(100vh - 200px)', minHeight: '400px' }}
          view={currentView}
          date={currentDate}
          selectable
          onSelectEvent={handleEditAppointment}
          onSelectSlot={handleSelectSlot}
          onView={setCurrentView}
          onNavigate={setCurrentDate}
          min={new Date(0, 0, 0, 6, 0, 0)}
          max={new Date(0, 0, 0, 21, 0, 0)}
          views={{
            month: Views.MONTH,
            week: Views.WEEK,
          }}
        />

        <div className="d-flex justify-content-between align-items-center mt-3 p-2 border-top">
          <div className="d-flex gap-1">
            <button
              type="button"
              onClick={() => setCurrentView('month')}
              className={`btn btn-sm ${currentView === 'month' ? 'btn-danger' : 'btn-outline-secondary'}`}
            >
              Month
            </button>
            <button
              type="button"
              onClick={() => setCurrentView('week')}
              className={`btn btn-sm ${currentView === 'week' ? 'btn-danger' : 'btn-outline-secondary'}`}
            >
              Week
            </button>
          </div>
          
          <div className="d-flex gap-1">
            <button
              type="button"
              onClick={() => {
                const newDate = new Date(currentDate);
                newDate.setMonth(newDate.getMonth() - 1);
                setCurrentDate(newDate);
              }}
              className="btn btn-outline-secondary btn-sm"
            >
              Prev
            </button>
          </div>
        </div>

        <Modal isOpen={isModalOpen} onClose={closeModal}>
          <ScheduleForm
            appointment={editingAppointment}
            clients={clients}
            services={services}
            employees={employees}
            onSubmit={handleSubmitAppointment}
            onCancel={closeModal}
          />
        </Modal>
      </PermissionGate>
    </div>
  );
}
