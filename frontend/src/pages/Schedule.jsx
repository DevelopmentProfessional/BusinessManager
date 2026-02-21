import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import useStore from '../services/useStore';
import { scheduleAPI, settingsAPI, isudAPI, clientsAPI, servicesAPI, employeesAPI, leaveRequestsAPI } from '../services/api';
import Modal from './components/Modal';
import ScheduleForm from './components/ScheduleForm';
import PermissionGate from './components/PermissionGate';
import AttendanceWidget from './components/AttendanceWidget';
import useDarkMode from '../services/useDarkMode';
import ScheduleFilterModal from './components/ScheduleFilterModal';

export default function Schedule() {
  const {
    appointments,
    clients,
    services,
    employees,
    loading,
    setAppointments,
    setClients,
    setServices,
    setEmployees,
    hasPermission,
    isAuthenticated,
    user,
  } = useStore();
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
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [overlapEvents, setOverlapEvents] = useState(null);
  const [filters, setFilters] = useState({
    employeeIds: [],
    clientIds: [],
    serviceIds: [],
    startDate: '',
    endDate: '',
    showOutOfOffice: false,
    oooEmployeeIds: [],
  });
  const [approvedLeaves, setApprovedLeaves] = useState([]);
  const hasFetched = useRef(false);
  const calendarGridRef = useRef(null);
  const calendarContainerRef = useRef(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);
  const lastSwipeTime = useRef(0);
  const MIN_SWIPE_DISTANCE = 50; // Minimum distance to trigger swipe (in pixels)
  const SWIPE_COOLDOWN = 300; // Cooldown period in milliseconds
  const MIN_DATE = new Date(1900, 0, 1); // January 1, 1900
  const MAX_DATE = new Date(2100, 11, 31); // December 31, 2100
  const [swipeOffset, setSwipeOffset] = useState(0); // For visual feedback during swipe

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

  // Load schedule data and supporting lookups
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

        const [scheduleResponse, clientsResponse, servicesResponse, employeesResponse, leavesResponse] = await Promise.all([
          scheduleAPI.getAll(),
          clientsAPI.getAll(),
          servicesAPI.getAll(),
          employeesAPI.getAll(),
          leaveRequestsAPI.getAll(),
        ]);

        const scheduleData = scheduleResponse?.data ?? scheduleResponse;
        if (Array.isArray(scheduleData)) {
          setAppointments(scheduleData);
        } else {
          console.error('Invalid schedule data format:', scheduleData);
        }

        const clientsData = clientsResponse?.data ?? clientsResponse;
        if (Array.isArray(clientsData)) {
          setClients(clientsData);
        }

        const servicesData = servicesResponse?.data ?? servicesResponse;
        if (Array.isArray(servicesData)) {
          setServices(servicesData);
        }

        const employeesData = employeesResponse?.data ?? employeesResponse;
        if (Array.isArray(employeesData)) {
          setEmployees(employeesData);
        }

        const leavesData = leavesResponse?.data ?? leavesResponse;
        if (Array.isArray(leavesData)) {
          setApprovedLeaves(leavesData.filter(l => l.status === 'approved'));
        }
      } catch (error) {
        console.error('Error loading schedule:', error);
        if (error.response?.status === 401 || error.response?.status === 403) {
          console.error('Authentication required');
        }
      }
    };

    loadSchedule();
  }, [setAppointments, setClients, setServices, setEmployees, isAuthenticated]);

  const employeeColorMap = useMemo(() => {
    const entries = employees.map((employee) => [employee.id, employee.color]);
    return new Map(entries);
  }, [employees]);

  const getOutOfOfficeForDate = useCallback((date) => {
    const dateStr = date.toISOString().split('T')[0];
    return approvedLeaves.filter(leave => {
      const start = (leave.start_date || '').split('T')[0];
      const end = (leave.end_date || '').split('T')[0];
      return start && end && dateStr >= start && dateStr <= end;
    });
  }, [approvedLeaves]);

  const filteredAppointments = useMemo(() => {
    const hasEmployeeFilter = filters.employeeIds.length > 0;
    const hasClientFilter = filters.clientIds.length > 0;
    const hasServiceFilter = filters.serviceIds.length > 0;
    const hasStartDate = Boolean(filters.startDate);
    const hasEndDate = Boolean(filters.endDate);

    const startDate = hasStartDate ? new Date(filters.startDate) : null;
    const endDate = hasEndDate ? new Date(filters.endDate) : null;
    if (startDate) {
      startDate.setHours(0, 0, 0, 0);
    }
    if (endDate) {
      endDate.setHours(23, 59, 59, 999);
    }

    return appointments.filter((appointment) => {
      if (hasEmployeeFilter && !filters.employeeIds.includes(appointment.employee_id)) {
        return false;
      }
      if (hasClientFilter && (!appointment.client_id || !filters.clientIds.includes(appointment.client_id))) {
        return false;
      }
      if (hasServiceFilter && (!appointment.service_id || !filters.serviceIds.includes(appointment.service_id))) {
        return false;
      }

      if (startDate || endDate) {
        const appointmentDate = new Date(appointment.appointment_date);
        if (startDate && appointmentDate < startDate) return false;
        if (endDate && appointmentDate > endDate) return false;
      }

      return true;
    });
  }, [appointments, filters]);

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
    ? `max-content repeat(${numEnabledDays}, minmax(0, 1fr))`
    : currentView === 'day'
      ? 'max-content minmax(0, 1fr)'
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
    const employeeIds = normalizeIds(appointmentData.employee_ids ?? appointmentData.employee_id);
    const clientIds = normalizeIds(appointmentData.client_ids ?? appointmentData.client_id);
    const primaryEmployeeId = employeeIds[0] || appointmentData.employee_id;
    const primaryClientId = clientIds[0] || appointmentData.client_id;

    const schedulePayload = {
      employee_id: primaryEmployeeId,
      appointment_date: appointmentData.appointment_date,
      appointment_type: appointmentData.appointment_type || 'one_time',
      duration_minutes: parseInt(appointmentData.duration_minutes) || 60,
      notes: appointmentData.notes || null,
      status: appointmentData.status || 'scheduled',
    };
    if (primaryClientId) schedulePayload.client_id = primaryClientId;
    if (appointmentData.service_id) schedulePayload.service_id = appointmentData.service_id;

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
      notes: draggedAppointment.notes || null,
      appointment_type: draggedAppointment.appointment_type || 'one_time',
      duration_minutes: draggedAppointment.duration_minutes || 60,
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
  }, []);

  // Navigation handlers for swipe gestures with date bounds validation
  const handleNavigatePrevious = useCallback(() => {
    const newDate = new Date(currentDate);
    
    if (currentView === 'day') {
      newDate.setDate(newDate.getDate() - 1);
    } else if (currentView === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      // Month view: navigate to previous month
      const currentDay = newDate.getDate();
      newDate.setMonth(newDate.getMonth() - 1);
      
      // Edge case: If current day doesn't exist in previous month (e.g., March 31 → Feb 31)
      // JavaScript automatically adjusts, but we want to set to last day of that month
      const maxDayInNewMonth = new Date(newDate.getFullYear(), newDate.getMonth() + 1, 0).getDate();
      if (currentDay > maxDayInNewMonth) {
        newDate.setDate(maxDayInNewMonth);
      }
    }
    
    // Validate date bounds
    if (newDate < MIN_DATE) {
      console.warn('Cannot navigate before', MIN_DATE.toLocaleDateString());
      return;
    }
    
    setCurrentDate(newDate);
  }, [currentDate, currentView]);

  const handleNavigateNext = useCallback(() => {
    const newDate = new Date(currentDate);
    
    if (currentView === 'day') {
      newDate.setDate(newDate.getDate() + 1);
    } else if (currentView === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      // Month view: navigate to next month
      const currentDay = newDate.getDate();
      newDate.setMonth(newDate.getMonth() + 1);
      
      // Edge case: If current day doesn't exist in next month (e.g., Jan 31 → Feb 31)
      // JavaScript automatically adjusts, but we want to set to last day of that month
      const maxDayInNewMonth = new Date(newDate.getFullYear(), newDate.getMonth() + 1, 0).getDate();
      if (currentDay > maxDayInNewMonth) {
        newDate.setDate(maxDayInNewMonth);
      }
    }
    
    // Validate date bounds
    if (newDate > MAX_DATE) {
      console.warn('Cannot navigate beyond', MAX_DATE.toLocaleDateString());
      return;
    }
    
    setCurrentDate(newDate);
  }, [currentDate, currentView]);

  // Touch handlers for swipe navigation on mobile with visual feedback
  const handleTouchStart = useCallback((e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
    setSwipeOffset(0);
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!touchStartX.current) return;
    
    const currentX = e.touches[0].clientX;
    const deltaX = currentX - touchStartX.current;
    
    // Show visual feedback (limit to prevent excessive drag)
    const maxOffset = 100;
    const constrainedOffset = Math.max(-maxOffset, Math.min(maxOffset, deltaX * 0.3));
    setSwipeOffset(constrainedOffset);
  }, []);

  const handleTouchEnd = useCallback((e) => {
    if (!touchStartX.current) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const touchEndTime = Date.now();
    
    const distanceX = touchStartX.current - touchEndX;
    const distanceY = touchStartY.current - touchEndY;
    const swipeDuration = touchEndTime - touchStartTime.current;

    // Reset visual feedback
    setSwipeOffset(0);

    // Only trigger if vertical movement is minimal (user is swiping horizontally)
    if (Math.abs(distanceY) > Math.abs(distanceX)) {
      touchStartX.current = 0;
      touchStartY.current = 0;
      return; // Vertical scroll, not a horizontal swipe
    }

    // Check cooldown period to prevent rapid multiple swipes
    const timeSinceLastSwipe = touchEndTime - lastSwipeTime.current;
    if (timeSinceLastSwipe < SWIPE_COOLDOWN) {
      touchStartX.current = 0;
      touchStartY.current = 0;
      return;
    }

    // Check if swipe distance is significant and swipe was reasonably fast
    if (Math.abs(distanceX) > MIN_SWIPE_DISTANCE && swipeDuration < 500) {
      if (distanceX > 0) {
        // Swiped left → go to next
        handleNavigateNext();
        lastSwipeTime.current = touchEndTime;
      } else {
        // Swiped right → go to previous
        handleNavigatePrevious();
        lastSwipeTime.current = touchEndTime;
      }
    }

    touchStartX.current = 0;
    touchStartY.current = 0;
  }, [handleNavigateNext, handleNavigatePrevious]);

  const isCurrentMonth = (date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  const getAppointmentsForDate = (date) => {
    const appointmentsForDate = filteredAppointments.filter(appointment => {
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
        <div className="schedule-header-bar d-flex justify-content-between align-items-center p-1 mb-2">
          <div className="schedule-clock">
            <span className="clock-time">{currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
            <span className="clock-date">{currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
          </div>
          <h4 className="text-center mb-0 ms-auto">
            {currentView === 'day'
              ? currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
              : currentView === 'week'
              ? `Week of ${new Date(currentDate.getTime() - currentDate.getDay() * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
              : currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
            }
          </h4>
         </div>

        <div className="schedule-body">
          <div 
            ref={calendarContainerRef}
            className="calendar-container" 
            style={{ 
              '--schedule-grid-cols': gridColumns,
              transform: `translateX(${swipeOffset}px)`,
              transition: swipeOffset === 0 ? 'transform 0.3s ease-out, opacity 0.3s ease-out' : 'none'
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
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
                        {appointmentsForTimeSlot.length > 1 ? (
                          // Overlap: render grey aggregated bar
                          (() => {
                            const earliestEvent = appointmentsForTimeSlot.reduce((earliest, event) => {
                              return new Date(event.appointment_date) < new Date(earliest.appointment_date) ? event : earliest;
                            });
                            const longestDuration = Math.max(...appointmentsForTimeSlot.map(e => e.duration_minutes || 60));
                            const earliestTime = new Date(earliestEvent.appointment_date);
                            const minutesPastHour = earliestTime.getMinutes();
                            const topOffset = (minutesPastHour / 60) * 100;
                            const heightPercent = (longestDuration / 60) * 100;

                            return (
                              <div
                                key={`overlap-${hour}-${dayIndex}`}
                                className="overlap-grey-bar"
                                title={`${appointmentsForTimeSlot.length} overlapping events`}
                                style={{
                                  position: 'absolute',
                                  top: `${topOffset}%`,
                                  height: `${heightPercent}%`,
                                  width: '95%',
                                  zIndex: 11441,
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOverlapEvents([...appointmentsForTimeSlot]);
                                }}
                              >
                                <span className="overlap-count">{appointmentsForTimeSlot.length}</span>
                                <div className="overlap-dots">
                                  {appointmentsForTimeSlot.map(appt => (
                                    <span key={appt.id} className="dot" style={{ color: employeeColorMap.get(appt.employee_id) || '#2563eb' }}>&bull;</span>
                                  ))}
                                </div>
                              </div>
                            );
                          })()
                        ) : appointmentsForTimeSlot.map(appointment => {
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

                          const employeeColor = employeeColorMap.get(appointment.employee_id) || '#2563eb';
                          const minutesPastHour = appointmentTime.getMinutes();
                          const topOffset = (minutesPastHour / 60) * 100;
                          const duration = appointment.duration_minutes || 60;
                          const heightPercent = (duration / 60) * 100;
                          const minutesFromMidnight = appointmentTime.getHours() * 60 + minutesPastHour;

                          return (
                            <div
                              key={appointment.id}
                              className="appointment-event"
                              title={`${clientName} - ${serviceName} at ${timeString}`}
                              style={{
                                backgroundColor: employeeColor,
                                position: 'absolute',
                                top: `${topOffset}%`,
                                height: `${heightPercent}%`,
                                width: '95%',
                                zIndex: 10000 + minutesFromMidnight,
                              }}
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
                      {appointmentsForTimeSlot.length > 1 ? (
                        // Overlap: render grey aggregated bar
                        (() => {
                          const earliestEvent = appointmentsForTimeSlot.reduce((earliest, event) => {
                            return new Date(event.appointment_date) < new Date(earliest.appointment_date) ? event : earliest;
                          });
                          const longestDuration = Math.max(...appointmentsForTimeSlot.map(e => e.duration_minutes || 60));
                          const earliestTime = new Date(earliestEvent.appointment_date);
                          const minutesPastHour = earliestTime.getMinutes();
                          const topOffset = (minutesPastHour / 60) * 100;
                          const heightPercent = (longestDuration / 60) * 100;

                          return (
                            <div
                              key={`overlap-${hour}`}
                              className="overlap-grey-bar"
                              title={`${appointmentsForTimeSlot.length} overlapping events`}
                              style={{
                                position: 'absolute',
                                top: `${topOffset}%`,
                                height: `${heightPercent}%`,
                                width: '95%',
                                zIndex: 11441,
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setOverlapEvents([...appointmentsForTimeSlot]);
                              }}
                            >
                              <span className="overlap-count">{appointmentsForTimeSlot.length}</span>
                              <div className="overlap-dots">
                                {appointmentsForTimeSlot.map(appt => (
                                  <span key={appt.id} className="dot" style={{ color: employeeColorMap.get(appt.employee_id) || '#2563eb' }}>&bull;</span>
                                ))}
                              </div>
                            </div>
                          );
                        })()
                      ) : appointmentsForTimeSlot.map(appointment => {
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

                        const employeeColor = employeeColorMap.get(appointment.employee_id) || '#2563eb';
                        const minutesPastHour = appointmentTime.getMinutes();
                        const topOffset = (minutesPastHour / 60) * 100;
                        const duration = appointment.duration_minutes || 60;
                        const heightPercent = (duration / 60) * 100;
                        const minutesFromMidnight = appointmentTime.getHours() * 60 + minutesPastHour;

                        return (
                          <div
                            key={appointment.id}
                            className="appointment-event"
                            title={`${clientName} - ${serviceName} at ${timeString}`}
                            style={{
                              backgroundColor: employeeColor,
                              position: 'absolute',
                              top: `${topOffset}%`,
                              height: `${heightPercent}%`,
                              width: '95%',
                              zIndex: 10000 + minutesFromMidnight,
                            }}
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
                            <div className="appointment-service">{serviceName}</div>
                            <div className="appointment-client">{clientName}</div>
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
                    {!filters.showOutOfOffice && appointmentsForDate.length > 0 && (
                      <div className="appointments">
                        {appointmentsForDate.map(appointment => {
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

                          const employeeColor = employeeColorMap.get(appointment.employee_id) || '#2563eb';

                          return (
                            <div
                              key={appointment.id}
                              className="appointment-dot"
                              title={`${clientName} - ${serviceName} at ${timeString}`}
                              style={{ backgroundColor: employeeColor }}
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
                              <div className="appointment-service">{serviceName}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {/* Out of Office: show events when filter ON, thin line when OFF */}
                    {(() => {
                      let oooForDate = getOutOfOfficeForDate(date);
                      if (filters.showOutOfOffice) {
                        if (filters.oooEmployeeIds.length > 0) {
                          oooForDate = oooForDate.filter(l => filters.oooEmployeeIds.includes(l.user_id));
                        }
                        if (oooForDate.length === 0) return null;
                        return (
                          <div className="ooo-events">
                            {oooForDate.map(leave => {
                              const emp = employees.find(e => e.id === leave.user_id);
                              const empName = emp ? `${emp.first_name} ${emp.last_name}` : 'Employee';
                              const empColor = emp?.color || '#6b7280';
                              return (
                                <div
                                  key={leave.id}
                                  className="appointment-dot ooo-event"
                                  style={{ backgroundColor: empColor }}
                                  title={`${empName} - Out of Office`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="appointment-service">{empName}</div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      } else {
                        if (oooForDate.length === 0) return null;
                        const oooNames = oooForDate
                          .map(l => {
                            const emp = employees.find(e => e.id === l.user_id);
                            return emp ? `${emp.first_name} ${emp.last_name}` : 'Employee';
                          })
                          .join(', ');
                        return (
                          <div
                            className="ooo-indicator-line"
                            title={`Out of office: ${oooNames}`}
                            onClick={(e) => e.stopPropagation()}
                          />
                        );
                      }
                    })()}
                  </div>
                );
              })
            )}
          </div>
          </div>
        </div>

        <div className="schedule-footer px-2 py-1 border-top">
          {/* Row 1: Month, Week, Day, Previous, Next */}
          <div className="d-flex gap-1 mb-1">
            {/* Month View */}
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
            {/* Week View */}
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
            {/* Day View */}
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
            {/* Previous */}
            <button
              type="button"
              onClick={handleNavigatePrevious}
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
              onClick={handleNavigateNext}
              className="btn btn-sm btn-outline-secondary"
              style={{ width: '36px', height: '36px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Next"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path fillRule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708"/>
              </svg>
            </button>
          </div>
          {/* Row 2: Today, Filter */}
          <div className="d-flex gap-1">
            {/* Today */}
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
            {/* Filter */}
            <button
              type="button"
              onClick={() => setIsFilterOpen(true)}
              className={`btn btn-sm ${
                filters.employeeIds.length > 0 ||
                filters.clientIds.length > 0 ||
                filters.serviceIds.length > 0 ||
                filters.startDate ||
                filters.endDate ||
                filters.showOutOfOffice
                  ? 'btn-primary'
                  : 'btn-outline-secondary'
              }`}
              style={{ height: '36px', padding: '0 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Filter"
            >
              Filter{filters.showOutOfOffice ? ' · OOO' : ''}
            </button>
          </div>
        </div>

        <Modal isOpen={isModalOpen} onClose={closeModal}>
          <ScheduleForm
            appointment={editingAppointment}
            onSubmit={handleSubmitAppointment}
            onCancel={closeModal}
            onDelete={handleDeleteAppointment}
            clients={clients}
            services={services}
            employees={employees}
          />
        </Modal>

        <ScheduleFilterModal
          isOpen={isFilterOpen}
          onClose={() => setIsFilterOpen(false)}
          employees={employees}
          clients={clients}
          services={services}
          filters={filters}
          approvedLeaves={approvedLeaves}
          onApply={(nextFilters) => setFilters(nextFilters)}
          onClear={() => setFilters({
            employeeIds: [],
            clientIds: [],
            serviceIds: [],
            startDate: '',
            endDate: '',
            showOutOfOffice: false,
            oooEmployeeIds: [],
          })}
        />
      </PermissionGate>

      {/* Overlap bottom modal */}
      {overlapEvents && (
        <>
          <div className="overlap-modal-backdrop" onClick={() => setOverlapEvents(null)} />
          <div className="overlap-bottom-modal">
            <div className="overlap-modal-header">
              <span className="overlap-modal-title">{overlapEvents.length} Overlapping Events</span>
              <button className="overlap-modal-close" onClick={() => setOverlapEvents(null)}>&times;</button>
            </div>
            <div className="overlap-event-list">
              {[...overlapEvents]
                .sort((a, b) => {
                  const timeA = new Date(a.appointment_date);
                  const timeB = new Date(b.appointment_date);
                  if (timeA < timeB) return -1;
                  if (timeA > timeB) return 1;
                  const empA = employees.find(e => e.id === a.employee_id);
                  const empB = employees.find(e => e.id === b.employee_id);
                  const nameA = empA ? `${empA.first_name} ${empA.last_name}`.toLowerCase() : '';
                  const nameB = empB ? `${empB.first_name} ${empB.last_name}`.toLowerCase() : '';
                  return nameA.localeCompare(nameB);
                })
                .map(appt => {
                  const client = clients.find(c => c.id === appt.client_id);
                  const clientName = client ? client.name : '';
                  const service = services.find(s => s.id === appt.service_id);
                  const serviceName = service ? service.name : '';
                  const emp = employees.find(e => e.id === appt.employee_id);
                  const empName = emp ? `${emp.first_name} ${emp.last_name}` : '';
                  const apptTime = new Date(appt.appointment_date);
                  const timeStr = apptTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
                  const empColor = employeeColorMap.get(appt.employee_id) || '#2563eb';
                  const duration = appt.duration_minutes || 60;
                  const label = appt.appointment_type === 'meeting' ? (appt.notes || 'Meeting')
                    : appt.appointment_type === 'task' ? (appt.notes || 'Task')
                    : serviceName || 'Appointment';

                  return (
                    <div
                      key={appt.id}
                      className="overlap-event-item"
                      onClick={() => {
                        if (!canEditAppointment(appt)) return;
                        setOverlapEvents(null);
                        setEditingAppointment(appt);
                        setIsModalOpen(true);
                      }}
                    >
                      <span className="overlap-emp-dot" style={{ backgroundColor: empColor }} />
                      <div className="overlap-event-info">
                        <div className="overlap-event-primary">
                          <span className="overlap-event-time">{timeStr}</span>
                          <span className="overlap-event-label">{label}</span>
                          {clientName && <span className="overlap-event-client">{clientName}</span>}
                        </div>
                        <div className="overlap-event-secondary">
                          {empName && <span>{empName}</span>}
                          <span>{duration} min</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </>
      )}

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
          touch-action: pan-y; /* Allow vertical scrolling but enable horizontal swipe detection */
          user-select: none; /* Prevent text selection during swipe */
          -webkit-user-select: none;
          will-change: transform; /* Optimize for animations */
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
          grid-template-columns: max-content repeat(7, minmax(0, 1fr));
          flex: 1;
          overflow: hidden;
          gap: 0;
          background: transparent;
          border: 1px solid ${isDarkMode ? '#6b7280' : '#dee2e6'};
          padding: 0;
          min-width: 0;
          min-height: 0;
          grid-auto-rows: minmax(36px, 1fr);
        }

        .calendar-grid.week-view .calendar-cell {
          border: 1px solid ${isDarkMode ? '#6b7280' : '#dee2e6'};
          box-shadow: none;
          margin-top: -1px;
          margin-left: -1px;
        }

        .calendar-grid.week-view .time-label-cell {
          grid-column: 1;
        }
        .calendar-grid.week-view .calendar-cell:not(.time-label-cell) {
          grid-column: auto;
        }

        .calendar-grid.day-view {
          grid-template-columns: max-content 1fr;
          flex: 1;
          overflow: hidden;
          gap: 0;
          min-height: 0;
          grid-auto-rows: minmax(36px, 1fr);
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
          padding: 4px;
          white-space: nowrap;
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
          overflow: visible;
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
          width: 21px;
          height: 21px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0px auto 1px auto;
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
          font-size: 14px;
          font-weight: bold;
        }
        
        .day-date.today-badge {
          background-color: white;
          color: ${isDarkMode ? '#2563eb' : '#2196f3'};
          border-radius: 50%;
          width: 21px;
          height: 21px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0px auto 0;
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
          margin-bottom: 1px;
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

        .ooo-indicator-line {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: #f97316;
          border-radius: 0 0 4px 4px;
          pointer-events: none;
        }

        .ooo-indicator-line[title] {
          pointer-events: auto;
          cursor: default;
        }

        .ooo-events {
          margin-top: 2px;
        }

        .ooo-event {
          opacity: 0.85;
          border-left: 3px solid rgba(0,0,0,0.25);
        }

        .appointment-event {
          color: white;
          border-radius: 4px;
          padding: 2px 4px;
          overflow: hidden;
          cursor: pointer;
          font-size: 10px;
          white-space: nowrap;
          text-overflow: ellipsis;
          min-width: 0;
          box-sizing: border-box;
          left: 0;
          transition: opacity 0.2s;
        }

        .appointment-event:hover {
          opacity: 0.85;
        }

        .overlap-grey-bar {
          background: repeating-linear-gradient(
            45deg,
            #cccccc,
            #cccccc 10px,
            #dddddd 10px,
            #dddddd 20px
          );
          border-radius: 4px;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 6px;
          cursor: pointer;
          overflow: hidden;
          opacity: 0.85;
          border: 1px solid #bbbbbb;
          box-sizing: border-box;
          left: 0;
        }

        .overlap-count {
          font-weight: bold;
          font-size: 12px;
          color: #333;
          flex-shrink: 0;
        }

        .overlap-dots {
          display: flex;
          flex-wrap: wrap;
          gap: 2px;
        }

        .overlap-dots .dot {
          font-size: 14px;
          line-height: 1;
        }

        .overlap-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.3);
          z-index: 11999;
        }

        .overlap-bottom-modal {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: ${isDarkMode ? '#2d3748' : 'white'};
          border-top-left-radius: 12px;
          border-top-right-radius: 12px;
          box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.15);
          max-height: 60vh;
          overflow-y: auto;
          animation: slideUp 0.3s ease-out;
          z-index: 12000;
        }

        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }

        .overlap-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          border-bottom: 1px solid ${isDarkMode ? '#4a5568' : '#eee'};
          position: sticky;
          top: 0;
          background: ${isDarkMode ? '#2d3748' : 'white'};
          border-top-left-radius: 12px;
          border-top-right-radius: 12px;
          z-index: 1;
        }

        .overlap-modal-title {
          font-weight: 600;
          font-size: 14px;
          color: ${isDarkMode ? '#e2e8f0' : '#333'};
        }

        .overlap-modal-close {
          background: none;
          border: none;
          font-size: 22px;
          cursor: pointer;
          color: ${isDarkMode ? '#9ca3af' : '#666'};
          line-height: 1;
          padding: 0 4px;
        }

        .overlap-modal-close:hover {
          color: ${isDarkMode ? '#e2e8f0' : '#333'};
        }

        .overlap-event-list {
          padding: 4px 0;
        }

        .overlap-event-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 16px;
          border-bottom: 1px solid ${isDarkMode ? '#4a5568' : '#eee'};
          cursor: pointer;
          transition: background 0.2s;
        }

        .overlap-event-item:hover {
          background: ${isDarkMode ? '#4a5568' : '#f5f5f5'};
        }

        .overlap-event-item:last-child {
          border-bottom: none;
        }

        .overlap-emp-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .overlap-event-info {
          flex: 1;
          min-width: 0;
        }

        .overlap-event-primary {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: ${isDarkMode ? '#e2e8f0' : '#333'};
        }

        .overlap-event-time {
          font-weight: 700;
          flex-shrink: 0;
        }

        .overlap-event-label {
          font-weight: 500;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .overlap-event-client {
          color: ${isDarkMode ? '#9ca3af' : '#666'};
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .overlap-event-secondary {
          display: flex;
          gap: 12px;
          font-size: 11px;
          color: ${isDarkMode ? '#9ca3af' : '#888'};
          margin-top: 2px;
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
            grid-auto-rows: minmax(20px, 1fr);
          }
          .calendar-cell.time-label-cell {
            font-size: 10px;
            padding: 1px;
          }
          .appointment-dot {
            font-size: 9px;
            padding: 3px 4px;
          }
          .appointment-event {
            font-size: 8px;
            padding: 1px 3px;
          }
          .appointment-time {
            font-size: 8px;
          }
          .appointment-service {
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
            grid-auto-rows: minmax(28px, 1fr);
          }
          .calendar-cell.time-label-cell {
            font-size: 9px; 
          }
          .appointment-dot {
            font-size: 8px;
            padding: 2px 3px;
          }
          .appointment-event {
            font-size: 7px;
            padding: 1px 2px;
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

        .appointment-service {
          font-size: 9px;
          font-weight: 600;
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
