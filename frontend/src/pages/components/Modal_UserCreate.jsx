/*
 * ============================================================
 * FILE: Modal_Create_User.jsx
 *
 * PURPOSE:
 *   Full-screen modal form for creating a new application user.
 *   Collects username, email, password, first/last name, and role,
 *   then delegates submission to the parent via the onSubmit prop.
 *
 * FUNCTIONAL PARTS:
 *   [1] Modal Shell — Full-screen Modal wrapper with flex column layout
 *   [2] Header — "Create User" title bar with close button
 *   [3] Scrollable Form Body — Floating-label inputs for all user fields and a role selector
 *   [4] Footer — Cancel (X) and Submit (check) icon buttons
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-03-01 | Claude  | Added section comments and top-level documentation
 * ============================================================
 */
import React from "react";
import Modal from "./Modal";
import { XMarkIcon, CheckIcon } from "@heroicons/react/24/outline";
import Dropdown_Custom from "./Dropdown_Custom";

export default function Modal_Create_User({ isOpen, onClose, newUser, setNewUser, onSubmit, loading, roles }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} noPadding fullScreen>
      <div className="ui-component-shell">
        <div className="component-header">
          <div className="component-header-left">Create User</div>
          <div className="component-header-center"></div>
          <div className="component-header-right"></div>
        </div>

        <div className="component-body">
          <div className="component-body-inner">
            <form id="create-user-form" onSubmit={onSubmit}>
              <div className="form-floating mb-3">
                <input type="text" id="createUserUsername" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} className="form-control" placeholder="Username" required />
                <label htmlFor="createUserUsername">Username</label>
              </div>
              <div className="form-floating mb-3">
                <input type="email" id="createUserEmail" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} className="form-control" placeholder="Email" required />
                <label htmlFor="createUserEmail">Email</label>
              </div>
              <div className="form-floating mb-3">
                <input type="password" id="createUserPassword" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} className="form-control" placeholder="Password" required />
                <label htmlFor="createUserPassword">Password</label>
              </div>
              <div className="form-floating mb-3">
                <input type="text" id="createUserFirstName" value={newUser.first_name} onChange={(e) => setNewUser({ ...newUser, first_name: e.target.value })} className="form-control" placeholder="First Name" required />
                <label htmlFor="createUserFirstName">First Name</label>
              </div>
              <div className="form-floating mb-3">
                <input type="text" id="createUserLastName" value={newUser.last_name} onChange={(e) => setNewUser({ ...newUser, last_name: e.target.value })} className="form-control" placeholder="Last Name" required />
                <label htmlFor="createUserLastName">Last Name</label>
              </div>
              <div className="form-floating mb-3">
                <Dropdown_Custom id="createUserRole" value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })} className="form-select ui-control-sm" options={roles.map((role) => ({ value: role, label: role }))} />
                <label htmlFor="createUserRole">Role</label>
              </div>
            </form>
          </div>
        </div>

        <div className="component-footer">
          <div className="component-footer-left">
            <button type="submit" form="create-user-form" disabled={loading} className="align-items-center btn btn-outline-secondary btn-sm d-flex gap-1" title="Create user">
              <CheckIcon style={{ width: 16, height: 16 }} />
              Create
            </button>
          </div>
          <div className="component-footer-center">
            <button type="button" onClick={onClose} className="btn ui-btn-circle-outline-secondary" title="Cancel">
              <XMarkIcon />
            </button>
          </div>
          <div className="component-footer-right"></div>
        </div>
      </div>
    </Modal>
  );
}
