/*
 * ============================================================
 * FILE: Schedule.jsx
 *
 * PURPOSE:
 *   Full-featured calendar page for managing employee appointments and
 *   schedules. Supports month, week, and day views with drag-and-drop
 *   rescheduling, mobile swipe navigation, attendance check-in, out-of-office
 *   indicators, multi-attendee meetings, filter panel, and email reminder
 *   templates. Access is gated by role permissions.
 *
 * FUNCTIONAL PARTS:
 *   [1]  Imports & SVG Icons  — React, router, store, APIs, Heroicons, child
 *                               components; inline SVG wrappers for view-toggle buttons
 *   [2]  State & Refs         — Current date/view, modal flags, drag state, clock,
 *                               filters, approved leaves, swipe refs, schedule settings
 *   [3]  Lifecycle / Effects  — Live clock interval; one-shot data fetch (schedule,
 *                               clients, services, employees, leave requests, settings);
 *                               auto-scroll to current hour in day/week views
 *   [4]  Derived Data         — employeeColorMap (memoized); filteredAppointments
 *                               (memoized with employee/client/service/date filters)
 *   [5]  Calendar Utilities   — isDayEnabled, getCalendarDays, getTimeSlots — compute
 *                               visible day/hour grid respecting schedule settings
 *   [6]  Permission Helpers   — canCreateSchedule, canEditAppointment — checks against
 *                               current user role and employee ownership
 *   [7]  Event / Click Handlers — handleAppointmentClick, handleDateClick, refreshSchedules
 *   [8]  Attendee Sync        — normalizeIds, syncScheduleAttendees, deleteScheduleAttendees
 *   [9]  CRUD Handlers        — handleSubmitAppointment (create/update + attendee sync),
 *                               handleDeleteAppointment
 *   [10] Drag & Drop          — handleDragStart, handleDragEnd, handleDragOver,
 *                               handleDragLeave, handleDrop
 *   [11] Navigation           — closeModal, handleNavigatePrevious, handleNavigateNext
 *   [12] Touch / Swipe        — handleTouchStart, handleTouchMove, handleTouchEnd —
 *                               swipe gesture navigation with visual feedback and cooldown
 *   [13] Render Helpers       — isCurrentMonth, getAppointmentsForDate, getOutOfOfficeForDate
 *   [14] Render               — Attendance widget, header clock, calendar grid (month/week/day),
 *                               footer toolbar, appointment modal, reminder modal,
 *                               filter modal, overlap modal, and inline CSS styles
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-03-01 | Claude  | Added section comments and top-level documentation
 *   2026-03-01 | Claude  | P5-B — Added STATUS_DOT_COLOR; status dot/strikethrough/opacity on all three calendar views
 *   2026-03-11 | Claude  | Added is_paid green-$ badge to all three calendar views
 *   2026-03-14 | Copilot | Updated footer buttons to one row, shortened labels, and fixed 3rem square sizing
 *   2026-03-23 | Copilot | Fixed month-view January cell truncation by using date-based cutoff across year boundaries
 *   2026-05-15 | Copilot | Added client and service labels to schedule events across calendar views
 *   2026-07-25 | GitHub Copilot | Added in-card mark-paid action for billable schedule events and billable-only unpaid counter
 *   2026-07-25 | GitHub Copilot | Enabled in-card payment approval for all users who can create schedule events
 *   2026-07-26 | GitHub Copilot | Routed unpaid appointment payment action through Sales checkout and restricted paid->unpaid to initiate_refunds permission
 *   2026-07-31 | GitHub Copilot | Included schedule context in Sales checkout handoff so checkout can show appointment/client details
 * ============================================================
 */

// ─── 1 IMPORTS ─────────────────────────────────────────────────────────────────
import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { S } from "../utils/strings";
import useStore from "../services/useStore";
import useFetchOnce from "../services/useFetchOnce";
import usePagePermission from "../services/usePagePermission";
import useCalendarView from "../services/useCalendarView";
import { scheduleAPI, settingsAPI, isudAPI, clientsAPI, clientCartAPI, servicesAPI, employeesAPI, leaveRequestsAPI } from "../services/api";
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon, FunnelIcon, Cog6ToothIcon, ClockIcon, BellIcon, CurrencyDollarIcon } from "@heroicons/react/24/outline";
import Button_Toolbar from "./components/Button_Toolbar";
import Modal from "./components/Modal";
import PageControlsModal from "./components/Page_ControlsModal";
import Form_Schedule from "./components/Form_Schedule";
import Gate_Permission from "./components/Gate_Permission";
import Widget_Attendance from "./components/Widget_Attendance";
import useDarkMode from "../services/useDarkMode";
import Dropup_ScheduleFilter from "./components/Dropup_ScheduleFilter";
import Modal_TemplateUse from "./components/Modal_TemplateUse";
import Modal_SettingsSchedule from "./components/Modal_SettingsSchedule";

// SVG icon wrappers for schedule view buttons
const MonthViewIcon = ({ className, size = 16 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} fill="currentColor" viewBox="0 0 16 16" className={className}>
    <path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5M2 2a1 1 0 0 0-1 1v1h14V3a1 1 0 0 0-1-1zm13 3H1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1z" />
    <path d="M2.5 7a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m4 0a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1H7a.5.5 0 0 1-.5-.5m4 0a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5M2.5 9a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m4 0a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1H7a.5.5 0 0 1-.5-.5m4 0a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5M2.5 11a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m4 0a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1H7a.5.5 0 0 1-.5-.5m4 0a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5" />
  </svg>
);
const WeekViewIcon = ({ className, size = 16 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} fill="currentColor" viewBox="0 0 16 16" className={className}>
    <path d="M11 6.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5zm-3 0a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5zm-5 3a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5zm3 0a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5z" />
    <path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5M1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4z" />
  </svg>
);
const DayViewIcon = ({ className, size = 16 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} fill="currentColor" viewBox="0 0 16 16" className={className}>
    <path d="M4 .5a.5.5 0 0 0-1 0V1H2a2 2 0 0 0-2 2v1h16V3a2 2 0 0 0-2-2h-1V.5a.5.5 0 0 0-1 0V1H4zM16 14V5H0v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2M8.5 8.5V10H10a.5.5 0 0 1 0 1H8.5v1.5a.5.5 0 0 1-1 0V11H6a.5.5 0 0 1 0-1h1.5V8.5a.5.5 0 0 1 1 0" />
  </svg>
);
const TodayIcon = ({ className, size = 16 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} fill="currentColor" viewBox="0 0 16 16" className={className}>
    <path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5M1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4z" />
    <text x="8" y="12" textAnchor="middle" fontSize="8" fontWeight="bold">
      {new Date().getDate()}
    </text>
  </svg>
);

// Status dot colours used across all three calendar views
const STATUS_DOT_COLOR = {
  scheduled: "#9ca3af", // gray
  confirmed: "#3b82f6", // blue
  completed: "#22c55e", // green
  cancelled: "#ef4444", // red
};

