import React from 'react';
import Modal from './Modal';
import { XMarkIcon } from '@heroicons/react/24/outline';
import Button_Toolbar from './Button_Toolbar';

export default function Modal_Permissions_User({
  isOpen,
  onClose,
  userPermissions,
  newPermission,
  setNewPermission,
  onCreatePermission,
  onDeletePermission,
  onUpdatePermission,
  onScheduleViewAllToggle,
  onScheduleWriteAllToggle,
  pages,
  permissions,
  isDarkMode,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} noPadding={true} fullScreen={true}>
      <div className="d-flex flex-column bg-white dark:bg-gray-900" style={{ height: '100%' }}>
        {/* Header */}
        <div className="flex-shrink-0 p-2 border-bottom border-gray-200 dark:border-gray-700 d-flex justify-content-between align-items-center">
          <h6 className="mb-0 fw-semibold text-gray-900 dark:text-gray-100">Manage Permissions</h6>
          <button type="button" onClick={onClose} className="btn btn-link p-0 text-muted">
            <XMarkIcon style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-grow-1 overflow-auto no-scrollbar px-3 pt-3">
          {/* Add New Permission Form */}
          <form onSubmit={onCreatePermission} className="mb-4 p-3 border rounded">
            <h5 className={`mb-3 ${isDarkMode ? 'text-light' : 'text-dark'}`}>Add New Permission</h5>
            <div className="row g-3">
              <div className="col-md-6">
                <select
                  value={newPermission.page}
                  onChange={(e) => setNewPermission({ ...newPermission, page: e.target.value })}
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
                  onChange={(e) => setNewPermission({ ...newPermission, permission: e.target.value })}
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
                      onChange={(e) => onScheduleViewAllToggle(e.target.checked)}
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
                      onChange={(e) => onScheduleWriteAllToggle(e.target.checked)}
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
                            onClick={() => onUpdatePermission(permission.id, !permission.granted)}
                            className={`btn btn-sm ${permission.granted ? 'btn-outline-warning' : 'btn-outline-success'}`}
                            title={permission.granted ? 'Deny Permission' : 'Grant Permission'}
                          >
                            <i className={`bi ${permission.granted ? 'bi-x-circle' : 'bi-check-circle'}`}></i>
                          </button>
                          <button
                            onClick={() => onDeletePermission(permission.id)}
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

        {/* Footer */}
        <div className="flex-shrink-0 pt-2 pb-4 px-3 border-top border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="d-flex align-items-center">
            <div style={{ width: 40 }} />
            <div className="flex-grow-1 d-flex gap-3 justify-content-center">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-outline-secondary btn-sm p-1 d-flex align-items-center justify-content-center"
                style={{ width: '3rem', height: '3rem' }}
                title="Close"
              >
                <XMarkIcon style={{ width: 18, height: 18 }} />
              </button>
            </div>
            <div style={{ width: 40 }} />
          </div>
        </div>
      </div>
    </Modal>
  );
}
