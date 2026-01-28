import React, { useState, useEffect } from 'react';
import useDarkMode from '../../services/useDarkMode';

export default function EmployeeFormTabs({ employee, onSubmit, onCancel }) {
  const { isDarkMode } = useDarkMode();
  const [activeTab, setActiveTab] = useState('employee');
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    role: 'EMPLOYEE',
    hire_date: new Date().toISOString().split('T')[0],
    is_active: true
  });

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
        is_active: employee.is_active !== undefined ? employee.is_active : true
      });
    }
  }, [employee]);

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
    
    onSubmit(submitData);
  };

  return (
    <div className={`p-4 ${isDarkMode ? 'bg-dark' : 'bg-white'}`}>
      <h3 className={`mb-4 ${isDarkMode ? 'text-light' : 'text-dark'}`}>
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
                <label className={`form-label ${isDarkMode ? 'text-light' : 'text-dark'}`}>
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
                <label className={`form-label ${isDarkMode ? 'text-light' : 'text-dark'}`}>
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
                <label className={`form-label ${isDarkMode ? 'text-light' : 'text-dark'}`}>
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
                <label className={`form-label ${isDarkMode ? 'text-light' : 'text-dark'}`}>
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
                <label className={`form-label ${isDarkMode ? 'text-light' : 'text-dark'}`}>
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
                <label className={`form-label ${isDarkMode ? 'text-light' : 'text-dark'}`}>
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
                <label className={`form-label ${isDarkMode ? 'text-light' : 'text-dark'}`}>
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
                <label className={`form-label ${isDarkMode ? 'text-light' : 'text-dark'}`}>
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
                  <label className={`form-check-label ${isDarkMode ? 'text-light' : 'text-dark'}`} htmlFor="is_active">
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
            <div className={`text-center p-4 ${isDarkMode ? 'text-light' : 'text-muted'}`}>
              <i className="bi bi-info-circle fs-1 mb-3"></i>
              <p>Permissions are managed after the employee is created.</p>
              <p>Use the "Manage Permissions" button in the employee list to set up permissions.</p>
            </div>
          </div>
        )}

        {/* Form Actions */}
        <div className="d-flex justify-content-between mt-4">
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-secondary"
          >
            <i className="bi bi-x-circle me-2"></i>
            Cancel
          </button>
          
          {activeTab === 'employee' && (
            <button
              type="submit"
              className="btn btn-primary"
            >
              <i className="bi bi-check-circle me-2"></i>
              {employee ? 'Update Employee' : 'Create Employee'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
