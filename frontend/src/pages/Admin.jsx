import React, { useState, useEffect } from 'react';
import useStore from '../store/useStore';
import api from '../services/api';

const Admin = () => {
  const { user } = useStore();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showPermissions, setShowPermissions] = useState(false);
  const [userPermissions, setUserPermissions] = useState([]);
  
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    role: 'employee'
  });

  const [newPermission, setNewPermission] = useState({
    page: '',
    permission: 'read',
    granted: true
  });

  const pages = ['clients', 'inventory', 'suppliers', 'services', 'employees', 'schedule', 'attendance', 'documents', 'admin'];
  const permissions = ['read', 'write', 'delete', 'admin'];
  const roles = ['admin', 'manager', 'employee', 'viewer'];

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchUsers();
    }
  }, [user]);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/auth/users');
      setUsers(response.data);
    } catch (err) {
      setError('Failed to fetch users');
    }
  };

  const fetchUserPermissions = async (userId) => {
    try {
      const response = await api.get(`/auth/users/${userId}/permissions`);
      setUserPermissions(response.data);
    } catch (err) {
      setError('Failed to fetch user permissions');
    }
  };

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
      fetchUsers();
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
      fetchUsers();
    } catch (err) {
      setError('Failed to lock user');
    }
  };

  const handleUnlockUser = async (userId) => {
    try {
      await api.post(`/auth/users/${userId}/unlock`);
      setSuccess('User unlocked successfully!');
      fetchUsers();
    } catch (err) {
      setError('Failed to unlock user');
    }
  };

  const handleForcePasswordReset = async (userId) => {
    try {
      await api.post(`/auth/users/${userId}/force-password-reset`);
      setSuccess('User will be required to reset password on next login!');
      fetchUsers();
    } catch (err) {
      setError('Failed to force password reset');
    }
  };

  const handleCreatePermission = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.post(`/auth/users/${selectedUser.id}/permissions`, newPermission);
      setSuccess('Permission created successfully!');
      setNewPermission({
        page: '',
        permission: 'read',
        granted: true
      });
      fetchUserPermissions(selectedUser.id);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create permission');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePermission = async (permissionId) => {
    try {
      await api.delete(`/auth/users/${selectedUser.id}/permissions/${permissionId}`);
      setSuccess('Permission deleted successfully!');
      fetchUserPermissions(selectedUser.id);
    } catch (err) {
      setError('Failed to delete permission');
    }
  };

  const handleUpdatePermission = async (permissionId, updates) => {
    try {
      await api.put(`/auth/users/${selectedUser.id}/permissions/${permissionId}`, updates);
      setSuccess('Permission updated successfully!');
      fetchUserPermissions(selectedUser.id);
    } catch (err) {
      setError('Failed to update permission');
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-sm text-red-700">Access denied. Admin privileges required.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="bg-white shadow rounded-lg">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
            <button
              onClick={() => setShowCreateUser(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
            >
              Create User
            </button>
          </div>
        </div>

        <div className="p-6 space-y-8">
          {/* Users Table */}
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-4">Users</h2>
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
                  {users.map((userItem) => (
                    <tr key={userItem.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {userItem.first_name} {userItem.last_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {userItem.username}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {userItem.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                        {userItem.role}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          userItem.is_locked 
                            ? 'bg-red-100 text-red-800' 
                            : userItem.is_active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                        }`}>
                          {userItem.is_locked ? 'Locked' : userItem.is_active ? 'Active' : 'Inactive'}
                        </span>
                        {userItem.force_password_reset && (
                          <span className="ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                            Reset Required
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                          onClick={() => {
                            setSelectedUser(userItem);
                            setShowPermissions(true);
                            fetchUserPermissions(userItem.id);
                          }}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          Permissions
                        </button>
                        {userItem.is_locked ? (
                          <button
                            onClick={() => handleUnlockUser(userItem.id)}
                            className="text-green-600 hover:text-green-900"
                          >
                            Unlock
                          </button>
                        ) : (
                          <button
                            onClick={() => handleLockUser(userItem.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Lock
                          </button>
                        )}
                        <button
                          onClick={() => handleForcePasswordReset(userItem.id)}
                          className="text-yellow-600 hover:text-yellow-900"
                        >
                          Force Reset
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

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

          {/* Permissions Modal */}
          {showPermissions && selectedUser && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
              <div className="relative top-10 mx-auto p-5 border w-3/4 shadow-lg rounded-md bg-white">
                <div className="mt-3">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      Permissions for {selectedUser.first_name} {selectedUser.last_name}
                    </h3>
                    <button
                      onClick={() => setShowPermissions(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </button>
                  </div>
                  
                  {/* Current Permissions */}
                  <div className="mb-6">
                    <h4 className="text-md font-medium text-gray-900 mb-3">Current Permissions</h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Page</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Permission</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {userPermissions.map((permission) => (
                            <tr key={permission.id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {permission.page}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {permission.permission}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  permission.granted ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {permission.granted ? 'Granted' : 'Denied'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                <button
                                  onClick={() => handleUpdatePermission(permission.id, { granted: !permission.granted })}
                                  className="text-indigo-600 hover:text-indigo-900"
                                >
                                  {permission.granted ? 'Deny' : 'Grant'}
                                </button>
                                <button
                                  onClick={() => handleDeletePermission(permission.id)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Add New Permission */}
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-3">Add New Permission</h4>
                    <form onSubmit={handleCreatePermission} className="flex space-x-4 items-end">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Page</label>
                        <select
                          value={newPermission.page}
                          onChange={(e) => setNewPermission({...newPermission, page: e.target.value})}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                          required
                        >
                          <option value="">Select Page</option>
                          {pages.map(page => (
                            <option key={page} value={page}>{page}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Permission</label>
                        <select
                          value={newPermission.permission}
                          onChange={(e) => setNewPermission({...newPermission, permission: e.target.value})}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                          required
                        >
                          {permissions.map(perm => (
                            <option key={perm} value={perm}>{perm}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={newPermission.granted}
                          onChange={(e) => setNewPermission({...newPermission, granted: e.target.checked})}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                        <label className="ml-2 block text-sm text-gray-900">Granted</label>
                      </div>
                      <button
                        type="submit"
                        disabled={loading}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {loading ? 'Adding...' : 'Add Permission'}
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
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
        </div>
      </div>
    </div>
  );
};

export default Admin;

