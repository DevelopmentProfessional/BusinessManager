import React, { useState, useEffect } from 'react';
import { XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';
import { rolesAPI, isudAPI } from '../../services/api';
import IconButton from './IconButton';
import ActionFooter from './ActionFooter';

export default function EmployeeFormTabs({ employee, onSubmit, onCancel, employees: employeesProp = [] }) {
  const [activeTab, setActiveTab] = useState('employee');
  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [employeesList, setEmployeesList] = useState(employeesProp);
  const [formData, setFormData] = useState({
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
    role_id: ''
  });

  // Load available roles (independent of page)
  useEffect(() => {
    const loadRoles = async () => {
      setRolesLoading(true);
      try {
        const response = await rolesAPI.getAll();
        const rolesData = response?.data ?? response;
        if (Array.isArray(rolesData)) {
          setRoles(rolesData);
        }
      } catch (err) {
        console.error('Failed to load roles:', err);
      } finally {
        setRolesLoading(false);
      }
    };
    loadRoles();
  }, []);

  // Own link to isud DB: use employees prop if provided, otherwise fetch so component works on any page
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

  useEffect(() => {
    if (employee) {
      setFormData({
        username: employee.username || '',
        password: '', // Never pre-fill password
        first_name: employee.first_name || '',
        last_name: employee.last_name || '',
        email: employee.email || '',
        phone: employee.phone || '',
        role: employee.role || 'EMPLOYEE',
        hire_date: employee.hire_date ? employee.hire_date.split('T')[0] : new Date().toISOString().split('T')[0],
        is_active: employee.is_active !== undefined ? employee.is_active : true,
        reports_to: employee.reports_to || '',
        role_id: employee.role_id || ''
      });
    }
  }, [employee]);

  // Filter out current employee from manager options (can't report to self)
  const managerOptions = employeesList.filter(e => e.id !== employee?.id);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate required fields
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
    
    // Prepare data for submission
    const submitData = { ...formData };
    
    // Don't send empty password for updates
    if (employee && !submitData.password.trim()) {
      delete submitData.password;
    }
    
    // Don't send empty email
    if (!submitData.email.trim()) {
      submitData.email = null;
    }

    // Handle reports_to - convert empty string to null
    if (!submitData.reports_to) {
      submitData.reports_to = null;
    }

    // Handle role_id - convert empty string to null
    if (!submitData.role_id) {
      submitData.role_id = null;
    }

    onSubmit(submitData);
  };

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg">
      <h3 className="mb-4 text-gray-900 dark:text-gray-100">
        {employee ? 'Edit Employee' : 'Add New Employee'}
      </h3>

      {/* Tab Navigation */}
      <ul className="nav nav-tabs mb-4">
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'employee' ? 'active' : ''}`}
            onClick={() => setActiveTab('employee')}
            type="button"
          >
            Employee Details
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'permissions' ? 'active' : ''}`}
            onClick={() => setActiveTab('permissions')}
            type="button"
            disabled={!employee}
          >
            Permissions {!employee && '(Save employee first)'}
          </button>
        </li>
      </ul>

      <form onSubmit={handleSubmit}>
        {/* Employee Tab */}
        {activeTab === 'employee' && (
          <div className="tab-pane">
            <div className="row g-3">
              <div className="col-md-6">
                <label className={`form-label text-gray-900 dark:text-gray-100`}>
                  Username <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  className="form-control"
                  placeholder="Enter username"
                  required
                />
              </div>
              
              <div className="col-md-6">
                <label className={`form-label text-gray-900 dark:text-gray-100`}>
                  Password {!employee && <span className="text-danger">*</span>}
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="form-control"
                  placeholder={employee ? "Leave blank to keep current password" : "Enter password"}
                  required={!employee}
                />
              </div>
              
              <div className="col-md-6">
                <label className={`form-label text-gray-900 dark:text-gray-100`}>
                  First Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleInputChange}
                  className="form-control"
                  placeholder="Enter first name"
                  required
                />
              </div>
              
              <div className="col-md-6">
                <label className={`form-label text-gray-900 dark:text-gray-100`}>
                  Last Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleInputChange}
                  className="form-control"
                  placeholder="Enter last name"
                  required
                />
              </div>
              
              <div className="col-md-6">
                <label className={`form-label text-gray-900 dark:text-gray-100`}>
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="form-control"
                  placeholder="Enter email (optional)"
                />
              </div>
              
              <div className="col-md-6">
                <label className={`form-label text-gray-900 dark:text-gray-100`}>
                  Phone
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="form-control"
                  placeholder="Enter phone number"
                />
              </div>
              
              <div className="col-md-6">
                <label className={`form-label text-gray-900 dark:text-gray-100`}>
                  Role
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  className="form-select"
                >
                  <option value="EMPLOYEE">Employee</option>
                  <option value="MANAGER">Manager</option>
                  <option value="ADMIN">Admin</option>
                  <option value="VIEWER">Viewer</option>
                </select>
              </div>
              
              <div className="col-md-6">
                <label className={`form-label text-gray-900 dark:text-gray-100`}>
                  Hire Date
                </label>
                <input
                  type="date"
                  name="hire_date"
                  value={formData.hire_date}
                  onChange={handleInputChange}
                  className="form-control"
                />
              </div>

              <div className="col-md-6">
                <label className={`form-label text-gray-900 dark:text-gray-100`}>
                  Reports To
                </label>
                <select
                  name="reports_to"
                  value={formData.reports_to}
                  onChange={handleInputChange}
                  className="form-select"
                >
                  <option value="">No Manager (Top Level)</option>
                  {managerOptions.map(mgr => (
                    <option key={mgr.id} value={mgr.id}>
                      {mgr.first_name} {mgr.last_name} ({mgr.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-6">
                <label className={`form-label text-gray-900 dark:text-gray-100`}>
                  Assigned Role
                  <span className="ms-1 text-muted" style={{ fontSize: '0.75rem' }}>(inherits permissions)</span>
                </label>
                <select
                  name="role_id"
                  value={formData.role_id}
                  onChange={handleInputChange}
                  className="form-select"
                  disabled={rolesLoading}
                >
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

              <div className="col-12">
                <div className="form-check">
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={formData.is_active}
                    onChange={handleInputChange}
                    className="form-check-input"
                    id="is_active"
                  />
                  <label className={`form-check-label text-gray-900 dark:text-gray-100`} htmlFor="is_active">
                    Active Employee
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Permissions Tab */}
        {activeTab === 'permissions' && (
          <div className="tab-pane">
            <div className={`text-center p-4 text-gray-600 dark:text-gray-400`}>
              <i className="bi bi-info-circle fs-1 mb-3"></i>
              <p>Permissions are managed after the employee is created.</p>
              <p>Use the "Manage Permissions" button in the employee list to set up permissions.</p>
            </div>
          </div>
        )}

        {/* Form Actions - footer, icon only with tooltips */}
        <ActionFooter className="d-flex justify-content-end gap-2 mt-4">
          <IconButton icon={XMarkIcon} label="Cancel" onClick={onCancel} variant="secondary" />
          {activeTab === 'employee' && (
            <IconButton icon={CheckIcon} label={employee ? 'Update Employee' : 'Create Employee'} type="submit" variant="primary" />
          )}
        </ActionFooter>
      </form>
    </div>
  );
}
