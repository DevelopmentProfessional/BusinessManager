/*
 * ============================================================
 * FILE: Form_Employee.jsx
 *
 * PURPOSE:
 *   Multi-tab create/edit form for an employee record. Covers personal
 *   details and credentials, compensation and leave benefits, an
 *   e-signature capture/upload panel, page-level permissions management,
 *   and a read-only performance summary (schedules, attendance, reviews).
 *
 * FUNCTIONAL PARTS:
 *   [1] Constants          — PAGES and PERMISSION_TYPES lookup arrays
 *   [2] State              — tab, roles, insurance plans, employees list,
 *                            permissions, signature, and form field state
 *   [3] Effects            — load roles, insurance plans, employees list,
 *                            populate form on edit, fetch permissions and
 *                            signature when switching tabs
 *   [4] Derived Data       — managerOptions (filtered supervisor list),
 *                            directReports
 *   [5] Handlers: Core     — handleInputChange, handleSubmit
 *   [6] Handlers: Signature — handleSignatureUpload, handleSaveSignature
 *   [7] Handlers: Permissions — fetchUserPermissions, handleCreatePermission,
 *                               handleTogglePermission, handleDeletePermission
 *   [8] Render: Header     — title and close button
 *   [9] Render: Tab Panes  — Details, Benefits, Signature, Permissions,
 *                            Performance
 *  [10] Render: Footer     — tab navigation, context-sensitive controls,
 *                            Cancel / Save action buttons
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-03-01 | Claude  | Added section comments and top-level documentation
 *   2026-03-07 | Claude  | Converted role select to custom dropdown with per-option help popovers
 *   2026-07-24 | GitHub Copilot | Removed custom dropdown caret icons and added word-safe trigger label truncation
 * ============================================================
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import { XMarkIcon, CheckIcon, PrinterIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import Button_Toolbar from "./Button_Toolbar";
import Footer_Actions from "./Footer_Actions";
import { rolesAPI, isudAPI, employeesAPI, insurancePlansAPI, payrollAPI, departmentsAPI } from "../../services/api";
import Button_InsuranceDocument from "./Button_InsuranceDocument";
import api from "../../services/api";
import { showConfirm } from "../../services/showConfirm";
import Widget_Signature from "./Widget_Signature";
import Modal_Pay_Employee from "./Modal_EmployeePay";
import useStore from "../../services/useStore";
import { useWordSafeLabel } from "../../utils/wordSafeTruncate";

// ─── 1 CONSTANTS ───────────────────────────────────────────────────────────────
const PAGE_OPTION_GROUPS = [
  {
    label: "Employee Settings",
    options: [
      { value: "requests", label: "Requests" },
      { value: "insurance", label: "Insurance" },
      { value: "wages", label: "Wages" },
      { value: "benefits", label: "Benefits" },
      { value: "payroll", label: "Payroll" },
    ],
  },
  {
    label: "Core Pages",
    options: [
      { value: "clients", label: "Clients" },
      { value: "inventory", label: "Inventory" },
      { value: "sales", label: "Sales" },
      { value: "services", label: "Services" },
      { value: "employees", label: "Employees" },
      { value: "schedule", label: "Schedule" },
      { value: "documents", label: "Documents" },
      { value: "templates", label: "Templates" },
      { value: "tasks", label: "Tasks" },
      { value: "reports", label: "Reports" },
      { value: "leave", label: "Leave" },
      { value: "admin", label: "Admin" },
    ],
  },
];
const PERMISSION_TYPES = ["read", "write", "admin"];

const PAY_SCHEDULE_DAYS = [
  { key: "mon", label: "Mon", full: "Monday" },
  { key: "tue", label: "Tue", full: "Tuesday" },
  { key: "wed", label: "Wed", full: "Wednesday" },
  { key: "thu", label: "Thu", full: "Thursday" },
  { key: "fri", label: "Fri", full: "Friday" },
  { key: "sat", label: "Sat", full: "Saturday" },
  { key: "sun", label: "Sun", full: "Sunday" },
];

const PAY_SCHEDULE_WEEK_OPTS = [
  { value: 1, label: "1st" },
  { value: 2, label: "2nd" },
  { value: 3, label: "3rd" },
  { value: 4, label: "4th" },
  { value: -1, label: "Last" },
];

function parsePayScheduleWorkDays(str) {
  if (!str) return ["mon", "tue", "wed", "thu", "fri"];
  return str
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

function serializePayScheduleWorkDays(arr) {
  return arr.join(",");
}

// ─── 2 STATE ───────────────────────────────────────────────────────────────────
export default function Form_Employee({ employee, onSubmit, onCancel, onDelete, onManagePermissions, employees: employeesProp = [], canDelete = false, selfEdit = false }) {
  const [activeTab, setActiveTab] = useState("details");
  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [employeesList, setEmployeesList] = useState(employeesProp);
  const [insurancePlans, setInsurancePlans] = useState([]);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [roleHelpKey, setRoleHelpKey] = useState(null);
  const [roleHelpPos, setRoleHelpPos] = useState({ top: 0, left: 0 });
  const [isEmploymentTypeDropdownOpen, setIsEmploymentTypeDropdownOpen] = useState(false);
  const [employmentTypeHelpKey, setEmploymentTypeHelpKey] = useState(null);
  const [employmentTypeHelpPos, setEmploymentTypeHelpPos] = useState({ top: 0, left: 0 });
  const [isPayFrequencyDropdownOpen, setIsPayFrequencyDropdownOpen] = useState(false);
  const [payFrequencyHelpKey, setPayFrequencyHelpKey] = useState(null);
  const [payFrequencyHelpPos, setPayFrequencyHelpPos] = useState({ top: 0, left: 0 });

  const roleOptions = [
    { value: "EMPLOYEE", label: "Employee", description: "Standard employee with basic access. Can view their own profile and schedule." },
    { value: "MANAGER", label: "Manager", description: "Supervisory role with team management access. Can view and manage direct reports." },
    { value: "ADMIN", label: "Admin", description: "Full administrative access. Can manage all users, settings, and system configuration." },
    { value: "VIEWER", label: "Viewer", description: "Read-only access. Can view data but cannot make changes or create records." },
  ];

  const employmentTypeOptions = [
    { value: "salary", label: "Salary", description: "Fixed annual compensation. Employee receives consistent pay regardless of hours worked." },
    { value: "hourly", label: "Hourly", description: "Paid by the hour worked. Compensation varies based on actual hours logged." },
  ];

  const payFrequencyOptions = [
    { value: "daily", label: "Daily", description: "Paid every working day. Common for temporary or gig workers." },
    { value: "weekly", label: "Weekly", description: "Paid once per week, typically on a specific weekday." },
    { value: "biweekly", label: "Bi-weekly", description: "Paid every two weeks. Results in 26 pay periods per year." },
    { value: "monthly", label: "Monthly", description: "Paid once per month, typically on a specific date. 12 pay periods per year." },
    { value: "annually", label: "Annually", description: "Paid once per year. Often used for bonuses or contractor final payments." },
    { value: "one_time", label: "One-time (Contract)", description: "Single payment for completed project or contract work. No recurring schedule." },
  ];

  const selectedRoleLabel = roleOptions.find((opt) => opt.value === formData.role)?.label || "Select Role";
  const selectedEmploymentTypeLabel = employmentTypeOptions.find((opt) => opt.value === formData.employment_type)?.label || "Select type";
  const selectedPayFrequencyLabel = payFrequencyOptions.find((opt) => opt.value === formData.pay_frequency)?.label || "Select frequency";
  const { ref: roleLabelRef, displayLabel: roleTriggerLabel } = useWordSafeLabel(selectedRoleLabel, { enabled: true });
  const { ref: employmentTypeLabelRef, displayLabel: employmentTypeTriggerLabel } = useWordSafeLabel(selectedEmploymentTypeLabel, { enabled: true });
  const { ref: payFrequencyLabelRef, displayLabel: payFrequencyTriggerLabel } = useWordSafeLabel(selectedPayFrequencyLabel, { enabled: true });

  // Permissions state
  const [userPermissions, setUserPermissions] = useState([]);
  const [newPermission, setNewPermission] = useState({ page: "", permission: "" });
  const [permError, setPermError] = useState("");
  const [permSuccess, setPermSuccess] = useState("");

  // Signature state
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [savedSignature, setSavedSignature] = useState(null);
  const [signatureLoading, setSignatureLoading] = useState(false);
  const [signatureMessage, setSignatureMessage] = useState("");
  const signatureFileRef = useRef(null);

  // Department state
  const [departments, setDepartments] = useState([]);
  const [showNewDept, setShowNewDept] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptDesc, setNewDeptDesc] = useState("");
  const [deptCreating, setDeptCreating] = useState(false);

  // Payments state
  const [paySlips, setPaySlips] = useState([]);
  const [paySlipsLoading, setPaySlipsLoading] = useState(false);
  const [selectedSlip, setSelectedSlip] = useState(null);
  const [showPayModal, setShowPayModal] = useState(false);

  const [employeePaySchedule, setEmployeePaySchedule] = useState(null);
  const [employeePayScheduleLoading, setEmployeePayScheduleLoading] = useState(false);
  const [employeePayScheduleSaving, setEmployeePayScheduleSaving] = useState(false);
  const [employeePayScheduleError, setEmployeePayScheduleError] = useState("");
  const [employeePayScheduleSuccess, setEmployeePayScheduleSuccess] = useState("");

  const { hasPermission } = useStore();

  const [formData, setFormData] = useState({
    // Details
    username: "",
    password: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    role: "EMPLOYEE",
    hire_date: new Date().toISOString().split("T")[0],
    is_active: true,
    reports_to: "",
    supervisor: "",
    role_id: "",
    iod_number: "",
    location: "",
    department_id: "",
    // Benefits
    employment_type: "",
    salary: "",
    hourly_rate: "",
    pay_frequency: "",
    insurance_plan: "",
    vacation_days: "",
    vacation_days_used: "",
    sick_days: "",
    sick_days_used: "",
  });

  // ─── 3 EFFECTS ───────────────────────────────────────────────────────────────
  // Load available roles
  useEffect(() => {
    const loadRoles = async () => {
      setRolesLoading(true);
      try {
        const response = await rolesAPI.getAll();
        const rolesData = response?.data ?? response;
        if (Array.isArray(rolesData)) setRoles(rolesData);
      } catch (err) {
        console.error("Failed to load roles:", err);
      } finally {
        setRolesLoading(false);
      }
    };
    loadRoles();
  }, []);

  // Load departments
  useEffect(() => {
    departmentsAPI
      .getAll()
      .then((res) => {
        const d = res?.data ?? res;
        if (Array.isArray(d)) setDepartments(d);
      })
      .catch(() => {});
  }, []);

  // Load insurance plans
  useEffect(() => {
    const loadPlans = async () => {
      try {
        const response = await insurancePlansAPI.getAll();
        const data = response?.data ?? response;
        if (Array.isArray(data)) setInsurancePlans(data.filter((p) => p.is_active));
      } catch (err) {
        console.error("Failed to load insurance plans:", err);
      }
    };
    loadPlans();
  }, []);

  // Load employees list
  useEffect(() => {
    if (employeesProp.length > 0) {
      setEmployeesList(employeesProp);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const response = await isudAPI.employees.getAll();
        const data = response?.data ?? response;
        if (!cancelled && Array.isArray(data)) setEmployeesList(data);
      } catch (err) {
        if (!cancelled) console.error("Form_Employee failed to load employees", err);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [employeesProp.length]);

  // Populate form when editing
  useEffect(() => {
    if (employee) {
      setFormData({
        username: employee.username || "",
        password: "",
        first_name: employee.first_name || "",
        last_name: employee.last_name || "",
        email: employee.email || "",
        phone: employee.phone || "",
        role: employee.role || "EMPLOYEE",
        hire_date: employee.hire_date ? employee.hire_date.split("T")[0] : new Date().toISOString().split("T")[0],
        is_active: employee.is_active !== undefined ? employee.is_active : true,
        reports_to: employee.reports_to || "",
        supervisor: employee.supervisor || "",
        role_id: employee.role_id || "",
        iod_number: employee.iod_number || "",
        location: employee.location || "",
        department_id: employee.department_id || "",
        employment_type: employee.employment_type || "",
        salary: employee.salary ?? "",
        hourly_rate: employee.hourly_rate ?? "",
        pay_frequency: employee.pay_frequency || "",
        insurance_plan: employee.insurance_plan || "",
        vacation_days: employee.vacation_days ?? "",
        vacation_days_used: employee.vacation_days_used ?? "",
        sick_days: employee.sick_days ?? "",
        sick_days_used: employee.sick_days_used ?? "",
      });
    }
  }, [employee]);

  // Fetch permissions when switching to permissions tab
  useEffect(() => {
    if (activeTab === "permissions" && employee?.id) {
      fetchUserPermissions(employee.id);
    }
  }, [activeTab, employee?.id]);

  // Load signature when switching to signature tab
  useEffect(() => {
    if (activeTab === "signature" && employee?.id) {
      const loadSignature = async () => {
        setSignatureLoading(true);
        try {
          setSavedSignature(employee.signature_data || null);
        } finally {
          setSignatureLoading(false);
        }
      };
      loadSignature();
    }
  }, [activeTab, employee?.id]);

  // Load pay slips when switching to payments tab
  useEffect(() => {
    if (activeTab === "payments" && employee?.id) {
      setPaySlipsLoading(true);
      payrollAPI
        .getByEmployee(employee.id)
        .then((res) => {
          const data = res?.data ?? res;
          setPaySlips(Array.isArray(data) ? data : []);
        })
        .catch(() => setPaySlips([]))
        .finally(() => setPaySlipsLoading(false));
    }
  }, [activeTab, employee?.id]);

  useEffect(() => {
    let cancelled = false;
    if (!employee?.id) {
      setEmployeePaySchedule(null);
      setEmployeePayScheduleError("");
      setEmployeePayScheduleSuccess("");
      return;
    }

    setEmployeePayScheduleLoading(true);
    setEmployeePayScheduleError("");
    payrollAPI
      .getEmployeeSchedule(employee.id)
      .then((res) => {
        if (cancelled) return;
        const d = res?.data ?? res;
        setEmployeePaySchedule(d && typeof d === "object" ? d : null);
      })
      .catch(() => {
        if (!cancelled) setEmployeePaySchedule(null);
      })
      .finally(() => {
        if (!cancelled) setEmployeePayScheduleLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [employee?.id]);

  // ─── 6 HANDLERS: SIGNATURE ───────────────────────────────────────────────────
  const handleSignatureUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      handleSaveSignature(ev.target.result);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSaveSignature = async (dataUrl) => {
    setSignatureLoading(true);
    setSignatureMessage("");
    try {
      if (!employee?.id) {
        throw new Error("Employee record is required to save a signature.");
      }
      await employeesAPI.updateUser(employee.id, { signature_data: dataUrl });
      setSavedSignature(dataUrl);
      setShowSignaturePad(false);
      setSignatureMessage("Signature saved successfully");
      setTimeout(() => setSignatureMessage(""), 3000);
    } catch (err) {
      setSignatureMessage("Failed to save signature: " + (err.response?.data?.detail || err.message));
    } finally {
      setSignatureLoading(false);
    }
  };

  const fetchUserPermissions = async (userId) => {
    try {
      const response = await api.get(`/auth/users/${userId}/permissions`);
      setUserPermissions(response.data || []);
    } catch (err) {
      console.error("Failed to fetch permissions:", err);
      setPermError("Failed to load permissions");
    }
  };

  // ─── 4 DERIVED DATA ──────────────────────────────────────────────────────────
  // Filter out current employee from potential supervisors.
  // Also enforce one-supervisoree constraint: exclude employees who already have someone
  // else reporting to them (they can't take on another supervisee).
  const managerOptions = useMemo(() => {
    // Build a set of employee IDs that already have at least one supervisee,
    // but exclude any supervisor who is ALREADY assigned to the current employee.
    const alreadySupervisingOther = new Set(employeesList.filter((e) => e.reports_to && e.id !== employee?.id && e.reports_to !== employee?.id).map((e) => e.reports_to));
    return employeesList.filter((e) => {
      if (e.id === employee?.id) return false; // can't supervise yourself
      if (alreadySupervisingOther.has(e.id)) return false; // already has a different supervisee
      return true;
    });
  }, [employeesList, employee?.id]);

  // Direct reports for this employee
  const directReports = useMemo(() => {
    if (!employee?.id) return [];
    return employeesList.filter((e) => e.reports_to === employee.id);
  }, [employeesList, employee?.id]);

  // ─── 5 HANDLERS: CORE ────────────────────────────────────────────────────────
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === "reports_to") {
      // Auto-sync supervisor text field with the selected person's name
      const selected = employeesList.find((emp) => emp.id === value);
      const supervisorName = selected ? `${selected.first_name} ${selected.last_name}` : "";
      setFormData((prev) => ({
        ...prev,
        reports_to: value,
        supervisor: supervisorName,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      }));
    }
  };

  const handleCreateDepartment = async () => {
    const name = newDeptName.trim();
    if (!name || deptCreating) return;
    setDeptCreating(true);
    try {
      const res = await departmentsAPI.create({ name, description: newDeptDesc.trim() || undefined });
      const created = res?.data ?? res;
      setDepartments((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setFormData((prev) => ({ ...prev, department_id: created.id }));
      setNewDeptName("");
      setNewDeptDesc("");
      setShowNewDept(false);
    } catch (err) {
      console.error("Failed to create department", err);
    } finally {
      setDeptCreating(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.username.trim()) {
      alert("Username is required");
      return;
    }
    if (!employee && !formData.password.trim()) {
      alert("Password is required for new employees");
      return;
    }
    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      alert("First name and last name are required");
      return;
    }

    const submitData = { ...formData };

    // Don't send empty password for updates
    if (employee && !submitData.password.trim()) delete submitData.password;
    // Convert empty strings to null for optional fields
    if (!submitData.email.trim()) submitData.email = null;
    if (!submitData.reports_to) submitData.reports_to = null;
    if (!submitData.role_id) submitData.role_id = null;
    if (!submitData.iod_number.trim()) submitData.iod_number = null;
    if (!submitData.location.trim()) submitData.location = null;
    if (!submitData.department_id) submitData.department_id = null;
    if (!submitData.employment_type) submitData.employment_type = null;
    if (!submitData.pay_frequency) submitData.pay_frequency = null;
    if (!submitData.insurance_plan) submitData.insurance_plan = null;
    // Convert numeric fields
    submitData.salary = submitData.salary !== "" ? parseFloat(submitData.salary) : null;
    submitData.hourly_rate = submitData.hourly_rate !== "" ? parseFloat(submitData.hourly_rate) : null;
    submitData.vacation_days = submitData.vacation_days !== "" ? parseInt(submitData.vacation_days) : null;
    submitData.vacation_days_used = submitData.vacation_days_used !== "" ? parseInt(submitData.vacation_days_used) : null;
    submitData.sick_days = submitData.sick_days !== "" ? parseInt(submitData.sick_days) : null;
    submitData.sick_days_used = submitData.sick_days_used !== "" ? parseInt(submitData.sick_days_used) : null;

    const payFreq = String(submitData.pay_frequency || "").toLowerCase();
    if (activeTab === "pay_settings" && employee?.id && employeePaySchedule && ["weekly", "biweekly", "monthly"].includes(payFreq)) {
      setEmployeePayScheduleSaving(true);
      setEmployeePayScheduleError("");
      setEmployeePayScheduleSuccess("");
      try {
        const payload = {
          frequency: payFreq,
          work_days: employeePaySchedule.work_days ?? "mon,tue,wed,thu,fri",
          payday_weekday: employeePaySchedule.payday_weekday ?? "fri",
          monthly_payday_type: employeePaySchedule.monthly_payday_type ?? "date",
          monthly_payday_date: employeePaySchedule.monthly_payday_date ?? 28,
          monthly_payday_week: employeePaySchedule.monthly_payday_week ?? null,
          monthly_payday_weekday: employeePaySchedule.monthly_payday_weekday ?? null,
          pay_timing: employeePaySchedule.pay_timing ?? "arrears",
          cycle_anchor_date: employeePaySchedule.cycle_anchor_date ?? null,
        };
        await payrollAPI.updateEmployeeSchedule(employee.id, payload);
        setEmployeePayScheduleSuccess("Pay settings saved");
        setTimeout(() => setEmployeePayScheduleSuccess(""), 3000);
      } catch (err) {
        setEmployeePayScheduleError(err?.response?.data?.detail || "Failed to save pay settings");
      } finally {
        setEmployeePayScheduleSaving(false);
      }
    }

    await onSubmit(submitData);
  };

  // ─── 7 HANDLERS: PERMISSIONS ─────────────────────────────────────────────────
  // Permission handlers
  const handleCreatePermission = async (e) => {
    e.preventDefault();
    if (!employee?.id) return;
    setPermError("");
    setPermSuccess("");
    try {
      await api.post(`/auth/users/${employee.id}/permissions`, {
        user_id: employee.id,
        page: newPermission.page,
        permission: newPermission.permission,
        granted: true,
      });
      setPermSuccess("Permission added");
      setNewPermission({ page: "", permission: "" });
      fetchUserPermissions(employee.id);
      setTimeout(() => setPermSuccess(""), 3000);
    } catch (err) {
      setPermError(err.response?.data?.detail || "Failed to create permission");
    }
  };

  const handleTogglePermission = async (permissionId, granted) => {
    if (!employee?.id) return;
    setPermError("");
    try {
      await api.put(`/auth/users/${employee.id}/permissions/${permissionId}`, { granted });
      fetchUserPermissions(employee.id);
    } catch (err) {
      setPermError(err.response?.data?.detail || "Failed to update permission");
    }
  };

  const handleDeletePermission = async (permissionId) => {
    if (!employee?.id) return;
    if (!(await showConfirm("Delete this permission?"))) return;
    setPermError("");
    try {
      await api.delete(`/auth/users/${employee.id}/permissions/${permissionId}`);
      fetchUserPermissions(employee.id);
    } catch (err) {
      setPermError(err.response?.data?.detail || "Failed to delete permission");
    }
  };

  // ─── 8 RENDER ─────────────────────────────────────────────────────────────────
  const tabs = [
    { key: "details", label: "Details" },
    { key: "benefits", label: "Benefits" },
    { key: "signature", label: "Signature", disabled: !employee },
    { key: "permissions", label: "Permissions", disabled: !employee },
    { key: "performance", label: "Performance", disabled: !employee },
    { key: "pay_settings", label: "Pay settings", disabled: !employee },
    { key: "payments", label: "Payments", disabled: !employee },
  ];

  return (
    <div className="ui-page-shell">
      {/* Header */}
      <div className="align-items-center bg-white border-bottom border-gray-200 d-flex dark:bg-gray-900 dark:border-gray-700 flex-shrink-0 justify-content-between p-0">
        <h6 className="ui-heading-strong">{employee ? "Edit Employee" : "Add Employee"}</h6>
      </div>

      {/* ─── 9 RENDER: TAB PANES ────────────────────────────────────────────────── */}
      {/* Scrollable Body */}
      <div className="bg-white dark:bg-gray-900 dark:text-gray-100 flex-grow-1 min-h-0 no-scrollbar overflow-auto pt-1 px-1 text-gray-900">
        <form id="employee-form" onSubmit={handleSubmit}>
          {/* ===== DETAILS TAB ===== */}
          {activeTab === "details" && (
            <div className="tab-pane">
              <div className="row ui-row-g2">
                <div className="col-md-6">
                  <div className="form-floating">
                    <input type="text" id="username" name="username" value={formData.username} onChange={handleInputChange} className="form-control ui-control-sm" placeholder="Username" required />
                    <label htmlFor="username">Username *</label>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="form-floating">
                    <input type="password" id="password" name="password" value={formData.password} onChange={handleInputChange} className="form-control ui-control-sm" placeholder="Password" required={!employee} />
                    <label htmlFor="password">{employee ? "Password (blank = keep current)" : "Password *"}</label>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="form-floating">
                    <input type="text" id="first_name" name="first_name" value={formData.first_name} onChange={handleInputChange} className="form-control ui-control-sm" placeholder="First Name" required />
                    <label htmlFor="first_name">First Name *</label>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="form-floating">
                    <input type="text" id="last_name" name="last_name" value={formData.last_name} onChange={handleInputChange} className="form-control ui-control-sm" placeholder="Last Name" required />
                    <label htmlFor="last_name">Last Name *</label>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="form-floating">
                    <input type="email" id="email" name="email" value={formData.email} onChange={handleInputChange} className="form-control ui-control-sm" placeholder="Email" />
                    <label htmlFor="email">Email</label>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="form-floating">
                    <input type="tel" id="phone" name="phone" value={formData.phone} onChange={handleInputChange} className="form-control ui-control-sm" placeholder="Phone" />
                    <label htmlFor="phone">Phone</label>
                  </div>
                </div>
                {!selfEdit && (
                  <>
                    <div className="col-md-6">
                      <div className="ui-pos-rel">
                        <label htmlFor="role" className="form-label" style={{ fontSize: "0.875rem", marginBottom: "0.25rem" }}>
                          Role
                        </label>
                        <div className="ui-pos-rel">
                          <button
                            type="button"
                            onClick={() => {
                              const nextOpen = !isRoleDropdownOpen;
                              setIsRoleDropdownOpen(nextOpen);
                              if (!nextOpen) setRoleHelpKey(null);
                            }}
                            className="align-items-center d-flex form-select form-select-sm justify-content-between text-start"
                            style={{ cursor: "pointer" }}
                          >
                            <span ref={roleLabelRef} className="app-word-safe-label">
                              {roleTriggerLabel}
                            </span>
                          </button>
                          {isRoleDropdownOpen && (
                            <div className="app-menu-panel bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700 position-absolute rounded shadow-lg w-100" style={{ top: "calc(100% + 4px)", zIndex: 1000, maxHeight: "300px", overflowY: "auto" }}>
                              {roleOptions.map((option, index) => {
                                const isHelpOpen = roleHelpKey === option.value;
                                return (
                                  <div key={option.value} className="align-items-center border-bottom border-gray-100 d-flex dark:border-gray-700 gap-1 px-0 py-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleInputChange({ target: { name: "role", value: option.value } });
                                        setIsRoleDropdownOpen(false);
                                        setRoleHelpKey(null);
                                      }}
                                      className="app-menu-item btn btn-link dark:text-gray-100 flex-grow-1 p-1 text-decoration-none text-gray-900 text-start"
                                    >
                                      {option.label}
                                    </button>
                                    <div className="flex-shrink-0">
                                      <button
                                        type="button"
                                        className="app-menu-action border-0 btn btn-link btn-sm p-0 text-primary"
                                        aria-label={`${option.label} help`}
                                        onMouseEnter={(e) => {
                                          const rect = e.currentTarget.getBoundingClientRect();
                                          setRoleHelpPos({ top: rect.top, left: rect.right + 8 });
                                          setRoleHelpKey(option.value);
                                        }}
                                        onMouseLeave={() => setRoleHelpKey((prev) => (prev === option.value ? null : prev))}
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          const rect = e.currentTarget.getBoundingClientRect();
                                          setRoleHelpPos({ top: rect.top, left: rect.right + 8 });
                                          setRoleHelpKey((prev) => (prev === option.value ? null : option.value));
                                        }}
                                        style={{ width: "1.75rem", height: "1.75rem", lineHeight: 1, fontWeight: 700, fontSize: "0.75rem", border: "none", outline: "none" }}
                                      >
                                        ?
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {/* Fixed-position tooltip — escapes overflow:auto container */}
                          {roleHelpKey &&
                            (() => {
                              const opt = roleOptions.find((o) => o.value === roleHelpKey);
                              if (!opt) return null;
                              return (
                                <div
                                  style={{ position: "fixed", top: roleHelpPos.top, left: roleHelpPos.left, width: 240, maxWidth: "calc(100vw - 1rem)", zIndex: 9999, pointerEvents: "none" }}
                                  className="bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 p-0 rounded-lg shadow-lg text-gray-900"
                                >
                                  <div className="fw-semibold" style={{ fontSize: "0.8rem" }}>
                                    {opt.label}
                                  </div>
                                  <div className="dark:text-gray-300 small text-gray-600">{opt.description}</div>
                                </div>
                              );
                            })()}
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="form-floating">
                        <input type="date" id="hire_date" name="hire_date" value={formData.hire_date} onChange={handleInputChange} className="form-control ui-control-sm" placeholder="Hire Date" />
                        <label htmlFor="hire_date">Hire Date</label>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="form-floating">
                        <select id="reports_to" name="reports_to" value={formData.reports_to} onChange={handleInputChange} className="form-select ui-control-sm">
                          <option value="">No Manager (Top Level)</option>
                          {managerOptions.map((mgr) => (
                            <option key={mgr.id} value={mgr.id}>
                              {mgr.first_name} {mgr.last_name} ({mgr.role})
                            </option>
                          ))}
                        </select>
                        <label htmlFor="reports_to">Supervisor</label>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="form-floating">
                        <select id="role_id" name="role_id" value={formData.role_id} onChange={handleInputChange} className="form-select ui-control-sm" disabled={rolesLoading}>
                          <option value="">No Role Assigned</option>
                          {roles.map((role) => (
                            <option key={role.id} value={role.id}>
                              {role.name} {role.role_permissions?.length > 0 && `(${role.role_permissions.length} permissions)`}
                            </option>
                          ))}
                        </select>
                        <label htmlFor="role_id">Assigned Role</label>
                      </div>
                      {formData.role_id && roles.find((r) => r.id === formData.role_id)?.role_permissions?.length > 0 && (
                        <div className="bg-body-secondary border mt-2 p-0 rounded" style={{ fontSize: "0.8rem" }}>
                          <strong>Role Permissions:</strong>
                          <div className="d-flex flex-wrap gap-1 mt-1">
                            {roles
                              .find((r) => r.id === formData.role_id)
                              ?.role_permissions?.map((perm) => (
                                <span key={perm.id} className="badge bg-secondary">
                                  {perm.page}:{perm.permission}
                                </span>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="col-md-6">
                      <div className="form-floating">
                        <input type="text" id="iod_number" name="iod_number" value={formData.iod_number} onChange={handleInputChange} className="form-control ui-control-sm" placeholder="IOD Number" />
                        <label htmlFor="iod_number">IOD Number</label>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="form-floating">
                        <input type="text" id="location" name="location" value={formData.location} onChange={handleInputChange} className="form-control ui-control-sm" placeholder="Location" />
                        <label htmlFor="location">Location</label>
                      </div>
                    </div>

                    {/* Department */}
                    <div className="col-12">
                      <div className="ui-flex-center-gap-2">
                        <div className="flex-grow-1 form-floating">
                          <select id="department_id" name="department_id" value={formData.department_id} onChange={handleInputChange} className="form-select ui-control-sm">
                            <option value="">— None —</option>
                            {departments.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name}
                              </option>
                            ))}
                          </select>
                          <label htmlFor="department_id">Department</label>
                        </div>
                        <button
                          type="button"
                          title={showNewDept ? "Close" : "Create a new department"}
                          onClick={() => {
                            setShowNewDept((v) => !v);
                            setNewDeptName("");
                            setNewDeptDesc("");
                          }}
                          className="btn btn-outline-secondary btn-sm flex-shrink-0"
                          style={{ height: "3.2rem", width: "2.6rem", fontSize: "1rem" }}
                        >
                          {showNewDept ? "×" : "+"}
                        </button>
                      </div>

                      {showNewDept && (
                        <div className="bg-gray-50 border border-gray-200 dark:bg-gray-800 dark:border-gray-700 mt-2 p-0 rounded">
                          <p className="mb-2 ui-small-muted">Create a new department</p>
                          <div className="d-flex flex-column gap-1">
                            <input
                              type="text"
                              value={newDeptName}
                              onChange={(e) => setNewDeptName(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleCreateDepartment())}
                              placeholder="Department name (required)"
                              className="form-control ui-control-sm"
                              style={{ fontSize: "0.82rem" }}
                              autoFocus
                            />
                            <input
                              type="text"
                              value={newDeptDesc}
                              onChange={(e) => setNewDeptDesc(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleCreateDepartment())}
                              placeholder="Description (optional)"
                              className="form-control ui-control-sm"
                              style={{ fontSize: "0.82rem" }}
                            />
                            <button type="button" onClick={handleCreateDepartment} disabled={!newDeptName.trim() || deptCreating} className="align-self-start btn btn-outline-primary btn-sm px-1" style={{ fontSize: "0.8rem" }}>
                              {deptCreating ? "…" : "Add"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Direct Reports (read-only) */}
                    {employee && directReports.length > 0 && (
                      <div className="col-12">
                        <label className="form-label">Direct Reports</label>
                        <div className="d-flex flex-wrap gap-1">
                          {directReports.map((dr) => (
                            <span key={dr.id} className="badge bg-info text-white">
                              {dr.first_name} {dr.last_name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="col-12">
                      <button type="button" onClick={() => setFormData((prev) => ({ ...prev, is_active: !prev.is_active }))} className={`btn btn-sm rounded-pill px-1 pb-0 ${formData.is_active ? "btn-success" : "btn-outline-secondary"}`}>
                        Active
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ===== BENEFITS TAB ===== */}
          {activeTab === "benefits" && (
            <div className="tab-pane">
              <div className="g-3 row">
                {/* Insurance */}
                <div className="col-12 mt-3">
                  <h6 className="mb-0 text-uppercase ui-small-muted">Insurance</h6>
                  <hr className="mb-2 mt-1" />
                </div>
                <div className="col-md-6">
                  <div className="align-items-stretch d-flex gap-2">
                    <div className="flex-grow-1 form-floating">
                      <select id="insurance_plan" name="insurance_plan" value={formData.insurance_plan} onChange={handleInputChange} className="form-select ui-control-sm">
                        <option value="">No Plan Selected</option>
                        {insurancePlans.map((plan) => (
                          <option key={plan.id} value={plan.name}>
                            {plan.name}
                          </option>
                        ))}
                      </select>
                      <label htmlFor="insurance_plan">Insurance Plan</label>
                    </div>
                    <div className="align-items-center d-flex flex-shrink-0" style={{ paddingTop: "0.35rem" }}>
                      <Button_InsuranceDocument planId={insurancePlans.find((p) => p.name === formData.insurance_plan)?.id} planName={formData.insurance_plan} insurancePlans={insurancePlans} title="View insurance plan document" />
                    </div>
                  </div>
                </div>

                {/* Leave */}
                <div className="col-12 mt-3">
                  <h6 className="mb-0 text-uppercase ui-small-muted">Leave</h6>
                  <hr className="mb-2 mt-1" />
                </div>
                <div className="col-md-3">
                  <div className="form-floating">
                    <input type="number" id="vacation_days" name="vacation_days" value={formData.vacation_days} onChange={handleInputChange} className="form-control ui-control-sm" placeholder="Total" min="0" />
                    <label htmlFor="vacation_days">Vacation Days</label>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="form-floating">
                    <input type="number" id="vacation_days_used" name="vacation_days_used" value={formData.vacation_days_used} onChange={handleInputChange} className="form-control ui-control-sm" placeholder="Used" min="0" />
                    <label htmlFor="vacation_days_used">Vacation Used</label>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="form-floating">
                    <input type="number" id="sick_days" name="sick_days" value={formData.sick_days} onChange={handleInputChange} className="form-control ui-control-sm" placeholder="Total" min="0" />
                    <label htmlFor="sick_days">Sick Days</label>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="form-floating">
                    <input type="number" id="sick_days_used" name="sick_days_used" value={formData.sick_days_used} onChange={handleInputChange} className="form-control ui-control-sm" placeholder="Used" min="0" />
                    <label htmlFor="sick_days_used">Sick Used</label>
                  </div>
                </div>

                {/* Leave summary bar */}
                {(formData.vacation_days || formData.sick_days) && (
                  <div className="col-12 mt-2">
                    <div className="row ui-row-g2">
                      {formData.vacation_days && (
                        <div className="col-md-6">
                          <small className="text-muted">
                            Vacation: {formData.vacation_days_used || 0} / {formData.vacation_days} used
                          </small>
                          <div className="progress">
                            <div
                              className="bg-primary progress-bar"
                              style={{
                                width: `${Math.min(100, ((formData.vacation_days_used || 0) / formData.vacation_days) * 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}
                      {formData.sick_days && (
                        <div className="col-md-6">
                          <small className="text-muted">
                            Sick: {formData.sick_days_used || 0} / {formData.sick_days} used
                          </small>
                          <div className="progress">
                            <div
                              className="bg-warning progress-bar"
                              style={{
                                width: `${Math.min(100, ((formData.sick_days_used || 0) / formData.sick_days) * 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===== SIGNATURE TAB ===== */}
          {activeTab === "signature" && (
            <div className="tab-pane">
              {employee ? (
                <div className="g-3 row">
                  {signatureMessage && (
                    <div className="col-12">
                      <div className={`alert py-0 small ${signatureMessage.includes("Failed") ? "alert-danger" : "alert-success"}`}>{signatureMessage}</div>
                    </div>
                  )}

                  {signatureLoading ? (
                    <div className="col-12 py-1 text-center">
                      <div className="spinner-border spinner-border-sm text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                    </div>
                  ) : showSignaturePad ? (
                    <div className="col-12">
                      <Widget_Signature onSave={handleSaveSignature} onCancel={() => setShowSignaturePad(false)} initialSignature={savedSignature} />
                    </div>
                  ) : savedSignature ? (
                    <div className="col-12 text-center">
                      <div className="bg-body border d-inline-block p-1 rounded">
                        <img src={savedSignature} alt="Saved signature" style={{ maxWidth: "400px", maxHeight: "150px" }} />
                      </div>
                    </div>
                  ) : (
                    <div className="col-12 py-1 text-center">
                      <p className="mb-0 text-muted">No signature saved yet.</p>
                    </div>
                  )}

                  {/* Hidden file input */}
                  <input type="file" ref={signatureFileRef} accept="image/*" style={{ display: "none" }} onChange={handleSignatureUpload} />
                </div>
              ) : (
                <div className="p-1 text-center">
                  <p className="text-muted">Create the employee first, then add a signature.</p>
                </div>
              )}
            </div>
          )}

          {/* ===== PERMISSIONS TAB ===== */}
          {activeTab === "permissions" && (
            <div className="tab-pane">
              {employee ? (
                <>
                  {/* Current Permissions Table */}
                  {userPermissions.length > 0 ? (
                    <div className="table-responsive">
                      <table className="mb-0 table table-sm">
                        <thead>
                          <tr>
                            <th style={{ width: "70px" }}>Actions</th>
                            <th>Page</th>
                            <th>Permission</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {userPermissions.map((perm) => (
                            <tr key={perm.id}>
                              <td>
                                <div className="d-flex gap-1">
                                  <button type="button" onClick={() => handleDeletePermission(perm.id)} className="btn btn-outline-danger btn-sm p-1" title="Delete">
                                    <XMarkIcon style={{ width: 12, height: 12 }} />
                                  </button>
                                  <button type="button" onClick={() => handleTogglePermission(perm.id, !perm.granted)} className={`btn btn-sm p-1 ${perm.granted ? "btn-outline-warning" : "btn-outline-success"}`} title={perm.granted ? "Deny" : "Grant"}>
                                    <i className={`bi ${perm.granted ? "bi-x-circle" : "bi-check-circle"}`}></i>
                                  </button>
                                </div>
                              </td>
                              <td>{perm.page}</td>
                              <td>{perm.permission}</td>
                              <td>
                                <span className={`badge ${perm.granted ? "bg-success" : "bg-danger"}`}>{perm.granted ? "Granted" : "Denied"}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="py-0 text-center text-muted">No permissions assigned yet.</p>
                  )}

                  {/* Role inherited permissions */}
                  {formData.role_id && roles.find((r) => r.id === formData.role_id)?.role_permissions?.length > 0 && (
                    <div className="bg-light border mt-3 p-0 rounded" style={{ fontSize: "0.8rem" }}>
                      <strong>Inherited from Role:</strong>
                      <div className="d-flex flex-wrap gap-1 mt-1">
                        {roles
                          .find((r) => r.id === formData.role_id)
                          ?.role_permissions?.map((perm) => (
                            <span key={perm.id} className="badge bg-secondary">
                              {perm.page}:{perm.permission}
                            </span>
                          ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-1 text-center">
                  <p className="text-muted">Create the employee first, then manage permissions.</p>
                </div>
              )}
            </div>
          )}

          {/* ===== PERFORMANCE TAB ===== */}
          {activeTab === "performance" && (
            <div className="tab-pane">
              {employee ? (
                <div className="g-3 row">
                  {/* Task Statistics */}
                  <div className="col-12">
                    <h6 className="mb-0 text-uppercase ui-small-muted">Task Statistics</h6>
                    <hr className="mb-2 mt-1" />
                  </div>
                  <div className="col-md-6">
                    <div className="card">
                      <div className="card-body py-1 text-center">
                        <div className="ui-small-muted">Scheduled Appointments</div>
                        <div className="fs-4 fw-bold">{employee.schedules?.length ?? "—"}</div>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="card">
                      <div className="card-body py-1 text-center">
                        <div className="ui-small-muted">Attendance Records</div>
                        <div className="fs-4 fw-bold">{employee.attendance_records?.length ?? "—"}</div>
                      </div>
                    </div>
                  </div>

                  {/* Review History placeholder */}
                  <div className="col-12 mt-2">
                    <h6 className="mb-0 text-uppercase ui-small-muted">Review History</h6>
                    <hr className="mb-2 mt-1" />
                    <p className="mb-0 py-0 text-center text-muted">No reviews recorded yet.</p>
                  </div>

                  {/* Goals placeholder */}
                  <div className="col-12">
                    <h6 className="mb-0 text-uppercase ui-small-muted">Goals</h6>
                    <hr className="mb-2 mt-1" />
                    <p className="mb-0 py-0 text-center text-muted">No goals set.</p>
                  </div>

                  {/* Feedback placeholder */}
                  <div className="col-12">
                    <h6 className="mb-0 text-uppercase ui-small-muted">Feedback</h6>
                    <hr className="mb-2 mt-1" />
                    <p className="mb-0 py-0 text-center text-muted">No feedback entries.</p>
                  </div>
                </div>
              ) : (
                <div className="p-1 text-center">
                  <p className="text-muted">Create the employee first to view performance data.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "pay_settings" && (
            <div className="tab-pane">
              {employee ? (
                <div className="g-3 row">
                  <div className="col-12">
                    <h6 className="mb-0 text-uppercase ui-small-muted">Compensation</h6>
                    <hr className="mb-2 mt-1" />
                  </div>

                  <div className="col-md-6">
                    <div className="ui-pos-rel">
                      <label htmlFor="employment_type" className="form-label" style={{ fontSize: "0.875rem", marginBottom: "0.25rem" }}>
                        Employment Type
                      </label>
                      <div className="ui-pos-rel">
                        <button
                          type="button"
                          onClick={() => {
                            const nextOpen = !isEmploymentTypeDropdownOpen;
                            setIsEmploymentTypeDropdownOpen(nextOpen);
                            if (!nextOpen) setEmploymentTypeHelpKey(null);
                          }}
                          className="align-items-center d-flex form-select form-select-sm justify-content-between text-start"
                          style={{ cursor: "pointer" }}
                        >
                          <span ref={employmentTypeLabelRef} className="app-word-safe-label">
                            {employmentTypeTriggerLabel}
                          </span>
                        </button>
                        {isEmploymentTypeDropdownOpen && (
                          <div className="app-menu-panel bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700 position-absolute rounded shadow-lg w-100" style={{ top: "calc(100% + 4px)", zIndex: 1000, maxHeight: "300px", overflowY: "auto" }}>
                            {employmentTypeOptions.map((option) => (
                              <div key={option.value} className="align-items-center border-bottom border-gray-100 d-flex dark:border-gray-700 gap-1 px-0 py-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleInputChange({ target: { name: "employment_type", value: option.value } });
                                    setIsEmploymentTypeDropdownOpen(false);
                                    setEmploymentTypeHelpKey(null);
                                  }}
                                  className="app-menu-item btn btn-link dark:text-gray-100 flex-grow-1 p-1 text-decoration-none text-gray-900 text-start"
                                >
                                  {option.label}
                                </button>
                                <div className="flex-shrink-0">
                                  <button
                                    type="button"
                                    className="app-menu-action border-0 btn btn-link btn-sm p-0 text-primary"
                                    aria-label={`${option.label} help`}
                                    onMouseEnter={(e) => {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setEmploymentTypeHelpPos({ top: rect.top, left: rect.right + 8 });
                                      setEmploymentTypeHelpKey(option.value);
                                    }}
                                    onMouseLeave={() => setEmploymentTypeHelpKey((prev) => (prev === option.value ? null : prev))}
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setEmploymentTypeHelpPos({ top: rect.top, left: rect.right + 8 });
                                      setEmploymentTypeHelpKey((prev) => (prev === option.value ? null : option.value));
                                    }}
                                    style={{ width: "1.75rem", height: "1.75rem", lineHeight: 1, fontWeight: 700, fontSize: "0.75rem", border: "none", outline: "none" }}
                                  >
                                    ?
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {employmentTypeHelpKey &&
                          (() => {
                            const opt = employmentTypeOptions.find((o) => o.value === employmentTypeHelpKey);
                            if (!opt) return null;
                            return (
                              <div
                                style={{ position: "fixed", top: employmentTypeHelpPos.top, left: employmentTypeHelpPos.left, width: 240, maxWidth: "calc(100vw - 1rem)", zIndex: 9999, pointerEvents: "none" }}
                                className="bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 p-0 rounded-lg shadow-lg text-gray-900"
                              >
                                <div className="fw-semibold" style={{ fontSize: "0.8rem" }}>
                                  {opt.label}
                                </div>
                                <div className="dark:text-gray-300 small text-gray-600">{opt.description}</div>
                              </div>
                            );
                          })()}
                      </div>
                    </div>
                  </div>

                  <div className="col-md-6">
                    <div className="ui-pos-rel">
                      <label htmlFor="pay_frequency" className="form-label" style={{ fontSize: "0.875rem", marginBottom: "0.25rem" }}>
                        Pay Frequency
                      </label>
                      <div className="ui-pos-rel">
                        <button
                          type="button"
                          onClick={() => {
                            const nextOpen = !isPayFrequencyDropdownOpen;
                            setIsPayFrequencyDropdownOpen(nextOpen);
                            if (!nextOpen) setPayFrequencyHelpKey(null);
                          }}
                          className="align-items-center d-flex form-select form-select-sm justify-content-between text-start"
                          style={{ cursor: "pointer" }}
                        >
                          <span ref={payFrequencyLabelRef} className="app-word-safe-label">
                            {payFrequencyTriggerLabel}
                          </span>
                        </button>
                        {isPayFrequencyDropdownOpen && (
                          <div className="app-menu-panel bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700 position-absolute rounded shadow-lg w-100" style={{ top: "calc(100% + 4px)", zIndex: 1000, maxHeight: "300px", overflowY: "auto" }}>
                            {payFrequencyOptions.map((option) => (
                              <div key={option.value} className="align-items-center border-bottom border-gray-100 d-flex dark:border-gray-700 gap-1 px-0 py-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleInputChange({ target: { name: "pay_frequency", value: option.value } });
                                    setIsPayFrequencyDropdownOpen(false);
                                    setPayFrequencyHelpKey(null);
                                    if (["weekly", "biweekly", "monthly"].includes(option.value) && employeePaySchedule) {
                                      setEmployeePaySchedule((p) => ({ ...p, frequency: option.value }));
                                    }
                                  }}
                                  className="app-menu-item btn btn-link dark:text-gray-100 flex-grow-1 p-1 text-decoration-none text-gray-900 text-start"
                                >
                                  {option.label}
                                </button>
                                <div className="flex-shrink-0">
                                  <button
                                    type="button"
                                    className="app-menu-action border-0 btn btn-link btn-sm p-0 text-primary"
                                    aria-label={`${option.label} help`}
                                    onMouseEnter={(e) => {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setPayFrequencyHelpPos({ top: rect.top, left: rect.right + 8 });
                                      setPayFrequencyHelpKey(option.value);
                                    }}
                                    onMouseLeave={() => setPayFrequencyHelpKey((prev) => (prev === option.value ? null : prev))}
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setPayFrequencyHelpPos({ top: rect.top, left: rect.right + 8 });
                                      setPayFrequencyHelpKey((prev) => (prev === option.value ? null : option.value));
                                    }}
                                    style={{ width: "1.75rem", height: "1.75rem", lineHeight: 1, fontWeight: 700, fontSize: "0.75rem", border: "none", outline: "none" }}
                                  >
                                    ?
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {payFrequencyHelpKey &&
                          (() => {
                            const opt = payFrequencyOptions.find((o) => o.value === payFrequencyHelpKey);
                            if (!opt) return null;
                            return (
                              <div
                                style={{ position: "fixed", top: payFrequencyHelpPos.top, left: payFrequencyHelpPos.left, width: 240, maxWidth: "calc(100vw - 1rem)", zIndex: 9999, pointerEvents: "none" }}
                                className="bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 p-0 rounded-lg shadow-lg text-gray-900"
                              >
                                <div className="fw-semibold" style={{ fontSize: "0.8rem" }}>
                                  {opt.label}
                                </div>
                                <div className="dark:text-gray-300 small text-gray-600">{opt.description}</div>
                              </div>
                            );
                          })()}
                      </div>
                    </div>
                  </div>

                  {formData.employment_type !== "hourly" && (
                    <div className="col-md-6">
                      <div className="input-group">
                        <span className="input-group-text">$</span>
                        <div className="form-floating">
                          <input type="number" id="salary" name="salary" value={formData.salary} onChange={handleInputChange} className="form-control ui-control-sm" placeholder="0.00" step="0.01" min="0" />
                          <label htmlFor="salary">Annual Salary</label>
                        </div>
                      </div>
                    </div>
                  )}
                  {formData.employment_type === "hourly" && (
                    <div className="col-md-6">
                      <div className="input-group">
                        <span className="input-group-text">$</span>
                        <div className="form-floating">
                          <input type="number" id="hourly_rate" name="hourly_rate" value={formData.hourly_rate} onChange={handleInputChange} className="form-control ui-control-sm" placeholder="0.00" step="0.01" min="0" />
                          <label htmlFor="hourly_rate">Hourly Rate</label>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="col-12 mt-3">
                    <h6 className="mb-0 text-uppercase ui-small-muted">Pay Schedule</h6>
                    <hr className="mb-2 mt-1" />
                  </div>

                  {!employeePayScheduleLoading && employeePayScheduleError && (
                    <div className="col-12">
                      <div className="alert alert-danger mb-0 px-1 py-0 small">{employeePayScheduleError}</div>
                    </div>
                  )}
                  {!employeePayScheduleLoading && employeePayScheduleSuccess && (
                    <div className="col-12">
                      <div className="alert alert-success mb-0 px-1 py-0 small">{employeePayScheduleSuccess}</div>
                    </div>
                  )}

                  {employeePayScheduleLoading ? (
                    <div className="col-12">
                      <div className="py-1 text-center">
                        <div className="spinner-border spinner-border-sm text-primary" role="status" />
                      </div>
                    </div>
                  ) : !employeePaySchedule ? (
                    <div className="col-12">
                      <div className="ui-small-muted">Unable to load pay schedule.</div>
                    </div>
                  ) : !["weekly", "biweekly", "monthly"].includes(String(formData.pay_frequency || "").toLowerCase()) ? (
                    <div className="col-12">
                      <div className="ui-small-muted">Select Weekly, Bi-weekly, or Monthly pay frequency to configure payday and pay timing.</div>
                    </div>
                  ) : (
                    <>
                      {(String(formData.pay_frequency || "").toLowerCase() === "weekly" || String(formData.pay_frequency || "").toLowerCase() === "biweekly") && (
                        <>
                          <div className="col-12">
                            <div className="fw-semibold mb-2 ui-text-sm">Work Days</div>
                            <div className="d-flex flex-wrap gap-2">
                              {PAY_SCHEDULE_DAYS.map((d) => {
                                const workDays = parsePayScheduleWorkDays(employeePaySchedule.work_days);
                                const active = workDays.includes(d.key);
                                return (
                                  <button
                                    key={d.key}
                                    type="button"
                                    onClick={() => {
                                      const current = parsePayScheduleWorkDays(employeePaySchedule.work_days);
                                      const next = current.includes(d.key) ? current.filter((x) => x !== d.key) : [...current, d.key];
                                      setEmployeePaySchedule((p) => ({ ...p, work_days: serializePayScheduleWorkDays(next) }));
                                    }}
                                    className={`btn btn-sm ${active ? "btn-primary" : "btn-outline-secondary"}`}
                                    style={{ minWidth: 48, fontSize: "0.8rem" }}
                                  >
                                    {d.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="col-12">
                            <div className="fw-semibold mb-2 ui-text-sm">Payday</div>
                            <div className="d-flex flex-wrap gap-2">
                              {PAY_SCHEDULE_DAYS.map((d) => (
                                <button
                                  key={d.key}
                                  type="button"
                                  onClick={() => setEmployeePaySchedule((p) => ({ ...p, payday_weekday: d.key }))}
                                  className={`btn btn-sm ${employeePaySchedule.payday_weekday === d.key ? "btn-success" : "btn-outline-secondary"}`}
                                  style={{ minWidth: 48, fontSize: "0.8rem" }}
                                >
                                  {d.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="col-md-6">
                            <div className="fw-semibold mb-2 ui-text-sm">Cycle Start Date</div>
                            <input type="date" className="form-control ui-control-sm" style={{ maxWidth: 220 }} value={employeePaySchedule.cycle_anchor_date || ""} onChange={(e) => setEmployeePaySchedule((p) => ({ ...p, cycle_anchor_date: e.target.value || null }))} />
                          </div>
                        </>
                      )}

                      {String(formData.pay_frequency || "").toLowerCase() === "monthly" && (
                        <>
                          <div className="col-12">
                            <div className="fw-semibold mb-2 ui-text-sm">Payday</div>
                            <div className="d-flex flex-wrap gap-2 mb-3">
                              {[
                                { value: "date", label: "Specific date" },
                                { value: "weekday", label: "Weekday of month" },
                              ].map((t) => (
                                <button
                                  key={t.value}
                                  type="button"
                                  onClick={() => setEmployeePaySchedule((p) => ({ ...p, monthly_payday_type: t.value }))}
                                  className={`btn btn-sm ${employeePaySchedule.monthly_payday_type === t.value ? "btn-primary" : "btn-outline-secondary"}`}
                                  style={{ fontSize: "0.8rem" }}
                                >
                                  {t.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {employeePaySchedule.monthly_payday_type === "date" && (
                            <div className="col-12">
                              <div className="align-items-center d-flex flex-wrap gap-2">
                                <label className="form-label fw-semibold mb-0 small">Day of month</label>
                                <input
                                  type="number"
                                  min={1}
                                  max={31}
                                  className="form-control ui-control-sm"
                                  style={{ width: 80 }}
                                  value={employeePaySchedule.monthly_payday_date || ""}
                                  onChange={(e) => setEmployeePaySchedule((p) => ({ ...p, monthly_payday_date: parseInt(e.target.value) || null }))}
                                />
                              </div>
                            </div>
                          )}

                          {employeePaySchedule.monthly_payday_type === "weekday" && (
                            <div className="col-12">
                              <div className="align-items-center d-flex flex-wrap gap-2">
                                <label className="form-label fw-semibold mb-0 small">The</label>
                                <select className="form-select ui-control-sm" style={{ width: "auto" }} value={employeePaySchedule.monthly_payday_week ?? ""} onChange={(e) => setEmployeePaySchedule((p) => ({ ...p, monthly_payday_week: parseInt(e.target.value) || null }))}>
                                  <option value="">—</option>
                                  {PAY_SCHEDULE_WEEK_OPTS.map((w) => (
                                    <option key={w.value} value={w.value}>
                                      {w.label}
                                    </option>
                                  ))}
                                </select>
                                <select className="form-select ui-control-sm" style={{ width: "auto" }} value={employeePaySchedule.monthly_payday_weekday || ""} onChange={(e) => setEmployeePaySchedule((p) => ({ ...p, monthly_payday_weekday: e.target.value || null }))}>
                                  <option value="">— day —</option>
                                  {PAY_SCHEDULE_DAYS.map((d) => (
                                    <option key={d.key} value={d.key}>
                                      {d.full}
                                    </option>
                                  ))}
                                </select>
                                <span className="ui-small-muted">of the month</span>
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      <div className="col-12">
                        <div className="fw-semibold mb-2 ui-text-sm">Pay Timing</div>
                        <div className="d-flex flex-column gap-2">
                          {[
                            { value: "arrears", label: "Arrears — pay after work is done" },
                            { value: "advance", label: "Advance — pay before work begins" },
                          ].map((opt) => (
                            <div
                              key={opt.value}
                              onClick={() => setEmployeePaySchedule((p) => ({ ...p, pay_timing: opt.value }))}
                              className={`p-1 rounded border ${employeePaySchedule.pay_timing === opt.value ? "border-primary bg-primary bg-opacity-10" : "border-secondary-subtle"}`}
                              style={{ cursor: "pointer" }}
                            >
                              <div className="align-items-center d-flex gap-2 mb-1">
                                <input type="radio" readOnly checked={employeePaySchedule.pay_timing === opt.value} className="form-check-input mt-0" />
                                <span className="fw-medium small">{opt.label}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="col-12">
                        <button
                          type="button"
                          className="align-items-center btn btn-primary d-flex gap-2 justify-content-center w-100"
                          onClick={async () => {
                            if (!employee?.id) return;
                            const payFreq = String(formData.pay_frequency || "").toLowerCase();
                            if (!["weekly", "biweekly", "monthly"].includes(payFreq)) return;
                            setEmployeePayScheduleSaving(true);
                            setEmployeePayScheduleError("");
                            setEmployeePayScheduleSuccess("");
                            try {
                              const payload = {
                                frequency: payFreq,
                                work_days: employeePaySchedule.work_days ?? "mon,tue,wed,thu,fri",
                                payday_weekday: employeePaySchedule.payday_weekday ?? "fri",
                                monthly_payday_type: employeePaySchedule.monthly_payday_type ?? "date",
                                monthly_payday_date: employeePaySchedule.monthly_payday_date ?? 28,
                                monthly_payday_week: employeePaySchedule.monthly_payday_week ?? null,
                                monthly_payday_weekday: employeePaySchedule.monthly_payday_weekday ?? null,
                                pay_timing: employeePaySchedule.pay_timing ?? "arrears",
                                cycle_anchor_date: employeePaySchedule.cycle_anchor_date ?? null,
                              };
                              await payrollAPI.updateEmployeeSchedule(employee.id, payload);
                              setEmployeePayScheduleSuccess("Pay settings saved");
                              setTimeout(() => setEmployeePayScheduleSuccess(""), 3000);
                            } catch (err) {
                              setEmployeePayScheduleError(err?.response?.data?.detail || "Failed to save pay settings");
                            } finally {
                              setEmployeePayScheduleSaving(false);
                            }
                          }}
                          disabled={employeePayScheduleSaving}
                        >
                          <CheckCircleIcon className="ui-icon-4" />
                          <span>{employeePayScheduleSaving ? "Saving…" : "Save Pay settings"}</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="p-1 text-center">
                  <p className="text-muted">Create the employee first to configure pay settings.</p>
                </div>
              )}
            </div>
          )}

          {/* ===== PAYMENTS TAB ===== */}
          {activeTab === "payments" && (
            <div className="tab-pane">
              {employee ? (
                <>
                  <h6 className="mb-0 text-uppercase ui-small-muted">Wage History</h6>
                  <hr className="mb-2 mt-1" />
                  {paySlipsLoading ? (
                    <div className="py-1 text-center">
                      <div className="spinner-border spinner-border-sm text-primary" role="status" />
                    </div>
                  ) : paySlips.length === 0 ? (
                    <p className="py-1 small text-center text-muted">No pay slips on record.</p>
                  ) : (
                    <div style={{ overflowX: "auto", scrollbarWidth: "none", msOverflowStyle: "none" }}>
                      <table className="mb-0 table table-hover table-sm" style={{ fontSize: "0.8rem" }}>
                        <thead className="table-light">
                          <tr>
                            <th>Period</th>
                            <th className="text-end">Gross</th>
                            <th className="text-end">Deductions</th>
                            <th className="text-end">Net</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {paySlips.map((slip) => (
                            <tr key={slip.id}>
                              <td>{slip.pay_period_start ? new Date(slip.pay_period_start).toLocaleDateString() : "—"}</td>
                              <td className="text-end">${Number(slip.gross_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              <td className="text-danger text-end">-${Number((slip.insurance_deduction ?? 0) + (slip.other_deductions ?? 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              <td className="fw-semibold text-end">${Number(slip.net_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              <td>
                                <button type="button" className="btn btn-outline-secondary btn-sm px-1 py-0" style={{ fontSize: "0.7rem" }} onClick={() => setSelectedSlip(slip)}>
                                  View
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-1 text-center">
                  <p className="text-muted">Create the employee first to view payment history.</p>
                </div>
              )}
            </div>
          )}
        </form>
      </div>

      {/* ─── 10 RENDER: FOOTER ──────────────────────────────────────────────────── */}
      {/* Footer */}
      <div className="app-footer-padding app-form-footer app-standard-footer ui-form-footer-shell">
        {/* Tab Navigation */}
        <ul className="mb-2 nav nav-tabs">
          {tabs.map((tab) => (
            <li key={tab.key} className="nav-item">
              <button className={`nav-link ${activeTab === tab.key ? "active" : ""} px-0 py-1 px-md-3 py-md-2`} onClick={() => setActiveTab(tab.key)} type="button" disabled={tab.disabled} style={{ fontSize: "clamp(0.75rem, 2vw, 1rem)" }}>
                {tab.label}
              </button>
            </li>
          ))}
        </ul>

        {/* Signature tab footer controls */}
        {activeTab === "signature" && employee && !showSignaturePad && !signatureLoading && (
          <div className="d-flex gap-2 justify-content-center mb-2">
            <button type="button" onClick={() => signatureFileRef.current?.click()} className="btn btn-outline-secondary btn-sm px-1 rounded-pill">
              Upload
            </button>
            <button type="button" onClick={() => setShowSignaturePad(true)} className="btn btn-primary btn-sm px-1 rounded-pill" title={savedSignature ? "Replace signature" : "Create signature"}>
              {savedSignature ? "Replace" : "Sign"}
            </button>
          </div>
        )}

        {/* Permissions tab footer controls */}
        {activeTab === "permissions" && employee && (
          <div className="mb-2">
            {permError && <div className="alert alert-danger mb-2 py-1 small">{permError}</div>}
            {permSuccess && <div className="alert alert-success mb-2 py-1 small">{permSuccess}</div>}
            <div className="align-items-center g-2 row">
              <div className="col">
                <select value={newPermission.page} onChange={(e) => setNewPermission((p) => ({ ...p, page: e.target.value }))} className="form-select ui-control-sm">
                  <option value="">Select Page</option>
                  {PAGE_OPTION_GROUPS.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.options.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="col">
                <select value={newPermission.permission} onChange={(e) => setNewPermission((p) => ({ ...p, permission: e.target.value }))} className="form-select ui-control-sm">
                  <option value="">Select Permission</option>
                  {PERMISSION_TYPES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-auto">
                <button type="button" onClick={handleCreatePermission} className="btn btn-primary btn-sm" disabled={!newPermission.page || !newPermission.permission}>
                  Add
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Payments tab footer controls */}
        {activeTab === "payments" && employee && hasPermission("employees", "write") && (
          <div className="d-flex justify-content-center mb-2">
            <button type="button" className="btn btn-outline-secondary btn-sm px-1 rounded-pill" onClick={() => setShowPayModal(true)}>
              Pay
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <Footer_Actions
          start={
            activeTab === "details" || activeTab === "benefits" || activeTab === "pay_settings" ? <Button_Toolbar icon={CheckIcon} label={employee ? "Save" : "Add"} type="submit" form="employee-form" className="btn-outline-secondary" title={employee ? "Save employee" : "Add employee"} /> : null
          }
          center={<Button_Toolbar icon={XMarkIcon} label="Cancel" onClick={onCancel} className="btn-outline-secondary" title="Cancel" />}
          end={
            employee && canDelete ? (
              <Button_Toolbar
                icon={XMarkIcon}
                label="Delete"
                title="Delete employee"
                onClick={async () => {
                  if (await showConfirm("Are you sure you want to delete this employee?", { confirmLabel: "Delete Employee" })) onDelete(employee.id);
                }}
                className="btn-outline-secondary"
              />
            ) : null
          }
        />
      </div>

      {/* Process Pay Modal */}
      <Modal_Pay_Employee
        isOpen={showPayModal}
        onClose={() => setShowPayModal(false)}
        employee={employee}
        onPaySuccess={() => {
          setShowPayModal(false);
          // Reload pay slips
          if (employee?.id) {
            setPaySlipsLoading(true);
            payrollAPI
              .getByEmployee(employee.id)
              .then((res) => {
                const d = res?.data ?? res;
                setPaySlips(Array.isArray(d) ? d : []);
              })
              .catch(() => setPaySlips([]))
              .finally(() => setPaySlipsLoading(false));
          }
        }}
      />

      {/* Pay Slip Detail Modal */}
      {selectedSlip && (
        <div
          className="d-block modal"
          tabIndex="-1"
          style={{ backgroundColor: "rgba(0,0,0,0.55)", zIndex: 2000 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedSlip(null);
          }}
        >
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content" id="pay-slip-print-area-emp">
              <div className="modal-header py-0">
                <h6 className="mb-0 modal-title">Pay Slip</h6>
                <button type="button" className="btn-close" onClick={() => setSelectedSlip(null)} />
              </div>
              <div className="modal-body" style={{ fontSize: "0.85rem" }}>
                <div className="mb-3 text-center">
                  <div className="fs-6 fw-bold">
                    {employee?.first_name} {employee?.last_name}
                  </div>
                  <div className="ui-small-muted">{employee?.role}</div>
                </div>
                <hr className="my-2" />
                <div className="g-1 mb-2 row">
                  <div className="col-6 ui-text-muted">Pay Period</div>
                  <div className="col-6 ui-text-end">
                    {selectedSlip.pay_period_start ? new Date(selectedSlip.pay_period_start).toLocaleDateString() : "—"} – {selectedSlip.pay_period_end ? new Date(selectedSlip.pay_period_end).toLocaleDateString() : "—"}
                  </div>
                  <div className="col-6 ui-text-muted">Type</div>
                  <div className="col-6 ui-text-end" style={{ textTransform: "capitalize" }}>
                    {selectedSlip.employment_type || "—"}
                  </div>
                  {selectedSlip.employment_type === "hourly" && (
                    <>
                      <div className="col-6 ui-text-muted">Hours</div>
                      <div className="col-6 ui-text-end">{selectedSlip.hours_worked ?? "—"}</div>
                      <div className="col-6 ui-text-muted">Rate</div>
                      <div className="col-6 ui-text-end">${Number(selectedSlip.hourly_rate_snapshot ?? 0).toFixed(2)}/hr</div>
                    </>
                  )}
                  <div className="col-6 ui-text-muted">Pay Frequency</div>
                  <div className="col-6 ui-text-end" style={{ textTransform: "capitalize" }}>
                    {selectedSlip.pay_frequency || "—"}
                  </div>
                </div>
                <hr className="my-2" />
                <div className="g-1 row">
                  <div className="col-6 ui-text-muted">Gross Pay</div>
                  <div className="col-6 ui-text-end">${Number(selectedSlip.gross_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  {selectedSlip.insurance_plan_name && (
                    <>
                      <div className="col-6 small text-muted">Insurance ({selectedSlip.insurance_plan_name})</div>
                      <div className="col-6 small text-danger text-end">-${Number(selectedSlip.insurance_deduction ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    </>
                  )}
                  {(selectedSlip.other_deductions ?? 0) > 0 && (
                    <>
                      <div className="col-6 small text-muted">Other Deductions</div>
                      <div className="col-6 small text-danger text-end">-${Number(selectedSlip.other_deductions).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    </>
                  )}
                  <div className="border-top col-6 fw-bold mt-1 pt-1">Net Pay</div>
                  <div className="border-top col-6 fw-bold mt-1 pt-1 text-end text-success">${Number(selectedSlip.net_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                </div>
                {selectedSlip.notes && <div className="mt-2 small text-muted">Notes: {selectedSlip.notes}</div>}
              </div>
              <div className="modal-footer py-0">
                <button
                  type="button"
                  className="align-items-center btn btn-outline-secondary btn-sm d-flex gap-2"
                  onClick={() => {
                    const el = document.getElementById("pay-slip-print-area-emp");
                    if (el) {
                      const w = window.open("", "_blank");
                      w.document.write('<html><head><title>Pay Slip</title><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css"></head><body class="p-1">' + el.innerHTML + "</body></html>");
                      w.document.close();
                      w.focus();
                      setTimeout(() => {
                        w.print();
                      }, 500);
                    }
                  }}
                >
                  <PrinterIcon className="ui-icon-4" />
                  <span>Print</span>
                </button>
                <button type="button" className="align-items-center btn btn-secondary btn-sm d-flex gap-2" onClick={() => setSelectedSlip(null)}>
                  <CheckCircleIcon className="ui-icon-4" />
                  <span>Close</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
