import React, { useState, useEffect, useMemo, useRef } from 'react';
import { TrashIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';
import { rolesAPI, isudAPI, employeesAPI, insurancePlansAPI } from '../../services/api';
import api from '../../services/api';
import Widget_Signature from './Widget_Signature';

const PAGES = ['clients', 'inventory', 'suppliers', 'services', 'employees', 'schedule', 'attendance', 'documents', 'admin'];
const PERMISSION_TYPES = ['read', 'write', 'admin'];

export default function Form_Employee({
  employee,
  onSubmit,
  onCancel,
  onDelete,
  onManagePermissions,
  employees: employeesProp = [],
  canDelete = false,
  selfEdit = false
}) {
  const [activeTab, setActiveTab] = useState('details');
  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [employeesList, setEmployeesList] = useState(employeesProp);
  const [insurancePlans, setInsurancePlans] = useState([]);

  // Permissions state
  const [userPermissions, setUserPermissions] = useState([]);
  const [newPermission, setNewPermission] = useState({ page: '', permission: '' });
  const [permError, setPermError] = useState('');
  const [permSuccess, setPermSuccess] = useState('');

  // Signature state
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [savedSignature, setSavedSignature] = useState(null);
  const [signatureLoading, setSignatureLoading] = useState(false);
  const [signatureMessage, setSignatureMessage] = useState('');
  const signatureFileRef = useRef(null);

  const [formData, setFormData] = useState({
    // Details
    username: '',
    password: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    role: 'EMPLOYEE',
    hire_date: new Date().toISOString().split('T')[0],
    is_active: true,
    reports_to: '',
    supervisor: '',
    role_id: '',
    iod_number: '',
    location: '',
    // Benefits
    employment_type: '',
    salary: '',
    hourly_rate: '',
    pay_frequency: '',
    insurance_plan: '',
    vacation_days: '',
    vacation_days_used: '',
    sick_days: '',
    sick_days_used: '',
  });

  // Load available roles
  useEffect(() => {
    const loadRoles = async () => {
      setRolesLoading(true);
      try {
        const response = await rolesAPI.getAll();
        const rolesData = response?.data ?? response;
        if (Array.isArray(rolesData)) setRoles(rolesData);
      } catch (err) {
        console.error('Failed to load roles:', err);
      } finally {
        setRolesLoading(false);
      }
    };
    loadRoles();
  }, []);

  // Load insurance plans
  useEffect(() => {
    const loadPlans = async () => {
      try {
        const response = await insurancePlansAPI.getAll();
        const data = response?.data ?? response;
        if (Array.isArray(data)) setInsurancePlans(data.filter(p => p.is_active));
      } catch (err) {
        console.error('Failed to load insurance plans:', err);
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
        if (!cancelled) console.error('Form_Employee failed to load employees', err);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [employeesProp.length]);

  // Populate form when editing
  useEffect(() => {
    if (employee) {
      setFormData({
        username: employee.username || '',
        password: '',
        first_name: employee.first_name || '',
        last_name: employee.last_name || '',
        email: employee.email || '',
        phone: employee.phone || '',
        role: employee.role || 'EMPLOYEE',
        hire_date: employee.hire_date ? employee.hire_date.split('T')[0] : new Date().toISOString().split('T')[0],
        is_active: employee.is_active !== undefined ? employee.is_active : true,
        reports_to: employee.reports_to || '',
        supervisor: employee.supervisor || '',
        role_id: employee.role_id || '',
        iod_number: employee.iod_number || '',
        location: employee.location || '',
        employment_type: employee.employment_type || '',
        salary: employee.salary ?? '',
        hourly_rate: employee.hourly_rate ?? '',
        pay_frequency: employee.pay_frequency || '',
        insurance_plan: employee.insurance_plan || '',
        vacation_days: employee.vacation_days ?? '',
        vacation_days_used: employee.vacation_days_used ?? '',
        sick_days: employee.sick_days ?? '',
        sick_days_used: employee.sick_days_used ?? '',
      });
    }
  }, [employee]);

  // Fetch permissions when switching to permissions tab
  useEffect(() => {
    if (activeTab === 'permissions' && employee?.id) {
      fetchUserPermissions(employee.id);
    }
  }, [activeTab, employee?.id]);

  // Load signature when switching to signature tab
  useEffect(() => {
    if (activeTab === 'signature' && employee?.id) {
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

  const handleSignatureUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      handleSaveSignature(ev.target.result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSaveSignature = async (dataUrl) => {
    setSignatureLoading(true);
    setSignatureMessage('');
    try {
      if (!employee?.id) {
        throw new Error('Employee record is required to save a signature.');
      }
      await employeesAPI.updateUser(employee.id, { signature_data: dataUrl });
      setSavedSignature(dataUrl);
      setShowSignaturePad(false);
      setSignatureMessage('Signature saved successfully');
      setTimeout(() => setSignatureMessage(''), 3000);
    } catch (err) {
      setSignatureMessage('Failed to save signature: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSignatureLoading(false);
    }
  };

  const fetchUserPermissions = async (userId) => {
    try {
      const response = await api.get(`/auth/users/${userId}/permissions`);
      setUserPermissions(response.data || []);
    } catch (err) {
      console.error('Failed to fetch permissions:', err);
      setPermError('Failed to load permissions');
    }
  };

  // Filter out current employee from potential supervisors.
  // Also enforce one-supervisoree constraint: exclude employees who already have someone
  // else reporting to them (they can't take on another supervisee).
  const managerOptions = useMemo(() => {
    // Build a set of employee IDs that already have at least one supervisee,
    // but exclude any supervisor who is ALREADY assigned to the current employee.
    const alreadySupervisingOther = new Set(
      employeesList
        .filter(e => e.reports_to && e.id !== employee?.id && e.reports_to !== employee?.id)
        .map(e => e.reports_to)
    );
    return employeesList.filter(e => {
      if (e.id === employee?.id) return false; // can't supervise yourself
      if (alreadySupervisingOther.has(e.id)) return false; // already has a different supervisee
      return true;
    });
  }, [employeesList, employee?.id]);

  // Direct reports for this employee
  const directReports = useMemo(() => {
    if (!employee?.id) return [];
    return employeesList.filter(e => e.reports_to === employee.id);
  }, [employeesList, employee?.id]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'reports_to') {
      // Auto-sync supervisor text field with the selected person's name
      const selected = employeesList.find(emp => emp.id === value);
      const supervisorName = selected ? `${selected.first_name} ${selected.last_name}` : '';
      setFormData(prev => ({
        ...prev,
        reports_to: value,
        supervisor: supervisorName,
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.username.trim()) {
      alert('Username is required');
      return;
    }
    if (!employee && !formData.password.trim()) {
      alert('Password is required for new employees');
      return;
    }
    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      alert('First name and last name are required');
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
    if (!submitData.employment_type) submitData.employment_type = null;
    if (!submitData.pay_frequency) submitData.pay_frequency = null;
    if (!submitData.insurance_plan) submitData.insurance_plan = null;
    // Convert numeric fields
    submitData.salary = submitData.salary !== '' ? parseFloat(submitData.salary) : null;
    submitData.hourly_rate = submitData.hourly_rate !== '' ? parseFloat(submitData.hourly_rate) : null;
    submitData.vacation_days = submitData.vacation_days !== '' ? parseInt(submitData.vacation_days) : null;
    submitData.vacation_days_used = submitData.vacation_days_used !== '' ? parseInt(submitData.vacation_days_used) : null;
    submitData.sick_days = submitData.sick_days !== '' ? parseInt(submitData.sick_days) : null;
    submitData.sick_days_used = submitData.sick_days_used !== '' ? parseInt(submitData.sick_days_used) : null;

    onSubmit(submitData);
  };

  // Permission handlers
  const handleCreatePermission = async (e) => {
    e.preventDefault();
    if (!employee?.id) return;
    setPermError('');
    setPermSuccess('');
    try {
      await api.post(`/auth/users/${employee.id}/permissions`, {
        user_id: employee.id,
        page: newPermission.page,
        permission: newPermission.permission,
        granted: true
      });
      setPermSuccess('Permission added');
      setNewPermission({ page: '', permission: '' });
      fetchUserPermissions(employee.id);
      setTimeout(() => setPermSuccess(''), 3000);
    } catch (err) {
      setPermError(err.response?.data?.detail || 'Failed to create permission');
    }
  };

  const handleTogglePermission = async (permissionId, granted) => {
    if (!employee?.id) return;
    setPermError('');
    try {
      await api.put(`/auth/users/${employee.id}/permissions/${permissionId}`, { granted });
      fetchUserPermissions(employee.id);
    } catch (err) {
      setPermError(err.response?.data?.detail || 'Failed to update permission');
    }
  };

  const handleDeletePermission = async (permissionId) => {
    if (!employee?.id) return;
    if (!window.confirm('Delete this permission?')) return;
    setPermError('');
    try {
      await api.delete(`/auth/users/${employee.id}/permissions/${permissionId}`);
      fetchUserPermissions(employee.id);
    } catch (err) {
      setPermError(err.response?.data?.detail || 'Failed to delete permission');
    }
  };

  const tabs = [
    { key: 'details', label: 'Details' },
    { key: 'benefits', label: 'Benefits' },
    { key: 'signature', label: 'Signature', disabled: !employee },
    { key: 'permissions', label: 'Permissions', disabled: !employee },
    { key: 'performance', label: 'Performance', disabled: !employee },
  ];

  return (
    <div className="d-flex flex-column bg-white dark:bg-gray-900" style={{ height: '100%' }}>

      {/* Header */}
      <div className="flex-shrink-0 p-2 border-bottom border-gray-200 dark:border-gray-700 d-flex justify-content-between align-items-center bg-white dark:bg-gray-900">
        <h6 className="mb-0 fw-semibold text-gray-900 dark:text-gray-100">
          {employee ? 'Edit Employee' : 'Add Employee'}
        </h6>
        <button type="button" onClick={onCancel} className="btn btn-link p-0 text-muted">
          <XMarkIcon style={{ width: 20, height: 20 }} />
        </button>
      </div>

      {/* Scrollable Body */}
      <div className="flex-grow-1 overflow-auto no-scrollbar px-3 pt-3 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <form id="employee-form" onSubmit={handleSubmit}>
          {/* ===== DETAILS TAB ===== */}
          {activeTab === 'details' && (
            <div className="tab-pane">
            <div className="row g-2">
              <div className="col-md-6">
                <div className="form-floating">
                  <input type="text" id="username" name="username" value={formData.username} onChange={handleInputChange}
                    className="form-control form-control-sm" placeholder="Username" required />
                  <label htmlFor="username">Username *</label>
                </div>
              </div>
              <div className="col-md-6">
                <div className="form-floating">
                  <input type="password" id="password" name="password" value={formData.password} onChange={handleInputChange}
                    className="form-control form-control-sm" placeholder="Password"
                    required={!employee} />
                  <label htmlFor="password">{employee ? 'Password (blank = keep current)' : 'Password *'}</label>
                </div>
              </div>
              <div className="col-md-6">
                <div className="form-floating">
                  <input type="text" id="first_name" name="first_name" value={formData.first_name} onChange={handleInputChange}
                    className="form-control form-control-sm" placeholder="First Name" required />
                  <label htmlFor="first_name">First Name *</label>
                </div>
              </div>
              <div className="col-md-6">
                <div className="form-floating">
                  <input type="text" id="last_name" name="last_name" value={formData.last_name} onChange={handleInputChange}
                    className="form-control form-control-sm" placeholder="Last Name" required />
                  <label htmlFor="last_name">Last Name *</label>
                </div>
              </div>
              <div className="col-md-6">
                <div className="form-floating">
                  <input type="email" id="email" name="email" value={formData.email} onChange={handleInputChange}
                    className="form-control form-control-sm" placeholder="Email" />
                  <label htmlFor="email">Email</label>
                </div>
              </div>
              <div className="col-md-6">
                <div className="form-floating">
                  <input type="tel" id="phone" name="phone" value={formData.phone} onChange={handleInputChange}
                    className="form-control form-control-sm" placeholder="Phone" />
                  <label htmlFor="phone">Phone</label>
                </div>
              </div>
              {!selfEdit && (
              <>
              <div className="col-md-6">
                <div className="form-floating">
                  <select id="role" name="role" value={formData.role} onChange={handleInputChange} className="form-select form-select-sm">
                    <option value="EMPLOYEE">Employee</option>
                    <option value="MANAGER">Manager</option>
                    <option value="ADMIN">Admin</option>
                    <option value="VIEWER">Viewer</option>
                  </select>
                  <label htmlFor="role">Role</label>
                </div>
              </div>
              <div className="col-md-6">
                <div className="form-floating">
                  <input type="date" id="hire_date" name="hire_date" value={formData.hire_date} onChange={handleInputChange}
                    className="form-control form-control-sm" placeholder="Hire Date" />
                  <label htmlFor="hire_date">Hire Date</label>
                </div>
              </div>
              <div className="col-md-6">
                <div className="form-floating">
                  <select id="reports_to" name="reports_to" value={formData.reports_to} onChange={handleInputChange} className="form-select form-select-sm">
                    <option value="">No Manager (Top Level)</option>
                    {managerOptions.map(mgr => (
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
                  <select id="role_id" name="role_id" value={formData.role_id} onChange={handleInputChange}
                    className="form-select form-select-sm" disabled={rolesLoading}>
                    <option value="">No Role Assigned</option>
                    {roles.map(role => (
                      <option key={role.id} value={role.id}>
                        {role.name} {role.role_permissions?.length > 0 && `(${role.role_permissions.length} permissions)`}
                      </option>
                    ))}
                  </select>
                  <label htmlFor="role_id">Assigned Role</label>
                </div>
                {formData.role_id && roles.find(r => r.id === formData.role_id)?.role_permissions?.length > 0 && (
                  <div className="mt-2 p-2 border rounded bg-body-secondary" style={{ fontSize: '0.8rem' }}>
                    <strong>Role Permissions:</strong>
                    <div className="d-flex flex-wrap gap-1 mt-1">
                      {roles.find(r => r.id === formData.role_id)?.role_permissions?.map(perm => (
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
                  <input type="text" id="iod_number" name="iod_number" value={formData.iod_number} onChange={handleInputChange}
                    className="form-control form-control-sm" placeholder="IOD Number" />
                  <label htmlFor="iod_number">IOD Number</label>
                </div>
              </div>
              <div className="col-md-6">
                <div className="form-floating">
                  <input type="text" id="location" name="location" value={formData.location} onChange={handleInputChange}
                    className="form-control form-control-sm" placeholder="Location" />
                  <label htmlFor="location">Location</label>
                </div>
              </div>

              {/* Direct Reports (read-only) */}
              {employee && directReports.length > 0 && (
                <div className="col-12">
                  <label className="form-label">Direct Reports</label>
                  <div className="d-flex flex-wrap gap-1">
                    {directReports.map(dr => (
                      <span key={dr.id} className="badge bg-info text-white">
                        {dr.first_name} {dr.last_name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="col-12">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, is_active: !prev.is_active }))}
                  className={`btn btn-sm rounded-pill px-3 ${formData.is_active ? 'btn-success' : 'btn-outline-secondary'}`}
                >
                  Active
                </button>
              </div>
              </>
              )}
            </div>
          </div>
        )}

        {/* ===== BENEFITS TAB ===== */}
        {activeTab === 'benefits' && (
          <div className="tab-pane">
            <div className="row g-3">
              {/* Compensation */}
              <div className="col-12">
                <h6 className="text-muted text-uppercase small mb-0">Compensation</h6>
                <hr className="mt-1 mb-2" />
              </div>
              <div className="col-md-6">
                <div className="form-floating">
                  <select id="employment_type" name="employment_type" value={formData.employment_type} onChange={handleInputChange} className="form-select form-select-sm">
                    <option value="">Select type</option>
                    <option value="salary">Salary</option>
                    <option value="hourly">Hourly</option>
                  </select>
                  <label htmlFor="employment_type">Employment Type</label>
                </div>
              </div>
              <div className="col-md-6">
                <div className="form-floating">
                  <select id="pay_frequency" name="pay_frequency" value={formData.pay_frequency} onChange={handleInputChange} className="form-select form-select-sm">
                    <option value="">Select frequency</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Bi-weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="annually">Annually</option>
                    <option value="one_time">One-time (Contract)</option>
                  </select>
                  <label htmlFor="pay_frequency">Pay Frequency</label>
                </div>
              </div>
              {formData.employment_type !== 'hourly' && (
                <div className="col-md-6">
                  <div className="input-group">
                    <span className="input-group-text">$</span>
                    <div className="form-floating">
                      <input type="number" id="salary" name="salary" value={formData.salary} onChange={handleInputChange}
                        className="form-control form-control-sm" placeholder="0.00" step="0.01" min="0" />
                      <label htmlFor="salary">Annual Salary</label>
                    </div>
                  </div>
                </div>
              )}
              {formData.employment_type === 'hourly' && (
                <div className="col-md-6">
                  <div className="input-group">
                    <span className="input-group-text">$</span>
                    <div className="form-floating">
                      <input type="number" id="hourly_rate" name="hourly_rate" value={formData.hourly_rate} onChange={handleInputChange}
                        className="form-control form-control-sm" placeholder="0.00" step="0.01" min="0" />
                      <label htmlFor="hourly_rate">Hourly Rate</label>
                    </div>
                  </div>
                </div>
              )}

              {/* Insurance */}
              <div className="col-12 mt-3">
                <h6 className="text-muted text-uppercase small mb-0">Insurance</h6>
                <hr className="mt-1 mb-2" />
              </div>
              <div className="col-md-6">
                <div className="form-floating">
                  <select id="insurance_plan" name="insurance_plan" value={formData.insurance_plan} onChange={handleInputChange}
                    className="form-select form-select-sm">
                    <option value="">No Plan Selected</option>
                    {insurancePlans.map(plan => (
                      <option key={plan.id} value={plan.name}>{plan.name}</option>
                    ))}
                  </select>
                  <label htmlFor="insurance_plan">Insurance Plan</label>
                </div>
              </div>

              {/* Leave */}
              <div className="col-12 mt-3">
                <h6 className="text-muted text-uppercase small mb-0">Leave</h6>
                <hr className="mt-1 mb-2" />
              </div>
              <div className="col-md-3">
                <div className="form-floating">
                  <input type="number" id="vacation_days" name="vacation_days" value={formData.vacation_days} onChange={handleInputChange}
                    className="form-control form-control-sm" placeholder="Total" min="0" />
                  <label htmlFor="vacation_days">Vacation Days</label>
                </div>
              </div>
              <div className="col-md-3">
                <div className="form-floating">
                  <input type="number" id="vacation_days_used" name="vacation_days_used" value={formData.vacation_days_used} onChange={handleInputChange}
                    className="form-control form-control-sm" placeholder="Used" min="0" />
                  <label htmlFor="vacation_days_used">Vacation Used</label>
                </div>
              </div>
              <div className="col-md-3">
                <div className="form-floating">
                  <input type="number" id="sick_days" name="sick_days" value={formData.sick_days} onChange={handleInputChange}
                    className="form-control form-control-sm" placeholder="Total" min="0" />
                  <label htmlFor="sick_days">Sick Days</label>
                </div>
              </div>
              <div className="col-md-3">
                <div className="form-floating">
                  <input type="number" id="sick_days_used" name="sick_days_used" value={formData.sick_days_used} onChange={handleInputChange}
                    className="form-control form-control-sm" placeholder="Used" min="0" />
                  <label htmlFor="sick_days_used">Sick Used</label>
                </div>
              </div>

              {/* Leave summary bar */}
              {(formData.vacation_days || formData.sick_days) && (
                <div className="col-12 mt-2">
                  <div className="row g-2">
                    {formData.vacation_days && (
                      <div className="col-md-6">
                        <small className="text-muted">Vacation: {formData.vacation_days_used || 0} / {formData.vacation_days} used</small>
                        <div className="progress" style={{ height: '6px' }}>
                          <div className="progress-bar bg-primary" style={{
                            width: `${Math.min(100, ((formData.vacation_days_used || 0) / formData.vacation_days) * 100)}%`
                          }} />
                        </div>
                      </div>
                    )}
                    {formData.sick_days && (
                      <div className="col-md-6">
                        <small className="text-muted">Sick: {formData.sick_days_used || 0} / {formData.sick_days} used</small>
                        <div className="progress" style={{ height: '6px' }}>
                          <div className="progress-bar bg-warning" style={{
                            width: `${Math.min(100, ((formData.sick_days_used || 0) / formData.sick_days) * 100)}%`
                          }} />
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
        {activeTab === 'signature' && (
          <div className="tab-pane">
            {employee ? (
              <div className="row g-3">
                {signatureMessage && (
                  <div className="col-12">
                    <div className={`alert py-2 small ${signatureMessage.includes('Failed') ? 'alert-danger' : 'alert-success'}`}>
                      {signatureMessage}
                    </div>
                  </div>
                )}

                {signatureLoading ? (
                  <div className="col-12 text-center py-4">
                    <div className="spinner-border spinner-border-sm text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  </div>
                ) : showSignaturePad ? (
                  <div className="col-12">
                    <Widget_Signature
                      onSave={handleSaveSignature}
                      onCancel={() => setShowSignaturePad(false)}
                      initialSignature={savedSignature}
                    />
                  </div>
                ) : savedSignature ? (
                  <div className="col-12 text-center">
                    <div className="border rounded p-3 bg-body d-inline-block">
                      <img
                        src={savedSignature}
                        alt="Saved signature"
                        style={{ maxWidth: '400px', maxHeight: '150px' }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="col-12 text-center py-4">
                    <p className="text-muted mb-0">No signature saved yet.</p>
                  </div>
                )}

                {/* Hidden file input */}
                <input
                  type="file"
                  ref={signatureFileRef}
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleSignatureUpload}
                />
              </div>
            ) : (
              <div className="text-center p-4">
                <p className="text-muted">Create the employee first, then add a signature.</p>
              </div>
            )}
          </div>
        )}

        {/* ===== PERMISSIONS TAB ===== */}
        {activeTab === 'permissions' && (
          <div className="tab-pane">
            {employee ? (
              <>
                {/* Current Permissions Table */}
                {userPermissions.length > 0 ? (
                  <div className="table-responsive">
                    <table className="table table-sm mb-0">
                      <thead>
                        <tr>
                          <th style={{ width: '70px' }}>Actions</th>
                          <th>Page</th>
                          <th>Permission</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userPermissions.map(perm => (
                          <tr key={perm.id}>
                            <td>
                              <div className="d-flex gap-1">
                                <button type="button"
                                  onClick={() => handleDeletePermission(perm.id)}
                                  className="btn btn-sm btn-outline-danger p-1" title="Delete">
                                  <TrashIcon style={{ width: 12, height: 12 }} />
                                </button>
                                <button type="button"
                                  onClick={() => handleTogglePermission(perm.id, !perm.granted)}
                                  className={`btn btn-sm p-1 ${perm.granted ? 'btn-outline-warning' : 'btn-outline-success'}`}
                                  title={perm.granted ? 'Deny' : 'Grant'}>
                                  <i className={`bi ${perm.granted ? 'bi-x-circle' : 'bi-check-circle'}`}></i>
                                </button>
                              </div>
                            </td>
                            <td>{perm.page}</td>
                            <td>{perm.permission}</td>
                            <td>
                              <span className={`badge ${perm.granted ? 'bg-success' : 'bg-danger'}`}>
                                {perm.granted ? 'Granted' : 'Denied'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-muted text-center py-2">No permissions assigned yet.</p>
                )}

                {/* Role inherited permissions */}
                {formData.role_id && roles.find(r => r.id === formData.role_id)?.role_permissions?.length > 0 && (
                  <div className="mt-3 p-2 border rounded bg-light" style={{ fontSize: '0.8rem' }}>
                    <strong>Inherited from Role:</strong>
                    <div className="d-flex flex-wrap gap-1 mt-1">
                      {roles.find(r => r.id === formData.role_id)?.role_permissions?.map(perm => (
                        <span key={perm.id} className="badge bg-secondary">
                          {perm.page}:{perm.permission}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center p-4">
                <p className="text-muted">Create the employee first, then manage permissions.</p>
              </div>
            )}
          </div>
        )}

        {/* ===== PERFORMANCE TAB ===== */}
        {activeTab === 'performance' && (
          <div className="tab-pane">
            {employee ? (
              <div className="row g-3">
                {/* Task Statistics */}
                <div className="col-12">
                  <h6 className="text-muted text-uppercase small mb-0">Task Statistics</h6>
                  <hr className="mt-1 mb-2" />
                </div>
                <div className="col-md-6">
                  <div className="card">
                    <div className="card-body text-center py-3">
                      <div className="text-muted small">Scheduled Appointments</div>
                      <div className="fs-4 fw-bold">{employee.schedules?.length ?? '—'}</div>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="card">
                    <div className="card-body text-center py-3">
                      <div className="text-muted small">Attendance Records</div>
                      <div className="fs-4 fw-bold">{employee.attendance_records?.length ?? '—'}</div>
                    </div>
                  </div>
                </div>

                {/* Review History placeholder */}
                <div className="col-12 mt-2">
                  <h6 className="text-muted text-uppercase small mb-0">Review History</h6>
                  <hr className="mt-1 mb-2" />
                  <p className="text-muted text-center py-2 mb-0">No reviews recorded yet.</p>
                </div>

                {/* Goals placeholder */}
                <div className="col-12">
                  <h6 className="text-muted text-uppercase small mb-0">Goals</h6>
                  <hr className="mt-1 mb-2" />
                  <p className="text-muted text-center py-2 mb-0">No goals set.</p>
                </div>

                {/* Feedback placeholder */}
                <div className="col-12">
                  <h6 className="text-muted text-uppercase small mb-0">Feedback</h6>
                  <hr className="mt-1 mb-2" />
                  <p className="text-muted text-center py-2 mb-0">No feedback entries.</p>
                </div>
              </div>
            ) : (
              <div className="text-center p-4">
                <p className="text-muted">Create the employee first to view performance data.</p>
              </div>
            )}
          </div>
        )}
        </form>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 pt-2 pb-4 px-3 border-top border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        {/* Tab Navigation */}
        <ul className="nav nav-tabs mb-2">
          {tabs.map(tab => (
            <li key={tab.key} className="nav-item">
              <button
                className={`nav-link ${activeTab === tab.key ? 'active' : ''} px-2 py-1 px-md-3 py-md-2`}
                onClick={() => setActiveTab(tab.key)}
                type="button"
                disabled={tab.disabled}
                style={{ fontSize: 'clamp(0.75rem, 2vw, 1rem)' }}
              >
                {tab.label}
              </button>
            </li>
          ))}
        </ul>

        {/* Signature tab footer controls */}
        {activeTab === 'signature' && employee && !showSignaturePad && !signatureLoading && (
          <div className="d-flex gap-2 mb-2 justify-content-center">
            <button
              type="button"
              onClick={() => signatureFileRef.current?.click()}
              className="btn btn-outline-secondary btn-sm rounded-pill px-3"
            >
              Upload Photo
            </button>
            <button
              type="button"
              onClick={() => setShowSignaturePad(true)}
              className="btn btn-primary btn-sm rounded-pill px-3"
            >
              {savedSignature ? 'Replace Signature' : 'Create Signature'}
            </button>
          </div>
        )}

        {/* Permissions tab footer controls */}
        {activeTab === 'permissions' && employee && (
          <div className="mb-2">
            {permError && <div className="alert alert-danger py-1 small mb-2">{permError}</div>}
            {permSuccess && <div className="alert alert-success py-1 small mb-2">{permSuccess}</div>}
            <div className="row g-2 align-items-center">
              <div className="col">
                <select value={newPermission.page}
                  onChange={e => setNewPermission(p => ({ ...p, page: e.target.value }))}
                  className="form-select form-select-sm">
                  <option value="">Select Page</option>
                  {PAGES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="col">
                <select value={newPermission.permission}
                  onChange={e => setNewPermission(p => ({ ...p, permission: e.target.value }))}
                  className="form-select form-select-sm">
                  <option value="">Select Permission</option>
                  {PERMISSION_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="col-auto">
                <button type="button" onClick={handleCreatePermission}
                  className="btn btn-primary btn-sm"
                  disabled={!newPermission.page || !newPermission.permission}>
                  Add
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="d-flex align-items-center">
          <div style={{ width: 40 }} className="d-flex align-items-center">
            {employee && canDelete && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Are you sure you want to delete this employee?')) onDelete(employee.id);
                }}
                className="btn btn-outline-danger btn-sm p-1 d-flex align-items-center justify-content-center rounded-circle"
                style={{ width: '2rem', height: '2rem' }}
                title="Delete Employee"
              >
                <TrashIcon style={{ width: 14, height: 14 }} />
              </button>
            )}
          </div>
          <div className="flex-grow-1 d-flex gap-3 justify-content-center">
            <button
              type="button"
              onClick={onCancel}
              className="btn btn-outline-secondary btn-sm p-1 d-flex align-items-center justify-content-center"
              style={{ width: '3rem', height: '3rem' }}
              title="Cancel"
            >
              <XMarkIcon style={{ width: 18, height: 18 }} />
            </button>
            {(activeTab === 'details' || activeTab === 'benefits') && (
              <button
                type="submit"
                form="employee-form"
                className="btn btn-primary btn-sm p-1 d-flex align-items-center justify-content-center"
                style={{ width: '3rem', height: '3rem' }}
                title={employee ? 'Update Employee' : 'Create Employee'}
              >
                <CheckIcon style={{ width: 18, height: 18 }} />
              </button>
            )}
          </div>
          <div style={{ width: 40 }} />
        </div>
      </div>
    </div>
  );
}
