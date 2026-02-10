import React, { useState, useEffect } from 'react';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  PlusIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export default function DatabaseConnectionManager() {
  const [connections, setConnections] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    environment: 'development',
    host: '',
    port: 5432,
    database_name: '',
    username: '',
    password: '',
    ssl_mode: 'require',
    is_active: true,
    visible_to_users: false,
    description: '',
    external_url: '',
    internal_url: '',
    pool_size: 10,
    max_overflow: 20
  });

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    try {
      setLoading(true);
      setError(''); // Clear any previous errors
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/v1/database-connections/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConnections(response.data);
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message || 'Failed to load database connections';
      setError(errorMsg);
      console.error('Error loading connections:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleToggleVisibility = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await axios.patch(
        `${API_BASE_URL}/api/v1/database-connections/${id}/toggle-visibility`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccess('Visibility updated successfully');
      setTimeout(() => setSuccess(''), 3000);
      loadConnections();
    } catch (err) {
      setError('Failed to toggle visibility');
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this database connection?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE_URL}/api/v1/database-connections/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess('Connection deleted successfully');
      setTimeout(() => setSuccess(''), 3000);
      loadConnections();
    } catch (err) {
      setError('Failed to delete connection');
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_BASE_URL}/api/v1/database-connections/`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccess('Connection added successfully');
      setTimeout(() => setSuccess(''), 3000);
      setShowAddModal(false);
      resetForm();
      loadConnections();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add connection');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      environment: 'development',
      host: '',
      port: 5432,
      database_name: '',
      username: '',
      password: '',
      ssl_mode: 'require',
      is_active: true,
      visible_to_users: false,
      description: '',
      external_url: '',
      internal_url: '',
      pool_size: 10,
      max_overflow: 20
    });
  };

  const getEnvironmentBadgeColor = (env) => {
    switch (env.toLowerCase()) {
      case 'production':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'test':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          Database Connections
        </h3>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary btn-sm d-flex align-items-center gap-1"
        >
          <PlusIcon className="h-4 w-4" />
          Add Connection
        </button>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="alert alert-success mb-3">{success}</div>
      )}
      {error && (
        <div className="alert alert-danger mb-3">{error}</div>
      )}

      {/* Loading State */}
      {loading && !connections.length ? (
        <div className="text-center py-8">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : null}

      {/* Connections List - Accordion Style */}
      {!loading && (
        <div className="space-y-2">
          {connections.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No database connections configured. Click "Add Connection" to create one.
            </div>
          ) : (
          connections.map((conn) => (
            <div
              key={conn.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
            >
              {/* Accordion Header */}
              <div
                className="bg-gray-50 dark:bg-gray-800 p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
                onClick={() => handleToggleExpand(conn.id)}
              >
                <div className="d-flex justify-content-between align-items-center">
                  <div className="d-flex align-items-center gap-2 flex-grow-1">
                    {expandedId === conn.id ? (
                      <ChevronUpIcon className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                    )}
                    <span className="font-medium text-gray-900 dark:text-white">
                      {conn.name}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getEnvironmentBadgeColor(conn.environment)}`}>
                      {conn.environment}
                    </span>
                    {!conn.is_active && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                        Inactive
                      </span>
                    )}
                  </div>
                  
                  {/* Visibility Toggle */}
                  <div className="d-flex align-items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleToggleVisibility(conn.id)}
                      className={`btn btn-sm ${conn.visible_to_users ? 'btn-success' : 'btn-outline-secondary'}`}
                      title={conn.visible_to_users ? 'Visible to users' : 'Hidden from users'}
                    >
                      {conn.visible_to_users ? (
                        <EyeIcon className="h-4 w-4" />
                      ) : (
                        <EyeSlashIcon className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(conn.id)}
                      className="btn btn-sm btn-outline-danger"
                      title="Delete connection"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Accordion Body */}
              {expandedId === conn.id && (
                <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Host:</span>
                      <span className="ml-2 text-gray-600 dark:text-gray-400">{conn.host}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Port:</span>
                      <span className="ml-2 text-gray-600 dark:text-gray-400">{conn.port}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Database:</span>
                      <span className="ml-2 text-gray-600 dark:text-gray-400">{conn.database_name}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Username:</span>
                      <span className="ml-2 text-gray-600 dark:text-gray-400">{conn.username}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">SSL Mode:</span>
                      <span className="ml-2 text-gray-600 dark:text-gray-400">{conn.ssl_mode}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Pool Size:</span>
                      <span className="ml-2 text-gray-600 dark:text-gray-400">{conn.pool_size}</span>
                    </div>
                    {conn.description && (
                      <div className="col-span-2">
                        <span className="font-medium text-gray-700 dark:text-gray-300">Description:</span>
                        <p className="mt-1 text-gray-600 dark:text-gray-400">{conn.description}</p>
                      </div>
                    )}
                    {conn.external_url && (
                      <div className="col-span-2">
                        <span className="font-medium text-gray-700 dark:text-gray-300">External URL:</span>
                        <p className="mt-1 text-gray-600 dark:text-gray-400 font-mono text-xs break-all">{conn.external_url}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
          )}
        </div>
      )}

      {/* Add Connection Modal */}
      {showAddModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Add Database Connection</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowAddModal(false)}
                ></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="row g-3">
                    {/* Name */}
                    <div className="col-md-6">
                      <label className="form-label">Connection Name *</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., Production DB"
                        required
                      />
                    </div>

                    {/* Environment */}
                    <div className="col-md-6">
                      <label className="form-label">Environment *</label>
                      <select
                        className="form-select"
                        value={formData.environment}
                        onChange={(e) => setFormData({ ...formData, environment: e.target.value })}
                        required
                      >
                        <option value="development">Development</option>
                        <option value="test">Test</option>
                        <option value="production">Production</option>
                      </select>
                    </div>

                    {/* Host */}
                    <div className="col-md-8">
                      <label className="form-label">Host *</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.host}
                        onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                        placeholder="localhost or render-hostname.com"
                        required
                      />
                    </div>

                    {/* Port */}
                    <div className="col-md-4">
                      <label className="form-label">Port *</label>
                      <input
                        type="number"
                        className="form-control"
                        value={formData.port}
                        onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                        required
                      />
                    </div>

                    {/* Database Name */}
                    <div className="col-md-6">
                      <label className="form-label">Database Name *</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.database_name}
                        onChange={(e) => setFormData({ ...formData, database_name: e.target.value })}
                        placeholder="business_manager"
                        required
                      />
                    </div>

                    {/* Username */}
                    <div className="col-md-6">
                      <label className="form-label">Username *</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        placeholder="postgres"
                        required
                      />
                    </div>

                    {/* Password */}
                    <div className="col-12">
                      <label className="form-label">Password *</label>
                      <input
                        type="password"
                        className="form-control"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required
                      />
                    </div>

                    {/* SSL Mode */}
                    <div className="col-md-6">
                      <label className="form-label">SSL Mode</label>
                      <select
                        className="form-select"
                        value={formData.ssl_mode}
                        onChange={(e) => setFormData({ ...formData, ssl_mode: e.target.value })}
                      >
                        <option value="require">Require</option>
                        <option value="prefer">Prefer</option>
                        <option value="disable">Disable</option>
                      </select>
                    </div>

                    {/* Pool Size */}
                    <div className="col-md-6">
                      <label className="form-label">Pool Size</label>
                      <input
                        type="number"
                        className="form-control"
                        value={formData.pool_size}
                        onChange={(e) => setFormData({ ...formData, pool_size: parseInt(e.target.value) })}
                      />
                    </div>

                    {/* External URL (Render) */}
                    <div className="col-12">
                      <label className="form-label">External URL (Optional - Render)</label>
                      <input
                        type="text"
                        className="form-control font-monospace"
                        value={formData.external_url}
                        onChange={(e) => setFormData({ ...formData, external_url: e.target.value })}
                        placeholder="postgres://user:pass@host/db"
                      />
                    </div>

                    {/* Description */}
                    <div className="col-12">
                      <label className="form-label">Description</label>
                      <textarea
                        className="form-control"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows="2"
                        placeholder="Optional description"
                      />
                    </div>

                    {/* Checkboxes */}
                    <div className="col-12">
                      <div className="form-check">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          id="isActive"
                          checked={formData.is_active}
                          onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        />
                        <label className="form-check-label" htmlFor="isActive">
                          Active
                        </label>
                      </div>
                      <div className="form-check">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          id="visibleToUsers"
                          checked={formData.visible_to_users}
                          onChange={(e) => setFormData({ ...formData, visible_to_users: e.target.checked })}
                        />
                        <label className="form-check-label" htmlFor="visibleToUsers">
                          Visible to Users (show in profile)
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowAddModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? 'Adding...' : 'Add Connection'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
