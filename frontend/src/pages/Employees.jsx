import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { PlusIcon, XMarkIcon, CheckIcon, UserGroupIcon, CheckCircleIcon, ChatBubbleLeftIcon } from '@heroicons/react/24/outline';
import useStore from '../services/useStore';
import api, { employeesAPI, adminAPI, rolesAPI, leaveRequestsAPI, onboardingRequestsAPI, offboardingRequestsAPI, insurancePlansAPI, payrollAPI, chatAPI, settingsAPI } from '../services/api';
import Modal from './components/Modal';
import Form_Employee from './components/Form_Employee';
import Dropdown_Custom from './components/Dropdown_Custom';
import Gate_Permission from './components/Gate_Permission';
import useDarkMode from '../services/useDarkMode';
import Modal_Create_User from './components/Modal_Create_User';
import Modal_Permissions_User from './components/Modal_Permissions_User';
import Modal_Manage_Roles from './components/Modal_Manage_Roles';
import Modal_Requests_Employee from './components/Modal_Requests_Employee';
import Modal_Insurance_Plans from './components/Modal_Insurance_Plans';
import Chat_Employee from './components/Chat_Employee';
import Modal_Wages from './components/Modal_Wages';

export default function Employees() {
  const { 
    employees, setEmployees, addEmployee, updateEmployee, removeEmployee,
    loading, setLoading, error, setError, clearError,
    isModalOpen, modalContent, openModal, closeModal,
    user: currentUser, setUser, hasPermission
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
  const [showInsuranceModal, setShowInsuranceModal] = useState(false);
  const [insurancePlans, setInsurancePlans] = useState([]);
  const [insurancePlansLoading, setInsurancePlansLoading] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [newPlan, setNewPlan] = useState({ name: '', description: '', is_active: true });
  const [insuranceError, setInsuranceError] = useState('');
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestTypeFilter, setRequestTypeFilter] = useState('all');
  const [requestTimeFilter, setRequestTimeFilter] = useState('all');
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
  const [isRoleFilterOpen, setIsRoleFilterOpen] = useState(false);
  const [isStatusFilterOpen, setIsStatusFilterOpen] = useState(false);
  const hasFetched = useRef(false);

  // Payroll state
  const [showPayModal, setShowPayModal] = useState(false);
  const [payingEmployee, setPayingEmployee] = useState(null);
  const [payForm, setPayForm] = useState({
    pay_period_start: '',
    pay_period_end: '',
    gross_amount: '',
    hours_worked: '',
    other_deductions: '',
    notes: '',
  });
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState('');
  const [paySuccess, setPaySuccess] = useState('');
  const [availableWeeks, setAvailableWeeks] = useState([]);
  const [payWeeksLoading, setPayWeeksLoading] = useState(false);
  const [paidEmployeeIds, setPaidEmployeeIds] = useState({});

  // Chat state
  const [showChatModal, setShowChatModal] = useState(false);
  const [chattingEmployee, setChattingEmployee] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({});

  const [appSettings, setAppSettings] = useState(null);

  // Wages modal
  const [showWagesModal, setShowWagesModal] = useState(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    loadEmployees();
    // Roles are loaded on-demand when the Manage Roles modal is opened
    settingsAPI.getSettings().then((res) => setAppSettings(res.data)).catch(() => {});
  }, []);

  // Load payment status for all employees when they update
  useEffect(() => {
    const loadPaymentStatus = async () => {
      if (!employees.length) return;
      try {
        const res = await payrollAPI.getAll();
        const allSlips = res?.data ?? res ?? [];
        if (!Array.isArray(allSlips)) return;

        const statuses = {};
        for (const employee of employees) {
          if (!employee.pay_frequency) continue;
          const currentPeriod = getCurrentPayPeriod(employee);
          if (!currentPeriod) continue;
          const slips = allSlips.filter(s => String(s.employee_id) === String(employee.id));
          statuses[employee.id] = slips.some(slip => {
            const slipStart = new Date(slip.pay_period_start);
            const slipEnd = new Date(slip.pay_period_end);
            return slip.status === 'paid' &&
                   slipStart <= currentPeriod.end &&
                   slipEnd >= currentPeriod.start;
          });
        }
        setPaidEmployeeIds(statuses);
      } catch {
        // silent — backend may be unavailable
      }
    };

    loadPaymentStatus();
  }, [employees]);

  const loadUnreadCounts = async () => {
    try {
      const res = await chatAPI.getUnreadCounts();
      const data = res?.data ?? res;
      if (data && typeof data === 'object') setUnreadCounts(data);
    } catch { /* silent */ }
  };

  useEffect(() => {
    loadUnreadCounts();
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

  const generateWeeks = (paidStartDates, count = 26) => {
    const weeks = [];
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() - daysToMonday);
    thisMonday.setHours(0, 0, 0, 0);
    for (let i = 0; i < count; i++) {
      const monday = new Date(thisMonday);
      monday.setDate(thisMonday.getDate() - i * 7);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const mondayStr = monday.toISOString().slice(0, 10);
      const sundayStr = sunday.toISOString().slice(0, 10);
      const isPaid = paidStartDates.some(d => {
        const dStr = typeof d === 'string' ? d.slice(0, 10) : new Date(d).toISOString().slice(0, 10);
        return dStr === mondayStr;
      });
      weeks.push({
        start: mondayStr,
        end: sundayStr,
        label: `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
        isPaid,
      });
    }
    return weeks;
  };

  const handleOpenPay = async (employee, e) => {
    e.stopPropagation();
    setPayingEmployee(employee);
    setPayError('');
    setPaySuccess('');
    setAvailableWeeks([]);
    const baseForm = {
      pay_period_start: '',
      pay_period_end: '',
      gross_amount: employee.salary ? String(employee.salary) : '',
      hours_worked: '',
      other_deductions: '',
      notes: '',
    };
    if (employee.pay_frequency === 'weekly') {
      setPayForm(baseForm);
      setShowPayModal(true);
      setPayWeeksLoading(true);
      try {
        const res = await payrollAPI.getByEmployee(employee.id);
        const slips = res?.data ?? res;
        const paidStarts = Array.isArray(slips) ? slips.map(s => s.pay_period_start) : [];
        setAvailableWeeks(generateWeeks(paidStarts));
      } catch (err) {
        console.error('Failed to load pay history:', err);
        setAvailableWeeks(generateWeeks([]));
      } finally {
        setPayWeeksLoading(false);
      }
    } else {
      const now = new Date();
      let start, end;
      if (employee.pay_frequency === 'daily') {
        start = now.toISOString().slice(0, 10);
        end = start;
      } else {
        start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
      }
      setPayForm({ ...baseForm, pay_period_start: start, pay_period_end: end });
      setShowPayModal(true);
    }
  };

  const handlePaySubmit = async (e) => {
    e.preventDefault();
    setPayError('');
    setPayLoading(true);
    try {
      const isHourly = payingEmployee?.employment_type === 'hourly';
      const payload = {
        pay_period_start: new Date(payForm.pay_period_start).toISOString(),
        pay_period_end: new Date(payForm.pay_period_end).toISOString(),
        other_deductions: payForm.other_deductions !== '' ? parseFloat(payForm.other_deductions) : 0,
        notes: payForm.notes || null,
        employment_type: payingEmployee?.employment_type || 'salary',
      };
      if (isHourly) {
        payload.hours_worked = payForm.hours_worked !== '' ? parseFloat(payForm.hours_worked) : 0;
        payload.hourly_rate_snapshot = payingEmployee?.hourly_rate || 0;
      } else {
        payload.gross_amount = payForm.gross_amount !== '' ? parseFloat(payForm.gross_amount) : null;
      }
      await payrollAPI.processPayment(payingEmployee.id, payload);
      setPaySuccess('Payment processed successfully!');
      
      // Refresh payment status for this employee
      const res = await payrollAPI.getByEmployee(payingEmployee.id);
      const paySlips = res?.data ?? res ?? [];
      const currentPeriod = getCurrentPayPeriod(payingEmployee);
      if (currentPeriod && Array.isArray(paySlips)) {
        const paidForPeriod = paySlips.some(slip => {
          const slipStart = new Date(slip.pay_period_start);
          const slipEnd = new Date(slip.pay_period_end);
          return slip.status === 'paid' && 
                 slipStart <= currentPeriod.end && 
                 slipEnd >= currentPeriod.start;
        });
        setPaidEmployeeIds(prev => ({ ...prev, [payingEmployee.id]: paidForPeriod }));
      }
      
      setTimeout(() => { setShowPayModal(false); setPaySuccess(''); }, 1500);
    } catch (err) {
      setPayError(err.response?.data?.detail || 'Failed to process payment');
    } finally {
      setPayLoading(false);
    }
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

  const getStatusFilterButtonClass = () => {
    if (statusFilter === 'active') return 'bg-green-600 text-white';
    if (statusFilter === 'inactive') return 'bg-red-600 text-white';
    return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600';
  };

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
        const updatedEmployee = response?.data ?? response;
        updateEmployee(editingEmployee.id, updatedEmployee);

        if (currentUser?.id === editingEmployee.id) {
          const mergedCurrentUser = { ...currentUser, ...updatedEmployee };
          setUser(mergedCurrentUser);
          if (localStorage.getItem('user')) localStorage.setItem('user', JSON.stringify(mergedCurrentUser));
          if (sessionStorage.getItem('user')) sessionStorage.setItem('user', JSON.stringify(mergedCurrentUser));
        }
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

  const handleOpenInsurance = async () => {
    setShowInsuranceModal(true);
    if (insurancePlans.length === 0) {
      setInsurancePlansLoading(true);
      try {
        const res = await insurancePlansAPI.getAll();
        setInsurancePlans(res?.data ?? res ?? []);
      } catch (err) {
        setInsuranceError('Failed to load insurance plans');
      } finally {
        setInsurancePlansLoading(false);
      }
    }
  };

  const handleInsurancePlanSave = async (e) => {
    e.preventDefault();
    setInsuranceError('');
    try {
      if (editingPlan?.id) {
        const res = await insurancePlansAPI.update(editingPlan.id, editingPlan);
        setInsurancePlans(prev => prev.map(p => p.id === editingPlan.id ? (res?.data ?? res) : p));
        setEditingPlan(null);
      } else {
        const res = await insurancePlansAPI.create(newPlan);
        setInsurancePlans(prev => [...prev, res?.data ?? res]);
        setNewPlan({ name: '', description: '', is_active: true });
      }
    } catch (err) {
      setInsuranceError(err.response?.data?.detail || 'Failed to save plan');
    }
  };

  const handleInsurancePlanDelete = async (id) => {
    if (!window.confirm('Delete this insurance plan?')) return;
    try {
      await insurancePlansAPI.delete(id);
      setInsurancePlans(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      setInsuranceError('Failed to delete plan');
    }
  };

  const handleInsurancePlanToggle = async (plan) => {
    try {
      const res = await insurancePlansAPI.update(plan.id, { is_active: !plan.is_active });
      setInsurancePlans(prev => prev.map(p => p.id === plan.id ? (res?.data ?? res) : p));
    } catch (err) {
      setInsuranceError('Failed to update plan');
    }
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

  // Helper function to determine current pay period based on pay_frequency
  const getCurrentPayPeriod = (employee) => {
    if (!employee.pay_frequency) return null;
    
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    
    switch(employee.pay_frequency) {
      case 'daily':
        return {
          start: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          end: new Date(now.getFullYear(), now.getMonth(), now.getDate())
        };
      case 'weekly':
        const dayOfWeek = now.getDay();
        const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const weekStart = new Date(now.setDate(diff));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        return {
          start: new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()),
          end: new Date(weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate())
        };
      case 'biweekly':
        const weekStart2 = new Date(startOfYear);
        const weeksElapsed = Math.floor((now - weekStart2) / (7 * 24 * 60 * 60 * 1000));
        const periodNum = Math.floor(weeksElapsed / 2);
        const biStart = new Date(startOfYear);
        biStart.setDate(biStart.getDate() + periodNum * 14);
        const biEnd = new Date(biStart);
        biEnd.setDate(biEnd.getDate() + 13);
        return {
          start: new Date(biStart.getFullYear(), biStart.getMonth(), biStart.getDate()),
          end: new Date(biEnd.getFullYear(), biEnd.getMonth(), biEnd.getDate())
        };
      case 'monthly':
        return {
          start: new Date(now.getFullYear(), now.getMonth(), 1),
          end: new Date(now.getFullYear(), now.getMonth() + 1, 0)
        };
      case 'annually':
        return {
          start: new Date(now.getFullYear(), 0, 1),
          end: new Date(now.getFullYear(), 11, 31)
        };
      default:
        return null;
    }
  };

  // Helper function to check if employee has been paid for current pay period
  const isEmployeePaidForCurrentPeriod = (employee) => {
    if (!employee || !employees.length) return false;
    
    // For employees without a pay frequency, we can't determine pay period
    const currentPeriod = getCurrentPayPeriod(employee);
    if (!currentPeriod) return false;
    
    // Check if any of the loaded employees' payroll data shows a paid slip for current period
    // Since we don't have direct access to pay slips here, we'll need to load it
    // For now, return false as default - will be checked on demand
    return false;
  };

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
      <div className="flex-shrink-0 border-bottom p-2 bg-body d-flex justify-content-between" style={{ position: 'sticky', top: 0, zIndex: 5 }}>
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

        {/* Container_Scrollable rows – grow upwards from bottom */}
        <div
          className="flex-grow-1 overflow-auto d-flex flex-column-reverse bg-white dark:bg-gray-900 no-scrollbar"
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

                    {/* Role + Pay + Chat */}
                    <td className="px-3">
                      <div className="d-flex align-items-center gap-1 justify-content-between">
                        <span className={`badge rounded-pill ${
                          employee.role === 'admin' ? 'bg-danger' :
                          employee.role === 'manager' ? 'bg-warning text-dark' :
                          'bg-primary'
                        }`}>
                          {employee.role}
                        </span>
                        <div className="d-flex align-items-center gap-1">
                          {employee.id !== currentUser?.id && (
                            <button
                              type="button"
                              className={`btn m-0 d-flex align-items-center justify-content-center position-relative ${unreadCounts[employee.id] ? 'btn-primary' : 'btn-outline-secondary'}`}
                              style={{ width: '3rem', height: '3rem' }}
                              title={`Chat with ${employee.first_name}${unreadCounts[employee.id] ? ` (${unreadCounts[employee.id]} unread)` : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setChattingEmployee(employee);
                                setShowChatModal(true);
                                // Clear badge immediately, backend will mark as read
                                setUnreadCounts(prev => {
                                  const next = { ...prev };
                                  delete next[employee.id];
                                  return next;
                                });
                              }}
                            >
                              <ChatBubbleLeftIcon style={{ width: 24, height: 24 }} />
                              {!!unreadCounts[employee.id] && (
                                <span
                                  className="badge bg-danger rounded-pill position-absolute"
                                  style={{ top: 2, right: 2, fontSize: '0.6rem', minWidth: 16, padding: '2px 4px' }}
                                >
                                  {unreadCounts[employee.id] > 9 ? '9+' : unreadCounts[employee.id]}
                                </span>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
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
          <div className="border-top border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">

            {/* Row 1 – Requests + Insurance */}
            {(hasPermission('employees', 'admin') || hasPermission('employees', 'write')) && (
              <div className="px-3 pt-2 d-flex gap-2 dark:border-gray-700">
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
                <button
                  type="button"
                  onClick={handleOpenInsurance}
                  className="btn btn-sm btn-outline-primary rounded-pill"
                  title="Manage insurance plans"
                >
                  Insurance
                </button>
                <button
                  type="button"
                  onClick={() => setShowWagesModal(true)}
                  className="btn btn-sm btn-outline-success rounded-pill"
                  title="Wages & payroll"
                >
                  Wages
                </button>
              </div>
            )}

            {/* Row 2 – Search + Add + Filters */}
            <div className="p-3 pt-2">
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

              <div className="d-flex align-items-center gap-1 flex-wrap pb-2">
                <Gate_Permission page="employees" permission="write">
                  <button
                    type="button"
                    onClick={handleCreate}
                    className="btn flex-shrink-0 d-flex align-items-center justify-content-center rounded-circle bg-secondary-600 hover:bg-secondary-700 text-white border-0 shadow-lg"
                    style={{ width: '3rem', height: '3rem' }}
                    title="Add employee"
                  >
                    <PlusIcon className="h-5 w-5" />
                  </button>
                </Gate_Permission>

                {/* Clear Filters Button */}
                {(roleFilter !== 'all' || statusFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setRoleFilter('all');
                      setStatusFilter('all');
                    }}
                    className="btn d-flex align-items-center justify-content-center rounded-circle bg-red-600 hover:bg-red-700 text-white border-0 shadow-lg transition-all"
                    style={{ width: '3rem', height: '3rem' }}
                    title="Clear all filters"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                )}

                {/* Role Filter */}
                <div className="position-relative">
                  <button
                    type="button"
                    onClick={() => setIsRoleFilterOpen(!isRoleFilterOpen)}
                    className={`btn d-flex align-items-center justify-content-center rounded-circle border-0 shadow-lg transition-all ${
                      roleFilter !== 'all'
                        ? 'bg-primary-600 hover:bg-primary-700 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                    style={{ width: '3rem', height: '3rem' }}
                    title="Filter by role"
                    data-active={roleFilter !== 'all'}
                  >
                    <UserGroupIcon className="h-6 w-6" />
                  </button>
                  {isRoleFilterOpen && (
                    <div className="position-absolute bottom-100 start-0 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-2 z-50" style={{ minWidth: '200px', maxHeight: '300px', overflowY: 'auto' }}>
                      <button
                        onClick={() => { setRoleFilter('all'); setIsRoleFilterOpen(false); }}
                        className={`d-block w-100 text-start px-3 py-2 rounded-lg mb-1 transition-colors ${roleFilter === 'all' ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400' : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100'}`}
                      >
                        All Roles
                      </button>
                      {roleOptions.map((role) => (
                        <button
                          key={role}
                          onClick={() => { setRoleFilter(role); setIsRoleFilterOpen(false); }}
                          className={`d-block w-100 text-start px-3 py-2 rounded-lg mb-1 transition-colors ${roleFilter === role ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400' : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100'}`}
                        >
                          {role}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Status Filter */}
                <div className="position-relative">
                  <button
                    type="button"
                    onClick={() => setIsStatusFilterOpen(!isStatusFilterOpen)}
                    className={`btn d-flex align-items-center justify-content-center rounded-circle border-0 shadow-lg transition-all ${getStatusFilterButtonClass()}`}
                    style={{ width: '3rem', height: '3rem' }}
                    title="Filter by status"
                    data-active={statusFilter !== 'all'}
                  >
                    <CheckCircleIcon className="h-6 w-6" />
                  </button>
                  {isStatusFilterOpen && (
                    <div className="position-absolute bottom-100 start-0 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-2 z-50" style={{ minWidth: '180px' }}>
                      <button
                        onClick={() => { setStatusFilter('all'); setIsStatusFilterOpen(false); }}
                        className={`d-block w-100 text-start px-3 py-2 rounded-lg mb-1 transition-colors ${statusFilter === 'all' ? 'bg-secondary-50 dark:bg-secondary-900/30 text-secondary-600 dark:text-secondary-400' : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100'}`}
                      >
                        All Statuses
                      </button>
                      <button
                        onClick={() => { setStatusFilter('active'); setIsStatusFilterOpen(false); }}
                        className={`d-block w-100 text-start px-3 py-2 rounded-lg mb-1 transition-colors ${statusFilter === 'active' ? 'bg-secondary-50 dark:bg-secondary-900/30 text-secondary-600 dark:text-secondary-400' : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100'}`}
                      >
                        Active
                      </button>
                      <button
                        onClick={() => { setStatusFilter('inactive'); setIsStatusFilterOpen(false); }}
                        className={`d-block w-100 text-start px-3 py-2 rounded-lg transition-colors ${statusFilter === 'inactive' ? 'bg-secondary-50 dark:bg-secondary-900/30 text-secondary-600 dark:text-secondary-400' : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100'}`}
                      >
                        Inactive
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Employee Form Modal */}
      <Modal
        isOpen={isModalOpen && modalContent === 'employee-form'}
        onClose={closeModal}
        noPadding={true}
        fullScreen={true}
      >
        {isModalOpen && modalContent === 'employee-form' && (
          <Form_Employee
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
      <Modal_Create_User
        isOpen={showCreateUser}
        onClose={() => setShowCreateUser(false)}
        newUser={newUser}
        setNewUser={setNewUser}
        onSubmit={handleCreateUser}
        loading={loading}
        roles={roles}
      />

      {/* Permissions Management Modal */}
      <Modal_Permissions_User
        isOpen={permissionsModalOpen}
        onClose={() => setPermissionsModalOpen(false)}
        userPermissions={userPermissions}
        newPermission={newPermission}
        setNewPermission={setNewPermission}
        onCreatePermission={handleCreatePermission}
        onDeletePermission={handleDeletePermission}
        onUpdatePermission={handleUpdatePermission}
        onScheduleViewAllToggle={handleScheduleViewAllToggle}
        onScheduleWriteAllToggle={handleScheduleWriteAllToggle}
        pages={pages}
        permissions={permissions}
        isDarkMode={isDarkMode}
      />

      {/* Roles Management Modal */}
      <Modal_Manage_Roles
        isOpen={showRolesModal}
        onClose={() => setShowRolesModal(false)}
        availableRoles={availableRoles}
        newRole={newRole}
        setNewRole={setNewRole}
        editingRole={editingRole}
        setEditingRole={setEditingRole}
        newRolePermission={newRolePermission}
        setNewRolePermission={setNewRolePermission}
        onCreateRole={handleCreateRole}
        onDeleteRole={handleDeleteRole}
        onAddRolePermission={handleAddRolePermission}
        onRemoveRolePermission={handleRemoveRolePermission}
        pages={pages}
        permissions={permissions}
        isDarkMode={isDarkMode}
        error={error}
        success={success}
      />

      {/* Requests Modal */}
      <Modal_Requests_Employee
        isOpen={showRequestsModal}
        onClose={() => setShowRequestsModal(false)}
        allRequests={allRequests}
        requestTypeFilter={requestTypeFilter}
        setRequestTypeFilter={setRequestTypeFilter}
        requestTimeFilter={requestTimeFilter}
        setRequestTimeFilter={setRequestTimeFilter}
        requestsLoading={requestsLoading}
        employees={employees}
        onRequestAction={handleRequestAction}
        loadRequests={loadRequests}
      />

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

      {/* Process Pay Modal */}
      {showPayModal && payingEmployee && (
        <div
          className="modal d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowPayModal(false); setPayError(''); } }}
        >
          <div className="modal-dialog modal-sm modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header py-2">
                <h6 className="modal-title mb-0">
                  Pay {payingEmployee.first_name} {payingEmployee.last_name}
                </h6>
                <button type="button" className="btn-close" onClick={() => { setShowPayModal(false); setPayError(''); }} />
              </div>
              <form onSubmit={handlePaySubmit}>
                <div className="modal-body py-3">
                  {payError && <div className="alert alert-danger py-1 px-2 small mb-2">{payError}</div>}
                  {paySuccess && <div className="alert alert-success py-1 px-2 small mb-2">{paySuccess}</div>}
                  <div className="mb-2 small text-muted">
                    Type: <strong style={{ textTransform: 'capitalize' }}>{payingEmployee.employment_type || 'salary'}</strong>
                    {payingEmployee.pay_frequency && (
                      <> &middot; Freq: <strong style={{ textTransform: 'capitalize' }}>{payingEmployee.pay_frequency.replace('_', '-')}</strong></>
                    )}
                    {payingEmployee.insurance_plan && (
                      <> &middot; Insurance: <strong>{payingEmployee.insurance_plan}</strong></>
                    )}
                  </div>

                  {/* Period selector — varies by pay frequency */}
                  {payingEmployee.pay_frequency === 'weekly' ? (
                    <div className="mb-2">
                      <label className="form-label small mb-1">Select Week</label>
                      {payWeeksLoading ? (
                        <div className="text-muted small py-1">Loading weeks…</div>
                      ) : (
                        <select
                          className="form-select form-select-sm"
                          value={payForm.pay_period_start}
                          onChange={e => {
                            const week = availableWeeks.find(w => w.start === e.target.value);
                            if (week) setPayForm(f => ({ ...f, pay_period_start: week.start, pay_period_end: week.end }));
                          }}
                          required
                        >
                          <option value="">— Select a week —</option>
                          {availableWeeks.map(w => (
                            <option key={w.start} value={w.start} disabled={w.isPaid}>
                              {w.label}{w.isPaid ? ' ✓ Paid' : ''}
                            </option>
                          ))}
                        </select>
                      )}
                      {payForm.pay_period_start && (
                        <div className="text-muted small mt-1">{payForm.pay_period_start} → {payForm.pay_period_end}</div>
                      )}
                    </div>
                  ) : payingEmployee.pay_frequency === 'daily' ? (
                    <div className="mb-2">
                      <label className="form-label small mb-1">Payment Date</label>
                      <input
                        type="date"
                        className="form-control form-control-sm"
                        value={payForm.pay_period_start}
                        onChange={e => setPayForm(f => ({ ...f, pay_period_start: e.target.value, pay_period_end: e.target.value }))}
                        required
                      />
                    </div>
                  ) : (
                    <>
                      <div className="mb-2">
                        <label className="form-label small mb-1">Pay Period Start</label>
                        <input
                          type="date"
                          className="form-control form-control-sm"
                          value={payForm.pay_period_start}
                          onChange={e => setPayForm(f => ({ ...f, pay_period_start: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="mb-2">
                        <label className="form-label small mb-1">Pay Period End</label>
                        <input
                          type="date"
                          className="form-control form-control-sm"
                          value={payForm.pay_period_end}
                          min={payForm.pay_period_start || undefined}
                          onChange={e => setPayForm(f => ({ ...f, pay_period_end: e.target.value }))}
                          required
                        />
                      </div>
                    </>
                  )}
                  {payingEmployee.employment_type === 'hourly' ? (
                    <div className="mb-2">
                      <label className="form-label small mb-1">Hours Worked</label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        placeholder="0"
                        min="0"
                        step="0.25"
                        value={payForm.hours_worked}
                        onChange={e => setPayForm(f => ({ ...f, hours_worked: e.target.value }))}
                        required
                      />
                      {payingEmployee.hourly_rate && (
                        <div className="text-muted small mt-1">Rate: ${payingEmployee.hourly_rate}/hr</div>
                      )}
                    </div>
                  ) : (
                    <div className="mb-2">
                      <label className="form-label small mb-1">Gross Amount ($)</label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        value={payForm.gross_amount}
                        onChange={e => setPayForm(f => ({ ...f, gross_amount: e.target.value }))}
                      />
                      <div className="text-muted small mt-1">Leave blank to use employee salary</div>
                    </div>
                  )}
                  <div className="mb-2">
                    <label className="form-label small mb-1">Other Deductions ($)</label>
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      value={payForm.other_deductions}
                      onChange={e => setPayForm(f => ({ ...f, other_deductions: e.target.value }))}
                    />
                  </div>
                  <div className="mb-0">
                    <label className="form-label small mb-1">Notes (optional)</label>
                    <textarea
                      className="form-control form-control-sm"
                      rows="2"
                      value={payForm.notes}
                      onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="modal-footer py-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => { setShowPayModal(false); setPayError(''); }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-sm btn-success" disabled={payLoading}>
                    {payLoading ? 'Processing…' : 'Process Payment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Employee Chat Modal */}
      {showChatModal && chattingEmployee && (
        <Chat_Employee
          employee={chattingEmployee}
          currentUser={currentUser}
          onClose={() => { setShowChatModal(false); setChattingEmployee(null); loadUnreadCounts(); }}
        />
      )}

      {/* Insurance Plans Modal */}
      <Modal_Insurance_Plans
        isOpen={showInsuranceModal}
        onClose={() => setShowInsuranceModal(false)}
        insurancePlans={insurancePlans}
        editingPlan={editingPlan}
        setEditingPlan={setEditingPlan}
        newPlan={newPlan}
        setNewPlan={setNewPlan}
        insurancePlansLoading={insurancePlansLoading}
        insuranceError={insuranceError}
        onSave={handleInsurancePlanSave}
        onDelete={handleInsurancePlanDelete}
        onToggle={handleInsurancePlanToggle}
      />

      {/* Wages Modal */}
      {showWagesModal && (
        <Modal_Wages
          employees={employees}
          onClose={() => setShowWagesModal(false)}
        />
      )}

    </div>
  );
}
