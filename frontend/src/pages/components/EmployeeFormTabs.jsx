import React, { useState, useEffect, useMemo } from 'react';
import { rolesAPI, isudAPI } from '../../services/api';
import api from '../../services/api';

const PAGES = ['clients', 'inventory', 'suppliers', 'services', 'employees', 'schedule', 'attendance', 'documents', 'admin'];
const PERMISSION_TYPES = ['read', 'write', 'admin'];

export default function EmployeeFormTabs({
  employee,
  onSubmit,
  onCancel,
  onDelete,
  onManagePermissions,
  employees: employeesProp = [],
  canDelete = false
}) {
  const [activeTab, setActiveTab] = useState('details');
  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [employeesList, setEmployeesList] = useState(employeesProp);

  // Permissions state
  const [userPermissions, setUserPermissions] = useState([]);
  const [newPermission, setNewPermission] = useState({ page: '', permission: '' });
  const [permError, setPermError] = useState('');
  const [permSuccess, setPermSuccess] = useState('');

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
    role_id: '',
    iod_number: '',
    location: '',
    // Benefits
    salary: '',
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
        if (!cancelled) console.error('EmployeeFormTabs failed to load employees', err);
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
        role_id: employee.role_id || '',
        iod_number: employee.iod_number || '',
        location: employee.location || '',
        salary: employee.salary ?? '',
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

  const fetchUserPermissions = async (userId) => {
    try {
      const response = await api.get(`/auth/users/${userId}/permissions`);
      setUserPermissions(response.data || []);
    } catch (err) {
      console.error('Failed to fetch permissions:', err);
      setPermError('Failed to load permissions');
    }
  };

  // Filter out current employee from manager options
  const managerOptions = employeesList.filter(e => e.id !== employee?.id);

  // Direct reports for this employee
  const directReports = useMemo(() => {
    if (!employee?.id) return [];
    return employeesList.filter(e => e.reports_to === employee.id);
  }, [employeesList, employee?.id]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
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
    if (!submitData.pay_frequency) submitData.pay_frequency = null;
    if (!submitData.insurance_plan.trim()) submitData.insurance_plan = null;
    // Convert numeric fields
    submitData.salary = submitData.salary !== '' ? parseFloat(submitData.salary) : null;
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
    { key: 'permissions', label: 'Permissions', disabled: !employee },
    { key: 'performance', label: 'Performance', disabled: !employee },
  ];

  return (
    <div className="p-0">
      <h3 className="mb-4 fw-bold">
        {employee ? 'Edit Employee' : 'Add New Employee'}
      </h3>

      {/* Tab Navigation */}
      <ul className="nav nav-tabs mb-4">
        {tabs.map(tab => (
          <li key={tab.key} className="nav-item">
            <button
              className={`nav-link ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
              type="button"
              disabled={tab.disabled}
            >
              {tab.label} {tab.disabled && !employee && '(Save first)'}
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={handleSubmit}>
        {/* ===== DETAILS TAB ===== */}
        {activeTab === 'details' && (
          <div className="tab-pane">
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Username <span className="text-danger">*</span></label>
                <input type="text" name="username" value={formData.username} onChange={handleInputChange}
                  className="form-control" placeholder="Enter username" required />
              </div>
              <div className="col-md-6">
                <label className="form-label">Password {!employee && <span className="text-danger">*</span>}</label>
                <input type="password" name="password" value={formData.password} onChange={handleInputChange}
                  className="form-control" placeholder={employee ? "Leave blank to keep current" : "Enter password"}
                  required={!employee} />
              </div>
              <div className="col-md-6">
                <label className="form-label">First Name <span className="text-danger">*</span></label>
                <input type="text" name="first_name" value={formData.first_name} onChange={handleInputChange}
                  className="form-control" placeholder="Enter first name" required />
              </div>
              <div className="col-md-6">
                <label className="form-label">Last Name <span className="text-danger">*</span></label>
                <input type="text" name="last_name" value={formData.last_name} onChange={handleInputChange}
                  className="form-control" placeholder="Enter last name" required />
              </div>
              <div className="col-md-6">
                <label className="form-label">Email</label>
                <input type="email" name="email" value={formData.email} onChange={handleInputChange}
                  className="form-control" placeholder="Enter email (optional)" />
              </div>
              <div className="col-md-6">
                <label className="form-label">Phone</label>
                <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange}
                  className="form-control" placeholder="Enter phone number" />
              </div>
              <div className="col-md-6">
                <label className="form-label">Role</label>
                <select name="role" value={formData.role} onChange={handleInputChange} className="form-select">
                  <option value="EMPLOYEE">Employee</option>
                  <option value="MANAGER">Manager</option>
                  <option value="ADMIN">Admin</option>
                  <option value="VIEWER">Viewer</option>
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Hire Date</label>
                <input type="date" name="hire_date" value={formData.hire_date} onChange={handleInputChange}
                  className="form-control" />
              </div>
              <div className="col-md-6">
                <label className="form-label">Supervisor</label>
                <select name="reports_to" value={formData.reports_to} onChange={handleInputChange} className="form-select">
                  <option value="">No Manager (Top Level)</option>
                  {managerOptions.map(mgr => (
                    <option key={mgr.id} value={mgr.id}>
                      {mgr.first_name} {mgr.last_name} ({mgr.role})
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">
                  Assigned Role
                  <span className="ms-1 text-muted" style={{ fontSize: '0.75rem' }}>(inherits permissions)</span>
                </label>
                <select name="role_id" value={formData.role_id} onChange={handleInputChange}
                  className="form-select" disabled={rolesLoading}>
                  <option value="">No Role Assigned</option>
                  {roles.map(role => (
                    <option key={role.id} value={role.id}>
                      {role.name} {role.role_permissions?.length > 0 && `(${role.role_permissions.length} permissions)`}
                    </option>
                  ))}
                </select>
                {formData.role_id && roles.find(r => r.id === formData.role_id)?.role_permissions?.length > 0 && (
                  <div className="mt-2 p-2 border rounded bg-light" style={{ fontSize: '0.8rem' }}>
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
                <label className="form-label">IOD Number</label>
                <input type="text" name="iod_number" value={formData.iod_number} onChange={handleInputChange}
                  className="form-control" placeholder="IOD number" />
              </div>
              <div className="col-md-6">
                <label className="form-label">Location</label>
                <input type="text" name="location" value={formData.location} onChange={handleInputChange}
                  className="form-control" placeholder="Office location" />
              </div>

              {/* Direct Reports (read-only) */}
              {employee && directReports.length > 0 && (
                <div className="col-12">
                  <label className="form-label">Direct Reports</label>
                  <div className="d-flex flex-wrap gap-1">
                    {directReports.map(dr => (
                      <span key={dr.id} className="badge bg-info text-dark">
                        {dr.first_name} {dr.last_name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="col-12">
                <div className="form-check">
                  <input type="checkbox" name="is_active" checked={formData.is_active}
                    onChange={handleInputChange} className="form-check-input" id="is_active" />
                  <label className="form-check-label" htmlFor="is_active">Active Employee</label>
                </div>
              </div>
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
                <label className="form-label">Salary</label>
                <div className="input-group">
                  <span className="input-group-text">$</span>
                  <input type="number" name="salary" value={formData.salary} onChange={handleInputChange}
                    className="form-control" placeholder="0.00" step="0.01" min="0" />
                </div>
              </div>
              <div className="col-md-6">
                <label className="form-label">Pay Frequency</label>
                <select name="pay_frequency" value={formData.pay_frequency} onChange={handleInputChange} className="form-select">
                  <option value="">Select frequency</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="annually">Annually</option>
                </select>
              </div>

              {/* Insurance */}
              <div className="col-12 mt-3">
                <h6 className="text-muted text-uppercase small mb-0">Insurance</h6>
                <hr className="mt-1 mb-2" />
              </div>
              <div className="col-md-6">
                <label className="form-label">Insurance Plan</label>
                <input type="text" name="insurance_plan" value={formData.insurance_plan} onChange={handleInputChange}
                  className="form-control" placeholder="Plan name or number" />
              </div>

              {/* Leave */}
              <div className="col-12 mt-3">
                <h6 className="text-muted text-uppercase small mb-0">Leave</h6>
                <hr className="mt-1 mb-2" />
              </div>
              <div className="col-md-3">
                <label className="form-label">Vacation Days</label>
                <input type="number" name="vacation_days" value={formData.vacation_days} onChange={handleInputChange}
                  className="form-control" placeholder="Total" min="0" />
              </div>
              <div className="col-md-3">
                <label className="form-label">Vacation Used</label>
                <input type="number" name="vacation_days_used" value={formData.vacation_days_used} onChange={handleInputChange}
                  className="form-control" placeholder="Used" min="0" />
              </div>
              <div className="col-md-3">
                <label className="form-label">Sick Days</label>
                <input type="number" name="sick_days" value={formData.sick_days} onChange={handleInputChange}
                  className="form-control" placeholder="Total" min="0" />
              </div>
              <div className="col-md-3">
                <label className="form-label">Sick Used</label>
                <input type="number" name="sick_days_used" value={formData.sick_days_used} onChange={handleInputChange}
                  className="form-control" placeholder="Used" min="0" />
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

        {/* ===== PERMISSIONS TAB ===== */}
        {activeTab === 'permissions' && (
          <div className="tab-pane">
            {employee ? (
              <>
                {permError && <div className="alert alert-danger py-2 small">{permError}</div>}
                {permSuccess && <div className="alert alert-success py-2 small">{permSuccess}</div>}

                {/* Add Permission */}
                <div className="mb-3 p-3 border rounded">
                  <h6 className="mb-2">Add Permission</h6>
                  <div className="row g-2 align-items-end">
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

                {/* Current Permissions */}
                {userPermissions.length > 0 ? (
                  <div className="table-responsive">
                    <table className="table table-sm mb-0">
                      <thead>
                        <tr>
                          <th>Page</th>
                          <th>Permission</th>
                          <th>Status</th>
                          <th style={{ width: '80px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userPermissions.map(perm => (
                          <tr key={perm.id}>
                            <td>{perm.page}</td>
                            <td>{perm.permission}</td>
                            <td>
                              <span className={`badge ${perm.granted ? 'bg-success' : 'bg-danger'}`}>
                                {perm.granted ? 'Granted' : 'Denied'}
                              </span>
                            </td>
                            <td>
                              <div className="btn-group btn-group-sm">
                                <button type="button"
                                  onClick={() => handleTogglePermission(perm.id, !perm.granted)}
                                  className={`btn btn-sm ${perm.granted ? 'btn-outline-warning' : 'btn-outline-success'}`}
                                  title={perm.granted ? 'Deny' : 'Grant'}>
                                  <i className={`bi ${perm.granted ? 'bi-x-circle' : 'bi-check-circle'}`}></i>
                                </button>
                                <button type="button"
                                  onClick={() => handleDeletePermission(perm.id)}
                                  className="btn btn-sm btn-outline-danger" title="Delete">
                                  <i className="bi bi-trash"></i>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-muted text-center py-3">No permissions assigned yet.</p>
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
                  <p className="text-muted text-center py-3 mb-0">No reviews recorded yet.</p>
                </div>

                {/* Goals placeholder */}
                <div className="col-12">
                  <h6 className="text-muted text-uppercase small mb-0">Goals</h6>
                  <hr className="mt-1 mb-2" />
                  <p className="text-muted text-center py-3 mb-0">No goals set.</p>
                </div>

                {/* Feedback placeholder */}
                <div className="col-12">
                  <h6 className="text-muted text-uppercase small mb-0">Feedback</h6>
                  <hr className="mt-1 mb-2" />
                  <p className="text-muted text-center py-3 mb-0">No feedback entries.</p>
                </div>
              </div>
            ) : (
              <div className="text-center p-4">
                <p className="text-muted">Create the employee first to view performance data.</p>
              </div>
            )}
          </div>
        )}

        {/* Form Actions */}
        <div className="d-flex justify-content-between align-items-center mt-4">
          <div className="d-flex gap-2">
            {employee && canDelete && (
              <button type="button" onClick={() => {
                if (window.confirm('Are you sure you want to delete this employee?')) onDelete(employee.id);
              }} className="btn btn-outline-danger">
                Delete Employee
              </button>
            )}
          </div>
          <div className="d-flex gap-2">
            <button type="button" onClick={onCancel} className="btn btn-outline-secondary">Cancel</button>
            {(activeTab === 'details' || activeTab === 'benefits') && (
              <button type="submit" className="btn btn-primary">
                {employee ? 'Update Employee' : 'Create Employee'}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
