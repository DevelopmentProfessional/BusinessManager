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
 * ============================================================
 */

import React, { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import Modal from "./Modal";
import { XMarkIcon, TrashIcon, CheckCircleIcon, XCircleIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import Button_Toolbar from "./Button_Toolbar";

function DropupSelect({ value, onChange, options, placeholder, isDarkMode }) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState({});
  const btnRef = useRef(null);

  useEffect(() => {
    if (open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuStyle({
        position: "fixed",
        left: rect.left,
        bottom: window.innerHeight - rect.top + 4,
        width: rect.width,
        zIndex: 9999,
        maxHeight: 220,
        overflowY: "auto",
      });
    }
  }, [open]);

  const menu = open ? ReactDOM.createPortal(
    <>
      <div
        style={{ position: "fixed", inset: 0, zIndex: 9998 }}
        onClick={() => setOpen(false)}
      />
      <ul
        className={`border rounded shadow-lg p-1 ${isDarkMode ? "bg-gray-800 border-gray-600" : "bg-white"}`}
        style={menuStyle}
      >
        <li>
          <button type="button" className="dropdown-item small text-muted" onClick={() => { onChange(""); setOpen(false); }}>
            {placeholder}
          </button>
        </li>
        {options.map(opt => (
          <li key={opt}>
            <button
              type="button"
              className={`dropdown-item small ${opt === value ? "active" : ""}`}
              onClick={() => { onChange(opt); setOpen(false); }}
            >
              {opt}
            </button>
          </li>
        ))}
      </ul>
    </>,
    document.body
  ) : null;

  return (
    <div>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`form-select form-select-sm text-start d-flex align-items-center justify-content-between w-100 ${isDarkMode ? "bg-gray-800 text-light border-gray-600" : ""}`}
      >
        <span>{value || <span className="text-muted">{placeholder}</span>}</span>
        <ChevronUpIcon style={{ width: 14, height: 14, flexShrink: 0 }} />
      </button>
      {menu}
    </div>
  );
}

export default function Modal_Permissions_User({ isOpen, onClose, userPermissions, newPermission, setNewPermission, onCreatePermission, onDeletePermission, onUpdatePermission, onScheduleViewAllToggle, onScheduleWriteAllToggle, pages, permissions, isDarkMode }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} noPadding={true} fullScreen={true}>
      <div className="d-flex flex-column bg-white dark:bg-gray-900" style={{ height: "100%" }}>
        {/* ─── 1 HEADER ──────────────────────────────────────────────────────── */}
        {/* Header */}
        <div className="flex-shrink-0 p-2 border-bottom border-gray-200 dark:border-gray-700 d-flex justify-content-between align-items-center">
          <h6 className="mb-0 fw-semibold text-gray-900 dark:text-gray-100">Manage Permissions</h6>
          <button type="button" onClick={onClose} className="btn btn-link p-0 text-muted">
            <XMarkIcon style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-grow-1 overflow-auto no-scrollbar px-3 pt-3">
          {/* ─── 2 ADD NEW PERMISSION FORM ──────────────────────────────────────── */}
          {/* Add New Permission Form */}
          <form onSubmit={onCreatePermission} className="mb-4 p-3 border rounded">
            <h5 className={`mb-3 ${isDarkMode ? "text-light" : "text-dark"}`}>Add New Permission</h5>
            <div className="row g-3">
              <div className="col-md-6">
                <DropupSelect
                  value={newPermission.page}
                  onChange={(val) => setNewPermission({ ...newPermission, page: val })}
                  options={pages}
                  placeholder="Select Page"
                  isDarkMode={isDarkMode}
                />
              </div>
              <div className="col-md-6">
                <DropupSelect
                  value={newPermission.permission}
                  onChange={(val) => setNewPermission({ ...newPermission, permission: val })}
                  options={permissions}
                  placeholder="Select Permission"
                  isDarkMode={isDarkMode}
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary mt-3">
              <i className="bi bi-plus-circle me-2"></i>
              Add Permission
            </button>
          </form>

          {/* ─── 3 SCHEDULE SPECIAL PERMISSIONS ─────────────────────────────────── */}
          {/* Schedule Special Permissions */}
          {newPermission.page === "schedule" && (
            <div className="mt-4 p-3 border rounded-lg bg-light">
              <h5 className={`text-sm font-medium mb-2 ${isDarkMode ? "text-light" : "text-dark"}`}>Schedule Special Permissions</h5>
              <div className="space-y-2">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="viewAllSchedules"
                      checked={userPermissions.some((p) => p.page === "schedule" && p.permission === "write" && p.granted)}
                      onChange={(e) => onScheduleViewAllToggle(e.target.checked)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor="viewAllSchedules" className={`ml-2 block text-sm ${isDarkMode ? "text-light" : "text-dark"}`}>
                      View All Employee Schedules
                    </label>
                  </div>
                  <div className="text-xs text-muted">Allows viewing schedules of all employees, not just their own</div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="writeAllSchedules"
                      checked={userPermissions.some((p) => p.page === "schedule" && p.permission === "write" && p.granted)}
                      onChange={(e) => onScheduleWriteAllToggle(e.target.checked)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor="writeAllSchedules" className={`ml-2 block text-sm ${isDarkMode ? "text-light" : "text-dark"}`}>
                      Write All Employee Schedules
                    </label>
                  </div>
                  <div className="text-xs text-muted">Allows creating/editing appointments for any employee, not just themselves</div>
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
                          <button onClick={() => onDeletePermission(permission.id)} className="btn btn-sm btn-outline-danger d-flex align-items-center justify-content-center" style={{ width: "3rem", height: "3rem" }} title="Delete Permission" type="button">
                            <TrashIcon style={{ width: 16, height: 16 }} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onUpdatePermission(permission.id, !permission.granted)}
                            className={`btn btn-sm d-flex align-items-center justify-content-center ms-auto ${permission.granted ? "btn-outline-warning" : "btn-outline-success"}`}
                            style={{ width: "3rem", height: "3rem" }}
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
          </div>
        </div>

        {/* ─── 5 FOOTER ───────────────────────────────────────────────────────── */}
        {/* Footer */}
        <div className="flex-shrink-0 pt-2 pb-4 px-3 border-top border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="d-flex align-items-center">
            <div style={{ width: 40 }} />
            <div className="flex-grow-1 d-flex gap-3 justify-content-center">
              <button type="button" onClick={onClose} className="btn btn-outline-secondary btn-sm p-1 d-flex align-items-center justify-content-center" style={{ width: "3rem", height: "3rem" }} title="Close">
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
