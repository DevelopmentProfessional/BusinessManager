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
 *   [7] Render: Footer     — Delete, Send Reminder, Cancel, and Book/Save buttons
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-03-01 | Claude  | Added section comments and top-level documentation
 *   2026-03-01 | Claude  | P5-A — Added status field (APPOINTMENT_STATUS_OPTIONS, formData.status, submitData.status)
 *   2026-03-11 | Claude  | Added is_paid toggle, discount field, Pay-via-Sales button, resource consumption panel
 * ============================================================
 */

import React, { useState, useEffect } from 'react';
import useStore from '../../services/useStore';
import { isudAPI, serviceRelationsAPI, inventoryAPI, productRelationsAPI, productionAPI } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { XMarkIcon, CheckIcon, TrashIcon, EnvelopeIcon, CreditCardIcon, CogIcon, BeakerIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/outline';
import Button_Toolbar from './Button_Toolbar';
import Gate_Permission from './Gate_Permission';
import Dropdown_Custom from './Dropdown_Custom';

// ─── 1 CONSTANTS ───────────────────────────────────────────────────────────────
const APPOINTMENT_TYPES = [
  { value: 'one_time', label: 'Appointment', description: 'Client appointment with service' },
  { value: 'series', label: 'Recurring', description: 'Recurring appointment series' },
  { value: 'meeting', label: 'Meeting', description: 'Internal meeting (employees only)' },
  { value: 'task', label: 'Task', description: 'Personal task or reminder' }
];

// Define which fields are needed for each appointment type
const APPOINTMENT_TYPE_CONFIG = {
  one_time: { needsClient: true, needsService: true, needsEmployee: true, clientMultiple: true, employeeMultiple: true },
  series: { needsClient: true, needsService: true, needsEmployee: true, clientMultiple: true, employeeMultiple: true },
  meeting: { needsClient: false, needsService: false, needsEmployee: true, clientMultiple: false, employeeMultiple: true },
  task: { needsClient: false, needsService: false, needsEmployee: true, clientMultiple: false, employeeMultiple: false }
};

const RECURRENCE_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-Weekly' },
  { value: 'monthly', label: 'Monthly' }
];

const ATTENDEE_STATUS_STYLE = {
  pending:  { label: 'Pending',  bg: '#fef3c7', color: '#92400e' },
  accepted: { label: 'Accepted', bg: '#d1fae5', color: '#065f46' },
  declined: { label: 'Declined', bg: '#fee2e2', color: '#991b1b' },
};

const APPOINTMENT_STATUS_OPTIONS = [
  { value: 'scheduled',  label: 'Scheduled'  },
  { value: 'confirmed',  label: 'Confirmed'  },
  { value: 'completed',  label: 'Completed'  },
  { value: 'cancelled',  label: 'Cancelled'  },
];

