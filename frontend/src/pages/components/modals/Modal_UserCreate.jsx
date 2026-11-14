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
import Button_Toolbar from "../buttons/Button_Toolbar";
import Footer_Actions from "../footers/Footer_Actions";
import { XMarkIcon, CheckIcon } from "@heroicons/react/24/outline";
import Dropdown_Custom from "../dropdowns/Dropdown_Custom";
import { InputText } from "../Inputs";
import Field_Floating from "../fields/Field_Floating";

export default function Modal_Create_User({
  isOpen,
  onClose,
  newUser = { username: "", email: "", password: "", first_name: "", last_name: "", role: "" },
  setNewUser = () => {},
  onSubmit = (e) => e?.preventDefault?.(),
  loading = false,
  roles = [],
}) {
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
              <Field_Floating id="createUserUsername" label="Username" className="mb-3">
                <InputText value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} required />
              </Field_Floating>
              <Field_Floating id="createUserEmail" label="Email" className="mb-3">
                <InputText type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} required />
              </Field_Floating>
              <Field_Floating id="createUserPassword" label="Password" className="mb-3">
                <InputText type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} required />
              </Field_Floating>
              <Field_Floating id="createUserFirstName" label="First Name" className="mb-3">
                <InputText value={newUser.first_name} onChange={(e) => setNewUser({ ...newUser, first_name: e.target.value })} required />
              </Field_Floating>
              <Field_Floating id="createUserLastName" label="Last Name" className="mb-3">
                <InputText value={newUser.last_name} onChange={(e) => setNewUser({ ...newUser, last_name: e.target.value })} required />
              </Field_Floating>
              <div className="form-floating mb-3">
                <Dropdown_Custom id="createUserRole" value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })} className="form-select ui-control-sm" options={roles.map((role) => ({ value: role, label: role }))} />
                <label htmlFor="createUserRole">Role</label>
              </div>
            </form>
          </div>
        </div>

        <div className="component-footer">
          <Footer_Actions
            start={<Button_Toolbar type="submit" form="create-user-form" disabled={loading} icon={CheckIcon} label="Create" className="btn-primary" title="Create user" />}
            center={<Button_Toolbar icon={XMarkIcon} label="Cancel" onClick={onClose} className="btn-outline-secondary" title="Cancel" />}
          />
        </div>
      </div>
    </Modal>
  );
}
