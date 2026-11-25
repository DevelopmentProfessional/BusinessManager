/*
 * ============================================================
 * FILE: Modal_Manage_Roles.jsx
 *
 * PURPOSE:
 *   Bottom-sheet manager for creating and managing application roles and their permissions.
 *   Allows admins to create new roles, delete non-system roles, and assign or remove
 *   page-level permissions from each role inline.
 *
 * FUNCTIONAL PARTS:
 *   [1] Header — title bar
 *   [2] Status Messages — error and success alert banners
 *   [3] Create New Role Form — name and description inputs with submit button
 *   [4] Existing Roles List — per-role card with permissions badges and add-permission selectors
 *   [5] Footer — centered close button
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-09-11 | GitHub Copilot | Removed unused toolbar import to satisfy ESLint no-unused-vars
 *   2026-03-01 | Claude  | Added section comments and top-level documentation
 * ============================================================
 */

import React, { useEffect, useState } from "react";
import { InputText, InputTextarea } from "../Inputs";
import Modal from "./Modal";
import Button_Toolbar from "../buttons/Button_Toolbar";
import { XMarkIcon, PlusIcon } from "../../../icons";
import Dropdown_Custom from "../dropdowns/Dropdown_Custom";
import Field_Floating from "../fields/Field_Floating";
import SettingsMasterDetail, { SettingsMasterDetailTable } from "../layout/Settings_MasterDetail";

const NEW_ROLE_ID = "new";

