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

import React, { useState, useRef } from "react";
import ReactDOM from "react-dom";
import Modal from "./Modal";
import { XMarkIcon, CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";
import { useWordSafeLabel } from "../../utils/wordSafeTruncate";

function DropupSelect({ value, onChange, options, placeholder, isDarkMode }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const menuIdRef = useRef(`dropup-menu-${Math.random().toString(36).slice(2)}`);
  const selectedLabel = value || placeholder;
  const { ref: labelRef, displayLabel } = useWordSafeLabel(selectedLabel, { enabled: true });

  const getMenuStyle = () => {
    if (!btnRef.current) return {};
    const rect = btnRef.current.getBoundingClientRect();
    return {
      position: "fixed",
      left: rect.left,
      bottom: window.innerHeight - rect.top + 4,
      width: rect.width,
      zIndex: 9999,
      background: isDarkMode ? "#1f2937" : "#fff",
      border: `1px solid ${isDarkMode ? "#374151" : "#dee2e6"}`,
      borderRadius: 6,
      boxShadow: isDarkMode ? "0 -4px 10px rgba(0,0,0,0.35)" : "0 -4px 12px rgba(0,0,0,0.15)",
      overflowY: "auto",
      maxHeight: 200,
    };
  };

  return (
    <div>
      <button
        type="button"
        ref={btnRef}
        className={`form-select form-select-sm text-start ${isDarkMode ? "text-light bg-dark border-secondary" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuIdRef.current}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
      >
        <span ref={labelRef} className="app-word-safe-label">
          {displayLabel}
        </span>
      </button>
      {open && ReactDOM.createPortal(
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 9998 }} onClick={() => setOpen(false)} />
          <ul id={menuIdRef.current} role="menu" style={getMenuStyle()} className="list-unstyled mb-0 py-1">
            <li>
              <button type="button" role="menuitem" className="dropdown-item small text-muted" onClick={() => { onChange(""); setOpen(false); }}>{placeholder}</button>
            </li>
            {options.map(opt => (
              <li key={opt}>
                <button type="button" role="menuitem" className={`dropdown-item small ${opt === value ? "fw-semibold text-primary" : ""}`} onClick={() => { onChange(opt); setOpen(false); }}>{opt}</button>
              </li>
            ))}
          </ul>
        </>,
        document.body
      )}
    </div>
  );
}

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
                        <div className="ui-flex-center-gap-1">
                          <button onClick={() => onDeletePermission(permission.id)} className="align-items-center btn btn-outline-danger btn-sm d-flex justify-content-center" title="Delete Permission" type="button">
                            <XMarkIcon style={{ width: 16, height: 16 }} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onUpdatePermission(permission.id, !permission.granted)}
                            className={`btn btn-sm d-flex align-items-center justify-content-center ms-auto ${permission.granted ? "btn-outline-warning" : "btn-outline-success"}`}
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