// ─── 2 STATE ───────────────────────────────────────────────────────────────────
export default function Form_Schedule({ appointment, onSubmit, onCancel, onDelete, onSendReminder, clients: clientsProp, services: servicesProp, employees: employeesProp, attendees = [] }) {
  const { closeModal, hasPermission, user, openAddClientModal } = useStore();
  const [clients, setClients] = useState(clientsProp || []);
  const [services, setServices] = useState(servicesProp || []);
  const [employees, setEmployees] = useState(employeesProp || []);
  const [timeError, setTimeError] = useState('');
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientsLoaded, setClientsLoaded] = useState(false);
  const [durationError, setDurationError] = useState('');
  const [serviceResources, setServiceResources] = useState([]);
  const [inventoryMap, setInventoryMap] = useState({});
  // Production task state
  const [productItems, setProductItems] = useState([]);
  const [productionInfo, setProductionInfo] = useState(null); // from GET /production/tasks/{id}/info
  const [productionLoading, setProductionLoading] = useState(false);
  const [productionError, setProductionError] = useState('');
  const [completeResult, setCompleteResult] = useState(null);
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
              const transformed = employeesRaw.map(emp => ({
                id: emp.id,
                first_name: emp.first_name ?? emp.firstName ?? '',
                last_name: emp.last_name ?? emp.lastName ?? '',
                role: emp.role ?? '',
              }));
              setEmployees(transformed);
            }
          }
        } catch (err) {
          if (!cancelled) console.error('Form_Schedule failed to load services/employees', err);
        }
      };
      load();
      return () => { cancelled = true; };
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
      console.error('Failed to load clients:', err);
    } finally {
      setClientsLoading(false);
    }
  };
  
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
      const [hour, minute] = time.split(':');
      const recEndDate = appointment.recurrence_end_date
        ? extractLocalParts(appointment.recurrence_end_date).date
        : '';
      return {
        client_ids: appointment.client_id ? [appointment.client_id] : [],
        service_id: appointment.service_id || '',
        employee_ids: appointment.employee_id ? [appointment.employee_id] : [],
        appointment_date: date,
        appointment_hour: hour,
        appointment_minute: minute,
        notes: appointment.notes || '',
        appointment_type: appointment.appointment_type || 'one_time',
        recurrence_frequency: appointment.recurrence_frequency || '',
        recurrence_end_type: appointment.recurrence_count ? 'count' : 'date',
        recurrence_end_date: recEndDate,
        recurrence_count: appointment.recurrence_count || '',
        duration_minutes: appointment.duration_minutes || '',
        status: appointment.status || 'scheduled',
        is_paid: appointment.is_paid || false,
        discount: appointment.discount || 0,
        sale_transaction_id: appointment.sale_transaction_id || null,
        task_type: appointment.task_type || 'service',
        production_item_id: appointment.production_item_id || '',
        production_quantity: appointment.production_quantity || 1,
      };
    }
    return {
      client_ids: [],
      service_id: '',
      employee_ids: [],
      appointment_date: '',
      appointment_hour: '',
      appointment_minute: '',
      notes: '',
      appointment_type: 'one_time',
      recurrence_frequency: '',
      recurrence_end_type: 'date',
      recurrence_end_date: '',
      recurrence_count: '',
      duration_minutes: '',
      status: 'scheduled',
      is_paid: false,
      discount: 0,
      sale_transaction_id: null,
      task_type: 'service',
      production_item_id: '',
      production_quantity: 1,
    };
  };

  const [formData, setFormData] = useState(getInitialFormData);
  // Track whether duration was manually changed (independent of service)
  const [durationManuallySet, setDurationManuallySet] = useState(false);

  useEffect(() => {
    setFormData(getInitialFormData());
  }, [appointment]);

  // Load product inventory items once (for the production task selector)
  useEffect(() => {
    inventoryAPI.getAll().then(res => {
      const all = Array.isArray(res?.data) ? res.data : [];
      setProductItems(all.filter(i => (i.type || '').toUpperCase() === 'PRODUCT'));
    }).catch(() => {});
  }, []);

  // Load production info when viewing/editing an existing production task
  useEffect(() => {
    if (!appointment?.id || formData.task_type !== 'production' || !formData.production_item_id) {
      setProductionInfo(null);
      return;
    }
    let cancelled = false;
    productionAPI.getInfo(appointment.id).then(res => {
      if (!cancelled) setProductionInfo(res?.data ?? res);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [appointment?.id, formData.task_type, formData.production_item_id]);

  // Load resource consumption info when service changes
  const loadServiceResources = async (serviceId) => {
    if (!serviceId) { setServiceResources([]); return; }
    try {
      const res = await serviceRelationsAPI.getResources(serviceId);
      const resources = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      setServiceResources(resources);
      // Fetch inventory names for each resource
      const ids = [...new Set(resources.map(r => r.inventory_id).filter(Boolean))];
      if (ids.length > 0) {
        const invRes = await inventoryAPI.getAll();
        const invData = Array.isArray(invRes?.data) ? invRes.data : (Array.isArray(invRes) ? invRes : []);
        const map = {};
        invData.forEach(item => { map[item.id] = item.name; });
        setInventoryMap(map);
      }
    } catch (err) {
      console.error('Failed to load service resources:', err);
      setServiceResources([]);
    }
  };

  useEffect(() => {
    loadServiceResources(formData.service_id);
  }, [formData.service_id]);

  // Auto-select current user if they can only schedule for themselves
  const isWriteAll = hasPermission('schedule', 'write_all') || hasPermission('schedule', 'admin');
  const isWriteOnly = hasPermission('schedule', 'write') && !isWriteAll;

  useEffect(() => {
    if (user && isWriteOnly) {
      // Lock employee selection to current user when write-only
      const self = employees.find(e => e.id === user.id || `${e.first_name} ${e.last_name}`.trim().toLowerCase() === `${user.first_name} ${user.last_name}`.trim().toLowerCase());
      if (self && (!Array.isArray(formData.employee_ids) || formData.employee_ids[0] !== self.id)) {
        setFormData(prev => ({ ...prev, employee_ids: [self.id] }));
      }
    } else if ((!Array.isArray(formData.employee_ids) || formData.employee_ids.length === 0) && employees.length === 1) {
      setFormData(prev => ({ ...prev, employee_ids: [employees[0].id] }));
    }
  }, [employees, formData.employee_ids, isWriteOnly, user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (name === 'duration_minutes') {
      setDurationError('');
    }
  };

  const handleServiceChange = (e) => {
    const { value } = e.target;
    const selectedService = services.find(s => s.id === value);
    setFormData(prev => ({
      ...prev,
      service_id: value,
      duration_minutes: selectedService?.duration_minutes ? selectedService.duration_minutes : prev.duration_minutes
    }));
    setDurationManuallySet(false);
    setServiceResources([]);
    if (selectedService?.duration_minutes) {
      setDurationError('');
    }
  };

  const handleDurationChange = (e) => {
    const { value } = e.target;
    setFormData(prev => ({
      ...prev,
      duration_minutes: value
    }));
    setDurationManuallySet(true);
    setDurationError('');
  };

  const handleClientChange = (e) => {
    const next = Array.isArray(e.target.value)
      ? e.target.value
      : e.target.value ? [e.target.value] : [];
    setFormData(prev => ({
      ...prev,
      client_ids: next
    }));
  };

  const handleEmployeeChange = (e) => {
    const next = Array.isArray(e.target.value)
      ? e.target.value
      : e.target.value ? [e.target.value] : [];
    setFormData(prev => ({
      ...prev,
      employee_ids: next
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const dateText = formData.appointment_date;
    const hourText = formData.appointment_hour;
    const minuteText = formData.appointment_minute;

    if (!dateText || !hourText || !minuteText) {
      setTimeError('Please select a valid date, hour, and minute');
      return;
    }

    const hour = parseInt(hourText, 10);
    const minute = parseInt(minuteText, 10);
    
    if (hour < 6 || hour > 21) {
      setTimeError('Can only schedule between 6:00 and 21:00');
      return;
    }
    setTimeError('');

    if (!formData.duration_minutes) {
      setDurationError('Please set a duration for this event');
      return;
    }

    // Submit a naive local ISO string (no timezone) to avoid shifts server-side
    const timeText = `${hourText}:${minuteText}`;
    const appointmentDateStr = `${dateText}T${timeText}:00`;

    // Get config for current type to determine required fields
    const config = APPOINTMENT_TYPE_CONFIG[formData.appointment_type] || APPOINTMENT_TYPE_CONFIG.one_time;

    const employeeIds = Array.isArray(formData.employee_ids) ? formData.employee_ids.filter(Boolean) : [];
    const clientIds = Array.isArray(formData.client_ids) ? formData.client_ids.filter(Boolean) : [];

    const isSeries = formData.appointment_type === 'series';
    const submitData = {
      employee_id: employeeIds[0] || '',
      employee_ids: employeeIds,
      appointment_date: appointmentDateStr,
      notes: formData.notes,
      appointment_type: formData.appointment_type,
      recurrence_frequency: isSeries ? formData.recurrence_frequency : null,
      recurrence_end_date: (isSeries && formData.recurrence_end_type === 'date' && formData.recurrence_end_date)
        ? `${formData.recurrence_end_date}T23:59:00`
        : null,
      recurrence_count: (isSeries && formData.recurrence_end_type === 'count' && formData.recurrence_count)
        ? parseInt(formData.recurrence_count)
        : null,
      is_recurring_master: isSeries,
      duration_minutes: parseInt(formData.duration_minutes),
      status: formData.status,
      is_paid: formData.is_paid,
      discount: parseFloat(formData.discount) || 0,
      sale_transaction_id: formData.sale_transaction_id || null,
      task_type: formData.task_type || 'service',
      production_item_id: formData.production_item_id || null,
      production_quantity: parseInt(formData.production_quantity) || 1,
    };

    // Only include client_id and service_id if needed for this type
    if (config.needsClient && clientIds.length > 0) {
      submitData.client_id = clientIds[0];
      submitData.client_ids = clientIds;
    }
    if (config.needsService && formData.service_id) {
      submitData.service_id = formData.service_id;
    }

    onSubmit(submitData);
  };

  // ─── 5 RENDER ─────────────────────────────────────────────────────────────────
  // Get config for current appointment type
  const typeConfig = APPOINTMENT_TYPE_CONFIG[formData.appointment_type] || APPOINTMENT_TYPE_CONFIG.one_time;

  const formTitle = appointment
    ? (formData.appointment_type === 'meeting' ? 'Edit Meeting'
      : formData.appointment_type === 'task' ? 'Edit Task'
      : 'Edit Appointment')
    : (formData.appointment_type === 'meeting' ? 'New Meeting'
      : formData.appointment_type === 'task' ? 'New Task'
      : 'New Appointment');

  return (
    <div className="d-flex flex-column bg-white dark:bg-gray-900" style={{ height: '100%' }}>

      {/* Header */}
      <div className="flex-shrink-0 p-2 border-bottom border-gray-200 dark:border-gray-700 d-flex align-items-center bg-white dark:bg-gray-900">
        <h6 className="mb-0 fw-semibold text-gray-900 dark:text-gray-100">{formTitle}</h6>
      </div>

      {/* ─── 6 RENDER: FORM BODY ────────────────────────────────────────────────── */}
      {/* Scrollable body — content floats to bottom */}
      <div className="flex-grow-1 overflow-auto no-scrollbar px-3 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 d-flex flex-column">
        <div className="flex-grow-1" />
        <form id="schedule-form" onSubmit={handleSubmit} className="d-flex flex-column gap-2 pt-3 pb-2">

          {/* Notes — shown at top for appointment/series types */}
          {(formData.appointment_type === 'one_time' || formData.appointment_type === 'series') && (
            <div className="form-floating">
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                className="form-control form-control-sm border-0"
                placeholder="Notes"
                style={{ height: '60px' }}
              />
              <label htmlFor="notes">Notes (optional)</label>
            </div>
          )}

          {/* Appointment Type */}
          <Dropdown_Custom
            name="appointment_type"
            value={formData.appointment_type}
            onChange={handleChange}
            options={APPOINTMENT_TYPES.map((type) => ({
              value: type.value,
              label: type.label
            }))}
            placeholder="Select event type"
            required
            label="Event Type"
          />

          {/* Status */}
          <Dropdown_Custom
            name="status"
            value={formData.status}
            onChange={handleChange}
            options={APPOINTMENT_STATUS_OPTIONS}
            placeholder="Select status"
            required
            label="Status"
          />

          {/* Meeting Title */}
          {formData.appointment_type === 'meeting' && (
            <div className="form-floating">
              <input
                type="text"
                id="meeting_title"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Meeting Title"
                className="form-control form-control-sm"
                required
              />
              <label htmlFor="meeting_title">Meeting Title</label>
            </div>
          )}

          {/* Task Description */}
          {formData.appointment_type === 'task' && (
            <div className="form-floating">
              <input
                type="text"
                id="task_description"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Task Description"
                className="form-control form-control-sm"
                required
              />
              <label htmlFor="task_description">Task Description</label>
            </div>
          )}

          {/* ── Production Task fields (task type only) ── */}
          {formData.appointment_type === 'task' && (
            <>
              {/* Task sub-type toggle: generic vs production */}
              <div className="d-flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, task_type: 'service', production_item_id: '', production_quantity: 1 }))}
                  className={`btn btn-sm flex-1 ${formData.task_type !== 'production' ? 'btn-primary' : 'btn-outline-secondary'}`}
                >
                  General Task
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, task_type: 'production' }))}
                  className={`btn btn-sm flex-1 ${formData.task_type === 'production' ? 'btn-primary' : 'btn-outline-secondary'}`}
                >
                  <CogIcon style={{ width: 14, height: 14, marginRight: 4, verticalAlign: 'middle' }} />
                  Production Run
                </button>
              </div>

              {/* Product selector + batch count (production tasks only) */}
              {formData.task_type === 'production' && (
                <>
                  <Dropdown_Custom
                    name="production_item_id"
                    value={formData.production_item_id}
                    onChange={handleChange}
                    options={productItems.map(p => ({ value: p.id, label: `${p.name}${p.sku ? ` (${p.sku})` : ''}` }))}
                    placeholder="Select product to produce"
                    searchable
                    label="Product"
                  />
                  <div className="form-floating">
                    <input
                      type="number" id="production_quantity" name="production_quantity"
                      min="1" value={formData.production_quantity}
                      onChange={handleChange}
                      className="form-control form-control-sm"
                      placeholder="Batches"
                    />
                    <label htmlFor="production_quantity">Number of Batches</label>
                  </div>
                </>
              )}

              {/* Production info panel — shown when editing an existing production task */}
              {formData.task_type === 'production' && appointment?.id && productionInfo && (
                <div className="border rounded p-2" style={{ fontSize: '0.78rem', background: '#f8faff' }}>
                  <p className="mb-2 fw-semibold" style={{ color: '#4338ca', fontSize: '0.8rem' }}>
                    <CogIcon style={{ width: 13, height: 13, marginRight: 4, verticalAlign: 'middle' }} />
                    Production Summary
                  </p>

                  {/* Product */}
                  {productionInfo.product && (
                    <div className="d-flex justify-content-between mb-1">
                      <span className="text-muted">Product</span>
                      <span className="fw-semibold">{productionInfo.product.name}</span>
                    </div>
                  )}

                  {/* Batches */}
                  <div className="d-flex justify-content-between mb-2">
                    <span className="text-muted">Batches to run</span>
                    <span className="fw-semibold">{formData.production_quantity}</span>
                  </div>

                  {/* Asset info */}
                  {productionInfo.assets?.length > 0 && productionInfo.assets.map(a => (
                    <div key={a.id} className="mb-2 p-1 rounded" style={{ background: '#eef2ff' }}>
                      <div className="d-flex align-items-center gap-1 mb-1">
                        <WrenchScrewdriverIcon style={{ width: 12, height: 12, color: '#4338ca' }} />
                        <span className="fw-semibold">{a.name}</span>
                      </div>
                      <div className="d-flex gap-3" style={{ fontSize: '0.74rem', color: '#374151' }}>
                        <span>Batch size: <strong>{a.batch_size} units</strong></span>
                        {a.duration_minutes && <span>Duration: <strong>{a.duration_minutes} min / batch</strong></span>}
                        {a.duration_minutes && formData.production_quantity > 1 && (
                          <span>Total: <strong>{a.duration_minutes * formData.production_quantity} min</strong></span>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Resources consumed */}
                  {productionInfo.resources?.length > 0 && (
                    <>
                      <p className="mb-1 fw-semibold text-muted" style={{ fontSize: '0.74rem' }}>Resources consumed:</p>
                      {productionInfo.resources.map(r => (
                        <div key={r.id} className="d-flex justify-content-between align-items-center">
                          <span className="d-flex align-items-center gap-1">
                            <BeakerIcon style={{ width: 11, height: 11, color: '#6b7280' }} />{r.name}
                          </span>
                          <span className="badge bg-secondary">
                            {r.quantity_per_batch * (formData.production_quantity || 1)} units
                          </span>
                        </div>
                      ))}
                    </>
                  )}

                  {/* Locations */}
                  {productionInfo.locations?.length > 0 && (
                    <div className="mt-1 d-flex gap-1 flex-wrap">
                      {productionInfo.locations.map(l => (
                        <span key={l.id} className="badge bg-light text-dark border" style={{ fontSize: '0.7rem' }}>📍 {l.name}</span>
                      ))}
                    </div>
                  )}

                  {/* Complete button */}
                  {appointment.status !== 'completed' && (
                    <>
                      {completeResult ? (
                        <div className="mt-2 p-2 rounded" style={{ background: '#d1fae5', fontSize: '0.76rem', color: '#065f46' }}>
                          ✓ Completed! Produced <strong>{completeResult.units_produced}</strong> units of {completeResult.product_name}.
                          Stock now: <strong>{completeResult.new_product_quantity}</strong>.
                          {completeResult.low_stock_warnings?.length > 0 && (
                            <div className="mt-1 text-danger">
                              ⚠ Low stock: {completeResult.low_stock_warnings.map(w => w.name).join(', ')}
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={productionLoading}
                          className="btn btn-success btn-sm mt-2 w-100"
                          onClick={async () => {
                            setProductionLoading(true);
                            setProductionError('');
                            try {
                              const res = await productionAPI.completeTask(appointment.id);
                              setCompleteResult(res?.data ?? res);
                            } catch (err) {
                              setProductionError(err?.response?.data?.detail || 'Failed to complete production task.');
                            } finally { setProductionLoading(false); }
                          }}
                        >
                          {productionLoading ? 'Processing…' : '✓ Complete Production Run'}
                        </button>
                      )}
                      {productionError && <div className="text-danger mt-1" style={{ fontSize: '0.74rem' }}>{productionError}</div>}
                    </>
                  )}
                  {appointment.status === 'completed' && (
                    <div className="mt-2 text-success" style={{ fontSize: '0.76rem' }}>✓ This production task is already completed.</div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Client Selection */}
          {typeConfig.needsClient && (
            <Dropdown_Custom
              name="client_id"
              value={typeConfig.clientMultiple ? formData.client_ids : (formData.client_ids[0] || '')}
              onChange={handleClientChange}
              options={clients.map((client) => ({
                value: client.id,
                label: client.name
              }))}
              placeholder={typeConfig.clientMultiple ? 'Select clients' : 'Select a client'}
              required
              searchable={true}
              onOpen={handleClientDropdownOpen}
              loading={clientsLoading}
              multiSelect={typeConfig.clientMultiple}
            />
          )}

          {/* Service Selection */}
          {typeConfig.needsService && (
            <Dropdown_Custom
              name="service_id"
              value={formData.service_id}
              onChange={handleServiceChange}
              options={services.map((service) => ({
                value: service.id,
                label: `${service.name} - $${service.price}`
              }))}
              placeholder="Select a service"
              required
              searchable={true}
            />
          )}

          {/* Payment & Discount — only for appointment types with a service */}
          {typeConfig.needsService && (
            <div className="d-flex gap-2 align-items-end">
              {/* Paid toggle */}
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, is_paid: !prev.is_paid }))}
                className={`btn btn-sm fw-semibold px-3 ${formData.is_paid ? 'btn-success' : 'btn-outline-secondary'}`}
                style={{ minWidth: 90, whiteSpace: 'nowrap' }}
              >
                {formData.is_paid ? '✓ Paid' : 'Unpaid'}
              </button>

              {/* Discount */}
              <div className="form-floating flex-grow-1">
                <input
                  type="number"
                  id="discount"
                  name="discount"
                  min="0"
                  step="0.01"
                  value={formData.discount}
                  onChange={handleChange}
                  className="form-control form-control-sm"
                  placeholder="Discount"
                />
                <label htmlFor="discount">Discount ($)</label>
              </div>

              {/* Pay via Sales button — only when editing an existing appointment */}
              {appointment?.id && formData.service_id && (
                <button
                  type="button"
                  onClick={() => {
                    const client = clients.find(c => c.id === (formData.client_ids[0] || appointment?.client_id));
                    navigate('/sales', {
                      state: {
                        scheduleId: appointment.id,
                        preSelectedClient: client || null,
                        preloadServiceId: formData.service_id,
                      }
                    });
                  }}
                  className="btn btn-sm btn-outline-primary d-flex align-items-center justify-content-center"
                  title="Open Sales checkout for this appointment"
                  style={{ width: '3rem', height: '3rem' }}
                >
                  <CreditCardIcon className="w-4 h-4" style={{ width: 16, height: 16 }} />
                </button>
              )}
            </div>
          )}

          {/* Resource Consumption Panel */}
          {typeConfig.needsService && serviceResources.length > 0 && (
            <div className="border rounded p-2" style={{ fontSize: '0.78rem' }}>
              <p className="mb-1 fw-semibold text-gray-600 dark:text-gray-400">Resources Consumed</p>
              <div className="d-flex flex-column gap-1">
                {serviceResources.map(r => (
                  <div key={r.id} className="d-flex justify-content-between align-items-center">
                    <span className="text-gray-800 dark:text-gray-200">{inventoryMap[r.inventory_id] || r.inventory_id.slice(0, 8)}</span>
                    <div className="d-flex gap-2 align-items-center">
                      <span className="badge bg-secondary">{r.quantity} units</span>
                      {r.consumption_rate_pct != null && (
                        <span className="badge bg-info text-dark">{r.consumption_rate_pct}%</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Employee Selection */}
          {typeConfig.needsEmployee && (
            <div>
              <Dropdown_Custom
                name="employee_id"
                value={typeConfig.employeeMultiple ? formData.employee_ids : (formData.employee_ids[0] || '')}
                onChange={handleEmployeeChange}
                options={((isWriteOnly && user)
                  ? employees.filter(e => e.id === user.id || `${e.first_name} ${e.last_name}`.trim().toLowerCase() === `${user.first_name} ${user.last_name}`.trim().toLowerCase())
                  : employees
                ).map((employee) => ({
                  value: employee.id,
                  label: `${employee.first_name} ${employee.last_name}${employee.role ? ` - ${employee.role}` : ''}`
                }))}
                placeholder={
                  formData.appointment_type === 'meeting' ? 'Select attendees'
                  : formData.appointment_type === 'task' ? 'Assign to'
                  : typeConfig.employeeMultiple ? 'Select employees' : 'Select employee'
                }
                required
                searchable={true}
                disabled={isWriteOnly}
                multiSelect={typeConfig.employeeMultiple}
              />
              {(isWriteOnly || employees.length === 1) && (
                <p className="text-xs text-gray-500 mt-1">You can only schedule for yourself</p>
              )}
            </div>
          )}

          {/* Recurrence */}
          {formData.appointment_type === 'series' && (
            <>
              <Dropdown_Custom
                name="recurrence_frequency"
                value={formData.recurrence_frequency}
                onChange={handleChange}
                options={RECURRENCE_OPTIONS}
                placeholder="Select frequency"
                required
                label="Recurrence"
              />

              {/* End type toggle */}
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className={`btn btn-sm flex-1 ${formData.recurrence_end_type === 'date' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setFormData(prev => ({ ...prev, recurrence_end_type: 'date', recurrence_count: '' }))}
                >
                  End by date
                </button>
                <button
                  type="button"
                  className={`btn btn-sm flex-1 ${formData.recurrence_end_type === 'count' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setFormData(prev => ({ ...prev, recurrence_end_type: 'count', recurrence_end_date: '' }))}
                >
                  End after N times
                </button>
              </div>

              {formData.recurrence_end_type === 'date' && (
                <div className="form-floating">
                  <input
                    type="date"
                    id="recurrence_end_date"
                    name="recurrence_end_date"
                    value={formData.recurrence_end_date}
                    onChange={handleChange}
                    className="form-control form-control-sm"
                    placeholder="End Date"
                    min={formData.appointment_date || undefined}
                  />
                  <label htmlFor="recurrence_end_date">Repeat until</label>
                </div>
              )}

              {formData.recurrence_end_type === 'count' && (
                <div className="form-floating">
                  <input
                    type="number"
                    id="recurrence_count"
                    name="recurrence_count"
                    value={formData.recurrence_count}
                    onChange={handleChange}
                    className="form-control form-control-sm"
                    placeholder="Occurrences"
                    min="1"
                    max="365"
                  />
                  <label htmlFor="recurrence_count">Number of occurrences</label>
                </div>
              )}
            </>
          )}

          {/* Duration */}
          <div>
            <Dropdown_Custom
              name="duration_minutes"
              value={formData.duration_minutes}
              onChange={handleChange}
              options={[15, 30, 45, 60, 90, 120, 180, 240].map((mins) => ({
                value: mins.toString(),
                label: `${mins} min`
              }))}
              placeholder="Select duration"
              required
              label="Duration"
            />
            {durationError && <p className="text-red-500 text-xs mt-1">{durationError}</p>}
          </div>

          {/* Date + Time */}
          <div className="row g-2">
            <div className="col-6">
              <div className="form-floating">
                <input
                  type="date"
                  id="appointment_date"
                  name="appointment_date"
                  required
                  value={formData.appointment_date}
                  onChange={handleChange}
                  className="form-control form-control-sm"
                  placeholder="Date"
                />
                <label htmlFor="appointment_date">Date</label>
              </div>
            </div>
            <div className="col-6">
              <div className="input-group">
                <Dropdown_Custom
                  name="appointment_hour"
                  value={formData.appointment_hour || ''}
                  onChange={handleChange}
                  options={[6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21].map(hour => ({
                    value: hour.toString().padStart(2, '0'),
                    label: hour.toString().padStart(2, '0')
                  }))}
                  placeholder="Hr"
                  required
                  className={`flex-1 ${timeError ? 'border-red-500' : ''}`}
                />
                <span className="input-group-text">:</span>
                <Dropdown_Custom
                  name="appointment_minute"
                  value={formData.appointment_minute || ''}
                  onChange={handleChange}
                  options={[0, 15, 30, 45].map(minute => ({
                    value: minute.toString().padStart(2, '0'),
                    label: minute.toString().padStart(2, '0')
                  }))}
                  placeholder="Min"
                  required
                  className={`flex-1 ${timeError ? 'border-red-500' : ''}`}
                />
              </div>
            </div>
          </div>
          {timeError && <p className="text-red-500 text-xs">{timeError}</p>}

          {/* Attendee status panel — only when editing an existing meeting */}
          {appointment?.id && formData.appointment_type === 'meeting' && attendees.length > 0 && (
            <div className="border rounded p-2" style={{ fontSize: '0.8rem' }}>
              <p className="mb-1 fw-semibold text-gray-700 dark:text-gray-300">Attendees</p>
              <div className="d-flex flex-column gap-1">
                {attendees.map((att) => {
                  const emp = att.user_id ? employees.find(e => e.id === att.user_id) : null;
                  const cli = att.client_id ? clients.find(c => c.id === att.client_id) : null;
                  const name = emp
                    ? `${emp.first_name} ${emp.last_name}`.trim()
                    : cli
                    ? cli.name
                    : 'Unknown';
                  const style = ATTENDEE_STATUS_STYLE[att.attendance_status] || ATTENDEE_STATUS_STYLE.pending;
                  return (
                    <div key={att.id} className="d-flex align-items-center justify-content-between gap-2">
                      <span className="text-gray-800 dark:text-gray-200">{name}</span>
                      <span
                        style={{
                          backgroundColor: style.bg,
                          color: style.color,
                          borderRadius: '9999px',
                          padding: '1px 8px',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
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

        </form>
      </div>

      {/* ─── 7 RENDER: FOOTER ───────────────────────────────────────────────────── */}
      {/* Footer */}
      <div className="flex-shrink-0 pt-2 pb-4 px-3 border-top border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="d-flex align-items-center">
          <div style={{ width: 40 }}>
            {appointment?.id && onDelete && (
              <Button_Toolbar
                icon={TrashIcon}
                label="Delete"
                onClick={onDelete}
                className="btn-outline-danger"
              />
            )}
          </div>
          <div className="flex-grow-1 d-flex gap-3 justify-content-center align-items-center">
            {appointment?.id && appointment?.client_id && (formData.appointment_type === 'one_time' || formData.appointment_type === 'series') && onSendReminder && (
              <Button_Toolbar
                icon={EnvelopeIcon}
                label="Send Reminder"
                onClick={onSendReminder}
                className="btn-outline-secondary"
              />
            )}
            <Button_Toolbar
              icon={XMarkIcon}
              label="Cancel"
              onClick={onCancel}
              className="btn-outline-secondary"
            />
            <Button_Toolbar
              icon={CheckIcon}
              label={appointment ? 'Save Changes' : 'Book'}
              type="submit"
              form="schedule-form"
              className="btn-primary"
            />
          </div>
          <div style={{ width: 40 }} />
        </div>
      </div>

    </div>
  );
}