export default function Modal_Manage_Roles({ isOpen, onClose, container, availableRoles, newRole, setNewRole, editingRole, setEditingRole, newRolePermission, setNewRolePermission, onCreateRole, onDeleteRole, onAddRolePermission, onRemoveRolePermission, pages, permissions, isDarkMode, error, success }) {
  const [selectedRoleId, setSelectedRoleId] = useState(null);
  const selectedRole = availableRoles.find((role) => String(role.id) === String(selectedRoleId));

  useEffect(() => {
    if (selectedRoleId !== null && selectedRoleId !== NEW_ROLE_ID && !availableRoles.some((role) => String(role.id) === String(selectedRoleId))) {
      setSelectedRoleId(null);
    }
  }, [availableRoles, selectedRoleId]);

  const closeDetail = () => {
    setSelectedRoleId(null);
    setEditingRole(null);
    setNewRolePermission({ page: "", permission: "" });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} container={container} noPadding contentGravity="bottom" title="Manage Roles" footer={
      <>
        {selectedRoleId === NEW_ROLE_ID && (
          <>
            <Button_Toolbar type="submit" form="create-role-form" icon={PlusIcon} label="Create" className="btn-primary" title="Create role" />
            <Button_Toolbar icon={XMarkIcon} label="Cancel" onClick={closeDetail} className="btn-outline-secondary" title="Cancel" />
          </>
        )}
        {selectedRole && (
          <>
            <Button_Toolbar icon={PlusIcon} label="Add permission" onClick={() => onAddRolePermission(selectedRole.id)} disabled={editingRole !== selectedRole.id || !newRolePermission.page || !newRolePermission.permission} className="btn-outline-primary" title="Add permission" />
            <Button_Toolbar icon={XMarkIcon} label="Cancel" onClick={closeDetail} className="btn-outline-secondary" title="Back to roles" />
          </>
        )}
        <Button_Toolbar icon={XMarkIcon} label={container === "inline" ? "Back to Settings" : "Close"} onClick={onClose} className="btn-outline-secondary" title="Close role manager" />
      </>
    }>
      <div className="ui-component-shell">
        <div className="component-body">
          <div className="component-body-inner h-100">
            {error && <div className="alert alert-danger py-2 mb-2" role="alert">{error}</div>}
            {success && <div className="alert alert-success py-2 mb-2" role="status">{success}</div>}
            <SettingsMasterDetail
              detailOpen={selectedRoleId !== null}
              onBack={closeDetail}
              list={
                <div className="d-flex flex-column h-100 min-h-0">
                  <div className="align-items-center d-flex justify-content-between mb-2">
                    <h5 className="mb-0">Roles</h5>
                    <Button_Toolbar icon={PlusIcon} label="New" onClick={() => setSelectedRoleId(NEW_ROLE_ID)} className="btn-primary btn-sm" title="Create role" />
                  </div>
                  <SettingsMasterDetailTable columns={[{ label: "Role" }, { label: "Permissions" }]}>
                    {availableRoles.length === 0 ? (
                      <tr><td colSpan={2} className="text-center text-muted py-2">No roles defined yet.</td></tr>
                    ) : availableRoles.map((role) => (
                      <tr key={role.id} className={String(role.id) === String(selectedRoleId) ? "table-primary" : ""}>
                        <td>
                          <button type="button" className="btn btn-link fw-medium p-0 text-start text-decoration-none" onClick={() => setSelectedRoleId(role.id)}>
                            {role.name}{role.is_system && <span className="badge bg-secondary ms-2">System</span>}
                          </button>
                        </td>
                        <td>{role.role_permissions?.length || 0}</td>
                      </tr>
                    ))}
                  </SettingsMasterDetailTable>
                </div>
              }
              detail={
                selectedRoleId === NEW_ROLE_ID ? (
                  <form id="create-role-form" onSubmit={onCreateRole} className="d-flex flex-column gap-3">
                    <h5 className={isDarkMode ? "text-light" : "text-dark"}>Create New Role</h5>
                    <Field_Floating id="role_name" label="Role Name">
                      <InputText value={newRole.name} onChange={(e) => setNewRole({ ...newRole, name: e.target.value })} className="form-control" required />
                    </Field_Floating>
                    <Field_Floating id="role_description" label="Description (optional)">
                      <InputTextarea value={newRole.description} onChange={(e) => setNewRole({ ...newRole, description: e.target.value })} className="form-control" rows={2} />
                    </Field_Floating>
                  </form>
                ) : selectedRole ? (
                  <div className="d-flex flex-column gap-3">
                    <div className="align-items-start d-flex justify-content-between">
                      <div>
                        <h5 className={`mb-1 ${isDarkMode ? "text-light" : "text-dark"}`}>{selectedRole.name}{selectedRole.is_system && <span className="badge bg-secondary ms-2">System</span>}</h5>
                        {selectedRole.description && <small className="text-muted">{selectedRole.description}</small>}
                      </div>
                      {!selectedRole.is_system && <Button_Toolbar label="Delete" onClick={() => onDeleteRole(selectedRole.id)} className="btn-outline-danger btn-sm" title="Delete role" />}
                    </div>
                    <div>
                      <div className={`fw-semibold mb-2 ${isDarkMode ? "text-light" : "text-muted"}`}>Permissions</div>
                      <div className="d-flex flex-wrap gap-1">
                        {selectedRole.role_permissions?.length > 0 ? selectedRole.role_permissions.map((permission) => (
                          <span key={permission.id} className="align-items-center badge bg-secondary d-flex gap-1">
                            {permission.page}:{permission.permission}
                            <button type="button" onClick={() => onRemoveRolePermission(selectedRole.id, permission.id)} className="btn-close btn-close-white ms-1" style={{ fontSize: "0.5rem" }} title="Remove permission" />
                          </span>
                        )) : <span className="text-muted">No permissions assigned</span>}
                      </div>
                    </div>
                    <div className="d-flex flex-wrap gap-2 align-items-end">
                      <div className="flex-grow-1" style={{ minWidth: "10rem" }}>
                        <Dropdown_Custom
                          value={editingRole === selectedRole.id ? newRolePermission.page : ""}
                          onChange={(e) => {
                            setEditingRole(selectedRole.id);
                            setNewRolePermission({ ...newRolePermission, page: e.target.value });
                          }}
                          className="form-select ui-control-sm"
                          options={[{ value: "", label: "Page..." }, ...pages.map((page) => ({ value: page, label: page }))]}
                        />
                      </div>
                      <div className="flex-grow-1" style={{ minWidth: "10rem" }}>
                        <Dropdown_Custom
                          value={editingRole === selectedRole.id ? newRolePermission.permission : ""}
                          onChange={(e) => {
                            setEditingRole(selectedRole.id);
                            setNewRolePermission({ ...newRolePermission, permission: e.target.value });
                          }}
                          className="form-select ui-control-sm"
                          options={[{ value: "", label: "Permission..." }, ...permissions.map((permission) => ({ value: permission, label: permission }))]}
                        />
                      </div>
                    </div>
                  </div>
                ) : <div className="text-muted">Select a role or create a new one.</div>
              }
            />
          </div>
        </div>{/* /component-body */}
      </div>
    </Modal>
  );
}
