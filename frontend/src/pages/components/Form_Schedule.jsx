/*
 * ============================================================
 * FILE: Form_Schedule.jsx
 *
 * PURPOSE:
 *   Create/edit form for scheduling events (appointments, recurring
 *   series, meetings, and tasks). Dynamically shows or hides client,
 *   service, and employee selectors based on the chosen event type,
 *   enforces business-hour validation, and supports permission-based
 *   employee selection locking for self-scheduling users.
 *
 * FUNCTIONAL PARTS:
 *   [1] Constants          — APPOINTMENT_TYPES, APPOINTMENT_TYPE_CONFIG,
 *                            RECURRENCE_OPTIONS, ATTENDEE_STATUS_STYLE
 *   [2] State              — clients, services, employees lists; time/duration
 *                            errors; lazy-load flags; form data
 *   [3] Effects            — load services and employees (or use props);
 *                            populate form on edit; auto-select current user
 *                            for write-only permission holders
 *   [4] Handlers           — handleChange, handleServiceChange,
 *                            handleDurationChange, handleClientChange,
 *                            handleEmployeeChange, handleClientDropdownOpen,
 *                            handleSubmit, extractLocalParts, getInitialFormData
 *   [5] Render: Header     — dynamic title based on appointment type and mode
 *   [6] Render: Form Body  — event type selector, conditional client/service/
 *                            employee dropdowns, recurrence options, duration,
 *                            date+time pickers, attendee status panel, notes
 *   [7] Render: Footer     — Cancel and Book/Save buttons
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-03-01 | Claude  | Added section comments and top-level documentation
 *   2026-03-01 | Claude  | P5-A — Added status field (APPOINTMENT_STATUS_OPTIONS, formData.status, submitData.status)
 *   2026-03-11 | Claude  | Added is_paid toggle, discount field, Pay-via-Sales button, resource consumption panel
 *   2026-06-13 | GitHub Copilot | Added schedule client create-from-search flow (+ button) with prefill and auto-select
 *   2026-06-13 | GitHub Copilot | Added schedule service create-from-search flow (+ button) with prefill and auto-select
 *   2026-06-13 | GitHub Copilot | Added schedule production item create-from-search flow (+ button) with prefill and auto-select
 *   2026-06-13 | GitHub Copilot | Switched schedule form to a single datetime input and moved discount handling to Sales checkout
 *   2026-06-13 | GitHub Copilot | Added per-appointment Reminder toggle and wired schedule-level reminder defaults
 * ============================================================
 */

import React, { useState, useEffect } from "react";
import useStore from "../../services/useStore";
import { isudAPI, serviceRelationsAPI, inventoryAPI, productRelationsAPI, productionAPI, scheduleAPI, getDetailedApiErrorMessage } from "../../services/api";
import { useNavigate } from "react-router-dom";
import { XMarkIcon, CheckIcon, CreditCardIcon, CogIcon, BeakerIcon, WrenchScrewdriverIcon } from "@heroicons/react/24/outline";
import Button_Toolbar from "./Button_Toolbar";
import Footer_Actions from "./Footer_Actions";
import Gate_Permission from "./Gate_Permission";
import Dropdown_Custom from "./Dropdown_Custom";

// ─── 1 CONSTANTS ───────────────────────────────────────────────────────────────
const APPOINTMENT_TYPES = [
  { value: "one_time", label: "Appointment", description: "Client appointment with service" },
  { value: "series", label: "Recurring", description: "Recurring appointment series" },
  { value: "meeting", label: "Meeting", description: "Internal meeting (employees only)" },
  { value: "task", label: "Task", description: "Personal task or reminder" },
];

// Define which fields are needed for each appointment type
const APPOINTMENT_TYPE_CONFIG = {
  one_time: { needsClient: true, needsService: true, needsEmployee: true, clientMultiple: true, employeeMultiple: true },
  series: { needsClient: true, needsService: true, needsEmployee: true, clientMultiple: true, employeeMultiple: true },
  meeting: { needsClient: false, needsService: false, needsEmployee: true, clientMultiple: false, employeeMultiple: true },
  task: { needsClient: false, needsService: false, needsEmployee: true, clientMultiple: false, employeeMultiple: false },
};

const RECURRENCE_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-Weekly" },
  { value: "monthly", label: "Monthly" },
];

const ATTENDEE_STATUS_STYLE = {
  pending: { label: "Pending", bg: "#fef3c7", color: "#92400e" },
  accepted: { label: "Accepted", bg: "#d1fae5", color: "#065f46" },
  declined: { label: "Declined", bg: "#fee2e2", color: "#991b1b" },
};

