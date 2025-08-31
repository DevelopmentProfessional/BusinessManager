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
import { FunnelIcon } from '@heroicons/react/24/outline';
import 'react-big-calendar/lib/css/react-big-calendar.css';

import useStore from '../store/useStore';
import { usePermissionRefresh } from '../hooks/usePermissionRefresh';
import { scheduleAPI, clientsAPI, servicesAPI, employeesAPI } from '../services/api';
import Modal from '../components/Modal';
import ScheduleForm from '../components/ScheduleForm';
import SixDayWeekView from '../components/SixDayWeekView';
import PermissionGate from '../components/PermissionGate';

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
  /* Subtle red accent for buttons and events only */
  .rbc-calendar {
    background-color: white;
  }

  .rbc-header {
    background-color: #f8f9fa;
    color: #374151;
    font-weight: 600;
    padding: 8px;
    border: 1px solid #e5e7eb;
  }

  .rbc-month-view {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    overflow: hidden;
  }

  .rbc-date-cell {
    background-color: white;
    border: 1px solid #e5e7eb;
    padding: 4px;
  }

  .rbc-date-cell.rbc-off-range {
    background-color: #f9fafb;
    color: #9ca3af;
  }

  .rbc-date-cell.rbc-today {
    background-color: #fef2f2;
    font-weight: bold;
    color: #b91c1c;
    border: 2px solid #b91c1c;
  }

  /* Events with matte red styling */
  .rbc-event {
    background-color: #b91c1c !important;
    border-color: #991b1b !important;
    color: white !important;
    border-radius: 6px;
    margin: 1px;
    padding: 3px 6px;
    font-size: 12px;
    font-weight: 500;
  }

  .rbc-event:hover {
    background-color: #991b1b !important;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  .rbc-event.rbc-selected {
    background-color: #7f1d1d !important;
    box-shadow: 0 0 0 2px #b91c1c;
  }

  /* Keep toolbar neutral */
  .rbc-toolbar {
    background-color: #f8f9fa;
    color: #374151;
    padding: 12px;
    border-radius: 8px 8px 0 0;
    border: 1px solid #e5e7eb;
  }

  .rbc-toolbar button {
    background-color: #white;
    border: 1px solid #d1d5db;
    color: #374151;
  }

  .rbc-toolbar button:hover {
    background-color: #f3f4f6;
  }

  .rbc-toolbar button.rbc-active {
    background-color: #b91c1c !important;
    border-color: #b91c1c !important;
    color: white !important;
  }

  .rbc-time-view {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
  }

  .rbc-time-header {
    background-color: #f8f9fa;
    color: #374151;
    border-bottom: 1px solid #e5e7eb;
  }

  .rbc-time-content {
    background-color: white;
  }

  .rbc-timeslot-group {
    border-bottom: 1px solid #f3f4f6;
  }

  .rbc-time-slot {
    border-bottom: 1px solid #f9fafb;
  }

  /* Keep the current time indicator matte red - it's functional */
  .rbc-current-time-indicator {
    background-color: #b91c1c;
    height: 3px !important;
    border-radius: 2px;
    box-shadow: 0 2px 4px rgba(185, 28, 28, 0.3);
  }

  .rbc-day-slot .rbc-time-slot {
    border-top: 1px solid #f3f4f6;
  }

  .rbc-day-slot .rbc-event {
    background-color: #b91c1c !important;
    border-color: #991b1b !important;
  }

  .rbc-day-slot .rbc-event:hover {
    background-color: #991b1b !important;
  }

  /* Fix for doubling effect - ensure clean rendering */
  * {
    box-sizing: border-box;
  }

  .rbc-month-view,
  .rbc-time-view {
    transform: none !important;
    backface-visibility: hidden;
  }

  .rbc-row,
  .rbc-date-cell,
  .rbc-event {
    transform: none !important;
    backface-visibility: hidden;
  }
