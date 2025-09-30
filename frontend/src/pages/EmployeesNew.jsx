import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import useStore from '../store/useStore';
import { usePermissionRefresh } from '../hooks/usePermissionRefresh';
import { employeesAPI, api } from '../services/api';
import Modal from '../components/Modal';
import EmployeeForm from '../components/EmployeeForm';
import useDarkMode from '../store/useDarkMode';

export default function Employees() {
  const { 
    employees, setEmployees, addEmployee, updateEmployee, removeEmployee,
    loading, setLoading, error, setError, clearError,
    isModalOpen, openModal, closeModal,
    user: currentUser, hasPermission
  } = useStore();

  const { isDarkMode } = useDarkMode();
  
  // Use the permission refresh hook
  usePermissionRefresh();

  const [editingEmployee, setEditingEmployee] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userPermissions, setUserPermissions] = useState([]);
  const [newPermission, setNewPermission] = useState({ page: '', permission: '' });
  const [success, setSuccess] = useState('');
  const [permissionsModalOpen, setPermissionsModalOpen] = useState(false);

  useEffect(() => {
    loadEmployees();
  }, []);

  // Check permissions at page level
  if (!hasPermission('employees', 'read') && 
      !hasPermission('employees', 'write') && 
      !hasPermission('employees', 'delete') && 
      !hasPermission('employees', 'admin')) {
    return <Navigate to="/profile" replace />;
  }

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const response = await employeesAPI.getAll();
      setEmployees(response.data);
      clearError();
    } catch (err) {
      setError('Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingEmployee(null);
    openModal('employee-form');
  };

  const handleEdit = (employee) => {
    setEditingEmployee(employee);
    openModal('employee-form');
  };

  const handleDelete = async (employeeId) => {
    if (!window.confirm('Are you sure you want to delete this employee?')) {
      return;
    }

    try {
      await employeesAPI.delete(employeeId);
      removeEmployee(employeeId);
      clearError();
    } catch (err) {
      setError('Failed to delete employee');
    }
  };

  const handleSubmit = async (employeeData) => {
    try {
      if (editingEmployee) {
        const response = await employeesAPI.update(editingEmployee.id, employeeData);
        updateEmployee(response.data);
      } else {
        const response = await employeesAPI.create(employeeData);
        addEmployee(response.data);
      }
      closeModal();
      clearError();
    } catch (err) {
      setError(editingEmployee ? 'Failed to update employee' : 'Failed to create employee');
    }
  };

  // Permissions Management
  const handleManagePermissions = async (user) => {
    setSelectedUser(user);
    setPermissionsModalOpen(true);
    await fetchUserPermissions(user.id);
  };

  const fetchUserPermissions = async (userId) => {
    try {
      const response = await api.get(`/auth/users/${userId}/permissions`);
      setUserPermissions(response.data);
    } catch (err) {
      setError('Failed to fetch user permissions');
    }
  };

  const handleCreatePermission = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      await api.post(`/auth/users/${selectedUser.id}/permissions`, {
        page: newPermission.page,
        permission: newPermission.permission,
        granted: true
      });

      setSuccess('Permission added successfully!');
      setNewPermission({ page: '', permission: '' });
      fetchUserPermissions(selectedUser.id);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create permission');
    }
  };

  const handleDeletePermission = async (permissionId) => {
    setError('');
    setSuccess('');
    
    try {
      await api.delete(`/auth/users/${selectedUser.id}/permissions/${permissionId}`);
      setSuccess('Permission deleted successfully!');
      fetchUserPermissions(selectedUser.id);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete permission');
    }
  };

  const handleUpdatePermission = async (permissionId, granted) => {
    setError('');
    setSuccess('');
    
    try {
      await api.put(`/auth/users/${selectedUser.id}/permissions/${permissionId}`, { granted });
      setSuccess(granted ? 'Permission granted!' : 'Permission denied!');
      fetchUserPermissions(selectedUser.id);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update permission');
    }
  };

  const handleScheduleViewAllToggle = async (granted) => {
    setError('');
    setSuccess('');
    
    try {
      const existingPermission = userPermissions.find(p => p.page === 'schedule' && p.permission === 'view_all');
      
      if (existingPermission) {
        await api.put(`/auth/users/${selectedUser.id}/permissions/${existingPermission.id}`, { granted });
        setSuccess(granted ? 'Schedule view all permission granted!' : 'Schedule view all permission revoked!');
      } else {
        await api.post(`/auth/users/${selectedUser.id}/permissions`, {
          page: 'schedule',
          permission: 'view_all',
          granted
        });
        setSuccess(granted ? 'Schedule view all permission granted!' : 'Schedule view all permission revoked!');
      }
      
      fetchUserPermissions(selectedUser.id);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update schedule view all permission');
    }
  };

  const handleScheduleWriteAllToggle = async (granted) => {
    try {
      const existingPermission = userPermissions.find(p => p.page === 'schedule' && p.permission === 'write_all');
      
      if (existingPermission) {
        await employeesAPI.updateUserPermission(selectedUser.id, existingPermission.id, { granted });
        setSuccess(granted ? 'Schedule write all permission granted!' : 'Schedule write all permission revoked!');
      } else {
        const response = await employeesAPI.createUserPermission(selectedUser.id, {
          page: 'schedule',
          permission: 'write_all',
          granted
        });
        setSuccess(granted ? 'Schedule write all permission granted!' : 'Schedule write all permission revoked!');
      }
      
      await fetchUserPermissions(selectedUser.id);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update schedule write all permission');
    }
  };

  const pages = ['clients', 'inventory', 'suppliers', 'services', 'employees', 'schedule', 'attendance', 'documents'];
  const permissions = ['read', 'write', 'write_all', 'delete', 'admin', 'view_all'];

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6 border-bottom">
          <h1 className="text-2xl font-bold mb-4">Employee Management</h1>
          
          {error && (
            <div className="alert alert-danger mb-4" role="alert">
              {error}
            </div>
          )}

          {success && (
            <div className="alert alert-success mb-4" role="alert">
              {success}
            </div>
          )}

          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2 className="h4 mb-0">Employees</h2>
            {hasPermission('employees', 'write') && (
              <button onClick={handleCreate} className="btn btn-primary">
                <i className="bi bi-plus-circle me-2"></i>
                Add Employee
              </button>
            )}
          </div>

          <div className="table-responsive">
            <table className="table table-striped">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <tr key={employee.id}>
                    <td>{employee.first_name} {employee.last_name}</td>
                    <td>{employee.email}</td>
                    <td>{employee.username}</td>
                    <td>
                      <span className={`badge ${employee.role === 'ADMIN' ? 'bg-danger' : 'bg-primary'}`}>
                        {employee.role}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${employee.is_active ? 'bg-success' : 'bg-secondary'}`}>
                        {employee.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="btn-group btn-group-sm">
                        {hasPermission('employees', 'write') && (
                          <button
                            onClick={() => handleEdit(employee)}
                            className="btn btn-outline-primary"
                            title="Edit Employee"
                          >
                            <i className="bi bi-pencil-square"></i>
                          </button>
                        )}
                        
                        {hasPermission('employees', 'admin') && (
                          <button
                            onClick={() => handleManagePermissions(employee)}
                            className="btn btn-outline-info"
                            title="Manage Permissions"
                          >
                            <i className="bi bi-key"></i>
                          </button>
                        )}
                        
                        {hasPermission('employees', 'delete') && (
                          <button
                            onClick={() => handleDelete(employee.id)}
                            className="btn btn-outline-danger"
                            title="Delete Employee"
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Employee Form Modal */}
      <Modal isOpen={isModalOpen && openModal === 'employee-form'} onClose={closeModal}>
        <EmployeeForm
          employee={editingEmployee}
          onSubmit={handleSubmit}
          onCancel={closeModal}
        />
      </Modal>

      {/* Permissions Management Modal */}
      <Modal isOpen={permissionsModalOpen} onClose={() => setPermissionsModalOpen(false)}>
        <div className={`p-4 ${isDarkMode ? 'bg-dark' : 'bg-white'}`}>
          <h3 className={`mb-4 ${isDarkMode ? 'text-light' : 'text-dark'}`}>
            Manage Permissions - {selectedUser?.first_name} {selectedUser?.last_name}
          </h3>

          {/* Add New Permission Form */}
          <form onSubmit={handleCreatePermission} className="mb-4 p-3 border rounded">
            <h5 className={`mb-3 ${isDarkMode ? 'text-light' : 'text-dark'}`}>Add New Permission</h5>
            <div className="row g-3">
              <div className="col-md-6">
                <select
                  value={newPermission.page}
                  onChange={(e) => setNewPermission({...newPermission, page: e.target.value})}
                  className="form-select"
                  required
                >
                  <option value="">Select Page</option>
                  {pages.map(page => (
                    <option key={page} value={page}>{page}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <select
                  value={newPermission.permission}
                  onChange={(e) => setNewPermission({...newPermission, permission: e.target.value})}
                  className="form-select"
                  required
                >
                  <option value="">Select Permission</option>
                  {permissions.map(permission => (
                    <option key={permission} value={permission}>{permission}</option>
                  ))}
                </select>
              </div>
            </div>
            <button type="submit" className="btn btn-primary mt-3">
              <i className="bi bi-plus-circle me-2"></i>
              Add Permission
            </button>
          </form>

          {/* Schedule Special Permissions */}
          {newPermission.page === 'schedule' && (
            <div className="mt-4 p-3 border rounded-lg bg-light">
              <h5 className={`text-sm font-medium mb-2 ${isDarkMode ? 'text-light' : 'text-dark'}`}>Schedule Special Permissions</h5>
              <div className="space-y-2">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="viewAllSchedules"
                      checked={userPermissions.some(p => p.page === 'schedule' && p.permission === 'view_all' && p.granted)}
                      onChange={(e) => handleScheduleViewAllToggle(e.target.checked)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor="viewAllSchedules" className={`ml-2 block text-sm ${isDarkMode ? 'text-light' : 'text-dark'}`}>
                      View All Employee Schedules
                    </label>
                  </div>
                  <div className="text-xs text-muted">
                    Allows viewing schedules of all employees, not just their own
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="writeAllSchedules"
                      checked={userPermissions.some(p => p.page === 'schedule' && p.permission === 'write_all' && p.granted)}
                      onChange={(e) => handleScheduleWriteAllToggle(e.target.checked)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor="writeAllSchedules" className={`ml-2 block text-sm ${isDarkMode ? 'text-light' : 'text-dark'}`}>
                      Write All Employee Schedules
                    </label>
                  </div>
                  <div className="text-xs text-muted">
                    Allows creating/editing appointments for any employee, not just themselves
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Current Permissions Table */}
          <div className="mt-4">
            <h5 className={`mb-3 ${isDarkMode ? 'text-light' : 'text-dark'}`}>Current Permissions</h5>
            <div className="table-responsive">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th className={isDarkMode ? 'text-light' : 'text-dark'}>Page</th>
                    <th className={isDarkMode ? 'text-light' : 'text-dark'}>Permission</th>
                    <th className={isDarkMode ? 'text-light' : 'text-dark'}>Status</th>
                    <th className={isDarkMode ? 'text-light' : 'text-dark'}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {userPermissions.map((permission) => (
                    <tr key={permission.id}>
                      <td className={isDarkMode ? 'text-light' : 'text-dark'}>{permission.page}</td>
                      <td className={isDarkMode ? 'text-light' : 'text-dark'}>{permission.permission}</td>
                      <td>
                        <span className={`badge ${permission.granted ? 'bg-success' : 'bg-danger'}`}>
                          {permission.granted ? 'Granted' : 'Denied'}
                        </span>
                      </td>
                      <td>
                        <div className="btn-group btn-group-sm">
                          <button
                            onClick={() => handleUpdatePermission(permission.id, !permission.granted)}
                            className={`btn btn-sm ${permission.granted ? 'btn-outline-warning' : 'btn-outline-success'}`}
                            title={permission.granted ? 'Deny Permission' : 'Grant Permission'}
                          >
                            <i className={`bi ${permission.granted ? 'bi-x-circle' : 'bi-check-circle'}`}></i>
                          </button>
                          <button
                            onClick={() => handleDeletePermission(permission.id)}
                            className="btn btn-sm btn-outline-danger"
                            title="Delete Permission"
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="d-flex justify-content-end mt-4">
            <button
              onClick={() => setPermissionsModalOpen(false)}
              className="btn btn-secondary"
            >
              <i className="bi bi-x-circle me-2"></i>
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
