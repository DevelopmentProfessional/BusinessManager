import React, { useState, useEffect } from 'react';
import { Tab } from '@headlessui/react';
import { UserIcon, KeyIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { employeesAPI } from '../services/api';
import useStore from '../store/useStore';

// Available pages and their permissions
const AVAILABLE_PAGES = [
  { id: 'clients', name: 'Clients', description: 'Manage client information' },
  { id: 'inventory', name: 'Inventory', description: 'Manage inventory and items' },
  { id: 'services', name: 'Services', description: 'Manage services offered' },
  { id: 'employees', name: 'Employees', description: 'Manage employee information' },
  { id: 'schedule', name: 'Schedule', description: 'Manage appointments and scheduling' },
  { id: 'attendance', name: 'Attendance', description: 'Track employee attendance' },
  { id: 'documents', name: 'Documents', description: 'Manage documents and files' },
  { id: 'admin', name: 'Admin', description: 'System administration' },
];

const PERMISSION_TYPES = [
  { id: 'read', name: 'View', description: 'Can view this page' },
  { id: 'write', name: 'Edit', description: 'Can create and edit items' },
  { id: 'delete', name: 'Delete', description: 'Can delete items' },
  { id: 'admin', name: 'Admin', description: 'Full administrative access' },
];

// Special permissions that don't follow the standard pattern
const SPECIAL_PERMISSIONS = [
  { pageId: 'schedule', id: 'view_all', name: 'View All Appointments', description: 'Can view appointments for all employees' },
];

export default function EmployeeForm({ employee, onSubmit, onCancel }) {
  const { user: currentUser, updateEmployeePermissions, handlePermissionChange } = useStore();
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState(null);
  const [userPermissions, setUserPermissions] = useState([]);
  const [linkedUser, setLinkedUser] = useState(null);
  
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    role: '',
    hire_date: '',
    is_active: true
  });

  const [userCredentials, setUserCredentials] = useState({
    username: '',
    email: '',
    password: '',
    confirm_password: '',
    role: 'employee',
    is_active: true
  });

  const [permissions, setPermissions] = useState({});
  const [permissionsVersion, setPermissionsVersion] = useState(0);
  const [updatingPermission, setUpdatingPermission] = useState(null);
  const [updatedPermission, setUpdatedPermission] = useState(null);

  // Initialize permissions state
  useEffect(() => {
    const initialPermissions = {};
    AVAILABLE_PAGES.forEach(page => {
      initialPermissions[page.id] = {};
      PERMISSION_TYPES.forEach(perm => {
        initialPermissions[page.id][perm.id] = false;
      });
    });
    
    // Add special permissions
    SPECIAL_PERMISSIONS.forEach(specialPerm => {
      if (!initialPermissions[specialPerm.pageId]) {
        initialPermissions[specialPerm.pageId] = {};
      }
      initialPermissions[specialPerm.pageId][specialPerm.id] = false;
    });
    
    setPermissions(initialPermissions);
  }, []);



  useEffect(() => {
    if (employee) {
      console.log('EmployeeForm: Employee data received:', employee);
      
      setFormData({
        first_name: employee.first_name || '',
        last_name: employee.last_name || '',
        email: employee.email || '',
        phone: employee.phone || '',
        role: employee.role || '',
        hire_date: employee.hire_date ? new Date(employee.hire_date).toISOString().split('T')[0] : '',
        is_active: employee.is_active !== undefined ? employee.is_active : true
      });

      // Load permissions directly from employee data
      const newPermissions = {};
      AVAILABLE_PAGES.forEach(page => {
        newPermissions[page.id] = {};
        PERMISSION_TYPES.forEach(perm => {
          const permissionField = `${page.id}_${perm.id}`;
          const permissionValue = employee[permissionField];
          newPermissions[page.id][perm.id] = permissionValue || false;
        });
      });
      
      // Load special permissions
      SPECIAL_PERMISSIONS.forEach(specialPerm => {
        if (!newPermissions[specialPerm.pageId]) {
          newPermissions[specialPerm.pageId] = {};
        }
        const permissionField = `${specialPerm.pageId}_${specialPerm.id}`;
        const permissionValue = employee[permissionField];
        newPermissions[specialPerm.pageId][specialPerm.id] = permissionValue || false;
      });
      
      setPermissions(newPermissions);
      setPermissionsVersion(prev => prev + 1); // Force re-render

      // Load linked user data if employee has user_id and current user is admin
      if (employee.user_id && currentUser?.role === 'admin') {
        console.log('EmployeeForm: Loading linked user data for user_id:', employee.user_id);
        loadLinkedUserData(employee.user_id);
      } else {
        console.log('EmployeeForm: No user_id found or not admin, resetting user credentials');
        console.log('EmployeeForm: employee.user_id:', employee.user_id);
        console.log('EmployeeForm: currentUser.role:', currentUser?.role);
        // Reset user credentials if no linked user or not admin
        setLinkedUser(null);
        setUserCredentials({
          username: '',
          email: '',
          password: '',
          confirm_password: '',
          role: 'employee',
          is_active: true
        });
        setUserPermissions([]);
      }
    }
  }, [employee]);

  const loadLinkedUserData = async (userId) => {
    // Only load if we haven't already loaded this user's data
    if (linkedUser && linkedUser.id === userId) {
      return;
    }
    
    try {
      setLoading(true);
      
      // Convert userId to string if it's a UUID object
      const userIdStr = typeof userId === 'string' ? userId : userId.toString();
      
      // Load user data
      const userResponse = await employeesAPI.getUserData(userIdStr);
      const user = userResponse.data;
      setLinkedUser(user);
      setUserCredentials({
        username: user.username || '',
        email: user.email || '',
        password: '',
        confirm_password: '',
        role: user.role || 'employee',
        is_active: user.is_active !== undefined ? user.is_active : true
      });

      // Load user permissions (for display only, not for editing)
      try {
        const permissionsResponse = await employeesAPI.getUserPermissions(userIdStr);
        const permissionsData = permissionsResponse.data;
        setUserPermissions(permissionsData);
      } catch (error) {
        setUserPermissions([]);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      // If user doesn't exist or other error, just continue without user data
      setLinkedUser(null);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleUserCredentialsChange = (e) => {
    const { name, value, type, checked } = e.target;
    setUserCredentials(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handlePermissionToggle = async (pageId, permissionId, checked) => {
    // Set updating state
    setUpdatingPermission(`${pageId}_${permissionId}`);
    
    // If editing an existing employee, update permissions immediately
    if (employee && employee.id) {
      const employeeId = typeof employee.id === 'string' ? employee.id : employee.id.toString();
      
      try {
        const permissionField = `${pageId}_${permissionId}`;
        const updateData = {
          [permissionField]: checked
        };
        
        // Update the store immediately for responsive UI
        await handlePermissionChange(employeeId, permissionField, checked);
        
        const response = await employeesAPI.update(employeeId, updateData);
        
        // Update local state with the response data to ensure consistency
        const updatedEmployee = response.data;
        const newPermissions = {};
        AVAILABLE_PAGES.forEach(page => {
          newPermissions[page.id] = {};
          PERMISSION_TYPES.forEach(perm => {
            const permField = `${page.id}_${perm.id}`;
            newPermissions[page.id][perm.id] = updatedEmployee[permField] || false;
          });
        });
        
        // Add special permissions
        SPECIAL_PERMISSIONS.forEach(specialPerm => {
          if (!newPermissions[specialPerm.pageId]) {
            newPermissions[specialPerm.pageId] = {};
          }
          const permField = `${specialPerm.pageId}_${specialPerm.id}`;
          newPermissions[specialPerm.pageId][specialPerm.id] = updatedEmployee[permField] || false;
        });
        
        setPermissions(newPermissions);
        setPermissionsVersion(prev => prev + 1);
        setUpdatedPermission(`${pageId}_${permissionId}`);
        
        // Update the store to reflect changes across all components
        updateEmployeePermissions(employeeId, updatedEmployee);
        
        // Clear success indicator after 2 seconds
        setTimeout(() => setUpdatedPermission(null), 2000);
        
      } catch (error) {
        console.error(`Error updating permission ${pageId}:${permissionId}:`, error);
        alert(`Failed to update permission: ${error.response?.data?.detail || error.message}`);
      } finally {
        setUpdatingPermission(null);
      }
    } else {
      // For new employees, just update local state
      const newPermissions = {
        ...permissions,
        [pageId]: {
          ...permissions[pageId],
          [permissionId]: checked
        }
      };
      setPermissions(newPermissions);
      setPermissionsVersion(prev => prev + 1);
      setUpdatingPermission(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate form data
      if (!formData.first_name || !formData.last_name || !formData.email || !formData.role || !formData.hire_date) {
        throw new Error('Please fill in all required employee fields');
      }

      // Validate user credentials if provided
      if (userCredentials.username || userCredentials.email) {
        if (!userCredentials.username || !userCredentials.email) {
          throw new Error('Please fill in all required user credential fields');
        }
        
        if (!employee && (!userCredentials.password || !userCredentials.confirm_password)) {
          throw new Error('Password is required for new users');
        }
        
        if (userCredentials.password && userCredentials.password !== userCredentials.confirm_password) {
          throw new Error('Passwords do not match');
        }
        
        if (userCredentials.password && userCredentials.password.length < 6) {
          throw new Error('Password must be at least 6 characters long');
        }
      }

      // Prepare employee data with permissions
      const employeeData = {
        ...formData,
        hire_date: new Date(formData.hire_date).toISOString()
      };

      // Add permission fields to employee data
      AVAILABLE_PAGES.forEach(page => {
        PERMISSION_TYPES.forEach(perm => {
          const permissionField = `${page.id}_${perm.id}`;
          employeeData[permissionField] = permissions[page.id]?.[perm.id] || false;
        });
      });
      
      // Add special permissions
      SPECIAL_PERMISSIONS.forEach(specialPerm => {
        const permissionField = `${specialPerm.pageId}_${specialPerm.id}`;
        employeeData[permissionField] = permissions[specialPerm.pageId]?.[specialPerm.id] || false;
      });

      // Submit employee data with permissions
      await onSubmit(employeeData);
    } catch (error) {
      console.error('Error submitting form:', error);
      alert(error.message || 'An error occurred while saving the employee');
    } finally {
      setLoading(false);
    }
  };

  const handleUserAccountUpdate = async () => {
    // Check if current user is admin
    if (currentUser?.role !== 'admin') {
      alert('Only administrators can update user accounts');
      return;
    }

    if (!employee || !employee.user_id) {
      alert('No employee or user account selected for update');
      return;
    }

    setLoading(true);
    try {
      // Validate user credentials
      if (!userCredentials.username || !userCredentials.email) {
        throw new Error('Please fill in all required user credential fields');
      }
      
      if (userCredentials.password && userCredentials.password !== userCredentials.confirm_password) {
        throw new Error('Passwords do not match');
      }
      
      if (userCredentials.password && userCredentials.password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }

      // Prepare user data
      const userData = {
        username: userCredentials.username,
        email: userCredentials.email,
        role: userCredentials.role,
        is_active: userCredentials.is_active,
        permissions: Object.entries(permissions).flatMap(([pageId, pagePerms]) =>
          Object.entries(pagePerms)
            .filter(([permId, granted]) => granted)
            .map(([permId]) => ({
              page: pageId,
              permission: permId,
              granted: true
            }))
        )
      };

      // Add password only if provided
      if (userCredentials.password) {
        userData.password = userCredentials.password;
      }

      // Update user account
      const response = await employeesAPI.updateUserAccount(employee.id, userData);
      alert('User account updated successfully!');
      
      // Reload user data
      if (employee.user_id) {
        await loadLinkedUserData(employee.user_id);
      }
      
    } catch (error) {
      console.error('Error updating user account:', error);
      alert(error.response?.data?.detail || error.message || 'An error occurred while updating the user account');
    } finally {
      setLoading(false);
    }
  };

  const handleUserAccountCreate = async () => {
    // Check if current user is admin
    if (currentUser?.role !== 'admin') {
      alert('Only administrators can create user accounts');
      return;
    }

    if (!employee) {
      alert('No employee selected for user account creation');
      return;
    }

    setLoading(true);
    try {
      // Validate user credentials
      if (!userCredentials.username || !userCredentials.email || !userCredentials.password) {
        throw new Error('Please fill in all required user credential fields including password');
      }
      
      if (userCredentials.password !== userCredentials.confirm_password) {
        throw new Error('Passwords do not match');
      }
      
      if (userCredentials.password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }

      // Prepare user data
      const userData = {
        username: userCredentials.username,
        email: userCredentials.email,
        password: userCredentials.password,
        role: userCredentials.role,
        is_active: userCredentials.is_active,
        permissions: Object.entries(permissions).flatMap(([pageId, pagePerms]) =>
          Object.entries(pagePerms)
            .filter(([permId, granted]) => granted)
            .map(([permId]) => ({
              page: pageId,
              permission: permId,
              granted: true
            }))
        )
      };

      // Create user account
      const response = await employeesAPI.createUserAccount(employee.id, userData);
      alert('User account created successfully!');
      
      // Reload employee data to get the new user_id
      window.location.reload();
      
    } catch (error) {
      console.error('Error creating user account:', error);
      alert(error.response?.data?.detail || error.message || 'An error occurred while creating the user account');
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = currentUser?.role === 'admin';

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="text-center">
          <ShieldCheckIcon className="mx-auto h-12 w-12 text-red-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Access Denied</h3>
          <p className="mt-1 text-sm text-gray-500">
            Only administrators can manage employee profiles and permissions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900">
            {employee ? 'Edit Employee' : 'Add New Employee'}
          </h3>
          <p className="text-sm text-gray-500">
            Manage employee information. Use the tabs above to manage user accounts and permissions (admin only).
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <Tab.Group selectedIndex={activeTab} onChange={setActiveTab}>
        <Tab.List className="flex space-x-1 rounded-xl bg-blue-900/20 p-1">
          <Tab
            className={({ selected }) =>
              `w-full rounded-lg py-2.5 text-sm font-medium leading-5 text-blue-700
               ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2
               ${selected
                ? 'bg-white shadow'
                : 'text-blue-100 hover:bg-white/[0.12] hover:text-white'
               }`
            }
          >
            <div className="flex items-center justify-center space-x-2">
              <UserIcon className="h-4 w-4" />
              <span>Employee Info</span>
            </div>
          </Tab>
          {currentUser?.role === 'admin' && (
            <Tab
              className={({ selected }) =>
                `w-full rounded-lg py-2.5 text-sm font-medium leading-5 text-blue-700
                 ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2
                 ${selected
                  ? 'bg-white shadow'
                  : 'text-blue-100 hover:bg-white/[0.12] hover:text-white'
                 }`
              }
            >
              <div className="flex items-center justify-center space-x-2">
                <KeyIcon className="h-4 w-4" />
                <span>User Account</span>
              </div>
            </Tab>
          )}
          {currentUser?.role === 'admin' && (
            <Tab
              className={({ selected }) =>
                `w-full rounded-lg py-2.5 text-sm font-medium leading-5 text-blue-700
                 ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2
                 ${selected
                  ? 'bg-white shadow'
                  : 'text-blue-100 hover:bg-white/[0.12] hover:text-white'
                 }`
              }
            >
              <div className="flex items-center justify-center space-x-2">
                <ShieldCheckIcon className="h-4 w-4" />
                <span>Permissions</span>
              </div>
            </Tab>
          )}
        </Tab.List>

        <Tab.Panels className="mt-6">
          {/* Employee Information Tab */}
          <Tab.Panel>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="first_name" className="block text-sm font-medium text-gray-700">
                    First Name *
                  </label>
                  <input
                    type="text"
                    id="first_name"
                    name="first_name"
                    required
                    value={formData.first_name}
                    onChange={handleChange}
                    className="input-field mt-1"
                    placeholder="Enter first name"
                  />
                </div>

                <div>
                  <label htmlFor="last_name" className="block text-sm font-medium text-gray-700">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    id="last_name"
                    name="last_name"
                    required
                    value={formData.last_name}
                    onChange={handleChange}
                    className="input-field mt-1"
                    placeholder="Enter last name"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="input-field mt-1"
                  placeholder="Enter email address"
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                  Phone
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="input-field mt-1"
                  placeholder="Enter phone number"
                />
              </div>

              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                  Role *
                </label>
                <select
                  id="role"
                  name="role"
                  required
                  value={formData.role}
                  onChange={handleChange}
                  className="input-field mt-1"
                >
                  <option value="">Select a role</option>
                  <option value="Manager">Manager</option>
                  <option value="Technician">Technician</option>
                  <option value="Sales">Sales</option>
                  <option value="Support">Support</option>
                  <option value="Admin">Admin</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label htmlFor="hire_date" className="block text-sm font-medium text-gray-700">
                  Hire Date *
                </label>
                <input
                  type="date"
                  id="hire_date"
                  name="hire_date"
                  required
                  value={formData.hire_date}
                  onChange={handleChange}
                  className="input-field mt-1"
                />
              </div>

              <div className="flex items-center">
                <input
                  id="is_active"
                  name="is_active"
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={handleChange}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                  Employee is active
                </label>
              </div>
            </div>
          </Tab.Panel>

          {/* User Account Tab - Admin Only */}
          {currentUser?.role === 'admin' && (
            <Tab.Panel>
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center">
                  <KeyIcon className="h-5 w-5 text-blue-600 mr-2" />
                  <p className="text-sm text-blue-700">
                    <strong>User Account:</strong> Create or update user credentials for this employee.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                    Username *
                  </label>
                  <input
                    type="text"
                    id="username"
                    name="username"
                    required
                    value={userCredentials.username}
                    onChange={handleUserCredentialsChange}
                    className="input-field mt-1"
                    placeholder="Enter username"
                  />
                </div>

                <div>
                  <label htmlFor="user_email" className="block text-sm font-medium text-gray-700">
                    User Email *
                  </label>
                  <input
                    type="email"
                    id="user_email"
                    name="email"
                    required
                    value={userCredentials.email}
                    onChange={handleUserCredentialsChange}
                    className="input-field mt-1"
                    placeholder="Enter user email"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Password {employee ? '(leave blank to keep current)' : '*'}
                  </label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    required={!employee}
                    value={userCredentials.password}
                    onChange={handleUserCredentialsChange}
                    className="input-field mt-1"
                    placeholder="Enter password"
                  />
                </div>

                <div>
                  <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700">
                    Confirm Password {employee ? '(leave blank to keep current)' : '*'}
                  </label>
                  <input
                    type="password"
                    id="confirm_password"
                    name="confirm_password"
                    required={!employee}
                    value={userCredentials.confirm_password}
                    onChange={handleUserCredentialsChange}
                    className="input-field mt-1"
                    placeholder="Confirm password"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="user_role" className="block text-sm font-medium text-gray-700">
                  User Role *
                </label>
                <select
                  id="user_role"
                  name="role"
                  required
                  value={userCredentials.role}
                  onChange={handleUserCredentialsChange}
                  className="input-field mt-1"
                >
                  <option value="employee">Employee</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>

              <div className="flex items-center">
                <input
                  id="user_is_active"
                  name="is_active"
                  type="checkbox"
                  checked={userCredentials.is_active}
                  onChange={handleUserCredentialsChange}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="user_is_active" className="ml-2 block text-sm text-gray-900">
                  User account is active
                </label>
              </div>

              {/* User Account Action Buttons */}
              <div className="pt-4 border-t border-gray-200">
                {linkedUser ? (
                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={handleUserAccountUpdate}
                      disabled={loading}
                      className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors duration-200"
                    >
                      {loading ? 'Updating...' : 'Update User Account'}
                    </button>
                  </div>
                ) : (
                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={handleUserAccountCreate}
                      disabled={loading}
                      className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors duration-200"
                    >
                      {loading ? 'Creating...' : 'Create User Account'}
                    </button>
                  </div>
                )}
                <p className="mt-2 text-xs text-gray-500">
                  {linkedUser 
                    ? 'Update the user account credentials and permissions for this employee. This is separate from the employee information above.'
                    : 'Create a new user account for this employee with the specified credentials and permissions. This is separate from the employee information above.'
                  }
                </p>
              </div>
            </div>
          </Tab.Panel>
          )}

          {/* Permissions Tab - Admin Only */}
          {currentUser?.role === 'admin' && (
            <Tab.Panel>
            <div className="space-y-4">


              <div className="space-y-6">
                {AVAILABLE_PAGES.map((page) => (
                  <div key={page.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="mb-3">
                      <h4 className="text-sm font-medium text-gray-900">{page.name}</h4>
                      <p className="text-xs text-gray-500">{page.description}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {PERMISSION_TYPES.map((permission) => (
                        <div key={`${page.id}-${permission.id}-${permissionsVersion}`} className="flex items-center">
                          <input
                            id={`${page.id}-${permission.id}`}
                            type="checkbox"
                            checked={permissions[page.id]?.[permission.id] || false}
                            onChange={(e) => handlePermissionToggle(page.id, permission.id, e.target.checked)}
                            disabled={updatingPermission === `${page.id}_${permission.id}`}
                            className={`h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded ${
                              updatingPermission === `${page.id}_${permission.id}` ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                          />
                          <label htmlFor={`${page.id}-${permission.id}`} className="ml-2 block text-xs text-gray-900">
                            <div className="font-medium flex items-center">
                              {permission.name}
                              {updatingPermission === `${page.id}_${permission.id}` && (
                                <span className="ml-1 text-blue-600">●</span>
                              )}
                              {updatedPermission === `${page.id}_${permission.id}` && (
                                <span className="ml-1 text-green-600">✓</span>
                              )}
                            </div>
                            <div className="text-gray-500">{permission.description}</div>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                
                {/* Special Permissions */}
                {SPECIAL_PERMISSIONS.length > 0 && (
                  <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                    <div className="mb-3">
                      <h4 className="text-sm font-medium text-blue-900">Special Permissions</h4>
                      <p className="text-xs text-blue-700">Additional permissions for specific functionality</p>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-3">
                      {SPECIAL_PERMISSIONS.map((permission) => (
                        <div key={`${permission.pageId}-${permission.id}-${permissionsVersion}`} className="flex items-center">
                          <input
                            id={`${permission.pageId}-${permission.id}`}
                            type="checkbox"
                            checked={permissions[permission.pageId]?.[permission.id] || false}
                            onChange={(e) => handlePermissionToggle(permission.pageId, permission.id, e.target.checked)}
                            disabled={updatingPermission === `${permission.pageId}_${permission.id}`}
                            className={`h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded ${
                              updatingPermission === `${permission.pageId}_${permission.id}` ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                          />
                          <label htmlFor={`${permission.pageId}-${permission.id}`} className="ml-2 block text-sm text-blue-900">
                            <div className="font-medium flex items-center">
                              {permission.name}
                              {updatingPermission === `${permission.pageId}_${permission.id}` && (
                                <span className="ml-1 text-blue-600">●</span>
                              )}
                              {updatedPermission === `${permission.pageId}_${permission.id}` && (
                                <span className="ml-1 text-green-600">✓</span>
                              )}
                            </div>
                            <div className="text-blue-700">{permission.description}</div>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Tab.Panel>
          )}
        </Tab.Panels>
      </Tab.Group>


    </div>
  );
}
