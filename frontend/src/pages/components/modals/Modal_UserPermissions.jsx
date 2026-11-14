/*
 * ============================================================
 * FILE: Modal_Permissions_User.jsx
 *
 * PURPOSE:
 *   Full-screen modal for viewing and editing an individual user's page-level permissions.
 *   Supports adding new page/permission pairs, toggling grant/deny status, deleting permissions,
 *   and configuring schedule-specific special permissions (view-all / write-all).
 *
 * FUNCTIONAL PARTS:
 *   [1] Header — title bar with close button
 *   [2] Add New Permission Form — page and permission selectors with submit
 *   [3] Schedule Special Permissions — conditional view-all and write-all checkboxes
 *   [4] Current Permissions Table — tabular list with toggle and delete actions per row
 *   [5] Footer — centered close button
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-03-01 | Claude  | Added section comments and top-level documentation
 *   2026-07-24 | GitHub Copilot | Added word-safe trigger label truncation for dropup selectors
 * ============================================================
 */

import React from "react";
import Modal from "./Modal";
import Button_Toolbar from "../buttons/Button_Toolbar";
import Footer_Actions from "../footers/Footer_Actions";
import Dropdown_Custom from "../dropdowns/Dropdown_Custom";
import { XMarkIcon, CheckCircleIcon, XCircleIcon, TrashIcon } from "@heroicons/react/24/outline";

const PERMISSION_DESCRIPTIONS = {
  read: "View records and details on this page.",
  read_all: "View all records across the company.",
  view_all: "View all schedule appointments across all employees.",
  write: "Create and edit records on this page.",
  write_all: "Create and edit schedule appointments for any employee.",
  write_self_only: "Create and edit schedule appointments only for yourself.",
  delete: "Delete records from this page.",
  approve_payments: "Approve wage and compensation payout records.",
  initiate_refunds: "Initiate client payment refunds and reversals.",
  admin: "Full administrative control and configuration for this page.",
};

