import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import styled from 'styled-components';
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
import SixDayWeekView from '../components/SixDayWeekView';

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date) => startOfWeek(date, { weekStartsOn: 1 }), // Start week on Monday
  getDay,
  locales,
});

const views = {
  month: true,
  week: SixDayWeekView,
  day: true,
};

const CustomCalendarWrapper = styled.div`
  .rbc-month-view {
    .rbc-row-content {
      .rbc-row {
        .rbc-date-cell:last-child {
          display: none; // Hide Sunday column cells
        }
      }
      // Align event segments to 6 visible columns instead of original 7
      // We scale the segments container from 7 to 6 columns and clip the overflow.
      overflow: hidden;
      .rbc-row {
        transform: scaleX(1.1666667); /* 7/6 */
        transform-origin: left;
      }
    }
    .rbc-header:last-child {
      display: none; // Hide Sunday header
    }
    // Also hide Sunday background cells so grid aligns with headers
    .rbc-row-bg {
      .rbc-day-bg:last-child {
        display: none;
      }
    }
  }
`;

export default function Schedule() {
  const { 
    appointments, setAppointments, addAppointment, updateAppointment,
    clients, setClients, services, setServices, employees, setEmployees,
    loading, setLoading, error, setError, clearError,
    isModalOpen, openModal, closeModal
  } = useStore();

  const [editingAppointment, setEditingAppointment] = useState(null);
  const [currentView, setCurrentView] = useState('month');
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    loadScheduleData();
  }, []);

  const loadScheduleData = async () => {
    setLoading(true);
    try {
      const [appointmentsRes, clientsRes, servicesRes, employeesRes] = await Promise.all([
        scheduleAPI.getAll(),
        clientsAPI.getAll(),
        servicesAPI.getAll(),
        employeesAPI.getAll()
      ]);

      setAppointments(appointmentsRes.data);
      setClients(clientsRes.data);
      setServices(servicesRes.data);
      setEmployees(employeesRes.data);
      clearError();
    } catch (err) {
      setError('Failed to load schedule data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSlot = useCallback(({ start, end }) => {
    setEditingAppointment({ appointment_date: start, end_time: end });
    openModal('appointment-form');
  }, [openModal]);

  const handleCreateAppointment = () => {
    setEditingAppointment(null); // For the floating action button
    openModal('appointment-form');
  };

  const handleEditAppointment = (event) => {
    setEditingAppointment(event.resource);
    openModal('appointment-form');
  };

  const handleUpdateStatus = async (appointmentId, status) => {
    try {
      const response = await scheduleAPI.update(appointmentId, { status });
      updateAppointment(appointmentId, response.data);
      clearError();
    } catch (err) {
      setError('Failed to update appointment status');
      console.error(err);
    }
  };

  const handleSubmitAppointment = async (appointmentData) => {
    try {
      if (editingAppointment && editingAppointment.id) {
        const response = await scheduleAPI.update(editingAppointment.id, appointmentData);
        updateAppointment(editingAppointment.id, response.data);
      } else {
        const response = await scheduleAPI.create(appointmentData);
        addAppointment(response.data);
      }
      closeModal();
      clearError();
    } catch (err) {
      setError('Failed to save appointment');
      console.error(err);
    }
  };

  const getClientName = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : 'Unknown Client';
  };

  const getServiceName = (serviceId) => {
    const service = services.find(s => s.id === serviceId);
    return service ? service.name : 'Unknown Service';
  };

  // Robustly parse server values to local Date objects (handles 'YYYY-MM-DDTHH:mm:ss', 'YYYY-MM-DD HH:mm:ss', Date)
  const parseToLocalDate = (value) => {
    try {
      if (value instanceof Date) {
        return new Date(
          value.getFullYear(), value.getMonth(), value.getDate(),
          value.getHours(), value.getMinutes(), value.getSeconds() || 0
        );
      }
      if (typeof value === 'string') {
        const s = value.replace(' ', 'T');
        const [datePart, timePartRaw] = s.split('T');
        const [y, m, d] = (datePart || '').split('-').map(Number);
        const timePart = timePartRaw || '00:00:00';
        const [hh, mm, ss] = timePart.split(':');
        return new Date(
          y || 1970, (m || 1) - 1, d || 1,
          parseInt(hh || '0', 10), parseInt(mm || '0', 10), parseInt(ss || '0', 10)
        );
      }
      return new Date(value);
    } catch (e) {
      console.error('Failed to parse date', value, e);
      return new Date();
    }
  };

  const events = useMemo(() => {
    return appointments.map(app => {
      const start = parseToLocalDate(app.appointment_date);
      // If end_time is not provided, default to one hour after start
      const end = app.end_time ? parseToLocalDate(app.end_time) : new Date(start.getTime() + 60 * 60 * 1000);
      
      return {
        title: `${getClientName(app.client_id)} - ${getServiceName(app.service_id)}`,
        start,
        end,
        resource: app, // a back-reference to the original appointment object
      };
    });
  }, [appointments, clients, services]);

  // Drag-and-drop and resize handlers to update only time fields and retain other information
  const DragAndDropCalendar = useMemo(() => withDragAndDrop(Calendar), []);

  const handleEventDrop = useCallback(async ({ event, start, end, isAllDay }) => {
    const original = event.resource;
    if (!original || !original.id) return;
    try {
      const payload = {
        // Keep everything else as-is, only update the time fields
        appointment_date: format(start, 'yyyy-MM-dd HH:mm:ss'),
        end_time: format(end, 'yyyy-MM-dd HH:mm:ss'),
      };
      const response = await scheduleAPI.update(original.id, payload);
      updateAppointment(original.id, response.data);
      clearError();
    } catch (err) {
      setError('Failed to update appointment time');
      console.error(err);
    }
  }, [updateAppointment, clearError, setError]);

  const handleEventResize = useCallback(async ({ event, start, end }) => {
    const original = event.resource;
    if (!original || !original.id) return;
    try {
      const payload = {
        appointment_date: format(start, 'yyyy-MM-dd HH:mm:ss'),
        end_time: format(end, 'yyyy-MM-dd HH:mm:ss'),
      };
      const response = await scheduleAPI.update(original.id, payload);
      updateAppointment(original.id, response.data);
      clearError();
    } catch (err) {
      setError('Failed to resize appointment');
      console.error(err);
    }
  }, [updateAppointment, clearError, setError]);

  if (loading) {
    return (
      <CustomCalendarWrapper className="p-4 flex flex-col h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </CustomCalendarWrapper>
    );
  }

  return (
    <CustomCalendarWrapper className="h-[calc(100vh-64px)] flex flex-col">
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 py-3 rounded">
          {error}
        </div>
      )}

      <DragAndDropCalendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ flex: 1 }}
        views={views}
        view={currentView}
        date={currentDate}
        selectable
        onSelectEvent={handleEditAppointment}
        onSelectSlot={handleSelectSlot}
        onEventDrop={handleEventDrop}
        onEventResize={handleEventResize}
        resizable
        onView={setCurrentView}
        onNavigate={setCurrentDate}
        components={{
          toolbar: ({ label }) => (
            <div className="text-center text-xl font-semibold mb-4">
              {label}
            </div>
          ),
          month: {
            header: ({ date, label }) => {
              const dayOfWeek = date.getDay();
              if (dayOfWeek === 0) return null; // Hide Sunday
              return <div className="text-center font-semibold">{format(date, 'EEE')}</div>;
            },
            dateHeader: ({ date, label }) => {
              const dayOfWeek = date.getDay();
              if (dayOfWeek === 0) return null; // Hide Sunday
              return <div className="text-center">{label}</div>;
            },
          },
        }}
        min={new Date(0, 0, 0, 6, 0, 0)} // Start at 6AM
        max={new Date(0, 0, 0, 22, 0, 0)} // End at 10PM
      />

      {/* Navigation controls underneath the calendar */}
      <div className="flex justify-between items-center mt-4 px-4 py-2 border-t">
        <div className="flex space-x-2">
          <button
            onClick={() => setCurrentView('month')}
            className={`px-3 py-1 rounded ${
              currentView === 'month' ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'
            }`}
          >
            Month
          </button>
          <button
            onClick={() => setCurrentView('week')}
            className={`px-3 py-1 rounded ${
              currentView === 'week' ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'
            }`}
          >
            Week
          </button>
          {currentDate.getDay() !== 0 && ( // Hide Day button when current date is Sunday
            <button
              onClick={() => setCurrentView('day')}
              className={`px-3 py-1 rounded ${
                currentView === 'day' ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              Day
            </button>
          )}
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={() => {
              const newDate = new Date(currentDate);
              if (currentView === 'month') {
                newDate.setMonth(newDate.getMonth() - 1);
              } else if (currentView === 'week') {
                newDate.setDate(newDate.getDate() - 7);
              } else {
                newDate.setDate(newDate.getDate() - 1);
              }
              setCurrentDate(newDate);
            }}
            className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
          >
            Prev
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Today
          </button>
          <button
            onClick={() => {
              const newDate = new Date(currentDate);
              if (currentView === 'month') {
                newDate.setMonth(newDate.getMonth() + 1);
              } else if (currentView === 'week') {
                newDate.setDate(newDate.getDate() + 7);
              } else {
                newDate.setDate(newDate.getDate() + 1);
              }
              setCurrentDate(newDate);
            }}
            className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
          >
            Next
          </button>
        </div>
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={closeModal} 
        style={currentView === 'week' ? { width: '80%', height: '80%' } : { width: '100%', height: '50%' }}
      >
        {isModalOpen && (
          <ScheduleForm
            appointment={editingAppointment}
            clients={clients}
            services={services}
            employees={employees}
            onSubmit={handleSubmitAppointment}
            onCancel={closeModal}
          />
        )}
      </Modal>
    </CustomCalendarWrapper>
  );
}