const APPOINTMENT_STATUS_OPTIONS = [
  { value: "scheduled", label: "Scheduled" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

// ─── 2 STATE ───────────────────────────────────────────────────────────────────
export default function Form_Schedule({ appointment, onSubmit, onCancel, onDelete, clients: clientsProp, services: servicesProp, employees: employeesProp, attendees = [], scheduleSettings = null }) {
  const { closeModal, hasPermission, user, openAddClientModal, openAddServiceModal, openAddInventoryModal } = useStore();
  const [clients, setClients] = useState(clientsProp || []);
  const [services, setServices] = useState(servicesProp || []);
  const [employees, setEmployees] = useState(employeesProp || []);
  const [timeError, setTimeError] = useState("");
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientsLoaded, setClientsLoaded] = useState(false);
  const [durationError, setDurationError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientMultiMode, setClientMultiMode] = useState(false);
  const [employeeMultiMode, setEmployeeMultiMode] = useState(false);
  const [serviceResources, setServiceResources] = useState([]);
  const [inventoryMap, setInventoryMap] = useState({});
  // Linked task (parent task) state
  const [linkedTasks, setLinkedTasks] = useState([]);
  const [linkedTasksLoading, setLinkedTasksLoading] = useState(false);
  const [linkedTasksLoaded, setLinkedTasksLoaded] = useState(false);
  const navigate = useNavigate();

  // ─── 3 EFFECTS ───────────────────────────────────────────────────────────────
  // Load services and employees if not provided as props (clients loaded on-demand)
  useEffect(() => {
    // Use props if provided
    if (servicesProp && servicesProp.length > 0) {
      setServices(servicesProp);
    }
    if (employeesProp && employeesProp.length > 0) {
      setEmployees(employeesProp);
    }
    if (clientsProp && clientsProp.length > 0) {
      setClients(clientsProp);
      setClientsLoaded(true);
    }

    // Only fetch services and employees if props are not provided
    const needsServices = !servicesProp || servicesProp.length === 0;
    const needsEmployees = !employeesProp || employeesProp.length === 0;

    if (needsServices || needsEmployees) {
      let cancelled = false;
      const load = async () => {
        try {
          const promises = [];
          if (needsServices) promises.push(isudAPI.services.getAll());
          if (needsEmployees) promises.push(isudAPI.schedule.getAvailableEmployees());

          const results = await Promise.all(promises);
          if (cancelled) return;

          let resultIndex = 0;
          if (needsServices) {
            const servicesData = results[resultIndex]?.data ?? results[resultIndex];
            if (Array.isArray(servicesData)) setServices(servicesData);
            resultIndex++;
          }
          if (needsEmployees) {
            const employeesRaw = results[resultIndex]?.data ?? results[resultIndex];
            if (Array.isArray(employeesRaw)) {
              const transformed = employeesRaw.map((emp) => ({
                id: emp.id,
                first_name: emp.first_name ?? emp.firstName ?? "",
                last_name: emp.last_name ?? emp.lastName ?? "",
                role: emp.role ?? "",
              }));
              setEmployees(transformed);
            }
          }
        } catch (err) {
          if (!cancelled) console.error("Form_Schedule failed to load services/employees", err);
        }
      };
      load();
      return () => {
        cancelled = true;
      };
    }
  }, [servicesProp, employeesProp, clientsProp]);

  // ─── 4 HANDLERS ──────────────────────────────────────────────────────────────
  // Load clients on-demand when dropdown opens
  const handleClientDropdownOpen = async () => {
    // Skip if already loaded or loading
    if (clientsLoaded || clientsLoading || (clients && clients.length > 0)) return;

    setClientsLoading(true);
    try {
      const response = await isudAPI.clients.getAll();
      const clientsData = response?.data ?? response;
      if (Array.isArray(clientsData)) {
        setClients(clientsData);
        setClientsLoaded(true);
      }
    } catch (err) {
      console.error("Failed to load clients:", err);
    } finally {
      setClientsLoading(false);
    }
  };

  const handleCreateClientFromSearch = (searchText) => {
    const prefillName = String(searchText || "").trim();
    openAddClientModal({
      prefill: { name: prefillName },
      onCreated: (newClient) => {
        if (!newClient?.id) return;

        setClients((prev) => {
          const list = Array.isArray(prev) ? prev : [];
          if (list.some((client) => client.id === newClient.id)) return list;
          return [...list, newClient];
        });
        setClientsLoaded(true);

        setFormData((prev) => ({
          ...prev,
          client_ids: [newClient.id],
        }));
      },
    });
  };

  const handleCreateServiceFromSearch = (searchText) => {
    const prefillName = String(searchText || "").trim();
    openAddServiceModal({
      prefill: { name: prefillName },
      onCreated: (newService) => {
        if (!newService?.id) return;

        setServices((prev) => {
          const list = Array.isArray(prev) ? prev : [];
          if (list.some((service) => service.id === newService.id)) return list;
          return [...list, newService];
        });

        setFormData((prev) => ({
          ...prev,
          service_id: newService.id,
        }));
      },
    });
  };

  const handleLinkedTaskOpen = async () => {
    if (linkedTasksLoaded || linkedTasksLoading) return;
    setLinkedTasksLoading(true);
    try {
      const res = await scheduleAPI.getAll();
      const data = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      setLinkedTasks(data.filter((s) => s.appointment_type === "task" && s.id !== appointment?.id));
      setLinkedTasksLoaded(true);
    } catch {
      // silently degrade
    } finally {
      setLinkedTasksLoading(false);
    }
  };

  // Extract local YYYY-MM-DD and HH:mm from a Date or ISO string reliably (no timezone shifts)
  const extractLocalParts = (value) => {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return { date: "", time: "" };
    const pad = (n) => String(n).padStart(2, "0");
    return {
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    };
  };

  const getInitialFormData = () => {
    if (appointment && appointment.appointment_date) {
      const { date, time } = extractLocalParts(appointment.appointment_date);
      const recEndDate = appointment.recurrence_end_date ? extractLocalParts(appointment.recurrence_end_date).date : "";
      return {
        client_ids: appointment.client_id ? [appointment.client_id] : [],
        service_id: appointment.service_id || "",
        employee_ids: appointment.employee_id ? [appointment.employee_id] : [],
        appointment_datetime: `${date}T${time}`,
        notes: appointment.notes || "",
        appointment_type: appointment.appointment_type || "one_time",
        recurrence_frequency: appointment.recurrence_frequency || "",
        recurrence_end_type: appointment.recurrence_count ? "count" : "date",
        recurrence_end_date: recEndDate,
        recurrence_count: appointment.recurrence_count || "",
        duration_minutes: appointment.duration_minutes || "",
        status: appointment.status || "scheduled",
        is_paid: appointment.is_paid || false,
        send_reminder: appointment.send_reminder ?? scheduleSettings?.reminder_send_notification ?? true,
        discount: appointment.discount || 0,
        sale_transaction_id: appointment.sale_transaction_id || null,
        parent_schedule_id: appointment.parent_schedule_id || null,
      };
    }
    return {
      client_ids: [],
      service_id: "",
      employee_ids: [],
      appointment_datetime: "",
      notes: "",
      appointment_type: "one_time",
      recurrence_frequency: "",
      recurrence_end_type: "date",
      recurrence_end_date: "",
      recurrence_count: "",
      duration_minutes: "",
      status: "scheduled",
      is_paid: false,
      send_reminder: scheduleSettings?.reminder_send_notification ?? true,
      discount: 0,
      sale_transaction_id: null,
      parent_schedule_id: null,
    };
  };

  const [formData, setFormData] = useState(getInitialFormData);
  // Track whether duration was manually changed (independent of service)
  const [durationManuallySet, setDurationManuallySet] = useState(false);

  useEffect(() => {
    setFormData(getInitialFormData());
  }, [appointment, scheduleSettings?.reminder_send_notification]);

  useEffect(() => {
    setClientMultiMode(Boolean((appointment?.client_ids || []).length > 1));
    setEmployeeMultiMode(Boolean((appointment?.employee_ids || []).length > 1));
  }, [appointment?.id]);

  // Load resource consumption info when service changes
  const loadServiceResources = async (serviceId) => {
    if (!serviceId) {
      setServiceResources([]);
      return;
    }
    try {
      const res = await serviceRelationsAPI.getResources(serviceId);
      const resources = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      setServiceResources(resources);
      // Fetch inventory names for each resource
      const ids = [...new Set(resources.map((r) => r.inventory_id).filter(Boolean))];
      if (ids.length > 0) {
        const invRes = await inventoryAPI.getAll();
        const invData = Array.isArray(invRes?.data) ? invRes.data : Array.isArray(invRes) ? invRes : [];
        const map = {};
        invData.forEach((item) => {
          map[item.id] = item.name;
        });
        setInventoryMap(map);
      }
    } catch (err) {
      console.error("Failed to load service resources:", err);
      setServiceResources([]);
    }
  };

  useEffect(() => {
    loadServiceResources(formData.service_id);
  }, [formData.service_id]);

  // Auto-select current user if they can only schedule for themselves
  const isWriteAll = hasPermission("schedule", "write_all") || hasPermission("schedule", "admin");
  const isWriteOnly = hasPermission("schedule", "write") && !isWriteAll;

  useEffect(() => {
    if (user && isWriteOnly) {
      // Lock employee selection to current user when write-only
      const self = employees.find((e) => e.id === user.id || `${e.first_name} ${e.last_name}`.trim().toLowerCase() === `${user.first_name} ${user.last_name}`.trim().toLowerCase());
      if (self && (!Array.isArray(formData.employee_ids) || formData.employee_ids[0] !== self.id)) {
        setFormData((prev) => ({ ...prev, employee_ids: [self.id] }));
      }
    } else if ((!Array.isArray(formData.employee_ids) || formData.employee_ids.length === 0) && employees.length === 1) {
      setFormData((prev) => ({ ...prev, employee_ids: [employees[0].id] }));
    }
  }, [employees, formData.employee_ids, isWriteOnly, user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (name === "duration_minutes") {
      setDurationError("");
    }
  };

  const handleServiceChange = (e) => {
    const { value } = e.target;
    const selectedService = services.find((s) => s.id === value);
    setFormData((prev) => ({
      ...prev,
      service_id: value,
      duration_minutes: selectedService?.duration_minutes ? selectedService.duration_minutes : prev.duration_minutes,
    }));
    setDurationManuallySet(false);
    setServiceResources([]);
    if (selectedService?.duration_minutes) {
      setDurationError("");
    }
  };

  const handleDurationChange = (e) => {
    const { value } = e.target;
    setFormData((prev) => ({
      ...prev,
      duration_minutes: value,
    }));
    setDurationManuallySet(true);
    setDurationError("");
  };

  const handleClientChange = (e) => {
    const next = Array.isArray(e.target.value) ? e.target.value : e.target.value ? [e.target.value] : [];
    setFormData((prev) => ({
      ...prev,
      client_ids: next,
    }));
  };

  const handleEmployeeChange = (e) => {
    const next = Array.isArray(e.target.value) ? e.target.value : e.target.value ? [e.target.value] : [];
    setFormData((prev) => ({
      ...prev,
      employee_ids: next,
    }));
  };

  const toggleClientMultiMode = () => {
    setClientMultiMode((prev) => {
      const next = !prev;
      if (!next) {
        setFormData((current) => ({
          ...current,
          client_ids: current.client_ids?.length ? [current.client_ids[0]] : [],
        }));
      }
      return next;
    });
  };

  const toggleEmployeeMultiMode = () => {
    setEmployeeMultiMode((prev) => {
      const next = !prev;
      if (!next) {
        setFormData((current) => ({
          ...current,
          employee_ids: current.employee_ids?.length ? [current.employee_ids[0]] : [],
        }));
      }
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    setSubmitError("");

    const dateTimeText = formData.appointment_datetime;
    const [dateText, rawTimeText] = String(dateTimeText || "").split("T");
    const [hourText, minuteText] = String(rawTimeText || "").split(":");

    if (!dateText || !hourText || !minuteText) {
      setTimeError("Please select a valid date and time");
      return;
    }

    const hour = parseInt(hourText, 10);
    const minute = parseInt(minuteText, 10);

    if (hour < 6 || hour > 21) {
      setTimeError("Can only schedule between 6:00 and 21:00");
      return;
    }
    setTimeError("");

    if (!formData.duration_minutes) {
      setDurationError("Please set a duration for this event");
      return;
    }

    // Submit a naive local ISO string (no timezone) to avoid shifts server-side
    const appointmentDateStr = `${dateText}T${hourText}:${minuteText}:00`;

    // Get config for current type to determine required fields
    const config = APPOINTMENT_TYPE_CONFIG[formData.appointment_type] || APPOINTMENT_TYPE_CONFIG.one_time;

    const employeeIds = Array.isArray(formData.employee_ids) ? formData.employee_ids.filter(Boolean) : [];
    const clientIds = Array.isArray(formData.client_ids) ? formData.client_ids.filter(Boolean) : [];

    const isSeries = formData.appointment_type === "series";
    const submitData = {
      employee_id: employeeIds[0] || "",
      employee_ids: employeeIds,
      appointment_date: appointmentDateStr,
      notes: formData.notes,
      appointment_type: formData.appointment_type,
      recurrence_frequency: isSeries ? formData.recurrence_frequency : null,
      recurrence_end_date: isSeries && formData.recurrence_end_type === "date" && formData.recurrence_end_date ? `${formData.recurrence_end_date}T23:59:00` : null,
      recurrence_count: isSeries && formData.recurrence_end_type === "count" && formData.recurrence_count ? parseInt(formData.recurrence_count) : null,
      is_recurring_master: isSeries,
      duration_minutes: parseInt(formData.duration_minutes),
      status: formData.status,
      is_paid: formData.is_paid,
      send_reminder: !!formData.send_reminder,
      discount: parseFloat(formData.discount) || 0,
      sale_transaction_id: formData.sale_transaction_id || null,
      parent_schedule_id: formData.parent_schedule_id || null,
    };

    // Only include client_id and service_id if needed for this type
    if (config.needsClient && clientIds.length > 0) {
      submitData.client_id = clientIds[0];
      submitData.client_ids = clientIds;
    }
    if (config.needsService && formData.service_id) {
      submitData.service_id = formData.service_id;
    }

    try {
      setIsSubmitting(true);
      await Promise.resolve(onSubmit(submitData));
    } catch (error) {
      setSubmitError(getDetailedApiErrorMessage(error, "Failed to save appointment"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── 5 RENDER ─────────────────────────────────────────────────────────────────
  // Get config for current appointment type
  const typeConfig = APPOINTMENT_TYPE_CONFIG[formData.appointment_type] || APPOINTMENT_TYPE_CONFIG.one_time;
  const appointmentDateOnly = formData.appointment_datetime ? formData.appointment_datetime.split("T")[0] : "";

  const selectedEmployeeColor = employees.find((employee) => employee.id === formData.employee_ids?.[0])?.color || "#64748b";
  const reminderButtonStyle = formData.send_reminder
    ? {
        minWidth: 96,
        whiteSpace: "nowrap",
        backgroundColor: `${selectedEmployeeColor}1A`,
        borderColor: `${selectedEmployeeColor}66`,
        color: selectedEmployeeColor,
      }
    : { minWidth: 96, whiteSpace: "nowrap" };

  const formTitle = appointment ? (formData.appointment_type === "meeting" ? "Edit Meeting" : formData.appointment_type === "task" ? "Edit Task" : "Edit Appointment") : formData.appointment_type === "meeting" ? "New Meeting" : formData.appointment_type === "task" ? "New Task" : "New Appointment";

  return (
    <div className="d-flex flex-column h-100 min-h-0 bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex-shrink-0 p-2 border-bottom border-gray-200 dark:border-gray-700 d-flex align-items-center bg-white dark:bg-gray-900">
        <h6 className="mb-0 fw-semibold text-gray-900 dark:text-gray-100">{formTitle}</h6>
      </div>

      {/* ─── 6 RENDER: FORM BODY ────────────────────────────────────────────────── */}
      {/* Scrollable body — content floats to bottom */}
      <div className="flex-grow-1 min-h-0 overflow-auto no-scrollbar px-3 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 d-flex flex-column">
        <div className="flex-grow-1" />
        <form id="schedule-form" onSubmit={handleSubmit} className="d-flex flex-column gap-2 pt-3 pb-2">
          {(formData.appointment_type === "one_time" || formData.appointment_type === "series") && (
            <>
              {/* [Event Type][Event Status] */}
              <div className="row g-2">
                <div className="col-6">
                  <Dropdown_Custom
                    name="appointment_type"
                    value={formData.appointment_type}
                    onChange={handleChange}
                    options={APPOINTMENT_TYPES.map((type) => ({
                      value: type.value,
                      label: type.label,
                    }))}
                    placeholder="Select event type"
                    required
                    label="Event Type"
                    openUpward
                    closeOnSelect
                  />
                </div>
                <div className="col-6">
                  <Dropdown_Custom name="status" value={formData.status} onChange={handleChange} options={APPOINTMENT_STATUS_OPTIONS} placeholder="Select status" required label="Status" openUpward closeOnSelect />
                </div>
              </div>

              {/* [Select Clients][Select Employees] */}
              <div className="row g-2">
                <div className="col-6">
                  {typeConfig.needsClient && (
                    <Dropdown_Custom
                      name="client_id"
                      value={clientMultiMode ? formData.client_ids : formData.client_ids[0] || ""}
                      onChange={handleClientChange}
                      options={clients.map((client) => ({
                        value: client.id,
                        label: `${client.first_name || ""} ${client.last_name || ""}`.trim() || client.name,
                      }))}
                      placeholder={typeConfig.clientMultiple ? "Select clients" : "Select a client"}
                      required
                      searchable={true}
                      onOpen={handleClientDropdownOpen}
                      loading={clientsLoading}
                      multiSelect={clientMultiMode}
                      useCountLabelForMultiSelect={clientMultiMode}
                      showSelectionSummary={true}
                      selectionSummaryEmptyLabel="0 selected"
                      showActionFooter
                      showClearButton
                      allowMultiModeToggle
                      isMultiModeActive={clientMultiMode}
                      onToggleMultiMode={toggleClientMultiMode}
                      openUpward
                      closeOnSelect={!clientMultiMode}
                    />
                  )}
                </div>
                <div className="col-6">
                  {typeConfig.needsEmployee && (
                    <div>
                      <Dropdown_Custom
                        name="employee_id"
                        value={employeeMultiMode ? formData.employee_ids : formData.employee_ids[0] || ""}
                        onChange={handleEmployeeChange}
                        options={(isWriteOnly && user ? employees.filter((e) => e.id === user.id || `${e.first_name} ${e.last_name}`.trim().toLowerCase() === `${user.first_name} ${user.last_name}`.trim().toLowerCase()) : employees).map((employee) => ({
                          value: employee.id,
                          label: `${employee.first_name} ${employee.last_name}`.trim(),
                        }))}
                        placeholder={typeConfig.employeeMultiple ? "Select employees" : "Select employee"}
                        required
                        searchable={true}
                        disabled={isWriteOnly}
                        multiSelect={employeeMultiMode}
                        useCountLabelForMultiSelect={employeeMultiMode}
                        showSelectionSummary={true}
                        selectionSummaryEmptyLabel="0 selected"
                        showActionFooter
                        showClearButton
                        allowMultiModeToggle
                        isMultiModeActive={employeeMultiMode}
                        onToggleMultiMode={toggleEmployeeMultiMode}
                        openUpward
                        closeOnSelect={!employeeMultiMode}
                      />
                      {(isWriteOnly || employees.length === 1) && <p className="text-xs text-gray-500 mt-1">You can only schedule for yourself</p>}
                    </div>
                  )}
                </div>
              </div>

              {/* [Select Service][Date/time] */}
              <div className="row g-2">
                <div className="col-6">
                  {typeConfig.needsService && (
                    <Dropdown_Custom
                      name="service_id"
                      value={formData.service_id}
                      onChange={handleServiceChange}
                      options={services.map((service) => ({
                        value: service.id,
                        label: `${service.name} - $${service.price}`,
                      }))}
                      placeholder="Select a service"
                      required
                      searchable={true}
                      openUpward
                      closeOnSelect
                    />
                  )}
                </div>
                <div className="col-6">
                  <div className="form-floating">
                    <input type="datetime-local" id="appointment_datetime" name="appointment_datetime" required value={formData.appointment_datetime} onChange={handleChange} className="form-control form-control-sm" placeholder="Date and time" />
                    <label htmlFor="appointment_datetime">Date & Time</label>
                  </div>
                  {timeError && <p className="text-red-500 text-xs">{timeError}</p>}
                </div>
              </div>
            </>
          )}

          {formData.appointment_type === "meeting" && (
            <>
              {/* [Event Type][Event Status] */}
              <div className="row g-2">
                <div className="col-6">
                  <Dropdown_Custom name="appointment_type" value={formData.appointment_type} onChange={handleChange} options={APPOINTMENT_TYPES.map((type) => ({ value: type.value, label: type.label }))} placeholder="Select event type" required label="Event Type" openUpward closeOnSelect />
                </div>
                <div className="col-6">
                  <Dropdown_Custom name="status" value={formData.status} onChange={handleChange} options={APPOINTMENT_STATUS_OPTIONS} placeholder="Select status" required label="Status" openUpward closeOnSelect />
                </div>
              </div>

              {/* [Meeting Title][Attendees] */}
              <div className="row g-2">
                <div className="col-6">
                  <div className="form-floating">
                    <input type="text" id="meeting_title" name="notes" value={formData.notes} onChange={handleChange} placeholder="Meeting Title" className="form-control form-control-sm" required />
                    <label htmlFor="meeting_title">Meeting Title</label>
                  </div>
                </div>
                <div className="col-6">
                  {typeConfig.needsEmployee && (
                    <div>
                      <Dropdown_Custom
                        name="employee_id"
                        value={employeeMultiMode ? formData.employee_ids : formData.employee_ids[0] || ""}
                        onChange={handleEmployeeChange}
                        options={(isWriteOnly && user ? employees.filter((e) => e.id === user.id || `${e.first_name} ${e.last_name}`.trim().toLowerCase() === `${user.first_name} ${user.last_name}`.trim().toLowerCase()) : employees).map((employee) => ({
                          value: employee.id,
                          label: `${employee.first_name} ${employee.last_name}`.trim(),
                        }))}
                        placeholder="Select attendees"
                        required
                        searchable={true}
                        disabled={isWriteOnly}
                        multiSelect={employeeMultiMode}
                        useCountLabelForMultiSelect={employeeMultiMode}
                        showSelectionSummary={true}
                        selectionSummaryEmptyLabel="0 selected"
                        showActionFooter
                        showClearButton
                        allowMultiModeToggle
                        isMultiModeActive={employeeMultiMode}
                        onToggleMultiMode={toggleEmployeeMultiMode}
                        openUpward
                        closeOnSelect={!employeeMultiMode}
                      />
                      {(isWriteOnly || employees.length === 1) && <p className="text-xs text-gray-500 mt-1">You can only schedule for yourself</p>}
                    </div>
                  )}
                </div>
              </div>

              {/* [Duration][Date/Time] */}
              <div className="row g-2">
                <div className="col-6">
                  <Dropdown_Custom
                    name="duration_minutes"
                    value={formData.duration_minutes}
                    onChange={handleChange}
                    options={[15, 30, 45, 60, 90, 120, 180, 240].map((mins) => ({ value: mins.toString(), label: `${mins} min` }))}
                    placeholder="Select duration"
                    required
                    label="Duration"
                    openUpward
                    closeOnSelect
                  />
                  {durationError && <p className="text-red-500 text-xs mt-1">{durationError}</p>}
                </div>
                <div className="col-6">
                  <div className="form-floating">
                    <input type="datetime-local" id="appointment_datetime" name="appointment_datetime" required value={formData.appointment_datetime} onChange={handleChange} className="form-control form-control-sm" placeholder="Date and time" />
                    <label htmlFor="appointment_datetime">Date & Time</label>
                  </div>
                  {timeError && <p className="text-red-500 text-xs">{timeError}</p>}
                </div>
              </div>
            </>
          )}

          {formData.appointment_type === "task" && (
            <>
              {/* [Event Type][Appointment Status] */}
              <div className="row g-2">
                <div className="col-6">
                  <Dropdown_Custom name="appointment_type" value={formData.appointment_type} onChange={handleChange} options={APPOINTMENT_TYPES.map((type) => ({ value: type.value, label: type.label }))} placeholder="Select event type" required label="Event Type" openUpward closeOnSelect />
                </div>
                <div className="col-6">
                  <Dropdown_Custom name="status" value={formData.status} onChange={handleChange} options={APPOINTMENT_STATUS_OPTIONS} placeholder="Select status" required label="Status" openUpward closeOnSelect />
                </div>
              </div>

              {/* [Link Task][Assigned to] */}
              <div className="row g-2">
                <div className="col-6">
                  <Dropdown_Custom
                    name="parent_schedule_id"
                    value={formData.parent_schedule_id || ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, parent_schedule_id: e.target.value || null }))}
                    options={[
                      { value: "", label: "None" },
                      ...linkedTasks.map((t) => ({
                        value: t.id,
                        label: t.notes ? `${t.notes.slice(0, 40)}${t.notes.length > 40 ? "…" : ""}` : `Task ${String(t.id).slice(0, 8)}`,
                      })),
                    ]}
                    placeholder="Link to parent task"
                    searchable={true}
                    onOpen={handleLinkedTaskOpen}
                    loading={linkedTasksLoading}
                    openUpward
                    closeOnSelect
                  />
                </div>
                <div className="col-6">
                  {typeConfig.needsEmployee && (
                    <div>
                      <Dropdown_Custom
                        name="employee_id"
                        value={employeeMultiMode ? formData.employee_ids : formData.employee_ids[0] || ""}
                        onChange={handleEmployeeChange}
                        options={(isWriteOnly && user ? employees.filter((e) => e.id === user.id || `${e.first_name} ${e.last_name}`.trim().toLowerCase() === `${user.first_name} ${user.last_name}`.trim().toLowerCase()) : employees).map((employee) => ({
                          value: employee.id,
                          label: `${employee.first_name} ${employee.last_name}`.trim(),
                        }))}
                        placeholder="Assign to"
                        required
                        searchable={true}
                        disabled={isWriteOnly}
                        multiSelect={employeeMultiMode}
                        useCountLabelForMultiSelect={employeeMultiMode}
                        showSelectionSummary={true}
                        selectionSummaryEmptyLabel="0 selected"
                        showActionFooter
                        showClearButton
                        allowMultiModeToggle
                        isMultiModeActive={employeeMultiMode}
                        onToggleMultiMode={toggleEmployeeMultiMode}
                        openUpward
                        closeOnSelect={!employeeMultiMode}
                      />
                      {(isWriteOnly || employees.length === 1) && <p className="text-xs text-gray-500 mt-1">You can only schedule for yourself</p>}
                    </div>
                  )}
                </div>
              </div>

              {/* [Duration][Date & Time] */}
              <div className="row g-2">
                <div className="col-6">
                  <Dropdown_Custom
                    name="duration_minutes"
                    value={formData.duration_minutes}
                    onChange={handleChange}
                    options={[15, 30, 45, 60, 90, 120, 180, 240].map((mins) => ({ value: mins.toString(), label: `${mins} min` }))}
                    placeholder="Select duration"
                    required
                    label="Duration"
                    openUpward
                    closeOnSelect
                  />
                  {durationError && <p className="text-red-500 text-xs mt-1">{durationError}</p>}
                </div>
                <div className="col-6">
                  <div className="form-floating">
                    <input type="datetime-local" id="appointment_datetime" name="appointment_datetime" required value={formData.appointment_datetime} onChange={handleChange} className="form-control form-control-sm" placeholder="Date and time" />
                    <label htmlFor="appointment_datetime">Date & Time</label>
                  </div>
                  {timeError && <p className="text-red-500 text-xs">{timeError}</p>}
                </div>
              </div>

              {/* [Task Description — full width textarea] */}
              <div className="form-floating">
                <textarea id="task_notes" name="notes" value={formData.notes} onChange={handleChange} className="form-control form-control-sm" placeholder="Task details" style={{ minHeight: "4rem", resize: "vertical" }} />
                <label htmlFor="task_notes">Task Description</label>
              </div>
            </>
          )}

          {/* Resource Consumption Panel */}
          {typeConfig.needsService && serviceResources.length > 0 && (
            <div className="border rounded p-2" style={{ fontSize: "0.78rem" }}>
              <p className="mb-1 fw-semibold text-gray-600 dark:text-gray-400">Resources Consumed</p>
              <div className="d-flex flex-column gap-1">
                {serviceResources.map((r) => (
                  <div key={r.id} className="d-flex justify-content-between align-items-center">
                    <span className="text-gray-800 dark:text-gray-200">{inventoryMap[r.inventory_id] || r.inventory_id.slice(0, 8)}</span>
                    <div className="d-flex gap-2 align-items-center">
                      <span className="badge bg-secondary">{r.quantity} units</span>
                      {r.consumption_rate_pct != null && <span className="badge bg-info text-dark">{r.consumption_rate_pct}%</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recurrence */}
          {formData.appointment_type === "series" && (
            <>
              <Dropdown_Custom name="recurrence_frequency" value={formData.recurrence_frequency} onChange={handleChange} options={RECURRENCE_OPTIONS} placeholder="Select frequency" required label="Recurrence" openUpward closeOnSelect />

              {/* End type toggle */}
              <div className="d-flex gap-2">
                <button type="button" className={`btn btn-sm flex-1 ${formData.recurrence_end_type === "date" ? "btn-primary" : "btn-outline-secondary"}`} onClick={() => setFormData((prev) => ({ ...prev, recurrence_end_type: "date", recurrence_count: "" }))}>
                  End by date
                </button>
                <button type="button" className={`btn btn-sm flex-1 ${formData.recurrence_end_type === "count" ? "btn-primary" : "btn-outline-secondary"}`} onClick={() => setFormData((prev) => ({ ...prev, recurrence_end_type: "count", recurrence_end_date: "" }))}>
                  End after N times
                </button>
              </div>

              {formData.recurrence_end_type === "date" && (
                <div className="form-floating">
                  <input type="date" id="recurrence_end_date" name="recurrence_end_date" value={formData.recurrence_end_date} onChange={handleChange} className="form-control form-control-sm" placeholder="End Date" min={appointmentDateOnly || undefined} />
                  <label htmlFor="recurrence_end_date">Repeat until</label>
                </div>
              )}

              {formData.recurrence_end_type === "count" && (
                <div className="form-floating">
                  <input type="number" id="recurrence_count" name="recurrence_count" value={formData.recurrence_count} onChange={handleChange} className="form-control form-control-sm" placeholder="Occurrences" min="1" max="365" />
                  <label htmlFor="recurrence_count">Number of occurrences</label>
                </div>
              )}
            </>
          )}

          {/* Notes — shown for appointment/series types */}
          {(formData.appointment_type === "one_time" || formData.appointment_type === "series") && (
            <div className="form-floating">
              <textarea id="notes" name="notes" value={formData.notes} onChange={handleChange} className="form-control form-control-sm border-0" placeholder="Notes" />
              <label htmlFor="notes">Notes (optional)</label>
            </div>
          )}

          {/* Attendee status panel — only when editing an existing meeting */}
          {appointment?.id && formData.appointment_type === "meeting" && attendees.length > 0 && (
            <div className="border rounded p-2" style={{ fontSize: "0.8rem" }}>
              <p className="mb-1 fw-semibold text-gray-700 dark:text-gray-300">Attendees</p>
              <div className="d-flex flex-column gap-1">
                {attendees.map((att) => {
                  const emp = att.user_id ? employees.find((e) => e.id === att.user_id) : null;
                  const cli = att.client_id ? clients.find((c) => c.id === att.client_id) : null;
                  const name = emp ? `${emp.first_name} ${emp.last_name}`.trim() : cli ? cli.name : "Unknown";
                  const style = ATTENDEE_STATUS_STYLE[att.attendance_status] || ATTENDEE_STATUS_STYLE.pending;
                  return (
                    <div key={att.id} className="d-flex align-items-center justify-content-between gap-2">
                      <span className="text-gray-800 dark:text-gray-200">{name}</span>
                      <span
                        style={{
                          backgroundColor: style.bg,
                          color: style.color,
                          borderRadius: "9999px",
                          padding: "1px 8px",
                          fontSize: "0.7rem",
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {style.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {appointment?.id && onDelete && (
            <div className="row mt-3">
              <div className="col-12 d-flex justify-content-center">
                <Button_Toolbar icon={XMarkIcon} label="Delete" onClick={onDelete} className="btn-outline-danger" title="Delete appointment" />
              </div>
            </div>
          )}

          {submitError && (
            <div className="alert alert-danger py-2 mb-0" role="alert" style={{ fontSize: "0.8rem" }}>
              {submitError}
            </div>
          )}
        </form>
      </div>

      {/* ─── 7 RENDER: FOOTER ───────────────────────────────────────────────────── */}
      {/* Footer */}
      <div className="flex-shrink-0 border-top border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 app-footer-padding app-form-footer app-standard-footer">
        <Footer_Actions
          start={<Button_Toolbar icon={CheckIcon} label={isSubmitting ? "Saving..." : appointment ? "Save" : "Book"} type="submit" form="schedule-form" className="btn-outline-secondary" title={appointment ? "Save changes" : "Book appointment"} disabled={isSubmitting} />}
          center={<Button_Toolbar icon={XMarkIcon} label="Cancel" onClick={onCancel} className="btn-outline-secondary" title="Cancel" />}
          end={null}
        />
      </div>
    </div>
  );
}
