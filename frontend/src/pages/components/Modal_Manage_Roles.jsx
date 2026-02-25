import React from 'react';
import Modal from './Modal';
import { XMarkIcon } from '@heroicons/react/24/outline';

export default function Modal_Manage_Roles({
  isOpen,
  onClose,
  availableRoles,
  newRole,
  setNewRole,
  editingRole,
  setEditingRole,
  newRolePermission,
  setNewRolePermission,
  onCreateRole,
  onDeleteRole,
  onAddRolePermission,
  onRemoveRolePermission,
  pages,
  permissions,
  isDarkMode,
  error,
  success,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} noPadding={true} fullScreen={true}>
      <div className="d-flex flex-column bg-white dark:bg-gray-900" style={{ height: '100%' }}>
        {/* Header */}
        <div className="flex-shrink-0 p-2 border-bottom border-gray-200 dark:border-gray-700 d-flex justify-content-between align-items-center">
          <h6 className="mb-0 fw-semibold text-gray-900 dark:text-gray-100">Manage Roles</h6>
          <button type="button" onClick={onClose} className="btn btn-link p-0 text-muted">
            <XMarkIcon style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-grow-1 overflow-auto no-scrollbar px-3 pt-3">
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
          <form onSubmit={onCreateRole} className="mb-4 p-3 border rounded">
            <h5 className={`mb-3 ${isDarkMode ? 'text-light' : 'text-dark'}`}>Create New Role</h5>
            <div className="row g-3">
              <div className="col-md-5">
                <input
                  type="text"
                  value={newRole.name}
                  onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                  className="form-control"
                  placeholder="Role Name"
                  required
                />
              </div>
              <div className="col-md-5">
                <input
                  type="text"
                  value={newRole.description}
                  onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
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
                          onClick={() => onDeleteRole(role.id)}
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
                                onClick={() => onRemoveRolePermission(role.id, perm.id)}
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
                            setNewRolePermission({ ...newRolePermission, page: e.target.value });
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
                            setNewRolePermission({ ...newRolePermission, permission: e.target.value });
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
                          onClick={() => onAddRolePermission(role.id)}
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