export default function Schedule() {
  const location = useLocation();
  const navigate = useNavigate();

  // ─── 2 STORE & PERMISSION GUARD ──────────────────────────────────────────────
  const { appointments, clients, services, employees, loading, setAppointments, setClients, setServices, setEmployees, hasPermission, isAuthenticated, user } = useStore();
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  // Use the permission refresh hook

  usePagePermission("schedule");

  // ─── 3 STATE & REFS ──────────────────────────────────────────────────────────
  const [scheduleSettings, setScheduleSettings] = useState({
    start_of_day: "06:00",
    end_of_day: "21:00",
    attendance_check_in_required: true,
    reminder_time_minutes: 30,
    reminder_send_notification: true,
    monday_enabled: true,
    tuesday_enabled: true,
    wednesday_enabled: true,
    thursday_enabled: true,
    friday_enabled: true,
    saturday_enabled: true,
    sunday_enabled: true,
  });

  const { currentDate, setCurrentDate, currentView, setCurrentView, swipeOffset, handleNavigatePrevious, handleNavigateNext, handleTouchStart, handleTouchMove, handleTouchEnd, getCalendarDays, getTimeSlots, isDayEnabled } = useCalendarView({ scheduleSettings });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState(null);
  const [draggedAppointment, setDraggedAppointment] = useState(null);
  const [dragOverCell, setDragOverCell] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [overlapEvents, setOverlapEvents] = useState(null);
  const [selectedAttendees, setSelectedAttendees] = useState([]);
  const [pastDateError, setPastDateError] = useState("");
  const [pastDateErrorTimer, setPastDateErrorTimer] = useState(null);
  const [filters, setFilters] = useState({
    employeeIds: [],
    clientIds: [],
    serviceIds: [],
    startDate: "",
    endDate: "",
    showOutOfOffice: false,
    oooEmployeeIds: [],
  });
  const [approvedLeaves, setApprovedLeaves] = useState([]);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderAppointment, setReminderAppointment] = useState(null);
  const [showPageControls, setShowPageControls] = useState(false);
  const [scheduleSettingsSaving, setScheduleSettingsSaving] = useState(false);
  const scheduleSettingsRef = useRef(null);
  const calendarGridRef = useRef(null);
  const calendarContainerRef = useRef(null);

  // Open appointment editor when linked from another page (e.g., client service history)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const editScheduleId = params.get("edit_schedule_id");
    if (!editScheduleId || !Array.isArray(appointments) || appointments.length === 0) return;

    const targetAppointment = appointments.find((a) => String(a.id) === String(editScheduleId));
    if (!targetAppointment) return;

    const openFromQuery = async () => {
      setSelectedAttendees([]);
      setEditingAppointment(targetAppointment);

      if (targetAppointment.appointment_type === "meeting" && targetAppointment.id) {
        try {
          const res = await isudAPI.scheduleAttendees.getBySchedule(targetAppointment.id);
          const rows = res?.data ?? [];
          setSelectedAttendees(Array.isArray(rows) ? rows : []);
        } catch {
          // silently degrade
        }
      }

      if (targetAppointment.appointment_date) {
        const dt = new Date(targetAppointment.appointment_date);
        if (!Number.isNaN(dt.getTime())) setCurrentDate(dt);
      }
      setCurrentView("day");
      setIsModalOpen(true);

      params.delete("edit_schedule_id");
      navigate({ pathname: location.pathname, search: params.toString() ? `?${params.toString()}` : "" }, { replace: true });
    };

    openFromQuery();
  }, [location.pathname, location.search, navigate, appointments]);

  // ─── 4 LIFECYCLE / EFFECTS ───────────────────────────────────────────────────
  // Update clock every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

  // Cleanup past date error timer on unmount
  useEffect(() => {
    return () => {
      if (pastDateErrorTimer) clearTimeout(pastDateErrorTimer);
    };
  }, [pastDateErrorTimer]);

  // ─── 5 DATA LOADING ──────────────────────────────────────────────────────────
  // Load schedule data and supporting lookups
  useFetchOnce(() => {
    const loadSchedule = async () => {
      // Check if user is authenticated before making API calls
      if (!isAuthenticated()) {
        console.error("User not authenticated - skipping data load");
        return;
      }

      try {
        // Load schedule settings
        const settingsResponse = await settingsAPI.getScheduleSettings();
        if (settingsResponse?.data) {
          setScheduleSettings({
            start_of_day: settingsResponse.data.start_of_day || "06:00",
            end_of_day: settingsResponse.data.end_of_day || "21:00",
            attendance_check_in_required: settingsResponse.data.attendance_check_in_required ?? false,
            reminder_time_minutes: settingsResponse.data.reminder_time_minutes ?? 30,
            reminder_send_notification: settingsResponse.data.reminder_send_notification ?? true,
            monday_enabled: settingsResponse.data.monday_enabled ?? true,
            tuesday_enabled: settingsResponse.data.tuesday_enabled ?? true,
            wednesday_enabled: settingsResponse.data.wednesday_enabled ?? true,
            thursday_enabled: settingsResponse.data.thursday_enabled ?? true,
            friday_enabled: settingsResponse.data.friday_enabled ?? true,
            saturday_enabled: settingsResponse.data.saturday_enabled ?? true,
            sunday_enabled: settingsResponse.data.sunday_enabled ?? true,
          });
        }

        const canReadLeaveRequests = hasPermission("leave", "read") || hasPermission("leave_request", "read") || hasPermission("leave_requests", "read");
        const graceful403 = (promise) =>
          promise.catch((error) => {
            if (error?.response?.status === 403) return { data: [] };
            throw error;
          });
        const [scheduleResponse, clientsResponse, servicesResponse, employeesResponse, leavesResponse] = await Promise.all([
          graceful403(scheduleAPI.getAll()),
          graceful403(clientsAPI.getAll()),
          graceful403(servicesAPI.getAll()),
          graceful403(employeesAPI.getAll()),
          canReadLeaveRequests ? graceful403(leaveRequestsAPI.getAll()) : Promise.resolve({ data: [] }),
        ]);

        const scheduleData = scheduleResponse?.data ?? scheduleResponse;
        if (Array.isArray(scheduleData)) {
          setAppointments(scheduleData);
        } else {
          console.error("Invalid schedule data format:", scheduleData);
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
          setApprovedLeaves(leavesData.filter((l) => l.status === "approved"));
        }
      } catch (error) {
        console.error("Error loading schedule:", error);
        if (error.response?.status === 401 || error.response?.status === 403) {
          console.error("Authentication required");
        }
      }
    };

    loadSchedule();
  });

  // ─── 6 DERIVED DATA ──────────────────────────────────────────────────────────
  const employeeColorMap = useMemo(() => {
    const entries = employees.map((employee) => [employee.id, employee.color]);
    return new Map(entries);
  }, [employees]);

  const getOutOfOfficeForDate = useCallback(
    (date) => {
      const dateStr = date.toISOString().split("T")[0];
      return approvedLeaves.filter((leave) => {
        const start = (leave.start_date || "").split("T")[0];
        const end = (leave.end_date || "").split("T")[0];
        return start && end && dateStr >= start && dateStr <= end;
      });
    },
    [approvedLeaves]
  );

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

  const isBillableAppointment = useCallback(
    (appointment) => {
      if (!appointment) return false;
      const type = appointment.appointment_type || "one_time";
      if (type !== "one_time" && type !== "series") return false;
      if (!appointment.client_id || !appointment.service_id) return false;

      const service = services.find((s) => s.id === appointment.service_id);
      if (!service) return true;

      const price = Number(service.price ?? 0);
      return Number.isFinite(price) ? price > 0 : true;
    },
    [services]
  );

  const isUnpaidBillableAppointment = useCallback(
    (appointment) => {
      if (!isBillableAppointment(appointment)) return false;
      if (appointment.status === "cancelled") return false;
      return !appointment.is_paid;
    },
    [isBillableAppointment]
  );

  const canTogglePaidForAppointment = useCallback((appointment) => {
    if (!appointment) return false;
    const type = appointment.appointment_type || "one_time";
    if (type !== "one_time" && type !== "series") return false;
    return Boolean(appointment.client_id && appointment.service_id);
  }, []);

  // ─── 7 CALENDAR UTILITIES ────────────────────────────────────────────────────
  const days = getCalendarDays();
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const enabledWeekdays = [
    { idx: 0, key: "sunday_enabled" },
    { idx: 1, key: "monday_enabled" },
    { idx: 2, key: "tuesday_enabled" },
    { idx: 3, key: "wednesday_enabled" },
    { idx: 4, key: "thursday_enabled" },
    { idx: 5, key: "friday_enabled" },
    { idx: 6, key: "saturday_enabled" },
  ].filter((d) => scheduleSettings?.[d.key]);

  const monthColCount = Math.max(enabledWeekdays.length, 1);
  const monthWeeks = useMemo(() => {
    if (currentView !== "month") return [];
    const weeks = [];
    for (let i = 0; i < days.length; i += monthColCount) {
      weeks.push(days.slice(i, i + monthColCount));
    }
    return weeks;
  }, [currentView, days, monthColCount]);

  const isPastCalendarDate = useCallback((date) => {
    const day = new Date(date);
    day.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return day < today;
  }, []);

  // ─── 8 AUTO-SCROLL EFFECT ────────────────────────────────────────────────────
  // Auto-scroll to current time when switching to day or week view
  useEffect(() => {
    if ((currentView === "day" || currentView === "week") && calendarGridRef.current) {
      const currentHour = new Date().getHours();
      const startHour = parseInt(scheduleSettings.start_of_day.split(":")[0], 10) || 6;
      const endHour = parseInt(scheduleSettings.end_of_day.split(":")[0], 10) || 21;

      const scrollHour = currentHour < startHour ? startHour : currentHour > endHour ? endHour : currentHour;

      // Small delay to ensure the grid is rendered
      setTimeout(() => {
        const timeSlotElement = calendarGridRef.current?.querySelector(`[data-hour="${scrollHour}"]`);
        if (timeSlotElement) {
          timeSlotElement.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
    }
  }, [currentView, scheduleSettings.start_of_day, scheduleSettings.end_of_day]);

  // ─── 9 PERMISSION HELPERS ────────────────────────────────────────────────────
  const canCreateSchedule = useCallback(() => {
    return hasPermission("schedule", "write") || hasPermission("schedule", "write_self_only") || hasPermission("schedule", "write_all") || hasPermission("schedule", "admin");
  }, [hasPermission]);

  const canApprovePayments = useCallback(() => {
    return hasPermission("schedule", "approve_payments") || hasPermission("schedule", "admin");
  }, [hasPermission]);

  const canInitiateRefunds = useCallback(() => {
    return hasPermission("schedule", "initiate_refunds") || hasPermission("schedule", "admin");
  }, [hasPermission]);

  const canEditAppointment = useCallback(
    (appointment) => {
      if (!appointment) return false;
      if (hasPermission("schedule", "admin") || hasPermission("schedule", "write_all")) return true;
      if (!hasPermission("schedule", "write") && !hasPermission("schedule", "write_self_only")) return false;
      // Try direct match (DB FK to user.id)
      if (user && appointment.employee_id === user.id) return true;
      // Heuristic: if FK is employee.id, try to match by name from employees list
      if (user && employees && employees.length) {
        const fullName = `${user.first_name} ${user.last_name}`.trim().toLowerCase();
        const selfIds = employees.filter((e) => `${e.first_name} ${e.last_name}`.trim().toLowerCase() === fullName || e.name?.trim().toLowerCase() === fullName).map((e) => e.id);
        if (selfIds.includes(appointment.employee_id)) return true;
      }
      return false;
    },
    [employees, hasPermission, user]
  );

  // ─── 10 EVENT / CLICK HANDLERS ───────────────────────────────────────────────
  const handleAppointmentClick = useCallback(
    async (e, appointment) => {
      e.stopPropagation();
      if (!canEditAppointment(appointment)) return;
      setSelectedAttendees([]);
      setEditingAppointment(appointment);
      if (appointment.appointment_type === "meeting" && appointment.id) {
        try {
          const res = await isudAPI.scheduleAttendees.getBySchedule(appointment.id);
          const data = res?.data ?? res;
          if (Array.isArray(data)) setSelectedAttendees(data);
        } catch {}
      }
      setIsModalOpen(true);
    },
    [canEditAppointment]
  );

  const handleDateClick = useCallback(
    (date) => {
      // UI pre-gate: do not open the create modal without proper permission
      if (!canCreateSchedule()) {
        console.warn("Insufficient permission to create an appointment. Modal will not open.");
        return;
      }

      // Check if the selected date is in the past
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selectedDate = new Date(date);
      selectedDate.setHours(0, 0, 0, 0);

      if (selectedDate < today) {
        setPastDateError("Cannot book appointments in the past");
        if (pastDateErrorTimer) clearTimeout(pastDateErrorTimer);
        const timer = setTimeout(() => {
          setPastDateError("");
          setPastDateErrorTimer(null);
        }, 2000);
        setPastDateErrorTimer(timer);
        return;
      }

      if (!isDayEnabled(date)) {
        setPastDateError("This day is disabled in Schedule Settings");
        if (pastDateErrorTimer) clearTimeout(pastDateErrorTimer);
        const timer = setTimeout(() => {
          setPastDateError("");
          setPastDateErrorTimer(null);
        }, 2000);
        setPastDateErrorTimer(timer);
        return;
      }

      if (currentView === "day" || currentView === "week") {
        const startHour = parseInt(scheduleSettings.start_of_day.split(":")[0], 10) || 6;
        const endHour = parseInt(scheduleSettings.end_of_day.split(":")[0], 10) || 21;
        const hour = new Date(date).getHours();
        if (hour < startHour || hour > endHour) {
          setPastDateError("This time is outside your business hours");
          if (pastDateErrorTimer) clearTimeout(pastDateErrorTimer);
          const timer = setTimeout(() => {
            setPastDateError("");
            setPastDateErrorTimer(null);
          }, 2000);
          setPastDateErrorTimer(timer);
          return;
        }
      }

      setEditingAppointment({
        appointment_date: date,
      });
      setIsModalOpen(true);
    },
    [canCreateSchedule, currentView, isDayEnabled, pastDateErrorTimer, scheduleSettings.end_of_day, scheduleSettings.start_of_day]
  );

  // ─── 11 DATA REFRESH ─────────────────────────────────────────────────────────
  // Helper to refresh schedule data (uses cache deduplication)
  const refreshSchedules = useCallback(async () => {
    try {
      const scheduleResponse = await scheduleAPI.getAll();
      const scheduleData = scheduleResponse?.data ?? scheduleResponse;
      if (Array.isArray(scheduleData)) {
        setAppointments(scheduleData);
      }
    } catch (err) {
      console.error("Failed to refresh schedules:", err);
    }
  }, [setAppointments]);

  // ─── 12 ATTENDEE SYNC UTILITIES ──────────────────────────────────────────────
  const normalizeIds = useCallback((value) => {
    if (Array.isArray(value)) {
      return value.map((id) => (id == null ? "" : String(id).trim())).filter(Boolean);
    }
    if (!value) return [];
    return [String(value).trim()].filter(Boolean);
  }, []);

  const syncScheduleAttendees = useCallback(async (scheduleId, employeeIds, clientIds, primaryEmployeeId, primaryClientId) => {
    if (!scheduleId) return;

    try {
      const existingResponse = await isudAPI.scheduleAttendees.getBySchedule(scheduleId);
      const existing = existingResponse?.data ?? existingResponse;
      if (Array.isArray(existing) && existing.length > 0) {
        await Promise.allSettled(existing.map((attendee) => isudAPI.scheduleAttendees.delete(attendee.id)));
      }

      const dedupe = (ids) => Array.from(new Set((ids || []).map((id) => String(id).trim()).filter(Boolean)));
      const normalizedPrimaryEmployeeId = primaryEmployeeId ? String(primaryEmployeeId).trim() : "";
      const normalizedPrimaryClientId = primaryClientId ? String(primaryClientId).trim() : "";
      const employeeAttendees = dedupe(employeeIds).filter((id) => id && id !== normalizedPrimaryEmployeeId);
      const clientAttendees = dedupe(clientIds).filter((id) => id && id !== normalizedPrimaryClientId);

      const createRequests = [
        ...employeeAttendees.map((userId) =>
          isudAPI.scheduleAttendees.create({
            schedule_id: scheduleId,
            user_id: userId,
          })
        ),
        ...clientAttendees.map((clientId) =>
          isudAPI.scheduleAttendees.create({
            schedule_id: scheduleId,
            client_id: clientId,
          })
        ),
      ];

      if (createRequests.length > 0) {
        const createResults = await Promise.allSettled(createRequests);
        const rejectedCount = createResults.filter((result) => result.status === "rejected").length;
        if (rejectedCount > 0) {
          console.warn(`Schedule attendee sync had ${rejectedCount} failed create operation(s).`);
        }
      }
    } catch (err) {
      console.error("Failed to sync schedule attendees:", err);
    }
  }, []);

  const deleteScheduleAttendees = useCallback(async (scheduleId) => {
    if (!scheduleId) return;
    try {
      const existingResponse = await isudAPI.scheduleAttendees.getBySchedule(scheduleId);
      const existing = existingResponse?.data ?? existingResponse;
      if (Array.isArray(existing) && existing.length > 0) {
        await Promise.allSettled(existing.map((attendee) => isudAPI.scheduleAttendees.delete(attendee.id)));
      }
    } catch (err) {
      console.error("Failed to delete schedule attendees:", err);
    }
  }, []);

  // ─── 13 CRUD HANDLERS ────────────────────────────────────────────────────────
  const handleSubmitAppointment = useCallback(
    async (appointmentData) => {
      const effectiveType = appointmentData.appointment_type || editingAppointment?.appointment_type || "one_time";
      const requiresClientService = effectiveType === "one_time" || effectiveType === "series";
      const employeeIds = normalizeIds(appointmentData.employee_ids ?? appointmentData.employee_id);
      const clientIds = normalizeIds(appointmentData.client_ids ?? appointmentData.client_id);
      const primaryEmployeeId = employeeIds[0] || appointmentData.employee_id || editingAppointment?.employee_id;
      const primaryClientId = requiresClientService ? clientIds[0] || appointmentData.client_id || editingAppointment?.client_id : null;
      const primaryServiceId = requiresClientService ? appointmentData.service_id || editingAppointment?.service_id : null;

      if (!primaryEmployeeId) {
        throw new Error("Please select an employee before saving.");
      }

      const schedulePayload = {
        employee_id: primaryEmployeeId,
        appointment_date: appointmentData.appointment_date,
        appointment_type: effectiveType,
        duration_minutes: parseInt(appointmentData.duration_minutes) || 60,
        notes: appointmentData.notes || null,
        status: appointmentData.status || "scheduled",
        recurrence_frequency: appointmentData.recurrence_frequency || null,
        recurrence_end_date: appointmentData.recurrence_end_date || null,
        recurrence_count: appointmentData.recurrence_count || null,
        is_recurring_master: appointmentData.is_recurring_master ?? false,
        is_paid: appointmentData.is_paid ?? false,
        send_reminder: appointmentData.send_reminder ?? scheduleSettings.reminder_send_notification ?? true,
      };
      if (primaryClientId) schedulePayload.client_id = primaryClientId;
      if (primaryServiceId) schedulePayload.service_id = primaryServiceId;

      let savedRecord;
      if (editingAppointment && editingAppointment.id) {
        const response = await scheduleAPI.update(editingAppointment.id, schedulePayload);
        savedRecord = response?.data ?? response;
      } else {
        const response = await scheduleAPI.create(schedulePayload);
        savedRecord = response?.data ?? response;
      }

      // Auto-add service to client cart when appointment has a client + service
      if (primaryServiceId && primaryClientId) {
        const svc = services.find((s) => s.id === primaryServiceId);
        if (svc) {
          try {
            await clientCartAPI.upsertItem(primaryClientId, {
              cart_key: `schedule-${savedRecord?.id || "new"}-${primaryServiceId}`,
              item_type: "service",
              item_id: primaryServiceId,
              item_name: svc.name,
              unit_price: svc.price ?? 0,
              quantity: 1,
              line_total: svc.price ?? 0,
            });
          } catch {
            // non-critical — don't fail the booking if cart fails
          }
        }
      }

      const scheduleId = savedRecord?.id || editingAppointment?.id;
      await syncScheduleAttendees(scheduleId, employeeIds, clientIds, primaryEmployeeId, primaryClientId);

      // Refresh schedules - cache will prevent duplicate calls if already in flight
      await refreshSchedules();

      setIsModalOpen(false);
      setEditingAppointment(null);
      setSelectedAttendees([]);
    },
    [editingAppointment, normalizeIds, refreshSchedules, scheduleSettings.reminder_send_notification, syncScheduleAttendees]
  );

  const handleDeleteAppointment = useCallback(async () => {
    if (!editingAppointment?.id) return;
    const scheduleId = editingAppointment.id;
    await deleteScheduleAttendees(scheduleId);
    await scheduleAPI.delete(scheduleId);
    await refreshSchedules();
    setIsModalOpen(false);
    setEditingAppointment(null);
    setSelectedAttendees([]);
  }, [deleteScheduleAttendees, editingAppointment, refreshSchedules]);

  const launchScheduleCheckout = useCallback(
    (appointment) => {
      if (!appointment?.client_id || !appointment?.service_id) return;
      const preSelectedClient = clients.find((c) => c.id === appointment.client_id);
      const serviceName = services.find((s) => String(s.id) === String(appointment.service_id))?.name || "Service";
      const employeeName = employees.find((e) => String(e.id) === String(appointment.employee_id))?.name || "";
      navigate("/sales", {
        state: {
          preSelectedClient,
          scheduleId: appointment.id,
          preloadServiceId: appointment.service_id,
          openCheckout: true,
          checkoutContext: {
            source: "schedule",
            appointmentId: appointment.id,
            appointmentDate: appointment.appointment_date || null,
            appointmentStatus: appointment.status || null,
            serviceName,
            employeeName,
            notes: appointment.notes || "",
          },
        },
      });
    },
    [clients, employees, navigate, services]
  );

  const canShowPaymentAction = useCallback(
    (appointment) => {
      if (!canTogglePaidForAppointment(appointment)) return false;
      if (appointment?.is_paid) return canInitiateRefunds();
      return canApprovePayments();
    },
    [canApprovePayments, canInitiateRefunds, canTogglePaidForAppointment]
  );

  const handleToggleAppointmentPaid = useCallback(
    async (e, appointment) => {
      e.stopPropagation();
      if (!appointment?.id) return;
      if (!canEditAppointment(appointment)) return;
      if (!canTogglePaidForAppointment(appointment)) return;

      if (!appointment.is_paid) {
        if (!canApprovePayments()) return;
        launchScheduleCheckout(appointment);
        return;
      }

      if (!canInitiateRefunds()) return;
      const shouldProceed = window.confirm("Initiate refund and unlock this appointment from paid status?");
      if (!shouldProceed) return;

      try {
        await scheduleAPI.initiateRefund(appointment.id, {
          reason: "Refund initiated from calendar payment toggle",
        });
        setAppointments(appointments.map((item) => (item.id === appointment.id ? { ...item, is_paid: false, sale_transaction_id: null } : item)));
      } catch (error) {
        console.error("Failed to initiate appointment refund:", error);
        setPastDateError("Refund initiation failed. Please verify manager permissions and payment state.");
        if (pastDateErrorTimer) clearTimeout(pastDateErrorTimer);
        const timer = setTimeout(() => {
          setPastDateError("");
          setPastDateErrorTimer(null);
        }, 2500);
        setPastDateErrorTimer(timer);
      }
    },
    [appointments, canApprovePayments, canEditAppointment, canInitiateRefunds, canTogglePaidForAppointment, launchScheduleCheckout, pastDateErrorTimer, setAppointments]
  );

  // ─── 14 DRAG & DROP HANDLERS ─────────────────────────────────────────────────
  const handleDragStart = useCallback((e, appointment) => {
    setDraggedAppointment(appointment);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", appointment.id);

    // Add visual feedback
    e.target.style.opacity = "0.5";
  }, []);

  const handleDragEnd = useCallback((e) => {
    e.target.style.opacity = "1";
    setDraggedAppointment(null);
    setDragOverCell(null);
  }, []);

  const _formatLocalDateTime = useCallback((date) => {
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
  }, []);

  const _snapMinuteToQuarter = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.height) return 0;
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height - 0.001));
    const minuteInHour = (y / rect.height) * 60;
    return Math.floor(minuteInHour / 15) * 15;
  }, []);

  const handleDragOver = useCallback(
    (e, targetDate, targetHour = null) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const snappedMinute = targetHour !== null ? _snapMinuteToQuarter(e) : null;
      setDragOverCell({ date: targetDate, hour: targetHour, minute: snappedMinute });
    },
    [_snapMinuteToQuarter]
  );

  const handleDragLeave = useCallback((e) => {
    // Only clear if we're leaving the calendar area entirely
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverCell(null);
    }
  }, []);

  const handleDrop = useCallback(
    async (e, targetDate, targetHour = null) => {
      e.preventDefault();

      if (!draggedAppointment) return;

      const dropMinute = targetHour !== null ? (dragOverCell?.minute ?? _snapMinuteToQuarter(e)) : null;

      if (!isDayEnabled(targetDate)) {
        setPastDateError("This day is disabled in Schedule Settings");
        if (pastDateErrorTimer) clearTimeout(pastDateErrorTimer);
        const timer = setTimeout(() => {
          setPastDateError("");
          setPastDateErrorTimer(null);
        }, 2000);
        setPastDateErrorTimer(timer);
        setDraggedAppointment(null);
        setDragOverCell(null);
        return;
      }

      if ((currentView === "day" || currentView === "week") && targetHour !== null) {
        const startHour = parseInt(scheduleSettings.start_of_day.split(":")[0], 10) || 6;
        const endHour = parseInt(scheduleSettings.end_of_day.split(":")[0], 10) || 21;
        if (targetHour < startHour || targetHour > endHour) {
          setPastDateError("This time is outside your business hours");
          if (pastDateErrorTimer) clearTimeout(pastDateErrorTimer);
          const timer = setTimeout(() => {
            setPastDateError("");
            setPastDateErrorTimer(null);
          }, 2000);
          setPastDateErrorTimer(timer);
          setDraggedAppointment(null);
          setDragOverCell(null);
          return;
        }
      }

      const newDate = new Date(targetDate);
      if (targetHour !== null) {
        newDate.setHours(targetHour, dropMinute ?? 0, 0, 0);
      } else {
        const originalTime = new Date(draggedAppointment.appointment_date);
        newDate.setHours(originalTime.getHours(), originalTime.getMinutes(), 0, 0);
      }

      const updatedAppointment = {
        client_id: draggedAppointment.client_id,
        service_id: draggedAppointment.service_id,
        employee_id: draggedAppointment.employee_id,
        appointment_date: _formatLocalDateTime(newDate),
        status: draggedAppointment.status || "scheduled",
        notes: draggedAppointment.notes || null,
        appointment_type: draggedAppointment.appointment_type || "one_time",
        duration_minutes: draggedAppointment.duration_minutes || 60,
      };

      await scheduleAPI.update(draggedAppointment.id, updatedAppointment);
      // Refresh schedules - cache will prevent duplicate calls if already in flight
      await refreshSchedules();

      setDraggedAppointment(null);
      setDragOverCell(null);
    },
    [_formatLocalDateTime, _snapMinuteToQuarter, currentView, dragOverCell?.minute, draggedAppointment, isDayEnabled, pastDateErrorTimer, refreshSchedules, scheduleSettings.end_of_day, scheduleSettings.start_of_day]
  );

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingAppointment(null);
  }, []);

  // ─── 17 RENDER HELPERS ───────────────────────────────────────────────────────
  const isCurrentMonth = (date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  const getAppointmentsForDate = (date) => {
    const appointmentsForDate = filteredAppointments.filter((appointment) => {
      const appointmentDate = new Date(appointment.appointment_date);
      return appointmentDate.toDateString() === date.toDateString();
    });

    return appointmentsForDate;
  };

  const getAppointmentDisplay = useCallback(
    (appointment) => {
      const client = clients.find((c) => c.id === appointment.client_id);
      const service = services.find((s) => s.id === appointment.service_id);
      const clientName = client?.name || "Unknown Client";
      const serviceName = service?.name || "Unknown Service";
      const primaryLabel = appointment.appointment_type === "meeting" ? appointment.notes || "Meeting" : appointment.appointment_type === "task" ? appointment.notes || "Task" : serviceName;
      const secondaryLabel = appointment.appointment_type === "meeting" || appointment.appointment_type === "task" ? [client?.name, service?.name].filter(Boolean).join(" - ") : clientName;

      return {
        clientName,
        serviceName,
        primaryLabel,
        secondaryLabel,
      };
    },
    [clients, services]
  );

  // ─── 18 RENDER ───────────────────────────────────────────────────────────────
  if (loading) {
    return <div className="p-1">{S.loading}</div>;
  }

  return (
    <div className="d-flex flex-column h-100 schedule-page">
      <Gate_Permission page="schedule" permission="read">
        {/* Past Date Error Message */}
        {pastDateError && (
          <div className="alert alert-dismissible alert-warning fade mb-0 mt-2 mx-2 show" role="alert" style={{ fontSize: "0.9rem", padding: "0.5rem 1rem" }}>
            {pastDateError}
            <button
              type="button"
              className="btn-close"
              onClick={() => {
                setPastDateError("");
                if (pastDateErrorTimer) clearTimeout(pastDateErrorTimer);
              }}
            />
          </div>
        )}

        {/* Attendance Widget - Clock In/Out (conditionally rendered based on settings) */}
        {scheduleSettings.attendance_check_in_required && (
          <div className="mb-3 px-0">
            <Widget_Attendance compact={true} />
          </div>
        )}

        {/* Header with clock */}
        <div className="align-items-center d-flex justify-content-between mb-2 p-1 schedule-header-bar">
          <div className="schedule-clock">
            <span className="clock-time">{currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}</span>
            <span className="clock-date">{currentTime.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
          </div>
          <div className="align-items-center d-flex gap-2 ms-auto">
            {/* Unpaid past-due indicator */}
            {(() => {
              const now = new Date();
              const count = appointments.filter((a) => isUnpaidBillableAppointment(a) && new Date(a.appointment_date) < now).length;
              return count > 0 ? (
                <div className="align-items-center d-inline-flex justify-content-center position-relative" title={`${count} unpaid past appointment${count > 1 ? "s" : ""}`} style={{ cursor: "default" }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#6b7280" strokeWidth="1.8" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v2m0 8v2m-4.5-6h9M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z" />
                  </svg>
                  <span className="position-absolute" style={{ top: -4, right: -6, background: "#6b7280", color: "#fff", fontSize: "0.6rem", borderRadius: "9999px", padding: "0 4px", minWidth: 14, textAlign: "center", lineHeight: "14px" }}>
                    {count}
                  </span>
                </div>
              ) : null;
            })()}
            {/* Upcoming appointments indicator */}
            {(() => {
              const now = new Date();
              const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
              const count = appointments.filter((a) => {
                const d = new Date(a.appointment_date);
                return d >= now && d <= soon && a.status !== "cancelled";
              }).length;
              return count > 0 ? (
                <div className="align-items-center d-inline-flex justify-content-center position-relative" title={`${count} upcoming appointment${count > 1 ? "s" : ""} in the next 24h`} style={{ cursor: "default" }}>
                  <BellIcon style={{ width: 20, height: 20, color: "#6b7280" }} />
                  <span className="position-absolute" style={{ top: -4, right: -6, background: "#6b7280", color: "#fff", fontSize: "0.6rem", borderRadius: "9999px", padding: "0 4px", minWidth: 14, textAlign: "center", lineHeight: "14px" }}>
                    {count}
                  </span>
                </div>
              ) : null;
            })()}
            <Button_Toolbar icon={Cog6ToothIcon} label="Settings" onClick={() => setShowPageControls(true)} className="btn-outline-secondary" title="Page settings" />
          </div>
        </div>

        <div className="schedule-body">
          <div
            ref={calendarContainerRef}
            className="calendar-container"
            style={{
              transform: `translateX(${swipeOffset}px)`,
              transition: swipeOffset === 0 ? "transform 0.3s ease-out, opacity 0.3s ease-out" : "none",
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {currentView === "week" ? (
              <table className="schedule-table schedule-table--week">
                <colgroup>
                  <col style={{ width: "35px" }} />
                  {days.map((_, idx) => (
                    <col key={`col-${idx}`} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    <th className="calendar-header-cell time-header-cell" aria-hidden="true">
                      <ClockIcon className="app-icon" />
                    </th>
                    {days.map((date, index) => {
                      const isToday = date.toDateString() === new Date().toDateString();
                      const isPast = isPastCalendarDate(date);
                      return (
                        <th key={index} className={`calendar-header-cell ${isToday ? "today-header" : ""} ${!isToday && isPast ? "past-header" : ""}`}>
                          <div className="day-name">{weekDays[date.getDay()]}</div>
                          <div className={`day-date ${isToday ? "today-badge" : ""}`}>{date.getDate()}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody ref={calendarGridRef}>
                  {getTimeSlots().map((hour) => (
                    <tr key={hour} className="schedule-time-row">
                      <th className="calendar-cell time-label-cell time-slot" data-hour={hour}>
                        {hour.toString().padStart(2, "0")}:00
                      </th>
                      {days.map((date, dayIndex) => {
                        const appointmentsForTimeSlot = getAppointmentsForDate(date).filter((appointment) => {
                          const appointmentTime = new Date(appointment.appointment_date);
                          return appointmentTime.getHours() === hour;
                        });
                        const isToday = date.toDateString() === new Date().toDateString();
                        const isCurrentHour = currentTime.getHours() === hour && isToday;
                        const currentMinutePercent = (currentTime.getMinutes() / 60) * 100;

                        return (
                          <td
                            key={`${hour}-${dayIndex}`}
                            className={`calendar-cell time-slot ${isToday ? "today-column" : ""} ${dragOverCell?.date?.toDateString() === date.toDateString() && dragOverCell?.hour === hour ? "drag-over" : ""}`}
                            style={{ position: "relative" }}
                            onClick={() => {
                              const slotDate = new Date(date);
                              slotDate.setHours(hour, 0, 0, 0);
                              handleDateClick(slotDate);
                            }}
                            onDragOver={(e) => handleDragOver(e, date, hour)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, date, hour)}
                          >
                            {dragOverCell?.date?.toDateString() === date.toDateString() && dragOverCell?.hour === hour && draggedAppointment && (
                              <div
                                aria-hidden="true"
                                style={{
                                  position: "absolute",
                                  top: `${((dragOverCell?.minute ?? 0) / 60) * 100}%`,
                                  height: `${((draggedAppointment?.duration_minutes || 60) / 60) * 100}%`,
                                  width: "95%",
                                  border: "2px dashed rgba(37,99,235,0.9)",
                                  backgroundColor: "rgba(37,99,235,0.08)",
                                  borderRadius: "6px",
                                  pointerEvents: "none",
                                  zIndex: 12050,
                                }}
                              />
                            )}
                            {appointmentsForTimeSlot.length > 1
                              ? (() => {
                                  const earliestEvent = appointmentsForTimeSlot.reduce((earliest, event) => {
                                    return new Date(event.appointment_date) < new Date(earliest.appointment_date) ? event : earliest;
                                  });
                                  const longestDuration = Math.max(...appointmentsForTimeSlot.map((e) => e.duration_minutes || 60));
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
                                        position: "absolute",
                                        top: `${topOffset}%`,
                                        height: `${heightPercent}%`,
                                        width: "95%",
                                        zIndex: 11441,
                                      }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setOverlapEvents([...appointmentsForTimeSlot]);
                                      }}
                                    >
                                      <span className="overlap-count">{appointmentsForTimeSlot.length}</span>
                                      <div className="overlap-dots">
                                        {appointmentsForTimeSlot.map((appt) => (
                                          <span key={appt.id} className="dot" style={{ color: employeeColorMap.get(appt.employee_id) || "#2563eb" }}>
                                            &bull;
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })()
                              : appointmentsForTimeSlot.map((appointment) => {
                                  const { clientName, serviceName, primaryLabel, secondaryLabel } = getAppointmentDisplay(appointment);
                                  const appointmentTime = new Date(appointment.appointment_date);
                                  const timeString = appointmentTime.toLocaleTimeString("en-US", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    hour12: false,
                                  });

                                  const employeeColor = employeeColorMap.get(appointment.employee_id) || "#2563eb";
                                  const minutesPastHour = appointmentTime.getMinutes();
                                  const topOffset = (minutesPastHour / 60) * 100;
                                  const duration = appointment.duration_minutes || 60;
                                  const heightPercent = (duration / 60) * 100;
                                  const minutesFromMidnight = appointmentTime.getHours() * 60 + minutesPastHour;

                                  const isMeeting = appointment.appointment_type === "meeting";
                                  const isCancelled = appointment.status === "cancelled";
                                  return (
                                    <div
                                      className="appointment-event-wrap"
                                      key={appointment.id}
                                      title={isMeeting ? `Meeting: ${appointment.notes || ""} at ${timeString}` : `${clientName} - ${serviceName} at ${timeString}`}
                                      style={{
                                        position: "absolute",
                                        top: `${topOffset}%`,
                                        height: `${heightPercent}%`,
                                        width: "95%",
                                        zIndex: 10000 + minutesFromMidnight,
                                      }}
                                      onClick={(e) => handleAppointmentClick(e, appointment)}
                                    >
                                      <div
                                        className="appointment-event"
                                        style={{
                                          backgroundColor: employeeColor,
                                          opacity: isCancelled ? 0.65 : 1,
                                          height: "100%",
                                          width: "100%",
                                        }}
                                        draggable={true}
                                        onDragStart={(e) => handleDragStart(e, appointment)}
                                        onDragEnd={handleDragEnd}
                                        onClick={(e) => handleAppointmentClick(e, appointment)}
                                      >
                                        <div className="appointment-service" style={isCancelled ? { textDecoration: "line-through" } : undefined}>
                                          {primaryLabel}
                                        </div>
                                        {secondaryLabel && <div className="appointment-client">{secondaryLabel}</div>}
                                        {appointment.status && appointment.status !== "scheduled" && <span style={{ position: "absolute", bottom: 2, right: 3, display: "block", width: 5, height: 5, borderRadius: "50%", backgroundColor: STATUS_DOT_COLOR[appointment.status] || "#9ca3af" }} />}
                                      </div>
                                      {canShowPaymentAction(appointment) && (
                                        <button
                                          type="button"
                                          className={`schedule-paid-toggle schedule-paid-toggle--floating ${appointment.is_paid ? "is-paid" : "is-unpaid"}`}
                                          title={appointment.is_paid ? "Initiate refund (manager approval required)" : "Open checkout to mark paid"}
                                          aria-label={appointment.is_paid ? "Initiate refund for appointment" : "Open checkout for appointment payment"}
                                          onClick={(e) => handleToggleAppointmentPaid(e, appointment)}
                                        >
                                          <CurrencyDollarIcon style={{ width: 9, height: 9 }} />
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}
                            {isCurrentHour && (
                              <div className="current-time-indicator" style={{ top: `${currentMinutePercent}%` }}>
                                <div className="current-time-dot"></div>
                                <div className="current-time-line"></div>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : currentView === "day" ? (
              <table className="schedule-table schedule-table--day">
                <colgroup>
                  <col style={{ width: "35px" }} />
                  <col />
                </colgroup>
                <thead>
                  <tr>
                    <th className="calendar-header-cell time-header-cell" aria-hidden="true">
                      <ClockIcon className="app-icon" />
                    </th>
                    <th className="calendar-header-cell"></th>
                  </tr>
                </thead>
                <tbody ref={calendarGridRef}>
                  {getTimeSlots().map((hour) => {
                    const appointmentsForTimeSlot = getAppointmentsForDate(days[0]).filter((appointment) => {
                      const appointmentTime = new Date(appointment.appointment_date);
                      return appointmentTime.getHours() === hour;
                    });
                    const isCurrentHour = currentTime.getHours() === hour && days[0].toDateString() === new Date().toDateString();
                    const currentMinutePercent = (currentTime.getMinutes() / 60) * 100;

                    return (
                      <tr key={hour} className="schedule-time-row">
                        <th className="calendar-cell time-label-cell time-slot" data-hour={hour}>
                          {hour.toString().padStart(2, "0")}:00
                        </th>
                        <td
                          className={`calendar-cell time-slot ${dragOverCell?.date?.toDateString() === days[0].toDateString() && dragOverCell?.hour === hour ? "drag-over" : ""}`}
                          style={{ position: "relative" }}
                          onClick={() => {
                            const slotDate = new Date(days[0]);
                            slotDate.setHours(hour, 0, 0, 0);
                            handleDateClick(slotDate);
                          }}
                          onDragOver={(e) => handleDragOver(e, days[0], hour)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, days[0], hour)}
                        >
                          {dragOverCell?.date?.toDateString() === days[0].toDateString() && dragOverCell?.hour === hour && draggedAppointment && (
                            <div
                              aria-hidden="true"
                              style={{
                                position: "absolute",
                                top: `${((dragOverCell?.minute ?? 0) / 60) * 100}%`,
                                height: `${((draggedAppointment?.duration_minutes || 60) / 60) * 100}%`,
                                width: "95%",
                                border: "2px dashed rgba(37,99,235,0.9)",
                                backgroundColor: "rgba(37,99,235,0.08)",
                                borderRadius: "6px",
                                pointerEvents: "none",
                                zIndex: 12050,
                              }}
                            />
                          )}
                          {appointmentsForTimeSlot.length > 1
                            ? (() => {
                                const earliestEvent = appointmentsForTimeSlot.reduce((earliest, event) => {
                                  return new Date(event.appointment_date) < new Date(earliest.appointment_date) ? event : earliest;
                                });
                                const longestDuration = Math.max(...appointmentsForTimeSlot.map((e) => e.duration_minutes || 60));
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
                                      position: "absolute",
                                      top: `${topOffset}%`,
                                      height: `${heightPercent}%`,
                                      width: "95%",
                                      zIndex: 11441,
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOverlapEvents([...appointmentsForTimeSlot]);
                                    }}
                                  >
                                    <span className="overlap-count">{appointmentsForTimeSlot.length}</span>
                                    <div className="overlap-dots">
                                      {appointmentsForTimeSlot.map((appt) => (
                                        <span key={appt.id} className="dot" style={{ color: employeeColorMap.get(appt.employee_id) || "#2563eb" }}>
                                          &bull;
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()
                            : appointmentsForTimeSlot.map((appointment) => {
                                const { clientName, serviceName, primaryLabel, secondaryLabel } = getAppointmentDisplay(appointment);
                                const appointmentTime = new Date(appointment.appointment_date);
                                const timeString = appointmentTime.toLocaleTimeString("en-US", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  hour12: false,
                                });

                                const employeeColor = employeeColorMap.get(appointment.employee_id) || "#2563eb";
                                const minutesPastHour = appointmentTime.getMinutes();
                                const topOffset = (minutesPastHour / 60) * 100;
                                const duration = appointment.duration_minutes || 60;
                                const heightPercent = (duration / 60) * 100;
                                const minutesFromMidnight = appointmentTime.getHours() * 60 + minutesPastHour;

                                const isMeeting = appointment.appointment_type === "meeting";
                                const isCancelled = appointment.status === "cancelled";
                                return (
                                  <div
                                    className="appointment-event-wrap"
                                    key={appointment.id}
                                    title={isMeeting ? `Meeting: ${appointment.notes || ""} at ${timeString}` : `${clientName} - ${serviceName} at ${timeString}`}
                                    style={{
                                      position: "absolute",
                                      top: `${topOffset}%`,
                                      height: `${heightPercent}%`,
                                      width: "95%",
                                      zIndex: 10000 + minutesFromMidnight,
                                    }}
                                    onClick={(e) => handleAppointmentClick(e, appointment)}
                                  >
                                    <div
                                      className="appointment-event"
                                      style={{
                                        backgroundColor: employeeColor,
                                        opacity: isCancelled ? 0.65 : 1,
                                        height: "100%",
                                        width: "100%",
                                      }}
                                      draggable={true}
                                      onDragStart={(e) => handleDragStart(e, appointment)}
                                      onDragEnd={handleDragEnd}
                                      onClick={(e) => handleAppointmentClick(e, appointment)}
                                    >
                                      <div className="appointment-time">{timeString}</div>
                                      <div className="appointment-service" style={isCancelled ? { textDecoration: "line-through" } : undefined}>
                                        {primaryLabel}
                                      </div>
                                      {secondaryLabel && <div className="appointment-client">{secondaryLabel}</div>}
                                      {appointment.status && appointment.status !== "scheduled" && <span style={{ position: "absolute", bottom: 2, right: 3, display: "block", width: 5, height: 5, borderRadius: "50%", backgroundColor: STATUS_DOT_COLOR[appointment.status] || "#9ca3af" }} />}
                                    </div>
                                    {canShowPaymentAction(appointment) && (
                                      <button
                                        type="button"
                                        className={`schedule-paid-toggle schedule-paid-toggle--floating ${appointment.is_paid ? "is-paid" : "is-unpaid"}`}
                                        title={appointment.is_paid ? "Initiate refund (manager approval required)" : "Open checkout to mark paid"}
                                        aria-label={appointment.is_paid ? "Initiate refund for appointment" : "Open checkout for appointment payment"}
                                        onClick={(e) => handleToggleAppointmentPaid(e, appointment)}
                                      >
                                        <CurrencyDollarIcon style={{ width: 9, height: 9 }} />
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                          {isCurrentHour && (
                            <div className="current-time-indicator" style={{ top: `${currentMinutePercent}%` }}>
                              <div className="current-time-dot"></div>
                              <div className="current-time-line"></div>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <table className="schedule-table schedule-table--month">
                <thead>
                  <tr>
                    {enabledWeekdays.map((d) => (
                      <th key={d.key} className="calendar-header-cell">
                        {weekDays[d.idx]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody ref={calendarGridRef}>
                  {monthWeeks.map((week, rowIndex) => (
                    <tr key={`week-${rowIndex}`}>
                      {Array.from({ length: monthColCount }).map((_, colIndex) => {
                        const date = week[colIndex];
                        if (!date) {
                          return <td key={`empty-${rowIndex}-${colIndex}`} className="calendar-cell other-month" />;
                        }
                        const appointmentsForDate = getAppointmentsForDate(date);
                        const isToday = date.toDateString() === new Date().toDateString();
                        return (
                          <td
                            key={`${rowIndex}-${colIndex}`}
                            className={`calendar-cell ${!isCurrentMonth(date) ? "other-month" : ""} ${isToday ? "today" : ""} ${dragOverCell?.date?.toDateString() === date.toDateString() ? "drag-over" : ""}`}
                            onClick={() => handleDateClick(date)}
                            onDragOver={(e) => handleDragOver(e, date)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, date)}
                          >
                            <div className="date-number">{date.getDate()}</div>
                            {!filters.showOutOfOffice && appointmentsForDate.length > 0 && (
                              <div className="appointments">
                                {appointmentsForDate.length > 1 ? (
                                  /* Grouped indicator — tapping opens the overlap bottom sheet */
                                  <div
                                    className="appointment-dot month-group-bar"
                                    title={`${appointmentsForDate.length} appointments`}
                                    style={{ position: "relative", cursor: "pointer" }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOverlapEvents([...appointmentsForDate]);
                                    }}
                                  >
                                    <div style={{ display: "flex", alignItems: "center", gap: 4, overflow: "hidden" }}>
                                      <span className="overlap-count" style={{ minWidth: 16, textAlign: "center" }}>
                                        {appointmentsForDate.length}
                                      </span>
                                      <div className="overlap-dots" style={{ display: "flex", gap: 2 }}>
                                        {appointmentsForDate.map((appt) => (
                                          <span key={appt.id} style={{ color: employeeColorMap.get(appt.employee_id) || "#2563eb", fontSize: "0.75rem" }}>
                                            &bull;
                                          </span>
                                        ))}
                                      </div>
                                      <span className="appointment-service" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, fontSize: "0.65rem" }}>
                                        appointments
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  appointmentsForDate.map((appointment) => {
                                    const { clientName, serviceName, primaryLabel, secondaryLabel } = getAppointmentDisplay(appointment);
                                    const appointmentTime = new Date(appointment.appointment_date);
                                    const timeString = appointmentTime.toLocaleTimeString("en-US", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      hour12: false,
                                    });

                                    const employeeColor = employeeColorMap.get(appointment.employee_id) || "#2563eb";
                                    const isMeeting = appointment.appointment_type === "meeting";
                                    const isCancelled = appointment.status === "cancelled";
                                    return (
                                      <div className="appointment-dot-wrap" key={appointment.id} title={isMeeting ? `Meeting: ${appointment.notes || ""} at ${timeString}` : `${clientName} - ${serviceName} at ${timeString}`} onClick={(e) => handleAppointmentClick(e, appointment)}>
                                        <div
                                          className="appointment-dot"
                                          style={{
                                            position: "relative",
                                            backgroundColor: employeeColor,
                                            opacity: isCancelled ? 0.65 : 1,
                                            borderLeft: appointment.status && appointment.status !== "scheduled" ? `3px solid ${STATUS_DOT_COLOR[appointment.status]}` : undefined,
                                          }}
                                          draggable={true}
                                          onDragStart={(e) => handleDragStart(e, appointment)}
                                          onDragEnd={handleDragEnd}
                                          onClick={(e) => handleAppointmentClick(e, appointment)}
                                        >
                                          <div style={{ display: "flex", alignItems: "center", gap: 3, overflow: "hidden" }}>
                                            <span className="appointment-service" style={{ ...(isCancelled ? { textDecoration: "line-through" } : {}), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                                              {primaryLabel}
                                            </span>
                                          </div>
                                          {secondaryLabel && (
                                            <div className="appointment-client" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                              {secondaryLabel}
                                            </div>
                                          )}
                                        </div>
                                        {canShowPaymentAction(appointment) && (
                                          <button
                                            type="button"
                                            className={`schedule-paid-toggle schedule-paid-toggle--month ${appointment.is_paid ? "is-paid" : "is-unpaid"}`}
                                            title={appointment.is_paid ? "Initiate refund (manager approval required)" : "Open checkout to mark paid"}
                                            aria-label={appointment.is_paid ? "Initiate refund for appointment" : "Open checkout for appointment payment"}
                                            onClick={(e) => handleToggleAppointmentPaid(e, appointment)}
                                          >
                                            <CurrencyDollarIcon style={{ width: 9, height: 9 }} />
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            )}
                            {(() => {
                              let oooForDate = getOutOfOfficeForDate(date);
                              if (filters.showOutOfOffice) {
                                if (filters.oooEmployeeIds.length > 0) {
                                  oooForDate = oooForDate.filter((l) => filters.oooEmployeeIds.includes(l.user_id));
                                }
                                if (oooForDate.length === 0) return null;
                                return (
                                  <div className="ooo-events">
                                    {oooForDate.map((leave) => {
                                      const emp = employees.find((e) => e.id === leave.user_id);
                                      const empName = emp ? `${emp.first_name} ${emp.last_name}` : "Employee";
                                      const empColor = emp?.color || "#6b7280";
                                      return (
                                        <div key={leave.id} className="appointment-dot ooo-event" style={{ backgroundColor: empColor }} title={`${empName} - Out of Office`} onClick={(e) => e.stopPropagation()}>
                                          <div className="appointment-service">{empName}</div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              } else {
                                if (oooForDate.length === 0) return null;
                                const oooNames = oooForDate
                                  .map((l) => {
                                    const emp = employees.find((e) => e.id === l.user_id);
                                    return emp ? `${emp.first_name} ${emp.last_name}` : "Employee";
                                  })
                                  .join(", ");
                                return <div className="ooo-indicator-line" title={`Out of office: ${oooNames}`} onClick={(e) => e.stopPropagation()} />;
                              }
                            })()}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <footer className="app-footer-padding app-footer-shell app-standard-footer border-top schedule-footer">
          <div className="align-items-center app-footer-toolbar d-flex">
            <Button_Toolbar icon={MonthViewIcon} label="Mon" onClick={() => setCurrentView("month")} className={currentView === "month" ? "btn-primary" : "btn-outline-secondary"} data-active={currentView === "month"} title="Month view" />
            <Button_Toolbar icon={WeekViewIcon} label="Week" onClick={() => setCurrentView("week")} className={`${currentView === "week" ? "btn-primary" : "btn-outline-secondary"} p-0`} data-active={currentView === "week"} title="Week view" />
            <Button_Toolbar icon={DayViewIcon} label="Day" onClick={() => setCurrentView("day")} className={currentView === "day" ? "btn-primary" : "btn-outline-secondary"} data-active={currentView === "day"} title="Day view" />
            <Button_Toolbar icon={TodayIcon} label="Now" onClick={() => setCurrentDate(new Date())} className="btn-outline-secondary" title="Go to today" />
            <Button_Toolbar icon={ChevronLeftIcon} label="Prev" onClick={handleNavigatePrevious} className="btn-outline-secondary" title="Previous" />
            <Button_Toolbar icon={ChevronRightIcon} label="Next" onClick={handleNavigateNext} className="btn-outline-secondary" />
            <Button_Toolbar
              icon={FunnelIcon}
              label="Filter"
              onClick={() => setIsFilterOpen(true)}
              className={`${filters.employeeIds.length > 0 || filters.clientIds.length > 0 || filters.serviceIds.length > 0 || filters.startDate || filters.endDate || filters.showOutOfOffice ? "btn-primary" : "btn-outline-secondary"}`}
              data-active={filters.employeeIds.length > 0 || filters.clientIds.length > 0 || filters.serviceIds.length > 0 || !!filters.startDate || !!filters.endDate || filters.showOutOfOffice}
            />
          </div>
        </footer>

        <Modal isOpen={isModalOpen} onClose={closeModal} noPadding={true} fullScreen={true} contentGravity="top">
          <Form_Schedule
            appointment={editingAppointment}
            onSubmit={handleSubmitAppointment}
            onCancel={closeModal}
            onDelete={handleDeleteAppointment}
            onSendReminder={() => {
              setReminderAppointment(editingAppointment);
              setShowReminderModal(true);
              closeModal();
            }}
            clients={clients}
            services={services}
            employees={employees}
            attendees={selectedAttendees}
            scheduleSettings={scheduleSettings}
          />
        </Modal>

        {showReminderModal && reminderAppointment && (
          <Modal_TemplateUse
            page="schedule"
            filterType="email"
            entity={reminderAppointment}
            client={clients.find((c) => c.id === reminderAppointment?.client_id)}
            employee={employees.find((e) => e.id === reminderAppointment?.employee_id)}
            service={services.find((s) => s.id === reminderAppointment?.service_id)}
            currentUser={user}
            settings={scheduleSettings}
            onClose={() => {
              setShowReminderModal(false);
              setReminderAppointment(null);
            }}
          />
        )}

        <Dropup_ScheduleFilter
          isOpen={isFilterOpen}
          onClose={() => setIsFilterOpen(false)}
          employees={employees}
          clients={clients}
          services={services}
          filters={filters}
          onApply={(nextFilters) => setFilters({ ...filters, ...nextFilters })}
          onClear={() =>
            setFilters({
              employeeIds: [],
              clientIds: [],
              serviceIds: [],
              startDate: "",
              endDate: "",
              showOutOfOffice: false,
              oooEmployeeIds: [],
            })
          }
        />
      </Gate_Permission>

      {/* Overlap bottom modal */}
      <Modal isOpen={!!overlapEvents} onClose={() => setOverlapEvents(null)} noPadding={true} fullScreen={true} contentGravity="bottom">
        <div className="d-flex flex-column justify-content-end">
          <div className="flex-shrink-0 overlap-event-list">
            {[...(overlapEvents || [])]
              .sort((a, b) => {
                const timeA = new Date(a.appointment_date);
                const timeB = new Date(b.appointment_date);
                if (timeA < timeB) return -1;
                if (timeA > timeB) return 1;
                const empA = employees.find((e) => e.id === a.employee_id);
                const empB = employees.find((e) => e.id === b.employee_id);
                const nameA = empA ? `${empA.first_name} ${empA.last_name}`.toLowerCase() : "";
                const nameB = empB ? `${empB.first_name} ${empB.last_name}`.toLowerCase() : "";
                return nameA.localeCompare(nameB);
              })
              .map((appt) => {
                const { clientName, serviceName, primaryLabel, secondaryLabel } = getAppointmentDisplay(appt);
                const emp = employees.find((e) => e.id === appt.employee_id);
                const empName = emp ? `${emp.first_name} ${emp.last_name}` : "";
                const apptTime = new Date(appt.appointment_date);
                const timeStr = apptTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
                const empColor = employeeColorMap.get(appt.employee_id) || "#2563eb";
                const duration = appt.duration_minutes || 60;

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
                        <span className="overlap-event-label">{primaryLabel}</span>
                        {secondaryLabel && <span className="overlap-event-client">{secondaryLabel}</span>}
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

          {/* Footer with Cancel button */}
          <div className="bg-white d-flex dark:bg-gray-900 flex-shrink-0 justify-content-center p-1 ps-1 pt-0">
            <button type="button" className="align-items-center btn btn-outline-secondary d-flex justify-content-center" onClick={() => setOverlapEvents(null)}>
              <XMarkIcon className="ui-icon-5" />
            </button>
          </div>
        </div>
      </Modal>

      <PageControlsModal
        isOpen={showPageControls}
        onClose={() => setShowPageControls(false)}
        title="Schedule Page Controls"
        saving={scheduleSettingsSaving}
        onSave={async () => {
          const ok = await scheduleSettingsRef.current?.save?.();
          if (ok) setShowPageControls(false);
        }}
      >
        {user?.id ? (
          <Modal_SettingsSchedule
            ref={scheduleSettingsRef}
            hideFooter
            userId={user.id}
            onSavingChange={setScheduleSettingsSaving}
            onSaved={(updated) => {
              if (!updated) return;
              setScheduleSettings({
                start_of_day: updated.start_of_day || "06:00",
                end_of_day: updated.end_of_day || "21:00",
                attendance_check_in_required: updated.attendance_check_in_required ?? false,
                reminder_time_minutes: updated.reminder_time_minutes ?? 30,
                reminder_send_notification: updated.reminder_send_notification ?? true,
                monday_enabled: updated.monday_enabled ?? true,
                tuesday_enabled: updated.tuesday_enabled ?? true,
                wednesday_enabled: updated.wednesday_enabled ?? true,
                thursday_enabled: updated.thursday_enabled ?? true,
                friday_enabled: updated.friday_enabled ?? true,
                saturday_enabled: updated.saturday_enabled ?? true,
                sunday_enabled: updated.sunday_enabled ?? true,
              });
            }}
          />
        ) : (
          <div className="ui-small-muted">Sign in to manage schedule settings.</div>
        )}
      </PageControlsModal>

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
          color: ${isDarkMode ? "#60a5fa" : "#2563eb"};
          line-height: 1.1;
        }
        
        .clock-date {
          font-size: 12px;
          color: ${isDarkMode ? "#9ca3af" : "#6b7280"};
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
          background: ${isDarkMode ? "#2d3748" : "white"};
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
          background: ${isDarkMode ? "#4a5568" : "#f8f9fa"};
          gap: 0;
          min-width: 0;
          flex-shrink: 0;
        }
        
        .calendar-header-cell {
          text-align: center;
          font-weight: 600;
          color: ${isDarkMode ? "#e2e8f0" : "#495057"};
          padding: 8px 0;
          border: 1px solid ${isDarkMode ? "#6b7280" : "#dee2e6"};
          border-right: none;
          min-width: 0;
          overflow: hidden;
        }

        .schedule-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          table-layout: fixed;
        }

        .schedule-table thead th {
          position: sticky;
          top: 0;
          z-index: 20000;
          background: ${isDarkMode ? "#4a5568" : "#f8f9fa"};
        }

        .schedule-table thead th.time-header-cell {
          position: sticky;
          top: 0;
          left: 0;
          z-index: 20002;
          background: ${isDarkMode ? "#4a5568" : "#f8f9fa"};
        }

        .schedule-time-row {
          height: 48px;
        }
        
        .calendar-header-cell:last-child {
          border-right: 1px solid ${isDarkMode ? "#6b7280" : "#dee2e6"};
        }
        
        .calendar-header-cell .day-name {
          font-size: 12px;
          font-weight: 500;
        }
        
        .calendar-header-cell .day-date {
          font-size: 14px;
          font-weight: 600;
        }

        .calendar-header-cell.time-header-cell {
          background: ${isDarkMode ? "#4a5568" : "#f8f9fa"};
          color: ${isDarkMode ? "#e2e8f0" : "#495057"};
          font-size: 12px;
          font-weight: 600;
          text-align: center;
          vertical-align: middle;
          padding: 4px 0;
          white-space: nowrap;
          box-sizing: border-box;
          width: 35px;
          min-width: 35px;
          max-width: 35px;
          border: none !important;
          height: 100%;
        }

        .calendar-header-cell.time-header-cell .app-icon {
          display: inline-block;
          vertical-align: middle;
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
          border: 1px solid ${isDarkMode ? "#6b7280" : "#dee2e6"};
          padding: 0;
          min-width: 0;
          min-height: 0;
          grid-auto-rows: minmax(36px, 1fr);
        }

        .calendar-grid.week-view .calendar-cell {
          border: 1px solid ${isDarkMode ? "#6b7280" : "#dee2e6"};
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
          background: ${isDarkMode ? "#4a5568" : "#f8f9fa"};
          color: ${isDarkMode ? "#e2e8f0" : "#495057"};
          font-size: 12px;
          font-weight: 600;
          text-align: center;
          vertical-align: middle;
          padding: 4px 0;
          white-space: nowrap;
          box-sizing: border-box;
          width: 35px;
          min-width: 35px;
          max-width: 35px;
          border: none !important;
          position: sticky;
          left: 0;
          z-index: 1000;
          height: 100%;
        }

        .calendar-cell {
          min-height: 0;
          min-width: 0;
          cursor: pointer;
          position: relative;
          background: ${isDarkMode ? "#2d3748" : "white"};
          color: ${isDarkMode ? "#e2e8f0" : "inherit"};
          box-sizing: border-box;
          text-align: center;
          padding: 1px;
          overflow: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
          height: 100%;
        }

        .calendar-cell:not(.time-label-cell) {
          border: 1px solid ${isDarkMode ? "#6b7280" : "#dee2e6"};
        }

        .calendar-cell::-webkit-scrollbar {
          display: none;
        }


        .calendar-cell.time-slot {
          box-sizing: border-box;
          height: 100%;
          overflow: visible;
        }
        
        .calendar-cell:hover {
          background-color: ${isDarkMode ? "#4a5568" : "#f8f9fa"};
        }
         
        .other-month {
          background-color: ${isDarkMode ? "#1a202c" : "#f8f9fa"};
          color: ${isDarkMode ? "#718096" : "#6c757d"};
        }
        
        .today {
          background-color: ${isDarkMode ? "#1e3a5f" : "#e3f2fd"} !important;
          font-weight: bold;
        }
        
        .today .date-number {
          background-color: ${isDarkMode ? "#2563eb" : "#2196f3"};
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
          background-color: ${isDarkMode ? "#2563eb" : "#2196f3"} !important;
          color: white !important;
        }

        .past-header {
          background-color: ${isDarkMode ? "#1f2937" : "#d1d5db"} !important;
          color: ${isDarkMode ? "#9ca3af" : "#374151"} !important;
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
          color: ${isDarkMode ? "#2563eb" : "#2196f3"};
          border-radius: 50%;
          width: 21px;
          height: 21px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0px auto 0;
        }
        
        .today-column {
          background-color: ${isDarkMode ? "#1e3a5f" : "#e3f2fd"} !important;
        }
        
        .today-column:hover {
          background-color: ${isDarkMode ? "#2d4a6f" : "#bbdefb"} !important;
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
        
        .appointment-dot-wrap {
          position: relative;
          overflow: visible;
          margin-bottom: 2px;
        }

        .appointment-dot {
          background: #007bff;
          color: white;
          padding: 4px 18px 4px 6px;
          border-radius: 8px;
          font-size: 10px;
          margin-bottom: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          min-width: 0;
          cursor: pointer;
          transition: background-color 0.2s;
          text-align: left;
          position: relative;
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
          padding: 2px 18px 2px 4px;
          overflow: hidden;
          cursor: pointer;
          font-size: 10px;
          white-space: nowrap;
          text-overflow: ellipsis;
          min-width: 0;
          box-sizing: border-box;
          left: 0;
          transition: opacity 0.2s;
          text-align: left;
          position: relative;
        }

        .appointment-event-wrap {
          overflow: visible;
        }

        .appointment-event:hover {
          opacity: 0.85;
        }

        .schedule-paid-toggle {
          width: 16px;
          height: 16px;
          border-radius: 9999px;
          border: 1px solid rgba(255, 255, 255, 0.65);
          background: rgba(255, 255, 255, 0.18);
          color: rgba(255, 255, 255, 0.95);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          cursor: pointer;
          transition: transform 0.12s ease, background-color 0.12s ease, border-color 0.12s ease;
          flex-shrink: 0;
        }

        .schedule-paid-toggle:hover {
          transform: scale(1.06);
          background: rgba(255, 255, 255, 0.28);
        }

        .schedule-paid-toggle.is-paid {
          background: #16a34a;
          border-color: #14532d;
          color: #ffffff;
        }

        .schedule-paid-toggle.is-unpaid {
          background: rgba(255, 255, 255, 0.16);
          border-color: rgba(255, 255, 255, 0.7);
          color: rgba(255, 255, 255, 0.95);
        }

        .schedule-paid-toggle--month {
          position: absolute;
          right: 4px;
          bottom: 4px;
          z-index: 11560;
        }

        .schedule-paid-toggle--floating {
          position: absolute;
          right: 4px;
          bottom: 4px;
          z-index: 11560;
          box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.25);
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
          background: ${isDarkMode ? "#2d3748" : "white"};
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
          border-bottom: 1px solid ${isDarkMode ? "#4a5568" : "#eee"};
          position: sticky;
          top: 0;
          background: ${isDarkMode ? "#2d3748" : "white"};
          border-top-left-radius: 12px;
          border-top-right-radius: 12px;
          z-index: 1;
        }

        .overlap-modal-title {
          font-weight: 600;
          font-size: 14px;
          color: ${isDarkMode ? "#e2e8f0" : "#333"};
        }

        .overlap-modal-close {
          background: none;
          border: none;
          font-size: 22px;
          cursor: pointer;
          color: ${isDarkMode ? "#9ca3af" : "#666"};
          line-height: 1;
          padding: 0 4px;
        }

        .overlap-modal-close:hover {
          color: ${isDarkMode ? "#e2e8f0" : "#333"};
        }

        .overlap-event-list {
          padding: 4px 0;
        }

        .overlap-event-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 16px;
          border-bottom: 1px solid ${isDarkMode ? "#4a5568" : "#eee"};
          cursor: pointer;
          transition: background 0.2s;
        }

        .overlap-event-item:hover {
          background: ${isDarkMode ? "#4a5568" : "#f5f5f5"};
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
          color: ${isDarkMode ? "#e2e8f0" : "#333"};
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
          color: ${isDarkMode ? "#9ca3af" : "#666"};
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .overlap-event-secondary {
          display: flex;
          gap: 12px;
          font-size: 11px;
          color: ${isDarkMode ? "#9ca3af" : "#888"};
          margin-top: 2px;
        }

        /* Responsive Styles */
        @media (max-width: 768px) {
          .calendar-header-cell {
            padding: 6px 0;
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
            padding: 3px 0 3px 4px;
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
            padding: 4px 0;
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
            padding: 2px 0 2px 3px;
          }
          .appointment-event {
            font-size: 7px;
            padding: 1px 2px;
          }
        }
        
        .drag-over {
          background-color: ${isDarkMode ? "#4a5568" : "#e3f2fd"} !important;
          border: 1px dashed ${isDarkMode ? "#90cdf4" : "#2196f3"} !important;
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