export default function Modal_Permissions_User({ isOpen, onClose, userPermissions, newPermission, setNewPermission, onCreatePermission, onDeletePermission, onUpdatePermission, onScheduleWriteSelfOnlyToggle, onScheduleWriteAllToggle, pages, permissions, isDarkMode }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} noPadding fullScreen>
      <div className="ui-component-shell">
        <div className="component-header">
          <div className="component-header-left">Manage Permissions</div>
          <div className="component-header-center"></div>
          <div className="component-header-right"></div>
        </div>

        <div className="component-body">
          <div className="component-body-inner">
          {/* ─── 2 ADD NEW PERMISSION FORM ──────────────────────────────────────── */}
          {/* Add New Permission Form */}
          <form onSubmit={onCreatePermission} className="border mb-4 p-1 rounded">
            <h5 className={`mb-3 ${isDarkMode ? "text-light" : "text-dark"}`}>Add New Permission</h5>
            <div className="g-3 row">
              <div className="col-md-6">
                <Dropdown_Custom
                  value={newPermission.page}
                  onChange={(event) => setNewPermission({ ...newPermission, page: event.target.value })}
                  options={pages.map((page) => ({ value: page, label: page }))}
                  placeholder="Page"
                  floatingLabel="Page"
                  showHelp
                  className="ui-control-sm"
                />
              </div>
              <div className="col-md-6">
                <Dropdown_Custom
                  value={newPermission.permission}
                  onChange={(event) => setNewPermission({ ...newPermission, permission: event.target.value })}
                  options={permissions.map((permission) => ({ value: permission, label: permission, description: PERMISSION_DESCRIPTIONS[permission] }))}
                  placeholder="Permission"
                  floatingLabel="Permission"
                  showHelp
                  className="ui-control-sm"
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary mt-3">
              <i className="bi bi-plus-circle me-2"></i>
              Add
            </button>
          </form>

          {/* ─── 3 SCHEDULE SPECIAL PERMISSIONS ─────────────────────────────────── */}
          {/* Schedule Special Permissions */}
          {newPermission.page === "schedule" && (
            <div className="bg-light border mt-4 p-1 rounded-lg">
              <h5 className={`text-sm font-medium mb-2 ${isDarkMode ? "text-light" : "text-dark"}`}>Schedule Special Permissions</h5>
              <div className="space-y-2">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="writeSelfOnlySchedules"
                      checked={userPermissions.some((p) => p.page === "schedule" && p.permission === "write_self_only" && p.granted)}
                      onChange={(e) => onScheduleWriteSelfOnlyToggle(e.target.checked)}
                      className="border-gray-300 focus:ring-indigo-500 h-4 rounded text-indigo-600 w-4"
                    />
                    <label htmlFor="writeSelfOnlySchedules" className={`ml-2 block text-sm ${isDarkMode ? "text-light" : "text-dark"}`}>
                      Write Self-Only Schedules
                    </label>
                  </div>
                  <div className="text-muted text-xs">Allows creating/editing only their own appointments</div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="writeAllSchedules"
                      checked={userPermissions.some((p) => p.page === "schedule" && p.permission === "write_all" && p.granted)}
                      onChange={(e) => onScheduleWriteAllToggle(e.target.checked)}
                      className="border-gray-300 focus:ring-indigo-500 h-4 rounded text-indigo-600 w-4"
                    />
                    <label htmlFor="writeAllSchedules" className={`ml-2 block text-sm ${isDarkMode ? "text-light" : "text-dark"}`}>
                      Write All Employee Schedules
                    </label>
                  </div>
                  <div className="text-muted text-xs">Allows creating/editing appointments for any employee, not just themselves</div>
                </div>
              </div>
            </div>
          )}

          {/* ─── 4 CURRENT PERMISSIONS TABLE ────────────────────────────────────── */}
          {/* Current Permissions Table */}
          <div className="mt-4">
            <h5 className={`mb-3 ${isDarkMode ? "text-light" : "text-dark"}`}>Current Permissions</h5>
            <div className="table-responsive">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th className={isDarkMode ? "text-light" : "text-dark"}>Page</th>
                    <th className={isDarkMode ? "text-light" : "text-dark"}>Permission</th>
                    <th className={isDarkMode ? "text-light" : "text-dark"}>Status</th>
                    <th className={isDarkMode ? "text-light" : "text-dark"}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {userPermissions.map((permission) => (
                    <tr key={permission.id}>
                      <td className={isDarkMode ? "text-light" : "text-dark"}>{permission.page}</td>
                      <td className={isDarkMode ? "text-light" : "text-dark"}>{permission.permission}</td>
                      <td>
                        <span className={`badge ${permission.granted ? "bg-success" : "bg-danger"}`}>{permission.granted ? "Granted" : "Denied"}</span>
                      </td>
                      <td>
                        <div className="d-flex align-items-center gap-1">
                          <button
                            onClick={() => onDeletePermission(permission.id)}
                            className="btn btn-outline-danger btn-sm rounded-circle d-inline-flex align-items-center justify-content-center p-0 flex-shrink-0"
                            style={{ width: "2rem", height: "2rem", minWidth: "2rem", minHeight: "2rem" }}
                            title="Delete Permission"
                            type="button"
                          >
                            <TrashIcon style={{ width: 14, height: 14 }} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onUpdatePermission(permission.id, !permission.granted)}
                            className={`btn btn-sm rounded-circle d-inline-flex align-items-center justify-content-center p-0 flex-shrink-0 ${permission.granted ? "btn-outline-warning" : "btn-outline-success"}`}
                            style={{ width: "2rem", height: "2rem", minWidth: "2rem", minHeight: "2rem" }}
                            title={permission.granted ? "Deny Permission" : "Grant Permission"}
                          >
                            {permission.granted ? <XCircleIcon style={{ width: 16, height: 16 }} /> : <CheckCircleIcon style={{ width: 16, height: 16 }} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>{/* /permissions table */}
          </div>{/* /component-body-inner */}
        </div>{/* /component-body */}

        {/* ─── 5 FOOTER ───────────────────────────────────────────────────────── */}
        <div className="component-footer">
          <Footer_Actions center={<Button_Toolbar icon={XMarkIcon} label="Close" onClick={onClose} className="btn-outline-secondary" title="Close" />} />
        </div>
      </div>
    </Modal>
  );
}
