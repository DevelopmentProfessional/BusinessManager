import React, { useState, useCallback, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import useStore from '../store/useStore';
import { usePermissionRefresh } from '../hooks/usePermissionRefresh';
import { scheduleAPI, clientsAPI, servicesAPI, employeesAPI } from '../services/api';
import Modal from '../components/Modal';
import ScheduleForm from '../components/ScheduleForm';
import PermissionGate from '../components/PermissionGate';
import useDarkMode from '../store/useDarkMode';

export default function Schedule() {
  const { appointments, clients, services, employees, loading, setClients, setServices, setEmployees, setAppointments, hasPermission, isAuthenticated, user } = useStore();
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  // Use the permission refresh hook
  usePermissionRefresh();

  // Check permissions at page level (including new permission types)
  if (!hasPermission('schedule', 'read') && 
      !hasPermission('schedule', 'read_all') &&
      !hasPermission('schedule', 'write') && 
      !hasPermission('schedule', 'view_all') &&
      !hasPermission('schedule', 'delete') && 
      !hasPermission('schedule', 'admin')) {
    return <Navigate to="/profile" replace />;
  }
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState('month');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState(null);
  const [draggedAppointment, setDraggedAppointment] = useState(null);
  const [dragOverCell, setDragOverCell] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      // Check if user is authenticated before making API calls
      if (!isAuthenticated()) {
        console.error('User not authenticated - skipping data load');
        return;
      }
      
      try {
        const clientsResponse = await clientsAPI.getAll();
        if (clientsResponse?.data) {
          setClients(clientsResponse.data);
        }
        
        const servicesResponse = await servicesAPI.getAll();
        if (servicesResponse?.data) {
          setServices(servicesResponse.data);
        }
        
        // Load employees from schedule endpoint to get permission-filtered list
        const employeesResponse = await scheduleAPI.getAvailableEmployees();
        if (employeesResponse?.data) {
          // Transform the data to match the expected format
          const transformedEmployees = employeesResponse.data.map(emp => ({
            id: emp.id,
            first_name: emp.name.split(' ')[0] || '',
            last_name: emp.name.split(' ').slice(1).join(' ') || '',
            role: emp.role || 'employee'
          }));
          setEmployees(transformedEmployees);
        }
        
        const scheduleResponse = await scheduleAPI.getAll();
        if (scheduleResponse?.data) {
          setAppointments(scheduleResponse.data);
        }
      } catch (error) {
        console.error('Error loading schedule data:', error);
        // If it's an authentication error, the user needs to log in
        if (error.response?.status === 401 || error.response?.status === 403) {
          console.error('Authentication required - redirecting to login');
          // The PermissionGate will handle the redirect
        }
      }
    };

    loadData();
  }, [setClients, setServices, setEmployees, isAuthenticated]);

  // Get calendar data based on current view
  const getCalendarDays = () => {
    if (currentView === 'day') {
      return [new Date(currentDate)];
    } else if (currentView === 'week') {
      const startOfWeek = new Date(currentDate);
      // Start week on Sunday (standard calendar)
      startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
      
      const days = [];
      for (let i = 0; i < 7; i++) { // 7 days (Sun-Sat)
        const day = new Date(startOfWeek);
        day.setDate(startOfWeek.getDate() + i);
        days.push(day);
      }
      return days;
    } else {
      // Month view
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const startDate = new Date(firstDay);
      
      // Start on Sunday (standard calendar)
      startDate.setDate(startDate.getDate() - firstDay.getDay());
      
      const days = [];
      const currentDateObj = new Date(startDate);
      
      // Generate 6 weeks * 7 days = 42 days (Sun-Sat)
      while (days.length < 42) {
        days.push(new Date(currentDateObj));
        currentDateObj.setDate(currentDateObj.getDate() + 1);
      }
      
      return days;
    }
  };

  // Get time slots for week and day views (full 24 hours)
  const getTimeSlots = () => {
    const timeSlots = [];
    for (let hour = 0; hour <= 23; hour++) {
      timeSlots.push(hour);
    }
    return timeSlots;
  };

  const days = getCalendarDays();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const canCreateSchedule = useCallback(() => {
    return (
      hasPermission('schedule', 'write') ||
      hasPermission('schedule', 'write_all') ||
      hasPermission('schedule', 'admin')
    );
  }, [hasPermission]);

  const canEditAppointment = useCallback((appointment) => {
    if (!appointment) return false;
    if (hasPermission('schedule', 'admin') || hasPermission('schedule', 'write_all')) return true;
    if (!hasPermission('schedule', 'write')) return false;
    // Try direct match (DB FK to user.id)
    if (user && appointment.employee_id === user.id) return true;
    // Heuristic: if FK is employee.id, try to match by name from employees list
    if (user && employees && employees.length) {
      const fullName = `${user.first_name} ${user.last_name}`.trim().toLowerCase();
      const selfIds = employees
        .filter(e => `${e.first_name} ${e.last_name}`.trim().toLowerCase() === fullName || e.name?.trim().toLowerCase() === fullName)
        .map(e => e.id);
      if (selfIds.includes(appointment.employee_id)) return true;
    }
    return false;
  }, [employees, hasPermission, user]);

  const handleDateClick = useCallback((date) => {
    // UI pre-gate: do not open the create modal without proper permission
    if (!canCreateSchedule()) {
      console.warn('Insufficient permission to create an appointment. Modal will not open.');
      return;
    }
    setEditingAppointment({
      appointment_date: date
    });
    setIsModalOpen(true);
  }, [canCreateSchedule]);

  const handleSubmitAppointment = useCallback(async (appointmentData) => {
    if (editingAppointment && editingAppointment.id) {
      await scheduleAPI.update(editingAppointment.id, appointmentData);
    } else {
      await scheduleAPI.create(appointmentData);
    }
    
    const scheduleResponse = await scheduleAPI.getAll();
    if (scheduleResponse?.data) {
      setAppointments(scheduleResponse.data);
    }
    
    setIsModalOpen(false);
    setEditingAppointment(null);
  }, [editingAppointment, setAppointments]);

  // Drag and drop handlers
  const handleDragStart = useCallback((e, appointment) => {
    setDraggedAppointment(appointment);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', appointment.id);
    
    // Add visual feedback
    e.target.style.opacity = '0.5';
  }, []);

  const handleDragEnd = useCallback((e) => {
    e.target.style.opacity = '1';
    setDraggedAppointment(null);
    setDragOverCell(null);
  }, []);

  const handleDragOver = useCallback((e, targetDate, targetHour = null) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCell({ date: targetDate, hour: targetHour });
  }, []);

  const handleDragLeave = useCallback((e) => {
    // Only clear if we're leaving the calendar area entirely
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverCell(null);
    }
  }, []);

  const handleDrop = useCallback(async (e, targetDate, targetHour = null) => {
    e.preventDefault();
    
    if (!draggedAppointment) return;
    
    const newDate = new Date(targetDate);
    if (targetHour !== null) {
      newDate.setUTCHours(targetHour, 0, 0, 0);
    } else {
      const originalTime = new Date(draggedAppointment.appointment_date);
      newDate.setUTCHours(originalTime.getUTCHours(), originalTime.getUTCMinutes(), 0, 0);
    }
    
    const updatedAppointment = {
      client_id: draggedAppointment.client_id,
      service_id: draggedAppointment.service_id,
      employee_id: draggedAppointment.employee_id,
      appointment_date: newDate.toISOString(),
      status: draggedAppointment.status || 'scheduled',
      notes: draggedAppointment.notes || null
    };
    
    const response = await scheduleAPI.update(draggedAppointment.id, updatedAppointment);
    if (response?.data) {
      const scheduleResponse = await scheduleAPI.getAll();
      if (scheduleResponse?.data) {
        setAppointments(scheduleResponse.data);
      }
    }
    
    setDraggedAppointment(null);
    setDragOverCell(null);
  }, [draggedAppointment, setAppointments]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingAppointment(null);
  }, []);

  const isCurrentMonth = (date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  const getAppointmentsForDate = (date) => {
    const appointmentsForDate = appointments.filter(appointment => {
      const appointmentDate = new Date(appointment.appointment_date);
      return appointmentDate.toDateString() === date.toDateString();
    });
    
    return appointmentsForDate;
  };
 
  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="h-100 d-flex flex-column">
      <PermissionGate page="schedule" permission="read">
        <h4 className="text-center mb-3">
          {currentView === 'day'
            ? currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
            : currentView === 'week'
            ? `Week of ${new Date(currentDate.getTime() - currentDate.getDay() * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
            : currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
          }
        </h4>

        <div className="calendar-container">
          {/* Week day headers */}
          <div className="calendar-header">
            {currentView === 'day' ? (
              <>
                <div className="calendar-header-cell">Time</div>
                <div className="calendar-header-cell">Appointments</div>
              </>
            ) : currentView === 'week' ? (
              <>
                <div className="calendar-header-cell">Time</div>
                {weekDays.map(day => (
                  <div key={day} className="calendar-header-cell">
                    {day}
                  </div>
                ))}
              </>
            ) : (
              weekDays.map(day => (
                <div key={day} className="calendar-header-cell">
                  {day}
                </div>
              ))
            )}
          </div>

          {/* Calendar grid */}
          <div className={`calendar-grid ${currentView === 'week' ? 'week-view' : currentView === 'day' ? 'day-view' : ''}`}>
            {currentView === 'week' ? (
              // Week view with time slots
              getTimeSlots().map(hour => (
                <React.Fragment key={hour}>
                  <div className="time-slot-cell">
                    {hour.toString().padStart(2, '0')}:00
                  </div>
                  {days.map((date, dayIndex) => {
                    const appointmentsForTimeSlot = getAppointmentsForDate(date).filter(appointment => {
                      const appointmentTime = new Date(appointment.appointment_date);
                      return appointmentTime.getHours() === hour;
                    });
                    
                    return (
                      <div
                        key={`${hour}-${dayIndex}`}
                        className={`calendar-cell time-slot border ${dragOverCell?.date?.toDateString() === date.toDateString() && dragOverCell?.hour === hour ? 'drag-over' : ''}`}
                        onClick={() => {
                          const slotDate = new Date(date);
                          slotDate.setHours(hour, 0, 0, 0);
                          handleDateClick(slotDate);
                        }}
                        onDragOver={(e) => handleDragOver(e, date, hour)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, date, hour)}
                      >
                        {appointmentsForTimeSlot.map(appointment => {
                          const client = clients.find(c => c.id === appointment.client_id);
                          const clientName = client ? client.name : 'Unknown Client';
                          const service = services.find(s => s.id === appointment.service_id);
                          const serviceName = service ? service.name : 'Unknown Service';
                          const appointmentTime = new Date(appointment.appointment_date);
                          const timeString = appointmentTime.toLocaleTimeString('en-US', { 
                            hour: '2-digit', 
                            minute: '2-digit',
                            hour12: false 
                          });
                          
                          return (
                            <div 
                              key={appointment.id} 
                              className="appointment-dot" 
                              title={`${clientName} - ${serviceName} at ${timeString}`}
                              draggable={true}
                              onDragStart={(e) => handleDragStart(e, appointment)}
                              onDragEnd={handleDragEnd}
                              onClick={(e) => {
                                e.stopPropagation();
                                // Page-level permission gating for editing
                                if (!canEditAppointment(appointment)) return;
                                setEditingAppointment(appointment);
                                setIsModalOpen(true);
                              }}
                            >
                              <div className="appointment-time">{timeString}</div>
                              <div className="appointment-client">{clientName}</div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))
            ) : currentView === 'day' ? (
              // Day view with time slots
              getTimeSlots().map(hour => {
                const appointmentsForTimeSlot = getAppointmentsForDate(days[0]).filter(appointment => {
                  const appointmentTime = new Date(appointment.appointment_date);
                  return appointmentTime.getHours() === hour;
                });
                
                return (
                  <React.Fragment key={hour}>
                    <div className="time-slot-cell">
                      {hour.toString().padStart(2, '0')}:00
                    </div>
                    <div
                      className={`calendar-cell time-slot border ${dragOverCell?.date?.toDateString() === days[0].toDateString() && dragOverCell?.hour === hour ? 'drag-over' : ''}`}
                      onClick={() => {
                        const slotDate = new Date(days[0]);
                        slotDate.setHours(hour, 0, 0, 0);
                        handleDateClick(slotDate);
                      }}
                      onDragOver={(e) => handleDragOver(e, days[0], hour)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, days[0], hour)}
                    >
                      {appointmentsForTimeSlot.map(appointment => {
                        const client = clients.find(c => c.id === appointment.client_id);
                        const clientName = client ? client.name : 'Unknown Client';
                        const service = services.find(s => s.id === appointment.service_id);
                        const serviceName = service ? service.name : 'Unknown Service';
                        const appointmentTime = new Date(appointment.appointment_date);
                        const timeString = appointmentTime.toLocaleTimeString('en-US', { 
                          hour: '2-digit', 
                          minute: '2-digit',
                          hour12: false 
                        });
                        
                        return (
                          <div 
                            key={appointment.id} 
                            className="appointment-dot" 
                            title={`${clientName} - ${serviceName} at ${timeString}`}
                            draggable={true}
                            onDragStart={(e) => handleDragStart(e, appointment)}
                            onDragEnd={handleDragEnd}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!canEditAppointment(appointment)) return;
                              setEditingAppointment(appointment);
                              setIsModalOpen(true);
                            }}
                          >
                            <div className="appointment-time">{timeString}</div>
                            <div className="appointment-client">{clientName}</div>
                          </div>
                        );
                      })}
                    </div>
                  </React.Fragment>
                );
              })
            ) : (
              // Month view
              days.map((date, index) => {
                const appointmentsForDate = getAppointmentsForDate(date);
                const isToday = date.toDateString() === new Date().toDateString();
                
                return (
                  <div
                    key={index}
                    className={`calendar-cell border ${!isCurrentMonth(date) ? 'other-month' : ''} ${isToday ? 'today' : ''} ${dragOverCell?.date?.toDateString() === date.toDateString() ? 'drag-over' : ''}`}
                    onClick={() => handleDateClick(date)}
                    onDragOver={(e) => handleDragOver(e, date)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, date)}
                  >
                    <div className="date-number">{date.getDate()}</div>
                    {appointmentsForDate.length > 0 && (
                      <div className="appointments">
                        {appointmentsForDate.slice(0, 2).map(appointment => {
                          // Get client name
                          const client = clients.find(c => c.id === appointment.client_id);
                          const clientName = client ? client.name : 'Unknown Client';
                          
                          // Get service name
                          const service = services.find(s => s.id === appointment.service_id);
                          const serviceName = service ? service.name : 'Unknown Service';
                          
                          // Get time
                          const appointmentTime = new Date(appointment.appointment_date);
                          const timeString = appointmentTime.toLocaleTimeString('en-US', { 
                            hour: '2-digit', 
                            minute: '2-digit',
                            hour12: false 
                          });
                          
                          return (
                            <div 
                              key={appointment.id} 
                              className="appointment-dot" 
                              title={`${clientName} - ${serviceName} at ${timeString}`}
                              draggable={true}
                              onDragStart={(e) => handleDragStart(e, appointment)}
                              onDragEnd={handleDragEnd}
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent date click
                                if (!canEditAppointment(appointment)) return;
                                setEditingAppointment(appointment);
                                setIsModalOpen(true);
                              }}
                            >
                              <div className="appointment-time">{timeString}</div>
                              <div className="appointment-client">{clientName}</div>
                            </div>
                          );
                        })}
                        {appointmentsForDate.length > 2 && (
                          <div className="more-appointments">+{appointmentsForDate.length - 2}</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="d-flex justify-content-between align-items-center mt-3 p-2 border-top">
          <div className="d-flex gap-1">
            <button
              type="button"
              onClick={() => setCurrentView('month')}
              className={`btn btn-sm ${currentView === 'month' ? 'btn-primary' : 'btn-outline-secondary'}`}
            >
              Month
            </button>
            <button
              type="button"
              onClick={() => setCurrentView('week')}
              className={`btn btn-sm ${currentView === 'week' ? 'btn-primary' : 'btn-outline-secondary'}`}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => setCurrentView('day')}
              className={`btn btn-sm ${currentView === 'day' ? 'btn-primary' : 'btn-outline-secondary'}`}
            >
              Day
            </button>
<button
              type="button"
              onClick={() => setCurrentDate(new Date())}
              className="btn btn-outline-secondary btn-sm"
            >
              Today
            </button>
               <button
              type="button"
              onClick={() => {
                const newDate = new Date(currentDate);
                if (currentView === 'day') {
                  newDate.setDate(newDate.getDate() - 1);
                } else if (currentView === 'week') {
                  newDate.setDate(newDate.getDate() - 7);
                } else {
                  newDate.setMonth(newDate.getMonth() - 1);
                }
                setCurrentDate(newDate);
              }}
              className="btn btn-outline-secondary btn-sm"
            >
             ◀️
            </button>
            
            <button
              type="button"
              onClick={async () => {
                const scheduleResponse = await scheduleAPI.getAll();
                if (scheduleResponse?.data) {
                  setAppointments(scheduleResponse.data);
                }
              }}
              className="btn btn-outline-secondary btn-sm"
            >
🔄            </button>
            <button
              type="button"
              onClick={() => {
                const newDate = new Date(currentDate);
                if (currentView === 'day') {
                  newDate.setDate(newDate.getDate() + 1);
                } else if (currentView === 'week') {
                  newDate.setDate(newDate.getDate() + 7);
                } else {
                  newDate.setMonth(newDate.getMonth() + 1);
                }
                setCurrentDate(newDate);
              }}
              className="btn btn-outline-secondary btn-sm"
            >
             ▶️
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

      <style>{`
        .calendar-container {
          background: ${isDarkMode ? '#2d3748' : 'white'};
          width: 100%;
          height: calc(100vh - 200px);
          display: flex;
          flex-direction: column;
          overflow: auto;
        }
        
        .calendar-header {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          background: ${isDarkMode ? '#4a5568' : '#f8f9fa'};
        }
        
        .calendar-header-cell {
          text-align: center;
          font-weight: 600;
          color: ${isDarkMode ? '#e2e8f0' : '#495057'};
        }
        
        .calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          flex: 1;
          overflow: auto;
        }
        
        .calendar-grid.week-view {
          grid-template-columns: 60px repeat(7, 1fr);
          flex: 1;
          overflow: auto;
        }
        
        .calendar-grid.week-view .time-slot-cell {
          grid-column: 1;
        }
        
        .calendar-grid.week-view .calendar-cell {
          grid-column: auto;
        }
        
        .calendar-grid.day-view {
          grid-template-columns: 60px 1fr;
          flex: 1;
          overflow: auto;
        }
        
        .time-slot-cell {
          background: ${isDarkMode ? '#4a5568' : '#f8f9fa'};
          color: ${isDarkMode ? '#e2e8f0' : '#495057'};
          font-size: 12px;
          font-weight: 600;
          text-align: center;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid ${isDarkMode ? '#6b7280' : '#dee2e6'};
        }
        
        .time-slot {
          min-height: 60px;
        }
        
        .calendar-cell {
          min-height: 100px;
          cursor: pointer;
          position: relative;
          background: ${isDarkMode ? '#2d3748' : 'white'};
          color: ${isDarkMode ? '#e2e8f0' : 'inherit'};
        }
        
        .calendar-cell:hover {
          background-color: ${isDarkMode ? '#4a5568' : '#f8f9fa'};
        }
        

        
        .other-month {
          background-color: ${isDarkMode ? '#1a202c' : '#f8f9fa'};
          color: ${isDarkMode ? '#718096' : '#6c757d'};
        }
        
        .today {
          background-color: #e3f2fd;
          font-weight: bold;
        }
        
        .date-number {
          font-size: 14px;
          font-weight: 500;
          margin-bottom: 4px;
        }
        
        .appointments {
          margin-top: 4px;
        }
        
        .appointment-dot {
          background: #007bff;
          color: white;
          padding: 4px 6px;
          border-radius: 8px;
          font-size: 10px;
          margin-bottom: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .appointment-dot:hover {
          background: #0056b3;
        }
        
        .drag-over {
          background-color: ${isDarkMode ? '#4a5568' : '#e3f2fd'} !important;
          border: 2px dashed ${isDarkMode ? '#90cdf4' : '#2196f3'} !important;
        }
        
        .appointment-time {
          font-weight: bold;
          font-size: 9px;
        }
        
        .appointment-client {
          font-size: 9px;
          opacity: 0.9;
        }
        
                 .more-appointments {
           color: #6c757d;
           font-size: 11px;
           text-align: center;
         }
         
         .navigation-buttons {
           margin-bottom: 50px;
         }
       `}</style>
    </div>
  );
}
