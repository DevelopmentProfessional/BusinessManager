/*
 * ============================================================
 * FILE: Modal_Manage_Roles.jsx
 *
 * PURPOSE:
 *   Full-screen modal for creating and managing application roles and their permissions.
 *   Allows admins to create new roles, delete non-system roles, and assign or remove
 *   page-level permissions from each role inline.
 *
 * FUNCTIONAL PARTS:
 *   [1] Header — title bar with close button
 *   [2] Status Messages — error and success alert banners
 *   [3] Create New Role Form — name and description inputs with submit button
 *   [4] Existing Roles List — per-role card with permissions badges and add-permission selectors
 *   [5] Footer — centered close button
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-03-01 | Claude  | Added section comments and top-level documentation
 * ============================================================
 */

import React from "react";
import Modal from "./Modal";
import { XMarkIcon, PlusIcon } from "@heroicons/react/24/outline";
import Button_Toolbar from "./Button_Toolbar";
import Dropdown_Custom from "./Dropdown_Custom";

export default function Modal_Manage_Roles({ isOpen, onClose, availableRoles, newRole, setNewRole, editingRole, setEditingRole, newRolePermission, setNewRolePermission, onCreateRole, onDeleteRole, onAddRolePermission, onRemoveRolePermission, pages, permissions, isDarkMode, error, success }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} noPadding fullScreen>
      <div className="ui-component-shell">
        <div className="component-header">
          <div className="component-header-left">Manage Roles</div>
          <div className="component-header-center"></div>
          <div className="component-header-right"></div>
        </div>

        <div className="component-body">
          <div className="component-body-inner">
          {error && (
            <div className="bg-red-50 border border-red-200 mb-4 p-1 rounded-md">
              <div className="text-red-700 text-sm">{error}</div>
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 mb-4 p-1 rounded-md">
              <div className="text-green-700 text-sm">{success}</div>
            </div>
          )}

          {/* ─── 3 CREATE NEW ROLE FORM ─────────────────────────────────────────── */}
          {/* Create New Role Form */}
          <form onSubmit={onCreateRole} className="border mb-4 p-1 rounded">
            <h5 className={`mb-3 ${isDarkMode ? "text-light" : "text-dark"}`}>Create New Role</h5>
            <div className="g-3 row">
              <div className="col-md-5">
                <input type="text" value={newRole.name} onChange={(e) => setNewRole({ ...newRole, name: e.target.value })} className="form-control" placeholder="Role Name" required />
              </div>
              <div className="col-md-5">
                <input type="text" value={newRole.description} onChange={(e) => setNewRole({ ...newRole, description: e.target.value })} className="form-control" placeholder="Description (optional)" />
              </div>
              <div className="col-md-2">
                <button type="submit" className="btn btn-primary w-100">
                  Create
                </button>
              </div>
            </div>
          </form>

          {/* ─── 4 EXISTING ROLES LIST ──────────────────────────────────────────── */}
          {/* Existing Roles List */}
          <div className="mt-4">
            <h5 className={`mb-3 ${isDarkMode ? "text-light" : "text-dark"}`}>Existing Roles</h5>
            {availableRoles.length === 0 ? (
              <p className="text-muted">No roles defined yet. Create one above.</p>
            ) : (
              <div className="space-y-4">
                {availableRoles.map((role) => (
                  <div key={role.id} className="border p-1 rounded">
                    <div className="align-items-start d-flex justify-content-between mb-2">
                      <div>
                        <h6 className={`mb-1 ${isDarkMode ? "text-light" : "text-dark"}`}>
                          {role.name}
                          {role.is_system && <span className="badge bg-secondary ms-2">System</span>}
                        </h6>
                        {role.description && <small className="text-muted">{role.description}</small>}
                      </div>
                      {!role.is_system && (
                        <button type="button" onClick={() => onDeleteRole(role.id)} className="btn btn-outline-danger btn-sm" title="Delete Role">
                          Delete
                        </button>
                      )}
                    </div>

                    {/* Role Permissions */}
                    <div className="mt-2">
                      <small className={`d-block mb-2 ${isDarkMode ? "text-light" : "text-muted"}`}>
                        <strong>Permissions:</strong>
                      </small>
                      <div className="d-flex flex-wrap gap-1 mb-2">
                        {role.role_permissions?.length > 0 ? (
                          role.role_permissions.map((perm) => (
                            <span key={perm.id} className="align-items-center badge bg-secondary d-flex gap-1">
                              {perm.page}:{perm.permission}
                              <button type="button" onClick={() => onRemoveRolePermission(role.id, perm.id)} className="btn-close btn-close-white ms-1" style={{ fontSize: "0.5rem" }} title="Remove permission" />
                            </span>
                          ))
                        ) : (
                          <span className="text-muted">No permissions assigned</span>
                        )}
                      </div>

                      {/* Add Permission to Role */}
                      <div className="d-flex gap-2 mt-2">
                        <Dropdown_Custom
                          value={editingRole === role.id ? newRolePermission.page : ""}
                          onChange={(e) => {
                            setEditingRole(role.id);
                            setNewRolePermission({ ...newRolePermission, page: e.target.value });
                          }}
                          className="form-select ui-control-sm"
                          style={{ maxWidth: "150px" }}
                          options={[
                            { value: "", label: "Page..." },
                            ...pages.map((page) => ({ value: page, label: page })),
                          ]}
                        />
                        <Dropdown_Custom
                          value={editingRole === role.id ? newRolePermission.permission : ""}
                          onChange={(e) => {
                            setEditingRole(role.id);
                            setNewRolePermission({ ...newRolePermission, permission: e.target.value });
                          }}
                          className="form-select ui-control-sm"
                          style={{ maxWidth: "150px" }}
                          options={[
                            { value: "", label: "Permission..." },
                            ...permissions.map((perm) => ({ value: perm, label: perm })),
                          ]}
                        />
                        <button type="button" onClick={() => onAddRolePermission(role.id)} className="align-items-center btn btn-outline-primary btn-sm d-flex gap-2" disabled={editingRole !== role.id || !newRolePermission.page || !newRolePermission.permission}>
                          <PlusIcon className="ui-icon-4" />
                          <span>Add</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>{/* /roles list */}
          </div>{/* /component-body-inner */}
        </div>{/* /component-body */}

        {/* ─── 5 FOOTER ───────────────────────────────────────────────────────── */}
        <div className="component-footer">
          <div className="component-footer-left"></div>
          <div className="component-footer-center">
            <button type="button" onClick={onClose} className="btn ui-btn-circle-outline-secondary" title="Close">
              <XMarkIcon />
            </button>
          </div>
          <div className="component-footer-right"></div>
        </div>
      </div>
    </Modal>
  );
}
