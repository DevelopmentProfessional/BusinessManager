import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import useStore from '../services/useStore';
import { scheduleAPI, settingsAPI, isudAPI } from '../services/api';
import Modal from './components/Modal';
import ScheduleForm from './components/ScheduleForm';
import PermissionGate from './components/PermissionGate';
import AttendanceWidget from './components/AttendanceWidget';
import useDarkMode from '../services/useDarkMode';

export default function Schedule() {
  const { appointments, clients, services, employees, loading, setAppointments, hasPermission, isAuthenticated, user } = useStore();
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  // Use the permission refresh hook

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
  const [saveError, setSaveError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const hasFetched = useRef(false);
  const calendarGridRef = useRef(null);

  // Update clock every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute
    
    return () => clearInterval(timer);
  }, []);

  // Schedule settings state
  const [scheduleSettings, setScheduleSettings] = useState({
    start_of_day: '06:00',
    end_of_day: '21:00',
    attendance_check_in_required: true,
    monday_enabled: true,
    tuesday_enabled: true,
    wednesday_enabled: true,
    thursday_enabled: true,
    friday_enabled: true,
    saturday_enabled: true,
    sunday_enabled: true
  });

  // Load ONLY schedule data on mount - services, employees, clients loaded on-demand in ScheduleForm
  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    const loadSchedule = async () => {
      // Check if user is authenticated before making API calls
      if (!isAuthenticated()) {
        console.error('User not authenticated - skipping data load');
        return;
      }

      try {
        // Load schedule settings
        const settingsResponse = await settingsAPI.getScheduleSettings();
        if (settingsResponse?.data) {
          setScheduleSettings({
            start_of_day: settingsResponse.data.start_of_day || '06:00',
            end_of_day: settingsResponse.data.end_of_day || '21:00',
            attendance_check_in_required: settingsResponse.data.attendance_check_in_required ?? true,
            monday_enabled: settingsResponse.data.monday_enabled ?? true,
            tuesday_enabled: settingsResponse.data.tuesday_enabled ?? true,
            wednesday_enabled: settingsResponse.data.wednesday_enabled ?? true,
            thursday_enabled: settingsResponse.data.thursday_enabled ?? true,
            friday_enabled: settingsResponse.data.friday_enabled ?? true,
            saturday_enabled: settingsResponse.data.saturday_enabled ?? true,
            sunday_enabled: settingsResponse.data.sunday_enabled ?? true
          });
        }

        // Only load schedule/appointments - other data loads on-demand in form
        const scheduleResponse = await scheduleAPI.getAll();
        const scheduleData = scheduleResponse?.data ?? scheduleResponse;
        if (Array.isArray(scheduleData)) {
          setAppointments(scheduleData);
        } else {
          console.error('Invalid schedule data format:', scheduleData);
        }
      } catch (error) {
        console.error('Error loading schedule:', error);
        if (error.response?.status === 401 || error.response?.status === 403) {
          console.error('Authentication required');
        }
      }
    };

    loadSchedule();
  }, [setAppointments, isAuthenticated]);

  // Get calendar data based on current view
  // Helper to check if a day is enabled based on settings
  const isDayEnabled = (date) => {
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const dayMap = [
      'sunday_enabled',    // 0
      'monday_enabled',    // 1
      'tuesday_enabled',   // 2
      'wednesday_enabled', // 3
      'thursday_enabled',  // 4
      'friday_enabled',    // 5
      'saturday_enabled'   // 6
    ];
    return scheduleSettings[dayMap[dayOfWeek]];
  };

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
        // Only include enabled days
        if (isDayEnabled(day)) {
          days.push(day);
        }
      }
      return days;
    } else {
      // Month view - show only enabled days in a grid
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      
      // Get all enabled days of the week
      const enabledDays = [];
      for (let i = 0; i < 7; i++) {
        const testDate = new Date(2024, 0, i); // Use a reference week
        if (isDayEnabled(testDate)) {
          enabledDays.push(i);
        }
      }
      
      // Find the first occurrence of an enabled day in the month
      let startDate = new Date(firstDay);
      while (!isDayEnabled(startDate) && startDate <= lastDay) {
        startDate.setDate(startDate.getDate() + 1);
      }
      
      // Generate days for the month, only including enabled days
      const days = [];
      const currentDateObj = new Date(startDate);
      
      // Go back to include days from previous month if needed to fill first week
      const firstEnabledDay = enabledDays[0];
      const startDayOfWeek = startDate.getDay();
      if (startDayOfWeek !== firstEnabledDay) {
        // Calculate how many days back we need to go
        let daysBack = 0;
        let checkDay = startDayOfWeek;
        while (checkDay !== firstEnabledDay) {
          checkDay = (checkDay - 1 + 7) % 7;
          daysBack++;
          if (daysBack > 7) break; // Safety check
        }
        currentDateObj.setDate(currentDateObj.getDate() - daysBack);
      }
      
      // Generate up to 6 weeks of enabled days
      const maxDays = enabledDays.length * 6;
      while (days.length < maxDays) {
        const dayToAdd = new Date(currentDateObj);
        if (isDayEnabled(dayToAdd)) {
          days.push(dayToAdd);
        }
        currentDateObj.setDate(currentDateObj.getDate() + 1);
        
        // Stop if we've gone too far past the current month
        if (currentDateObj.getMonth() > month + 1 || 
            (currentDateObj.getMonth() === month + 1 && currentDateObj.getDate() > 7)) {
          break;
        }
      }
      
      return days;
    }
  };

  // Get time slots for week and day views (based on settings)
  const getTimeSlots = () => {
    const timeSlots = [];
    const startHour = parseInt(scheduleSettings.start_of_day.split(':')[0], 10) || 6;
    const endHour = parseInt(scheduleSettings.end_of_day.split(':')[0], 10) || 21;
    for (let hour = startHour; hour <= endHour; hour++) {
      timeSlots.push(hour);
    }
    return timeSlots;
  };

  const days = getCalendarDays();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  // Calculate number of columns for dynamic grid layout
  // Use minmax(0, 1fr) so columns share width equally and don't size to content
  const numEnabledDays = currentView === 'week' || currentView === 'month' 
    ? days.slice(0, 7).length 
    : 7;
  const gridColumns = currentView === 'week' 
    ? `60px repeat(${numEnabledDays}, minmax(0, 1fr))` 
    : currentView === 'day'
      ? '60px minmax(0, 1fr)'
      : `repeat(${numEnabledDays}, minmax(0, 1fr))`;

  // Auto-scroll to current time when switching to day or week view
  useEffect(() => {
    if ((currentView === 'day' || currentView === 'week') && calendarGridRef.current) {
      const currentHour = new Date().getHours();
      const startHour = parseInt(scheduleSettings.start_of_day.split(':')[0], 10) || 6;
      const endHour = parseInt(scheduleSettings.end_of_day.split(':')[0], 10) || 21;
      
      // Only scroll if current hour is within the displayed range
      if (currentHour >= startHour && currentHour <= endHour) {
        // Small delay to ensure the grid is rendered
        setTimeout(() => {
          const timeSlotElement = calendarGridRef.current?.querySelector(`[data-hour="${currentHour}"]`);
          if (timeSlotElement) {
            timeSlotElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 100);
      }
    }
  }, [currentView, scheduleSettings.start_of_day, scheduleSettings.end_of_day]);

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

  // Helper to refresh schedule data (uses cache deduplication)
  const refreshSchedules = useCallback(async () => {
    try {
      const scheduleResponse = await scheduleAPI.getAll();
      const scheduleData = scheduleResponse?.data ?? scheduleResponse;
      if (Array.isArray(scheduleData)) {
        setAppointments(scheduleData);
      }
    } catch (err) {
      console.error('Failed to refresh schedules:', err);
    }
  }, [setAppointments]);

  const normalizeIds = useCallback((value) => {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (!value) return [];
    return [value];
  }, []);

  const syncScheduleAttendees = useCallback(async (scheduleId, employeeIds, clientIds, primaryEmployeeId, primaryClientId) => {
    if (!scheduleId) return;

    try {
      const existingResponse = await isudAPI.scheduleAttendees.getBySchedule(scheduleId);
      const existing = existingResponse?.data ?? existingResponse;
      if (Array.isArray(existing) && existing.length > 0) {
        await Promise.all(existing.map(attendee => isudAPI.scheduleAttendees.delete(attendee.id)));
      }

      const dedupe = (ids) => Array.from(new Set(ids));
      const employeeAttendees = dedupe(employeeIds).filter((id) => id && id !== primaryEmployeeId);
      const clientAttendees = dedupe(clientIds).filter((id) => id && id !== primaryClientId);

      const createRequests = [
        ...employeeAttendees.map((userId) => isudAPI.scheduleAttendees.create({
          schedule_id: scheduleId,
          user_id: userId,
        })),
        ...clientAttendees.map((clientId) => isudAPI.scheduleAttendees.create({
          schedule_id: scheduleId,
          client_id: clientId,
        })),
      ];

      if (createRequests.length > 0) {
        await Promise.all(createRequests);
      }
    } catch (err) {
      console.error('Failed to sync schedule attendees:', err);
    }
  }, []);

  const deleteScheduleAttendees = useCallback(async (scheduleId) => {
    if (!scheduleId) return;
    try {
      const existingResponse = await isudAPI.scheduleAttendees.getBySchedule(scheduleId);
      const existing = existingResponse?.data ?? existingResponse;
      if (Array.isArray(existing) && existing.length > 0) {
        await Promise.all(existing.map(attendee => isudAPI.scheduleAttendees.delete(attendee.id)));
      }
    } catch (err) {
      console.error('Failed to delete schedule attendees:', err);
    }
  }, []);

  const handleSubmitAppointment = useCallback(async (appointmentData) => {
    setIsSaving(true);
    setSaveError(null);
    
    try {
      const employeeIds = normalizeIds(appointmentData.employee_ids ?? appointmentData.employee_id);
      const clientIds = normalizeIds(appointmentData.client_ids ?? appointmentData.client_id);
      const primaryEmployeeId = employeeIds[0] || appointmentData.employee_id;
      const primaryClientId = clientIds[0] || appointmentData.client_id;

      const schedulePayload = {
        ...appointmentData,
        employee_id: primaryEmployeeId,
        client_id: primaryClientId,
        status: appointmentData.status || editingAppointment?.status || 'scheduled'
      };
      delete schedulePayload.employee_ids;
      delete schedulePayload.client_ids;

      let savedRecord;
      if (editingAppointment && editingAppointment.id) {
        const response = await scheduleAPI.update(editingAppointment.id, schedulePayload);
        savedRecord = response?.data ?? response;
      } else {
        const response = await scheduleAPI.create(schedulePayload);
        savedRecord = response?.data ?? response;
      }

      const scheduleId = savedRecord?.id || editingAppointment?.id;
      await syncScheduleAttendees(scheduleId, employeeIds, clientIds, primaryEmployeeId, primaryClientId);

      // Refresh schedules - cache will prevent duplicate calls if already in flight
      await refreshSchedules();
      
      setIsModalOpen(false);
      setEditingAppointment(null);
      setSaveError(null);
    } catch (error) {
      console.error('Error saving appointment:', error);
      setSaveError(error.response?.data?.detail || error.message || 'Failed to save appointment. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [editingAppointment, normalizeIds, refreshSchedules, syncScheduleAttendees]);

  const handleDeleteAppointment = useCallback(async () => {
    if (!editingAppointment?.id) return;
    const scheduleId = editingAppointment.id;
    await deleteScheduleAttendees(scheduleId);
    await scheduleAPI.delete(scheduleId);
    await refreshSchedules();
    setIsModalOpen(false);
    setEditingAppointment(null);
  }, [deleteScheduleAttendees, editingAppointment, refreshSchedules]);
>>>>>>> fd42e7720f92de848e36fdf0c01414e7e474469b

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
    
    await scheduleAPI.update(draggedAppointment.id, updatedAppointment);
    // Refresh schedules - cache will prevent duplicate calls if already in flight
    await refreshSchedules();
    
    setDraggedAppointment(null);
    setDragOverCell(null);
  }, [draggedAppointment, setAppointments]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingAppointment(null);
    setSaveError(null);
    setIsSaving(false);
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
    <div className="schedule-page h-100 d-flex flex-column">
      <PermissionGate page="schedule" permission="read">
        {/* Attendance Widget - Clock In/Out (conditionally rendered based on settings) */}
        {scheduleSettings.attendance_check_in_required && (
          <div className="mb-3 px-2">
            <AttendanceWidget compact={true} />
          </div>
        )}

        {/* Header with clock */}
        <div className="schedule-header-bar d-flex justify-content-between align-items-center px-3 mb-2">
          <div className="schedule-clock">
            <span className="clock-time">{currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
            <span className="clock-date">{currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
          </div>
          <h4 className="text-center mb-0">
            {currentView === 'day'
              ? currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
              : currentView === 'week'
              ? `Week of ${new Date(currentDate.getTime() - currentDate.getDay() * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
              : currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
            }
          </h4>
          <div style={{ width: '100px' }}></div> {/* Spacer for balance */}
        </div>

        <div className="schedule-body">
          <div className="calendar-container" style={{ '--schedule-grid-cols': gridColumns }}>
          {/* Week day headers - same column template as grid so widths match */}
          <div className="calendar-header schedule-header" style={{ gridTemplateColumns: gridColumns }}>
            {currentView === 'day' ? (
              <>
                <div className="calendar-header-cell">Time</div>
                <div className="calendar-header-cell">Appointments</div>
              </>
            ) : currentView === 'week' ? (
              <>
                <div className="calendar-header-cell">Time</div>
                {days.map((date, index) => {
                  const isToday = date.toDateString() === new Date().toDateString();
                  return (
                    <div 
                      key={index} 
                      className={`calendar-header-cell ${isToday ? 'today-header' : ''}`}
                    >
                      <div className="day-name">{weekDays[date.getDay()]}</div>
                      <div className={`day-date ${isToday ? 'today-badge' : ''}`}>{date.getDate()}</div>
                    </div>
                  );
                })}
              </>
            ) : (
              // Month view headers - only show enabled days
              days.slice(0, 7).map((date, index) => {
                const dayName = weekDays[date.getDay()];
                return (
                  <div key={index} className="calendar-header-cell">
                    {dayName}
                  </div>
                );
              })
            )}
          </div>

          {/* Calendar grid */}
          <div 
            ref={calendarGridRef}
            className={`calendar-grid ${currentView === 'week' ? 'week-view' : currentView === 'day' ? 'day-view' : ''}`}
            style={{ gridTemplateColumns: gridColumns }}
          >
            {currentView === 'week' ? (
              // Week view with time slots
              getTimeSlots().map(hour => (
                <React.Fragment key={hour}>
                  <div className="calendar-cell time-slot time-label-cell" data-hour={hour}>
                    {hour.toString().padStart(2, '0')}:00
                  </div>
                  {days.map((date, dayIndex) => {
                    const appointmentsForTimeSlot = getAppointmentsForDate(date).filter(appointment => {
                      const appointmentTime = new Date(appointment.appointment_date);
                      return appointmentTime.getHours() === hour;
                    });
                    const isToday = date.toDateString() === new Date().toDateString();
                    const isCurrentHour = currentTime.getHours() === hour && isToday;
                    const currentMinutePercent = (currentTime.getMinutes() / 60) * 100;
                    
                    return (
                      <div
                        key={`${hour}-${dayIndex}`}
                        className={`calendar-cell time-slot ${isToday ? 'today-column' : ''} ${dragOverCell?.date?.toDateString() === date.toDateString() && dragOverCell?.hour === hour ? 'drag-over' : ''}`}
                        style={{ position: 'relative' }}
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
                              <div className="appointment-service">{serviceName}</div>
                            </div>
                          );
                        })}
                        {/* Current time indicator line */}
                        {isCurrentHour && (
                          <div 
                            className="current-time-indicator"
                            style={{ top: `${currentMinutePercent}%` }}
                          >
                            <div className="current-time-dot"></div>
                            <div className="current-time-line"></div>
                          </div>
                        )}
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
                const isCurrentHour = currentTime.getHours() === hour && days[0].toDateString() === new Date().toDateString();
                const currentMinutePercent = (currentTime.getMinutes() / 60) * 100;
                
                return (
                  <React.Fragment key={hour}>
                    <div className="calendar-cell time-slot time-label-cell" data-hour={hour}>
                      {hour.toString().padStart(2, '0')}:00
                    </div>
                    <div
                      className={`calendar-cell time-slot ${dragOverCell?.date?.toDateString() === days[0].toDateString() && dragOverCell?.hour === hour ? 'drag-over' : ''}`}
                      style={{ position: 'relative' }}
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
                            <div className="appointment-service">{serviceName}</div>
                          </div>
                        );
                      })}
                      {/* Current time indicator line */}
                      {isCurrentHour && (
                        <div 
                          className="current-time-indicator"
                          style={{ top: `${currentMinutePercent}%` }}
                        >
                          <div className="current-time-dot"></div>
                          <div className="current-time-line"></div>
                        </div>
                      )}
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
                    className={`calendar-cell ${!isCurrentMonth(date) ? 'other-month' : ''} ${isToday ? 'today' : ''} ${dragOverCell?.date?.toDateString() === date.toDateString() ? 'drag-over' : ''}`}
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
                              <div className="appointment-service">{serviceName}</div>
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
        </div>

        <div className="schedule-footer px-2 py-1 border-top">
          {/* Row 1: Month, Week, Previous, Next */}
          <div className="d-flex gap-1 mb-1">
            {/* Month View - Calendar Grid Icon */}
            <button
              type="button"
              onClick={() => setCurrentView('month')}
              className={`btn btn-sm ${currentView === 'month' ? 'btn-primary' : 'btn-outline-secondary'}`}
              style={{ width: '36px', height: '36px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Month View"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5M2 2a1 1 0 0 0-1 1v1h14V3a1 1 0 0 0-1-1zm13 3H1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1z"/>
                <path d="M2.5 7a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m4 0a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1H7a.5.5 0 0 1-.5-.5m4 0a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5M2.5 9a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m4 0a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1H7a.5.5 0 0 1-.5-.5m4 0a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5M2.5 11a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m4 0a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1H7a.5.5 0 0 1-.5-.5m4 0a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5"/>
              </svg>
            </button>
            {/* Week View - Calendar Week Icon */}
            <button
              type="button"
              onClick={() => setCurrentView('week')}
              className={`btn btn-sm ${currentView === 'week' ? 'btn-primary' : 'btn-outline-secondary'}`}
              style={{ width: '36px', height: '36px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Week View"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M11 6.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5zm-3 0a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5zm-5 3a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5zm3 0a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5z"/>
                <path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5M1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4z"/>
              </svg>
            </button>
            {/* Previous */}
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
              className="btn btn-sm btn-outline-secondary"
              style={{ width: '36px', height: '36px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Previous"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path fillRule="evenodd" d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0"/>
              </svg>
            </button>
            {/* Next */}
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
              className="btn btn-sm btn-outline-secondary"
              style={{ width: '36px', height: '36px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Next"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path fillRule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708"/>
              </svg>
            </button>
          </div>
          {/* Row 2: Day, Today */}
          <div className="d-flex gap-1">
            {/* Day View - Single Day Icon */}
            <button
              type="button"
              onClick={() => setCurrentView('day')}
              className={`btn btn-sm ${currentView === 'day' ? 'btn-primary' : 'btn-outline-secondary'}`}
              style={{ width: '36px', height: '36px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Day View"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M4 .5a.5.5 0 0 0-1 0V1H2a2 2 0 0 0-2 2v1h16V3a2 2 0 0 0-2-2h-1V.5a.5.5 0 0 0-1 0V1H4zM16 14V5H0v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2M8.5 8.5V10H10a.5.5 0 0 1 0 1H8.5v1.5a.5.5 0 0 1-1 0V11H6a.5.5 0 0 1 0-1h1.5V8.5a.5.5 0 0 1 1 0"/>
              </svg>
            </button>
            {/* Today - Calendar with day number */}
            <button
              type="button"
              onClick={() => setCurrentDate(new Date())}
              className="btn btn-sm btn-outline-secondary"
              style={{ width: '36px', height: '36px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Today"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5M1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4z"/>
                <text x="8" y="12" textAnchor="middle" fontSize="8" fontWeight="bold">{new Date().getDate()}</text>
              </svg>
            </button>
          </div>
        </div>

        <Modal isOpen={isModalOpen} onClose={closeModal}>
          <ScheduleForm
            appointment={editingAppointment}
            onSubmit={handleSubmitAppointment}
            onCancel={closeModal}
            saveError={saveError}
            isSaving={isSaving}
            onDelete={handleDeleteAppointment}
          />
        </Modal>
      </PermissionGate>

      <style>{`
        /* Schedule Clock */
        .schedule-page {
          min-height: 100vh;
          height: 100vh;
          min-height: 100dvh;
          height: 100dvh;
          overflow: hidden;
        }

        .schedule-header-bar,
        .schedule-footer {
          flex-shrink: 0;
        }

        .schedule-footer {
          margin-top: auto;
        }

        .schedule-body {
          flex: 1;
          min-height: 0;
          overflow: auto;
          display: flex;
        }

        .schedule-clock {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          min-width: 100px;
        }
        
        .clock-time {
          font-size: 24px;
          font-weight: 700;
          color: ${isDarkMode ? '#60a5fa' : '#2563eb'};
          line-height: 1.1;
        }
        
        .clock-date {
          font-size: 12px;
          color: ${isDarkMode ? '#9ca3af' : '#6b7280'};
        }
        
        /* Current Time Indicator */
        .current-time-indicator {
          position: absolute;
          left: 0;
          right: 0;
          display: flex;
          align-items: center;
          z-index: 5;
          pointer-events: none;
        }
        
        .current-time-dot {
          width: 10px;
          height: 10px;
          background-color: #ef4444;
          border-radius: 50%;
          margin-left: -5px;
          box-shadow: 0 0 4px rgba(239, 68, 68, 0.5);
        }
        
        .current-time-line {
          flex: 1;
          height: 2px;
          background-color: #ef4444;
          box-shadow: 0 0 4px rgba(239, 68, 68, 0.3);
        }
        
        .calendar-container {
          background: ${isDarkMode ? '#2d3748' : 'white'};
          width: 100%;
          min-width: 0;
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          overflow: visible;
        }
        
        .calendar-header {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          background: ${isDarkMode ? '#4a5568' : '#f8f9fa'};
          gap: 0;
          min-width: 0;
          flex-shrink: 0;
        }
        
        .calendar-header-cell {
          text-align: center;
          font-weight: 600;
          color: ${isDarkMode ? '#e2e8f0' : '#495057'};
          padding: 8px 4px;
          border: 1px solid ${isDarkMode ? '#6b7280' : '#dee2e6'};
          border-right: none;
          min-width: 0;
          overflow: hidden;
        }
        
        .calendar-header-cell:last-child {
          border-right: 1px solid ${isDarkMode ? '#6b7280' : '#dee2e6'};
        }
        
        .calendar-header-cell .day-name {
          font-size: 12px;
          font-weight: 500;
        }
        
        .calendar-header-cell .day-date {
          font-size: 14px;
          font-weight: 600;
        }
        
        .calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          flex: 1;
          overflow: hidden;
          gap: 0;
          min-width: 0;
          min-height: 0;
          height: 100%;
        }

        .calendar-grid:not(.week-view):not(.day-view) {
          grid-auto-rows: minmax(0, 1fr);
        }

        .calendar-grid.week-view {
          grid-template-columns: 60px repeat(7, minmax(0, 1fr));
          flex: 1;
          overflow: hidden;
          gap: 2px;
          background: ${isDarkMode ? '#6b7280' : '#dee2e6'};
          padding: 2px;
          min-width: 0;
          min-height: 0;
          grid-auto-rows: 60px;
        }

        .calendar-grid.week-view .time-label-cell {
          grid-column: 1;
        }
        .calendar-grid.week-view .calendar-cell:not(.time-label-cell) {
          grid-column: auto;
        }

        .calendar-grid.day-view {
          grid-template-columns: 60px 1fr;
          flex: 1;
          overflow: hidden;
          gap: 0;
          min-height: 0;
          grid-auto-rows: 60px;
        }

        .calendar-cell.time-label-cell {
          background: ${isDarkMode ? '#4a5568' : '#f8f9fa'};
          color: ${isDarkMode ? '#e2e8f0' : '#495057'};
          font-size: 12px;
          font-weight: 600;
          text-align: center;
          display: flex;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
          min-width: 0;
          height: 100%;
        }

        .calendar-cell {
          min-height: 0;
          min-width: 0;
          cursor: pointer;
          position: relative;
          background: ${isDarkMode ? '#2d3748' : 'white'};
          color: ${isDarkMode ? '#e2e8f0' : 'inherit'};
          box-sizing: border-box;
          text-align: center;
          padding: 1px;
          overflow: auto;
          border: 1px solid ${isDarkMode ? '#6b7280' : '#dee2e6'};
          height: 100%;
        }

        .calendar-cell.time-slot {
          box-sizing: border-box;
          height: 100%;
        }
        
        .calendar-cell:hover {
          background-color: ${isDarkMode ? '#4a5568' : '#f8f9fa'};
        }
        

        
        .other-month {
          background-color: ${isDarkMode ? '#1a202c' : '#f8f9fa'};
          color: ${isDarkMode ? '#718096' : '#6c757d'};
        }
        
        .today {
          background-color: ${isDarkMode ? '#1e3a5f' : '#e3f2fd'} !important;
          font-weight: bold;
        }
        
        .today .date-number {
          background-color: ${isDarkMode ? '#2563eb' : '#2196f3'};
          color: white;
          border-radius: 50%;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 2px auto 4px auto;
        }
        
        .today-header {
          background-color: ${isDarkMode ? '#2563eb' : '#2196f3'} !important;
          color: white !important;
        }
        
        .today-header .day-name {
          font-size: 11px;
          opacity: 0.9;
        }
        
        .today-header .day-date {
          font-size: 16px;
          font-weight: bold;
        }
        
        .day-date.today-badge {
          background-color: white;
          color: ${isDarkMode ? '#2563eb' : '#2196f3'};
          border-radius: 50%;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 2px auto 0;
        }
        
        .today-column {
          background-color: ${isDarkMode ? '#1e3a5f' : '#e3f2fd'} !important;
        }
        
        .today-column:hover {
          background-color: ${isDarkMode ? '#2d4a6f' : '#bbdefb'} !important;
        }
        
        .date-number {
          font-size: 14px;
          font-weight: 500;
          margin-bottom: 4px;
          display: block;
          width: 100%;
          box-sizing: border-box;
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
          min-width: 0;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .appointment-dot:hover {
          background: #0056b3;
        }
        
        /* Responsive Styles */
        @media (max-width: 768px) {
          .calendar-header-cell {
            padding: 6px 2px;
            font-size: 11px;
          }
          .calendar-header-cell .day-name {
            font-size: 10px;
          }
          .calendar-header-cell .day-date {
            font-size: 12px;
          }
          .calendar-grid.week-view,
          .calendar-grid.day-view {
            grid-auto-rows: 20px;
          }
          .calendar-cell.time-label-cell {
            font-size: 10px;
            padding: 1px;
          }
          .appointment-dot {
            font-size: 9px;
            padding: 3px 4px;
          }
          .appointment-time {
            font-size: 8px;
          }
          .appointment-client {
            font-size: 9px;
          }
        }
        
        @media (max-width: 480px) {
          .calendar-header-cell {
            padding: 4px 1px;
            font-size: 10px;
          }
          .calendar-header-cell .day-name {
            font-size: 9px;
          }
          .calendar-header-cell .day-date {
            font-size: 11px;
          }
          .calendar-grid.week-view,
          .calendar-grid.day-view {
            grid-auto-rows: 45px;
          }
          .calendar-cell.time-label-cell {
            font-size: 9px;
          }
          .appointment-dot {
            font-size: 8px;
            padding: 2px 3px;
          }
        }
        
        .drag-over {
          background-color: ${isDarkMode ? '#4a5568' : '#e3f2fd'} !important;
          border: 1px dashed ${isDarkMode ? '#90cdf4' : '#2196f3'} !important;
        }
        
        .appointment-time {
          font-weight: bold;
          font-size: 9px;
        }
        
        .appointment-client {
          font-size: 9px;
          opacity: 0.9;
        }
        
        .appointment-service {
          font-size: 8px;
          opacity: 0.8;
          font-style: italic;
          margin-top: 2px;
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
