import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import useStore from '../store/useStore';
import { usePermissionRefresh } from '../hooks/usePermissionRefresh';
import api, { employeesAPI, adminAPI } from '../services/api';
import Modal from '../components/Modal';
import EmployeeFormTabs from '../components/EmployeeFormTabs';
import CustomDropdown from '../components/CustomDropdown';
import DataImportModal from '../components/DataImportModal';
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
  const [newPermission, setNewPermission] = useState({ page: '', permission: '', granted: true });
  const [success, setSuccess] = useState('');
  const [permissionsModalOpen, setPermissionsModalOpen] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showDataImport, setShowDataImport] = useState(false);
  const [systemInfo, setSystemInfo] = useState(null);
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    role: 'employee'
  });

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
    // 🚨 MAXIMUM DEBUG LOGGING FOR LOAD EMPLOYEES 🚨
    console.log('🔥 LOAD EMPLOYEES DEBUG - loadEmployees called');
    
    setLoading(true);
    try {
      console.log('🔥 LOAD EMPLOYEES DEBUG - Calling employeesAPI.getAll()');
      console.log('🔥 LOAD EMPLOYEES DEBUG - API base URL:', api.defaults.baseURL);
      
      const response = await employeesAPI.getAll();
      
      console.log('🔥 LOAD EMPLOYEES DEBUG - API response:', response);
      console.log('🔥 LOAD EMPLOYEES DEBUG - Response status:', response.status);
      console.log('🔥 LOAD EMPLOYEES DEBUG - Response data:', response.data);
      console.log('🔥 LOAD EMPLOYEES DEBUG - Number of employees loaded:', response.data?.length);
      
      if (response.data && Array.isArray(response.data)) {
        response.data.forEach((employee, index) => {
          console.log(`🔥 LOAD EMPLOYEES DEBUG - Employee ${index}:`, {
            id: employee.id,
            username: employee.username,
            first_name: employee.first_name,
            last_name: employee.last_name,
            email: employee.email,
            role: employee.role,
            is_active: employee.is_active,
            is_locked: employee.is_locked
          });
        });
      }
      
      setEmployees(response.data);
      clearError();
      console.log('🔥 LOAD EMPLOYEES DEBUG - Employees loaded successfully');
    } catch (err) {
      console.log('🔥 LOAD EMPLOYEES DEBUG - Load employees error occurred!');
      console.log('🔥 LOAD EMPLOYEES DEBUG - Error object:', err);
      console.log('🔥 LOAD EMPLOYEES DEBUG - Error message:', err.message);
      console.log('🔥 LOAD EMPLOYEES DEBUG - Error response:', err.response);
      console.log('🔥 LOAD EMPLOYEES DEBUG - Error response status:', err.response?.status);
      console.log('🔥 LOAD EMPLOYEES DEBUG - Error response data:', err.response?.data);
      console.log('🔥 LOAD EMPLOYEES DEBUG - Error config:', err.config);
      
      setError('Failed to load employees');
    } finally {
      setLoading(false);
      console.log('🔥 LOAD EMPLOYEES DEBUG - Loading state set to false');
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
    // 🚨 MAXIMUM DEBUG LOGGING FOR EMPLOYEE DELETE 🚨
    console.log('🔥 EMPLOYEE DEBUG - handleDelete called');
    console.log('🔥 EMPLOYEE DEBUG - employeeId:', employeeId);
    console.log('🔥 EMPLOYEE DEBUG - typeof employeeId:', typeof employeeId);
    console.log('🔥 EMPLOYEE DEBUG - currentUser:', currentUser);
    console.log('🔥 EMPLOYEE DEBUG - hasPermission employees:delete:', hasPermission('employees', 'delete'));
    
    if (!window.confirm('Are you sure you want to delete this employee?')) {
      console.log('🔥 EMPLOYEE DEBUG - User cancelled delete confirmation');
      return;
    }

    console.log('🔥 EMPLOYEE DEBUG - User confirmed delete, proceeding...');

    try {
      console.log('🔥 EMPLOYEE DEBUG - Calling employeesAPI.delete with ID:', employeeId);
      console.log('🔥 EMPLOYEE DEBUG - API base URL:', employeesAPI.delete.toString());
      
      const response = await employeesAPI.delete(employeeId);
      
      console.log('🔥 EMPLOYEE DEBUG - Delete API response:', response);
      console.log('🔥 EMPLOYEE DEBUG - Response status:', response.status);
      console.log('🔥 EMPLOYEE DEBUG - Response data:', response.data);
      
      removeEmployee(employeeId);
      clearError();
      
      console.log('🔥 EMPLOYEE DEBUG - Employee deleted successfully from store');
    } catch (err) {
      console.log('🔥 EMPLOYEE DEBUG - Delete error occurred!');
      console.log('🔥 EMPLOYEE DEBUG - Error object:', err);
      console.log('🔥 EMPLOYEE DEBUG - Error message:', err.message);
      console.log('🔥 EMPLOYEE DEBUG - Error response:', err.response);
      console.log('🔥 EMPLOYEE DEBUG - Error response status:', err.response?.status);
      console.log('🔥 EMPLOYEE DEBUG - Error response data:', err.response?.data);
      console.log('🔥 EMPLOYEE DEBUG - Error config:', err.config);
      
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
    // 🚨 MAXIMUM DEBUG LOGGING FOR MANAGE PERMISSIONS 🚨
    console.log('🔥 PERMISSIONS DEBUG - handleManagePermissions called');
    console.log('🔥 PERMISSIONS DEBUG - User object:', user);
    console.log('🔥 PERMISSIONS DEBUG - User ID:', user?.id);
    console.log('🔥 PERMISSIONS DEBUG - User name:', user?.first_name, user?.last_name);
    console.log('🔥 PERMISSIONS DEBUG - User username:', user?.username);
    
    setSelectedUser(user);
    setPermissionsModalOpen(true);
    
    console.log('🔥 PERMISSIONS DEBUG - Modal opened, fetching permissions...');
    await fetchUserPermissions(user.id);
  };

  const fetchUserPermissions = async (userId) => {
    // 🚨 MAXIMUM DEBUG LOGGING FOR FETCH PERMISSIONS 🚨
    console.log('🔥 FETCH PERMISSIONS DEBUG - fetchUserPermissions called');
    console.log('🔥 FETCH PERMISSIONS DEBUG - userId:', userId);
    console.log('🔥 FETCH PERMISSIONS DEBUG - typeof userId:', typeof userId);
    
    try {
      const permissionsUrl = `/auth/users/${userId}/permissions`;
      console.log('🔥 FETCH PERMISSIONS DEBUG - Permissions URL:', permissionsUrl);
      console.log('🔥 FETCH PERMISSIONS DEBUG - Full API URL:', `${api.defaults.baseURL}${permissionsUrl}`);
      
      const response = await api.get(permissionsUrl);
      
      console.log('🔥 FETCH PERMISSIONS DEBUG - API response:', response);
      console.log('🔥 FETCH PERMISSIONS DEBUG - Response status:', response.status);
      console.log('🔥 FETCH PERMISSIONS DEBUG - Response data:', response.data);
      console.log('🔥 FETCH PERMISSIONS DEBUG - Response data length:', response.data?.length);
      
      if (response.data && Array.isArray(response.data)) {
        response.data.forEach((permission, index) => {
          console.log(`🔥 FETCH PERMISSIONS DEBUG - Permission ${index}:`, {
            id: permission.id,
            page: permission.page,
            permission: permission.permission,
            granted: permission.granted,
            user_id: permission.user_id
          });
        });
      }
      
      setUserPermissions(response.data);
      console.log('🔥 FETCH PERMISSIONS DEBUG - Permissions set in state successfully');
    } catch (err) {
      console.log('🔥 FETCH PERMISSIONS DEBUG - Fetch permissions error occurred!');
      console.log('🔥 FETCH PERMISSIONS DEBUG - Error object:', err);
      console.log('🔥 FETCH PERMISSIONS DEBUG - Error message:', err.message);
      console.log('🔥 FETCH PERMISSIONS DEBUG - Error response:', err.response);
      console.log('🔥 FETCH PERMISSIONS DEBUG - Error response status:', err.response?.status);
      console.log('🔥 FETCH PERMISSIONS DEBUG - Error response data:', err.response?.data);
      console.log('🔥 FETCH PERMISSIONS DEBUG - Error config:', err.config);
      
      setError('Failed to fetch user permissions');
    }
  };

  const handleCreatePermission = async (e) => {
    e.preventDefault();
    
    // 🚨 MAXIMUM DEBUG LOGGING FOR CREATE PERMISSION 🚨
    console.log('🔥 CREATE PERMISSION DEBUG - handleCreatePermission called');
    console.log('🔥 CREATE PERMISSION DEBUG - selectedUser:', selectedUser);
    console.log('🔥 CREATE PERMISSION DEBUG - selectedUser.id:', selectedUser?.id);
    console.log('🔥 CREATE PERMISSION DEBUG - newPermission:', newPermission);
    
    setError('');
    setSuccess('');

    try {
      const createUrl = `/auth/users/${selectedUser.id}/permissions`;
      const permissionData = {
        page: newPermission.page,
        permission: newPermission.permission,
        granted: true
      };
      
      console.log('🔥 CREATE PERMISSION DEBUG - Create URL:', createUrl);
      console.log('🔥 CREATE PERMISSION DEBUG - Permission data:', permissionData);
      console.log('🔥 CREATE PERMISSION DEBUG - Full API URL:', `${api.defaults.baseURL}${createUrl}`);
      
      const response = await api.post(createUrl, permissionData);
      
      console.log('🔥 CREATE PERMISSION DEBUG - Create permission API response:', response);
      console.log('🔥 CREATE PERMISSION DEBUG - Response status:', response.status);
      console.log('🔥 CREATE PERMISSION DEBUG - Response data:', response.data);

      setSuccess('Permission added successfully!');
      setNewPermission({ page: '', permission: '' });
      
      console.log('🔥 CREATE PERMISSION DEBUG - Fetching updated permissions...');
      fetchUserPermissions(selectedUser.id);
      
      setTimeout(() => setSuccess(''), 3000);
      console.log('🔥 CREATE PERMISSION DEBUG - Permission created successfully');
    } catch (err) {
      console.log('🔥 CREATE PERMISSION DEBUG - Create permission error occurred!');
      console.log('🔥 CREATE PERMISSION DEBUG - Error object:', err);
      console.log('🔥 CREATE PERMISSION DEBUG - Error message:', err.message);
      console.log('🔥 CREATE PERMISSION DEBUG - Error response:', err.response);
      console.log('🔥 CREATE PERMISSION DEBUG - Error response status:', err.response?.status);
      console.log('🔥 CREATE PERMISSION DEBUG - Error response data:', err.response?.data);
      console.log('🔥 CREATE PERMISSION DEBUG - Error config:', err.config);
      
      setError(err.response?.data?.detail || 'Failed to create permission');
    }
  };

  const handleDeletePermission = async (permissionId) => {
    // 🚨 MAXIMUM DEBUG LOGGING FOR PERMISSION DELETE 🚨
    console.log('🔥 PERMISSION DEBUG - handleDeletePermission called');
    console.log('🔥 PERMISSION DEBUG - permissionId:', permissionId);
    console.log('🔥 PERMISSION DEBUG - typeof permissionId:', typeof permissionId);
    console.log('🔥 PERMISSION DEBUG - selectedUser:', selectedUser);
    console.log('🔥 PERMISSION DEBUG - selectedUser.id:', selectedUser?.id);
    console.log('🔥 PERMISSION DEBUG - typeof selectedUser.id:', typeof selectedUser?.id);
    console.log('🔥 PERMISSION DEBUG - userPermissions array:', userPermissions);
    
    // Find the specific permission being deleted
    const permissionToDelete = userPermissions.find(p => p.id === permissionId);
    console.log('🔥 PERMISSION DEBUG - Permission to delete:', permissionToDelete);
    
    // Add confirmation dialog
    if (!window.confirm('Are you sure you want to delete this permission? This action cannot be undone.')) {
      console.log('🔥 PERMISSION DEBUG - User cancelled permission delete confirmation');
      return;
    }

    console.log('🔥 PERMISSION DEBUG - User confirmed delete, proceeding...');
    setError('');
    setSuccess('');
    
    try {
      const deleteUrl = `/auth/users/${selectedUser.id}/permissions/${permissionId}`;
      console.log('🔥 PERMISSION DEBUG - Delete URL:', deleteUrl);
      console.log('🔥 PERMISSION DEBUG - Full API URL:', `${api.defaults.baseURL}${deleteUrl}`);
      
      const response = await api.delete(deleteUrl);
      
      console.log('🔥 PERMISSION DEBUG - Delete permission API response:', response);
      console.log('🔥 PERMISSION DEBUG - Response status:', response.status);
      console.log('🔥 PERMISSION DEBUG - Response data:', response.data);
      
      setSuccess('Permission deleted successfully!');
      
      console.log('🔥 PERMISSION DEBUG - Fetching updated permissions...');
      fetchUserPermissions(selectedUser.id);
      
      setTimeout(() => setSuccess(''), 3000);
      console.log('🔥 PERMISSION DEBUG - Permission delete completed successfully');
    } catch (err) {
      console.log('🔥 PERMISSION DEBUG - Delete permission error occurred!');
      console.log('🔥 PERMISSION DEBUG - Error object:', err);
      console.log('🔥 PERMISSION DEBUG - Error message:', err.message);
      console.log('🔥 PERMISSION DEBUG - Error name:', err.name);
      console.log('🔥 PERMISSION DEBUG - Error stack:', err.stack);
      console.log('🔥 PERMISSION DEBUG - Error response:', err.response);
      console.log('🔥 PERMISSION DEBUG - Error response status:', err.response?.status);
      console.log('🔥 PERMISSION DEBUG - Error response statusText:', err.response?.statusText);
      console.log('🔥 PERMISSION DEBUG - Error response data:', err.response?.data);
      console.log('🔥 PERMISSION DEBUG - Error response headers:', err.response?.headers);
      console.log('🔥 PERMISSION DEBUG - Error config:', err.config);
      console.log('🔥 PERMISSION DEBUG - Error config url:', err.config?.url);
      console.log('🔥 PERMISSION DEBUG - Error config method:', err.config?.method);
      console.log('🔥 PERMISSION DEBUG - Error config baseURL:', err.config?.baseURL);
      
      setError(err.response?.data?.detail || 'Failed to delete permission');
      console.error('Delete permission error:', err);
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

  // Admin Functions
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.post('/auth/users', newUser);
      setSuccess('User created successfully!');
      setShowCreateUser(false);
      setNewUser({
        username: '',
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        role: 'employee'
      });
      loadEmployees();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const handleLockUser = async (userId) => {
    try {
      await api.post(`/auth/users/${userId}/lock`);
      setSuccess('User locked successfully!');
      loadEmployees();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to lock user');
    }
  };

  const handleUnlockUser = async (userId) => {
    try {
      await api.post(`/auth/users/${userId}/unlock`);
      setSuccess('User unlocked successfully!');
      loadEmployees();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to unlock user');
    }
  };

  const handleForcePasswordReset = async (userId) => {
    try {
      await api.post(`/auth/users/${userId}/force-password-reset`);
      setSuccess('User will be required to reset password on next login!');
      loadEmployees();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to force password reset');
    }
  };

  const handleTestAppointments = async () => {
    try {
      const response = await adminAPI.testAppointments();
      setSystemInfo(response.data);
      setSuccess('Appointment test completed successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to test appointments: ' + (err.response?.data?.detail || err.message));
    }
  };

  const pages = ['clients', 'inventory', 'suppliers', 'services', 'employees', 'schedule', 'attendance', 'documents', 'admin'];
  const permissions = ['read', 'write', 'write_all', 'delete', 'admin', 'view_all'];
  const roles = ['admin', 'manager', 'employee', 'viewer'];

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Employee & User Management</h1>
            <div className="flex space-x-2">
              {hasPermission('employees', 'admin') && (
                <>
                  <button
                    onClick={() => setShowDataImport(true)}
                    className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                  >
                    Import Data
                  </button>
                  <button
                    onClick={handleTestAppointments}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                  >
                    Test System
                  </button>
                  <button
                    onClick={() => setShowCreateUser(true)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
                  >
                    Create User
                  </button>
                </>
              )}
              {hasPermission('employees', 'write') && !hasPermission('employees', 'admin') && (
                <button onClick={handleCreate} className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
                  Add Employee
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-8">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <div className="text-sm text-green-700">{success}</div>
            </div>
          )}

          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              {hasPermission('employees', 'admin') ? 'Users & Employees' : 'Employees'}
            </h2>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {employees.map((employee) => (
                    <tr key={employee.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {employee.first_name} {employee.last_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {employee.username}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {employee.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                        {employee.role}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          employee.is_locked 
                            ? 'bg-red-100 text-red-800' 
                            : employee.is_active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                        }`}>
                          {employee.is_locked ? 'Locked' : employee.is_active ? 'Active' : 'Inactive'}
                        </span>
                        {employee.force_password_reset && (
                          <span className="ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                            Reset Required
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        {hasPermission('employees', 'write') && (
                          <button
                            onClick={() => handleEdit(employee)}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="Edit Employee"
                          >
                            Edit
                          </button>
                        )}
                        
                        {hasPermission('employees', 'admin') && (
                          <>
                            <button
                              onClick={() => {
                                console.log('🔥 BUTTON DEBUG - MANAGE PERMISSIONS button clicked');
                                console.log('🔥 BUTTON DEBUG - Employee object:', employee);
                                console.log('🔥 BUTTON DEBUG - Employee ID:', employee.id);
                                handleManagePermissions(employee);
                              }}
                              className="text-indigo-600 hover:text-indigo-900"
                              title="Manage Permissions"
                            >
                              Permissions
                            </button>
                            {employee.is_locked ? (
                              <button
                                onClick={() => handleUnlockUser(employee.id)}
                                className="text-green-600 hover:text-green-900"
                              >
                                Unlock
                              </button>
                            ) : (
                              <button
                                onClick={() => handleLockUser(employee.id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                Lock
                              </button>
                            )}
                            <button
                              onClick={() => handleForcePasswordReset(employee.id)}
                              className="text-yellow-600 hover:text-yellow-900"
                            >
                              Force Reset
                            </button>
                          </>
                        )}
                        
                        {hasPermission('employees', 'delete') && (
                          <button
                            onClick={() => {
                              console.log('🔥 BUTTON DEBUG - Employee DELETE button clicked');
                              console.log('🔥 BUTTON DEBUG - Employee ID:', employee.id);
                              console.log('🔥 BUTTON DEBUG - Employee object:', employee);
                              handleDelete(employee.id);
                            }}
                            className="text-red-600 hover:text-red-900"
                            title="Delete Employee"
                          >
                            Delete
                          </button>
                        )}
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
        <EmployeeFormTabs
          employee={editingEmployee}
          onSubmit={handleSubmit}
          onCancel={closeModal}
        />
      </Modal>

      {/* Create User Modal */}
      {showCreateUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Create New User</h3>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Username</label>
                  <input
                    type="text"
                    value={newUser.username}
                    onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Password</label>
                  <input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">First Name</label>
                  <input
                    type="text"
                    value={newUser.first_name}
                    onChange={(e) => setNewUser({...newUser, first_name: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Last Name</label>
                  <input
                    type="text"
                    value={newUser.last_name}
                    onChange={(e) => setNewUser({...newUser, last_name: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Role</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    {roles.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>
                <div className="flex space-x-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {loading ? 'Creating...' : 'Create User'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateUser(false)}
                    className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

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
                            onClick={() => {
                              console.log('🔥 BUTTON DEBUG - Permission DELETE button clicked');
                              console.log('🔥 BUTTON DEBUG - Permission ID:', permission.id);
                              console.log('🔥 BUTTON DEBUG - Permission object:', permission);
                              console.log('🔥 BUTTON DEBUG - Selected user:', selectedUser);
                              handleDeletePermission(permission.id);
                            }}
                            className="btn btn-sm btn-outline-danger hover:bg-red-50"
                            title="Delete Permission"
                            type="button"
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

      {/* System Info Display */}
      {systemInfo && (
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-md p-4">
          <h3 className="text-lg font-medium text-blue-900 mb-3">System Information</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{systemInfo.total_clients}</div>
              <div className="text-sm text-blue-700">Clients</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{systemInfo.total_services}</div>
              <div className="text-sm text-blue-700">Services</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{systemInfo.total_employees}</div>
              <div className="text-sm text-blue-700">Employees</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{systemInfo.total_appointments}</div>
              <div className="text-sm text-blue-700">Appointments</div>
            </div>
          </div>
          
          {systemInfo.sample_appointments && systemInfo.sample_appointments.length > 0 && (
            <div>
              <h4 className="text-md font-medium text-blue-900 mb-2">Sample Appointments:</h4>
              <div className="space-y-2">
                {systemInfo.sample_appointments.map((apt, index) => (
                  <div key={index} className="bg-white p-3 rounded border">
                    <div className="font-medium">{apt.client_name} - {apt.service_name}</div>
                    <div className="text-sm text-gray-600">
                      {apt.employee_name} • {new Date(apt.appointment_date).toLocaleString()} • {apt.status}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Data Import Modal */}
      <DataImportModal
        isOpen={showDataImport}
        onClose={() => setShowDataImport(false)}
        onImportComplete={() => {
          console.log('Data import completed');
          loadEmployees();
        }}
      />
      </div>
    </div>
  );
}