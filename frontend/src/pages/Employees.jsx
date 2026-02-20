import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { PlusIcon } from '@heroicons/react/24/outline';
import useStore from '../services/useStore';
import api, { employeesAPI, adminAPI, rolesAPI, leaveRequestsAPI, onboardingRequestsAPI, offboardingRequestsAPI } from '../services/api';
import Modal from './components/Modal';
import EmployeeFormTabs from './components/EmployeeFormTabs';
import CustomDropdown from './components/CustomDropdown';
import PermissionGate from './components/PermissionGate';
import useDarkMode from '../services/useDarkMode';

export default function Employees() {
  const { 
    employees, setEmployees, addEmployee, updateEmployee, removeEmployee,
    loading, setLoading, error, setError, clearError,
    isModalOpen, modalContent, openModal, closeModal,
    user: currentUser, hasPermission
  } = useStore();

  const { isDarkMode } = useDarkMode();
  
  // Use the permission refresh hook

  const [editingEmployee, setEditingEmployee] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userPermissions, setUserPermissions] = useState([]);
  const [newPermission, setNewPermission] = useState({ page: '', permission: '', granted: true });
  const [success, setSuccess] = useState('');
  const [permissionsModalOpen, setPermissionsModalOpen] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [systemInfo, setSystemInfo] = useState(null);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [showRolesModal, setShowRolesModal] = useState(false);
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const [allRequests, setAllRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestTypeFilter, setRequestTypeFilter] = useState('all');
  const [editingRole, setEditingRole] = useState(null);
  const [newRole, setNewRole] = useState({ name: '', description: '' });
  const [newRolePermission, setNewRolePermission] = useState({ page: '', permission: '' });
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    role: 'employee'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    loadEmployees();
    // Roles are loaded on-demand when the Manage Roles modal is opened
  }, []);

  const loadRoles = async () => {
    try {
      const response = await rolesAPI.getAll();
      const rolesData = response?.data ?? response;
      if (Array.isArray(rolesData)) {
        setAvailableRoles(rolesData);
      }
    } catch (err) {
      console.error('Failed to load roles:', err);
    }
  };

  const getRoleName = (roleId) => {
    if (!roleId) return '-';
    const role = availableRoles.find(r => r.id === roleId);
    return role ? role.name : '-';
  };

  const handleCreateRole = async (e) => {
    e.preventDefault();
    if (!newRole.name.trim()) {
      setError('Role name is required');
      return;
    }
    try {
      await rolesAPI.create(newRole);
      setSuccess('Role created successfully!');
      setNewRole({ name: '', description: '' });
      loadRoles();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create role');
    }
  };

  const handleDeleteRole = async (roleId) => {
    if (!window.confirm('Are you sure you want to delete this role?')) return;
    try {
      await rolesAPI.delete(roleId);
      setSuccess('Role deleted successfully!');
      loadRoles();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete role');
    }
  };

  const handleAddRolePermission = async (roleId) => {
    if (!newRolePermission.page || !newRolePermission.permission) {
      setError('Please select both page and permission');
      return;
    }
    try {
      await rolesAPI.addPermission(roleId, newRolePermission);
      setSuccess('Permission added to role!');
      setNewRolePermission({ page: '', permission: '' });
      loadRoles();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add permission');
    }
  };

  const handleRemoveRolePermission = async (roleId, permissionId) => {
    try {
      await rolesAPI.removePermission(roleId, permissionId);
      setSuccess('Permission removed from role!');
      loadRoles();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to remove permission');
    }
  };

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
      
      // Handle both direct data and response.data formats
      const employeesData = response?.data ?? response;
      if (Array.isArray(employeesData)) {
        setEmployees(employeesData);
        clearError();
      } else {
        console.error('Invalid employees data format:', employeesData);
        setError('Invalid data format received from server');
        setEmployees([]);
      }
    } catch (err) {
      setError('Failed to load employees');
      console.error('Error loading employees:', err);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingEmployee(null);
    openModal('employee-form');
  };

  const roleOptions = useMemo(() => {
    const roles = employees.map((employee) => employee.role).filter(Boolean);
    return Array.from(new Set(roles)).sort();
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return employees.filter((employee) => {
      if (roleFilter !== 'all' && employee.role !== roleFilter) return false;
      if (statusFilter === 'active' && !employee.is_active) return false;
      if (statusFilter === 'inactive' && employee.is_active) return false;

      if (!term) return true;

      const haystack = [
        employee.first_name,
        employee.last_name,
        employee.email,
        employee.username,
        employee.role,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [employees, searchTerm, roleFilter, statusFilter]);

  const handleEdit = (employee) => {
    console.log('handleEdit called with:', employee);
    setEditingEmployee(employee);
    openModal('employee-form');
  };

  const handleDelete = async (employeeId) => {

    
    if (!window.confirm('Are you sure you want to delete this employee?')) {
      return;
    }


    try {
      
      const response = await employeesAPI.delete(employeeId);
      
      
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
    console.log('🔥 MANAGE PERMISSIONS - Opening modal for user:', user);
    
    setSelectedUser(user);
    setPermissionsModalOpen(true);
    
    // Add a small delay to ensure state is set
    setTimeout(() => {
      console.log('🔥 MANAGE PERMISSIONS - selectedUser after setState:', selectedUser);
    }, 100);
    
    await fetchUserPermissions(user.id);
  };

  const fetchUserPermissions = async (userId) => {

    
    try {
      const permissionsUrl = `/auth/users/${userId}/permissions`;
      
      const response = await api.get(permissionsUrl);
      
      
      if (response.data && Array.isArray(response.data)) {
        // Process permissions data if needed
      }
      
      setUserPermissions(response.data);
    } catch (err) {
      
      setError('Failed to fetch user permissions');
    }
  };

  const handleCreatePermission = async (e) => {
    e.preventDefault();
    
    console.log('🔥 PERMISSION CREATE - selectedUser:', selectedUser);
    console.log('🔥 PERMISSION CREATE - newPermission:', newPermission);
    
    setError('');
    setSuccess('');

    // Validate selectedUser exists
    if (!selectedUser || !selectedUser.id) {
      setError('No user selected for permission creation. Please close and reopen the permissions modal.');
      return;
    }

    try {
      const createUrl = `/auth/users/${selectedUser.id}/permissions`;
      const permissionData = {
        user_id: selectedUser.id, // Add user_id to payload as backup
        page: newPermission.page,
        permission: newPermission.permission,
        granted: true
      };
      
      console.log('🔥 PERMISSION CREATE - URL:', createUrl);
      console.log('🔥 PERMISSION CREATE - Payload:', permissionData);
      
      
      const response = await api.post(createUrl, permissionData);
      console.log('🔥 PERMISSION CREATE - Response:', response.data);

      setSuccess('Permission added successfully!');
      setNewPermission({ page: '', permission: '' });
      
      fetchUserPermissions(selectedUser.id);
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('🔥 PERMISSION CREATE ERROR:', err);
      console.error('🔥 PERMISSION CREATE ERROR Response:', err.response?.data);
      setError(err.response?.data?.detail || 'Failed to create permission');
    }
  };

  const handleDeletePermission = async (permissionId) => {
    console.log('🔥 DELETE PERMISSION - selectedUser:', selectedUser);
    console.log('🔥 DELETE PERMISSION - permissionId:', permissionId);
    
    // Find the specific permission being deleted
    const permissionToDelete = userPermissions.find(p => p.id === permissionId);
    
    // Add confirmation dialog
    if (!window.confirm('Are you sure you want to delete this permission? This action cannot be undone.')) {
      return;
    }

    if (!selectedUser || !selectedUser.id) {
      setError('No user selected. Please close and reopen the permissions modal.');
      return;
    }

    setError('');
    setSuccess('');
    
    try {
      const deleteUrl = `/auth/users/${selectedUser.id}/permissions/${permissionId}`;
      console.log('🔥 DELETE PERMISSION - URL:', deleteUrl);
      
      const response = await api.delete(deleteUrl);
      
      
      setSuccess('Permission deleted successfully!');
      
      fetchUserPermissions(selectedUser.id);
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      
      setError(err.response?.data?.detail || 'Failed to delete permission');
      console.error('Delete permission error:', err);
    }
  };

  const handleUpdatePermission = async (permissionId, granted) => {
    setError('');
    setSuccess('');
    
    console.log('🔥 UPDATE PERMISSION - selectedUser:', selectedUser);
    console.log('🔥 UPDATE PERMISSION - permissionId:', permissionId, 'granted:', granted);
    
    if (!selectedUser || !selectedUser.id) {
      setError('No user selected. Please close and reopen the permissions modal.');
      return;
    }
    
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
    
    console.log('🔥 SCHEDULE VIEW ALL - selectedUser:', selectedUser);
    
    if (!selectedUser || !selectedUser.id) {
      setError('No user selected. Please close and reopen the permissions modal.');
      return;
    }
    
    try {
      const existingPermission = userPermissions.find(p => p.page === 'schedule' && p.permission === 'write');
      
      if (existingPermission) {
        await api.put(`/auth/users/${selectedUser.id}/permissions/${existingPermission.id}`, { granted });
        setSuccess(granted ? 'Schedule write permission granted!' : 'Schedule write permission revoked!');
      } else {
        await api.post(`/auth/users/${selectedUser.id}/permissions`, {
          user_id: selectedUser.id, // Add user_id to payload as backup
          page: 'schedule',
          permission: 'write',
          granted
        });
        setSuccess(granted ? 'Schedule write permission granted!' : 'Schedule write permission revoked!');
      }
      
      fetchUserPermissions(selectedUser.id);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update schedule view all permission');
    }
  };

  const handleScheduleWriteAllToggle = async (granted) => {
    console.log('🔥 SCHEDULE WRITE ALL - selectedUser:', selectedUser);
    
    if (!selectedUser || !selectedUser.id) {
      setError('No user selected. Please close and reopen the permissions modal.');
      return;
    }
    
    try {
      const existingPermission = userPermissions.find(p => p.page === 'schedule' && p.permission === 'write');
      
      if (existingPermission) {
        await employeesAPI.updateUserPermission(selectedUser.id, existingPermission.id, { granted });
        setSuccess(granted ? 'Schedule write permission granted!' : 'Schedule write permission revoked!');
      } else {
        const response = await employeesAPI.createUserPermission(selectedUser.id, {
          user_id: selectedUser.id, // Add user_id to payload as backup
          page: 'schedule',
          permission: 'write',
          granted
        });
        setSuccess(granted ? 'Schedule write permission granted!' : 'Schedule write permission revoked!');
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

  const loadRequests = async (typeFilter = requestTypeFilter) => {
    setRequestsLoading(true);
    try {
      const isAdmin = currentUser?.role === 'admin';
      const supervisorId = currentUser?.id;

      const fetchLeave = async () => {
        const res = isAdmin
          ? await leaveRequestsAPI.getAll()
          : await leaveRequestsAPI.getBySupervisor(supervisorId);
        const rows = res?.data ?? res ?? [];
        return rows.map(r => ({
          ...r,
          _requestType: r.leave_type === 'vacation' ? 'leave_vacation' : 'leave_sick',
          _typeLabel: r.leave_type === 'vacation' ? 'Leave (Vacation)' : 'Leave (Sick)',
          _dateInfo: `${r.start_date} → ${r.end_date}${r.days_requested ? ` (${r.days_requested}d)` : ''}`,
        }));
      };

      const fetchOnboarding = async () => {
        const res = isAdmin
          ? await onboardingRequestsAPI.getAll()
          : await onboardingRequestsAPI.getBySupervisor(supervisorId);
        const rows = res?.data ?? res ?? [];
        return rows.map(r => ({
          ...r,
          _requestType: 'onboarding',
          _typeLabel: 'Onboarding',
          _dateInfo: r.request_date || '—',
        }));
      };

      const fetchOffboarding = async () => {
        const res = isAdmin
          ? await offboardingRequestsAPI.getAll()
          : await offboardingRequestsAPI.getBySupervisor(supervisorId);
        const rows = res?.data ?? res ?? [];
        return rows.map(r => ({
          ...r,
          _requestType: 'offboarding',
          _typeLabel: 'Offboarding',
          _dateInfo: r.request_date || '—',
        }));
      };

      let combined = [];
      if (typeFilter === 'all') {
        const [leave, onboarding, offboarding] = await Promise.all([fetchLeave(), fetchOnboarding(), fetchOffboarding()]);
        combined = [...leave, ...onboarding, ...offboarding];
      } else if (typeFilter === 'leave_vacation' || typeFilter === 'leave_sick') {
        combined = await fetchLeave();
        if (typeFilter === 'leave_vacation') combined = combined.filter(r => r._requestType === 'leave_vacation');
        else combined = combined.filter(r => r._requestType === 'leave_sick');
      } else if (typeFilter === 'onboarding') {
        combined = await fetchOnboarding();
      } else if (typeFilter === 'offboarding') {
        combined = await fetchOffboarding();
      }

      combined.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      setAllRequests(combined);
    } catch (err) {
      setError('Failed to load requests');
    } finally {
      setRequestsLoading(false);
    }
  };

  const handleOpenRequests = () => {
    setShowRequestsModal(true);
    loadRequests(requestTypeFilter);
  };

  const handleRequestAction = async (req, newStatus) => {
    try {
      if (req._requestType === 'onboarding') {
        await onboardingRequestsAPI.action(req.id, newStatus);
      } else if (req._requestType === 'offboarding') {
        await offboardingRequestsAPI.action(req.id, newStatus);
      } else {
        await leaveRequestsAPI.action(req.id, newStatus);
      }
      setAllRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: newStatus } : r));
    } catch (err) {
      setError(`Failed to ${newStatus === 'approved' ? 'approve' : 'deny'} request`);
    }
  };

  const pages = ['clients', 'inventory', 'suppliers', 'services', 'employees', 'schedule', 'attendance', 'documents', 'admin'];
  const permissions = ['read', 'write', 'admin']; // Only use permission types that exist in production DB
  const roles = ['admin', 'manager', 'employee', 'viewer'];

  // Helper function to get manager name from reports_to ID
  const getManagerName = (reportsToId) => {
    if (!reportsToId) return '-';
    const manager = employees.find(e => e.id === reportsToId);
    return manager ? `${manager.first_name} ${manager.last_name}` : '-';
  };

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="d-flex flex-column vh-100 overflow-hidden bg-body">

      {/* Header - sticky on mobile */}
      <div className="flex-shrink-0 border-bottom p-3 bg-body" style={{ position: 'sticky', top: 0, zIndex: 5 }}>
        <h1 className="h-4 mb-0 fw-bold text-body-emphasis">Employees</h1>
      </div>

      {/* Error / Success Alerts */}
      {error && (
        <div className="flex-shrink-0 alert alert-danger border-0 rounded-0 m-0">
          {error}
        </div>
      )}

      {success && (
        <div className="flex-shrink-0 alert alert-success border-0 rounded-0 m-0">
          {success}
        </div>
      )}

      {/* Main upside-down table container */}
      <div className="flex-grow-1 d-flex flex-column overflow-hidden">

        {/* Scrollable rows – grow upwards from bottom */}
        <div
          className="flex-grow-1 overflow-auto d-flex flex-column-reverse bg-white"
          style={{ background: 'var(--bs-body-bg)' }}
        >
          {filteredEmployees.length > 0 ? (
            <table className="table table-borderless table-hover mb-0 table-fixed">
              <colgroup>
                <col />
                <col style={{ width: '120px' }} />
              </colgroup>
              <tbody>
                {filteredEmployees.map((employee, index) => (
                  <tr
                    key={employee.id || index}
                    className="align-middle border-bottom"
                    style={{ height: '56px', cursor: 'pointer' }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('Row clicked for employee:', employee);
                      handleEdit(employee);
                    }}
                  >
                    {/* Name with color coding for active/inactive */}
                    <td className="px-3">
                      <div 
                        className={`fw-medium text-truncate ${
                          employee.is_active ? 'text-success' : 'text-muted'
                        }`} 
                        style={{ maxWidth: '100%' }}
                      >
                        {employee.first_name} {employee.last_name}
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-3">
                      <span className={`badge rounded-pill ${
                        employee.role === 'admin' ? 'bg-danger' :
                        employee.role === 'manager' ? 'bg-warning text-dark' :
                        'bg-primary'
                      }`}>
                        {employee.role}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="d-flex align-items-center justify-content-center flex-grow-1 text-muted">
              No employees found
            </div>
          )}
        </div>

        {/* Fixed bottom – headers + controls */}
        <div className="app-footer-search flex-shrink-0 bg-white dark:bg-gray-800 border-top border-gray-200 dark:border-gray-700 shadow-sm" style={{ zIndex: 10 }}>
          {/* Column Headers */}
          <table className="table table-borderless mb-0 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
            <colgroup>
              <col />
              <col style={{ width: '120px' }} />
            </colgroup>
            <tfoot>
              <tr className="bg-gray-100 dark:bg-gray-700">
                <th>Employee</th>
                <th>Role</th>
              </tr>
            </tfoot>
          </table>

          {/* Controls */}
          <div className="p-3 border-top border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="position-relative w-100 mb-2">
              <span className="position-absolute top-50 start-0 translate-middle-y ps-2 text-muted">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0"/>
                </svg>
              </span>
              <input
                type="text"
                placeholder="Search by name, email, or role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="app-search-input form-control ps-5 w-100 rounded-pill"
              />
            </div>

            <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
              <PermissionGate page="employees" permission="write">
                <button
                  type="button"
                  onClick={handleCreate}
                  className="btn flex-shrink-0 d-flex align-items-center justify-content-center rounded-circle bg-secondary-600 hover:bg-secondary-700 text-white border-0 shadow-lg"
                  style={{ width: '3rem', height: '3rem' }}
                  title="Add employee"
                >
                  <PlusIcon className="h-5 w-5" />
                </button>
              </PermissionGate>
              {(hasPermission('employees', 'admin') || hasPermission('employees', 'write')) && (
                <button
                  type="button"
                  onClick={handleOpenRequests}
                  className="btn btn-sm btn-outline-warning rounded-pill"
                  title="Review requests"
                >
                  Requests
                  {allRequests.filter(r => r.status === 'pending').length > 0 && (
                    <span className="badge bg-danger ms-1">{allRequests.filter(r => r.status === 'pending').length}</span>
                  )}
                </button>
              )}

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="form-select form-select-sm rounded-pill"
                style={{ width: 'fit-content', minWidth: '120px' }}
              >
                <option value="all">Roles</option>
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="form-select form-select-sm rounded-pill"
                style={{ width: 'fit-content', minWidth: '120px' }}
              >
                <option value="all">Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Employee Form Modal */}
      <Modal 
        isOpen={isModalOpen && modalContent === 'employee-form'} 
        onClose={closeModal}
        title={editingEmployee ? 'Edit Employee' : 'Add Employee'}
      >
        {isModalOpen && modalContent === 'employee-form' && (
          <EmployeeFormTabs
            employee={editingEmployee}
            onSubmit={handleSubmit}
            onCancel={closeModal}
            onDelete={editingEmployee ? handleDelete : null}
            onManagePermissions={editingEmployee && hasPermission('employees', 'admin') ? handleManagePermissions : null}
            employees={employees}
            canDelete={editingEmployee && hasPermission('employees', 'delete')}
          />
        )}
      </Modal>

      {/* Create User Modal */}
      <Modal 
        isOpen={showCreateUser} 
        onClose={() => setShowCreateUser(false)}
        title="Create New User"
        noPadding={true}
      >
        <form onSubmit={handleCreateUser} className="d-flex flex-column h-100">
          {/* Scrollable Content */}
          <div className="flex-1 overflow-auto p-4" style={{ maxHeight: 'calc(80vh - 140px)' }}>
                  <div className="form-floating mb-3">
                    <input
                      type="text"
                      id="createUserUsername"
                      value={newUser.username}
                      onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                      className="form-control"
                      placeholder="Username"
                      required
                    />
                    <label htmlFor="createUserUsername">Username</label>
                  </div>
                  <div className="form-floating mb-3">
                    <input
                      type="email"
                      id="createUserEmail"
                      value={newUser.email}
                      onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                      className="form-control"
                      placeholder="Email"
                      required
                    />
                    <label htmlFor="createUserEmail">Email</label>
                  </div>
                  <div className="form-floating mb-3">
                    <input
                      type="password"
                      id="createUserPassword"
                      value={newUser.password}
                      onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                      className="form-control"
                      placeholder="Password"
                      required
                    />
                    <label htmlFor="createUserPassword">Password</label>
                  </div>
                  <div className="form-floating mb-3">
                    <input
                      type="text"
                      id="createUserFirstName"
                      value={newUser.first_name}
                      onChange={(e) => setNewUser({...newUser, first_name: e.target.value})}
                      className="form-control"
                      placeholder="First Name"
                      required
                    />
                    <label htmlFor="createUserFirstName">First Name</label>
                  </div>
                  <div className="form-floating mb-3">
                    <input
                      type="text"
                      id="createUserLastName"
                      value={newUser.last_name}
                      onChange={(e) => setNewUser({...newUser, last_name: e.target.value})}
                      className="form-control"
                      placeholder="Last Name"
                      required
                    />
                    <label htmlFor="createUserLastName">Last Name</label>
                  </div>
                  <div className="form-floating mb-3">
                    <select
                      id="createUserRole"
                      value={newUser.role}
                      onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                      className="form-select form-select-sm"
                    >
                      {roles.map(role => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                    <label htmlFor="createUserRole">Role</label>
                  </div>
          </div>

          {/* Fixed Footer */}
          <div className="border-top bg-white dark:bg-gray-800 p-3">
            <div className="d-flex justify-content-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateUser(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
              >
                {loading ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Permissions Management Modal */}
      <Modal 
        isOpen={permissionsModalOpen} 
        onClose={() => setPermissionsModalOpen(false)}
        title={`Manage Permissions - ${selectedUser?.first_name} ${selectedUser?.last_name}`}
        noPadding={true}
      >
        <div className="d-flex flex-column h-100">
          {/* Scrollable Content */}
          <div className="flex-1 overflow-auto p-4" style={{ maxHeight: 'calc(80vh - 140px)' }}>
            {/* Add New Permission Form */}
            <form onSubmit={handleCreatePermission} className="mb-4 p-3 border rounded">
            <h5 className={`mb-3 ${isDarkMode ? 'text-light' : 'text-dark'}`}>Add New Permission</h5>
            <div className="row g-3">
              <div className="col-md-6">
                <select
                  value={newPermission.page}
                  onChange={(e) => setNewPermission({...newPermission, page: e.target.value})}
                  className="form-select form-select-sm"
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
                  className="form-select form-select-sm"
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
                      checked={userPermissions.some(p => p.page === 'schedule' && p.permission === 'write' && p.granted)}
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
                      checked={userPermissions.some(p => p.page === 'schedule' && p.permission === 'write' && p.granted)}
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
          </div>

          {/* Fixed Footer */}
          <div className="border-top bg-white dark:bg-gray-800 p-3">
            <div className="d-flex justify-content-end gap-2">
              <button
                type="button"
                onClick={() => setPermissionsModalOpen(false)}
                className="btn btn-secondary"
              >
                <i className="bi bi-x-circle me-2"></i>
                Close
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Roles Management Modal */}
      <Modal 
        isOpen={showRolesModal} 
        onClose={() => setShowRolesModal(false)}
        title="Manage Roles"
        noPadding={true}
      >
        <div className="d-flex flex-column h-100">
          {/* Scrollable Content */}
          <div className="flex-1 overflow-auto p-4" style={{ maxHeight: 'calc(80vh - 140px)' }}>
            {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-md p-3 mb-4">
              <div className="text-sm text-green-700">{success}</div>
            </div>
          )}

          {/* Create New Role Form */}
          <form onSubmit={handleCreateRole} className="mb-4 p-3 border rounded">
            <h5 className={`mb-3 ${isDarkMode ? 'text-light' : 'text-dark'}`}>Create New Role</h5>
            <div className="row g-3">
              <div className="col-md-5">
                <input
                  type="text"
                  value={newRole.name}
                  onChange={(e) => setNewRole({...newRole, name: e.target.value})}
                  className="form-control"
                  placeholder="Role Name"
                  required
                />
              </div>
              <div className="col-md-5">
                <input
                  type="text"
                  value={newRole.description}
                  onChange={(e) => setNewRole({...newRole, description: e.target.value})}
                  className="form-control"
                  placeholder="Description (optional)"
                />
              </div>
              <div className="col-md-2">
                <button type="submit" className="btn btn-primary w-100">
                  Create
                </button>
              </div>
            </div>
          </form>

          {/* Existing Roles List */}
          <div className="mt-4">
            <h5 className={`mb-3 ${isDarkMode ? 'text-light' : 'text-dark'}`}>Existing Roles</h5>
            {availableRoles.length === 0 ? (
              <p className="text-muted">No roles defined yet. Create one above.</p>
            ) : (
              <div className="space-y-4">
                {availableRoles.map((role) => (
                  <div key={role.id} className="border rounded p-3">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div>
                        <h6 className={`mb-1 ${isDarkMode ? 'text-light' : 'text-dark'}`}>
                          {role.name}
                          {role.is_system && (
                            <span className="badge bg-secondary ms-2">System</span>
                          )}
                        </h6>
                        {role.description && (
                          <small className="text-muted">{role.description}</small>
                        )}
                      </div>
                      {!role.is_system && (
                        <button
                          onClick={() => handleDeleteRole(role.id)}
                          className="btn btn-sm btn-outline-danger"
                          title="Delete Role"
                        >
                          Delete
                        </button>
                      )}
                    </div>

                    {/* Role Permissions */}
                    <div className="mt-2">
                      <small className={`d-block mb-2 ${isDarkMode ? 'text-light' : 'text-muted'}`}>
                        <strong>Permissions:</strong>
                      </small>
                      <div className="d-flex flex-wrap gap-1 mb-2">
                        {role.role_permissions?.length > 0 ? (
                          role.role_permissions.map((perm) => (
                            <span key={perm.id} className="badge bg-secondary d-flex align-items-center gap-1">
                              {perm.page}:{perm.permission}
                              <button
                                onClick={() => handleRemoveRolePermission(role.id, perm.id)}
                                className="btn-close btn-close-white ms-1"
                                style={{ fontSize: '0.5rem' }}
                                title="Remove permission"
                              />
                            </span>
                          ))
                        ) : (
                          <span className="text-muted">No permissions assigned</span>
                        )}
                      </div>

                      {/* Add Permission to Role */}
                      <div className="d-flex gap-2 mt-2">
                        <select
                          value={editingRole === role.id ? newRolePermission.page : ''}
                          onChange={(e) => {
                            setEditingRole(role.id);
                            setNewRolePermission({...newRolePermission, page: e.target.value});
                          }}
                          className="form-select form-select-sm"
                          style={{ maxWidth: '150px' }}
                        >
                          <option value="">Page...</option>
                          {pages.map(page => (
                            <option key={page} value={page}>{page}</option>
                          ))}
                        </select>
                        <select
                          value={editingRole === role.id ? newRolePermission.permission : ''}
                          onChange={(e) => {
                            setEditingRole(role.id);
                            setNewRolePermission({...newRolePermission, permission: e.target.value});
                          }}
                          className="form-select form-select-sm"
                          style={{ maxWidth: '150px' }}
                        >
                          <option value="">Permission...</option>
                          {permissions.map(perm => (
                            <option key={perm} value={perm}>{perm}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleAddRolePermission(role.id)}
                          className="btn btn-sm btn-outline-primary"
                          disabled={editingRole !== role.id || !newRolePermission.page || !newRolePermission.permission}
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          </div>

          {/* Fixed Footer */}
          <div className="border-top bg-white dark:bg-gray-800 p-3">
            <div className="d-flex justify-content-end gap-2">
              <button
                type="button"
                onClick={() => setShowRolesModal(false)}
                className="btn btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Requests Modal */}
      <Modal
        isOpen={showRequestsModal}
        onClose={() => setShowRequestsModal(false)}
        title={currentUser?.role === 'admin' ? 'Requests (All)' : 'Requests (Your Team)'}
        noPadding={true}
      >
        <div className="d-flex flex-column h-100">
          {/* Type filter pills */}
          <div className="px-3 pt-3 pb-2 border-bottom d-flex flex-wrap gap-1">
            {[
              { key: 'all', label: 'All' },
              { key: 'leave_vacation', label: 'Leave (Vacation)' },
              { key: 'leave_sick', label: 'Leave (Sick)' },
              { key: 'onboarding', label: 'Onboarding' },
              { key: 'offboarding', label: 'Offboarding' },
            ].map(({ key, label }) => (
              <button
                key={key}
                className={`btn btn-sm rounded-pill ${requestTypeFilter === key ? 'btn-warning' : 'btn-outline-secondary'}`}
                onClick={() => {
                  setRequestTypeFilter(key);
                  loadRequests(key);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-auto p-3" style={{ maxHeight: 'calc(80vh - 170px)' }}>
            {requestsLoading ? (
              <div className="text-center py-4">
                <div className="spinner-border text-primary" role="status" />
              </div>
            ) : allRequests.length === 0 ? (
              <p className="text-muted text-center py-4">No requests found.</p>
            ) : (
              <div className="d-flex flex-column gap-2">
                {['pending', 'approved', 'denied'].map(statusGroup => {
                  const grouped = allRequests.filter(r => r.status === statusGroup);
                  if (grouped.length === 0) return null;
                  return (
                    <div key={statusGroup}>
                      <h6 className={`text-capitalize mb-2 ${statusGroup === 'pending' ? 'text-warning' : statusGroup === 'approved' ? 'text-success' : 'text-danger'}`}>
                        {statusGroup} ({grouped.length})
                      </h6>
                      {grouped.map(req => {
                        const emp = employees.find(e => e.id === req.user_id);
                        return (
                          <div key={req.id} className="card mb-2">
                            <div className="card-body py-2 px-3">
                              <div className="d-flex justify-content-between align-items-start">
                                <div>
                                  <div className="fw-semibold">{emp ? `${emp.first_name} ${emp.last_name}` : 'Unknown Employee'}</div>
                                  <div className="small text-muted">
                                    <span className="badge bg-secondary me-1">{req._typeLabel}</span>
                                    {req._dateInfo}
                                  </div>
                                  {req.notes && <div className="small text-muted fst-italic">{req.notes}</div>}
                                </div>
                                {req.status === 'pending' && (
                                  <div className="d-flex gap-1">
                                    <button
                                      className="btn btn-sm btn-success"
                                      onClick={() => handleRequestAction(req, 'approved')}
                                    >
                                      Approve
                                    </button>
                                    <button
                                      className="btn btn-sm btn-danger"
                                      onClick={() => handleRequestAction(req, 'denied')}
                                    >
                                      Deny
                                    </button>
                                  </div>
                                )}
                                {req.status !== 'pending' && (
                                  <span className={`badge ${req.status === 'approved' ? 'bg-success' : 'bg-danger'}`}>
                                    {req.status}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="border-top p-3">
            <button className="btn btn-secondary" onClick={() => setShowRequestsModal(false)}>Close</button>
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

    </div>
  );
}