`;

export default function Schedule() {
  const { 
    appointments, setAppointments, addAppointment, updateAppointment,
    clients, setClients, services, setServices, employees, setEmployees,
    loading, setLoading, error, setError, clearError,
    isModalOpen, openModal, closeModal, user,
    setFilter, getFilter, hasPermission
  } = useStore();

  // Use the permission refresh hook
  usePermissionRefresh();

  const [editingAppointment, setEditingAppointment] = useState(null);
  const [currentView, setCurrentView] = useState(() => getFilter('schedule', 'view', 'month'));
  const [currentDate, setCurrentDate] = useState(() => {
    const savedDate = getFilter('schedule', 'date');
    return savedDate ? new Date(savedDate) : new Date();
  });
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState(() => getFilter('schedule', 'employeeFilter', 'all'));
  const [availableEmployees, setAvailableEmployees] = useState([]);
  const [hasViewAllPermission, setHasViewAllPermission] = useState(false);
  const [showEmployeeFilter, setShowEmployeeFilter] = useState(() => getFilter('schedule', 'showFilter', false));
  const [selectedEmployees, setSelectedEmployees] = useState(() => {
    const savedEmployees = getFilter('schedule', 'selectedEmployees', []);
    return new Set(savedEmployees);
  });

  useEffect(() => {
    loadScheduleData();
  }, []);

  const loadScheduleData = async () => {
    setLoading(true);
    try {
      // Check if user has view_all permission
      const hasViewAll = user?.role === 'admin' || user?.schedule_view_all === true;
      setHasViewAllPermission(hasViewAll);

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

      // Load available employees for filter if user has view_all permission
      if (hasViewAll) {
        try {
          const availableEmployeesRes = await scheduleAPI.getAvailableEmployees();
          setAvailableEmployees(availableEmployeesRes.data);
        } catch (err) {
          console.error('Failed to load available employees:', err);
        }
      }

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
    if (!hasPermission('schedule', 'write')) {
      setError('You do not have permission to create appointments');
      return;
    }
    setEditingAppointment(null); // For the floating action button
    openModal('appointment-form');
  };

  const handleEditAppointment = (event) => {
    if (!hasPermission('schedule', 'write')) {
      setError('You do not have permission to edit appointments');
      return;
    }
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
        return new Date(value);
      }
      if (typeof value === 'string') {
        // Handle ISO string format
        if (value.includes('T') || value.includes('Z')) {
          return new Date(value);
        }
        // Handle 'YYYY-MM-DD HH:mm:ss' format
        const s = value.replace(' ', 'T');
        return new Date(s);
      }
      return new Date(value);
    } catch (e) {
      console.error('Failed to parse date', value, e);
      return new Date();
    }
  };

  const handleEmployeeFilterChange = (employeeId) => {
    setSelectedEmployeeFilter(employeeId);
    setFilter('schedule', 'employeeFilter', employeeId);
  };

  const handleEmployeeToggle = (employeeId) => {
    setSelectedEmployees(prev => {
      const newSet = new Set(prev);
      if (newSet.has(employeeId)) {
        newSet.delete(employeeId);
      } else {
        newSet.add(employeeId);
      }
      // Save the updated set to persistent storage
      setFilter('schedule', 'selectedEmployees', Array.from(newSet));
      return newSet;
    });
  };

  const getFilteredEmployees = () => {
    if (currentView === 'month') {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      return availableEmployees.filter(emp => {
        const hasAppointments = appointments.some(apt => 
          apt.employee_id === emp.id && 
          new Date(apt.appointment_date) >= startOfMonth && 
          new Date(apt.appointment_date) <= endOfMonth
        );
        return hasAppointments;
      });
    } else if (currentView === 'week') {
      const startOfWeek = new Date(currentDate);
      startOfWeek.setDate(currentDate.getDate() - currentDate.getDay() + 1);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      return availableEmployees.filter(emp => {
        const hasAppointments = appointments.some(apt => 
          apt.employee_id === emp.id && 
          new Date(apt.appointment_date) >= startOfWeek && 
          new Date(apt.appointment_date) <= endOfWeek
        );
        return hasAppointments;
      });
    } else { // day view
      const startOfDay = new Date(currentDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(currentDate);
      endOfDay.setHours(23, 59, 59, 999);
      return availableEmployees.filter(emp => {
        const hasAppointments = appointments.some(apt => 
          apt.employee_id === emp.id && 
          new Date(apt.appointment_date) >= startOfDay && 
          new Date(apt.appointment_date) <= endOfDay
        );
        return hasAppointments;
      });
    }
  };

  const events = useMemo(() => {
    let filteredAppointments = appointments;
    
    // Filter by selected employees if user has view_all permission
    if (hasViewAllPermission && selectedEmployees.size > 0) {
      filteredAppointments = appointments.filter(app => selectedEmployees.has(app.employee_id));
    } else if (hasViewAllPermission && selectedEmployeeFilter !== 'all') {
      filteredAppointments = appointments.filter(app => app.employee_id === selectedEmployeeFilter);
    }
    
    return filteredAppointments.map(app => {
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
  }, [appointments, clients, services, selectedEmployeeFilter, selectedEmployees, hasViewAllPermission]);

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

      {/* Employee Filter - Only show if user has view_all permission */}
      <PermissionGate page="schedule" permission="read">
        {hasViewAllPermission && availableEmployees.length > 0 && (
          <div className="mb-4 px-4 py-2 bg-gray-50 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">Filter by Employee:</label>
                <select
                  value={selectedEmployeeFilter}
                  onChange={(e) => handleEmployeeFilterChange(e.target.value)}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="all">All Employees</option>
                  {availableEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Multi-select Filter Button */}
              <button
                onClick={() => {
                  const newShowFilter = !showEmployeeFilter;
                  setShowEmployeeFilter(newShowFilter);
                  setFilter('schedule', 'showFilter', newShowFilter);
                }}
                className="flex items-center space-x-2 px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                <FunnelIcon className="h-4 w-4" />
                <span className="text-sm">Filter</span>
              </button>
            </div>
            
            {/* Multi-select Employee Filter Panel */}
            {showEmployeeFilter && (
              <div className="mt-4 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                <h4 className="text-sm font-medium text-gray-900 mb-3">
                  Filter by Employees ({getFilteredEmployees().length} available)
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {getFilteredEmployees().map((emp) => (
                    <label key={emp.id} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedEmployees.has(emp.id)}
                        onChange={() => handleEmployeeToggle(emp.id)}
                        className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                      />
                      <span className="text-sm text-gray-700">{emp.name}</span>
                    </label>
                  ))}
                </div>
                {selectedEmployees.size > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <button
                      onClick={() => {
                        setSelectedEmployees(new Set());
                        setFilter('schedule', 'selectedEmployees', []);
                      }}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      Clear All Filters
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </PermissionGate>

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
        onView={(view) => {
          setCurrentView(view);
          setFilter('schedule', 'view', view);
        }}
        onNavigate={(date) => {
          setCurrentDate(date);
          setFilter('schedule', 'date', date.toISOString());
        }}
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
        max={new Date(0, 0, 0, 21, 0, 0)} // End at 9PM
      />

      {/* Navigation controls underneath the calendar */}
      <div className="flex justify-between items-center mt-4 px-4 py-2 border-t">
        <div className="flex space-x-2">
          <button
            onClick={() => {
              setCurrentView('month');
              setFilter('schedule', 'view', 'month');
            }}
            className={`px-3 py-1 rounded ${
              currentView === 'month' ? 'bg-red-600 text-white' : 'bg-gray-200 hover:bg-gray-300'
            }`}
          >
            Month
          </button>
          <button
            onClick={() => {
              setCurrentView('week');
              setFilter('schedule', 'view', 'week');
            }}
            className={`px-3 py-1 rounded ${
              currentView === 'week' ? 'bg-red-600 text-white' : 'bg-gray-200 hover:bg-gray-300'
            }`}
          >
            Week
          </button>
          {currentDate.getDay() !== 0 && ( // Hide Day button when current date is Sunday
            <button
              onClick={() => {
                setCurrentView('day');
                setFilter('schedule', 'view', 'day');
              }}
              className={`px-3 py-1 rounded ${
                currentView === 'day' ? 'bg-red-600 text-white' : 'bg-gray-200 hover:bg-gray-300'
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
              setFilter('schedule', 'date', newDate.toISOString());
            }}
            className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
          >
            Prev
          </button>
          <button
            onClick={() => {
              const today = new Date();
              setCurrentDate(today);
              setFilter('schedule', 'date', today.toISOString());
            }}
            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
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
              setFilter('schedule', 'date', newDate.toISOString());
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
