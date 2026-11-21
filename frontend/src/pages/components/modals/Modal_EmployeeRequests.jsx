/*
 * ============================================================
 * FILE: Modal_Requests_Employee.jsx
 *
 * PURPOSE:
 *   Full-screen modal that displays and manages employee requests (leave, onboarding,
 *   offboarding). Groups requests by status (approved, denied, pending) and allows
 *   managers to approve or deny pending requests inline.
 *
 * FUNCTIONAL PARTS:
 *   [1] Header — title bar
 *   [2] Scrollable Request List — grouped by status with time-filter applied, approve/deny buttons for pending
 *   [3] Footer — request type filter pills, time-range dropdown, and close button
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-11-15 | GitHub Copilot | Replaced request-type filter pills with an upward-opening dropup and renamed the footer dismiss action to Cancel
 *   2026-09-11 | GitHub Copilot | Removed unused toolbar import to satisfy ESLint no-unused-vars
 *   2026-03-01 | Claude  | Added section comments and top-level documentation
 * ============================================================
 */

import React from "react";
import Modal from "./Modal";
import Button_Toolbar from "../buttons/Button_Toolbar";
import { XMarkIcon } from "../../../icons";
import Dropdown_Custom from "../dropdowns/Dropdown_Custom";
import { InputDropup } from "../Inputs";
import { EmptyState, LoadingSpinner } from "../feedback";
import Badge_Status from "../badges/Badge_Status";

export default function Modal_Requests_Employee({ isOpen, onClose, allRequests, requestTypeFilter, setRequestTypeFilter, requestTimeFilter, setRequestTimeFilter, requestsLoading, employees, onRequestAction, loadRequests }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} noPadding fullScreen>
      <div className="ui-component-shell">
        <div className="component-header">
          <div className="component-header-left">Requests</div>
          <div className="component-header-center"></div>
          <div className="component-header-right"></div>
        </div>

        <div className="component-body">
          <div className="component-body-inner">
          {requestsLoading ? (
            <div className="py-1 text-center">
              <LoadingSpinner label="Loading employee requests" />
            </div>
          ) : allRequests.length === 0 ? (
            <EmptyState title="No requests found" className="justify-content-center" />
          ) : (
            <div className="d-flex flex-column gap-2">
              {["approved", "denied", "pending"].map((statusGroup) => {
                const now = new Date();
                const timeFiltered = allRequests.filter((r) => {
                  if (requestTimeFilter === "all") return true;
                  if (!r.created_at) return true;
                  const diffDays = (now - new Date(r.created_at)) / (1000 * 60 * 60 * 24);
                  if (requestTimeFilter === "7d") return diffDays <= 7;
                  if (requestTimeFilter === "30d") return diffDays <= 30;
                  if (requestTimeFilter === "90d") return diffDays <= 90;
                  return true;
                });
                const grouped = timeFiltered.filter((r) => r.status === statusGroup);
                if (grouped.length === 0) return null;
                return (
                  <div key={statusGroup}>
                    <h6 className="mb-2 text-capitalize text-muted">
                      {statusGroup} ({grouped.length})
                    </h6>
                    {grouped.map((req) => {
                      const emp = employees.find((e) => e.id === req.user_id);
                      return (
                        <div key={req.id} className="card mb-2">
                          <div className="card-body px-2 pt-2 pb-1">
                            <div className="align-items-start d-flex justify-content-between">
                              <div>
                                <div className="fw-semibold">{emp ? `${emp.first_name} ${emp.last_name}` : "Unknown Employee"}</div>
                                <div className="ui-small-muted">
                                  <span className="badge bg-secondary me-1">{req._typeLabel}</span>
                                  {req._dateInfo}
                                </div>
                                {req.notes && <div className="fst-italic small text-muted">{req.notes}</div>}
                              </div>
                              {req.status === "pending" && (
                                <div className="d-flex gap-1">
                                  <button className="btn ui-btn-outline-secondary-sm" onClick={() => onRequestAction(req, "approved")}>
                                    Approve
                                  </button>
                                  <button className="btn ui-btn-outline-secondary-sm" onClick={() => onRequestAction(req, "denied")}>
                                    Deny
                                  </button>
                                </div>
                              )}
                              {req.status !== "pending" && <Badge_Status status={req.status} />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </div>

        {/* ─── 3 FOOTER ───────────────────────────────────────────────────────── */}
        <div className="component-footer" style={{ flexWrap: "wrap", gap: "0.4rem" }}>
          <div className="component-footer-left" style={{ flexWrap: "wrap", gap: "0.3rem" }}>
            <InputDropup
              value={requestTypeFilter}
              onChange={(e) => {
                setRequestTypeFilter(e.target.value);
                loadRequests(e.target.value);
              }}
              openUpward
              floatingLabel="Request type"
              options={[
                { value: "all", label: "All requests" },
                { value: "leave_vacation", label: "Vacation" },
                { value: "leave_sick", label: "Sick" },
                { value: "onboarding", label: "Onboarding" },
                { value: "offboarding", label: "Offboarding" },
              ]}
              className="requests-filter-dropup"
              style={{ minWidth: "10rem" }}
              aria-label="Filter by request type"
            />
            <Dropdown_Custom
              value={requestTimeFilter}
              onChange={(e) => setRequestTimeFilter(e.target.value)}
              className="form-select form-select-sm rounded-pill"
              style={{ width: "fit-content" }}
              options={[
                { value: "all", label: "All Time" },
                { value: "7d", label: "Last 7 Days" },
                { value: "30d", label: "Last 30 Days" },
                { value: "90d", label: "Last 90 Days" },
              ]}
            />
            <Button_Toolbar icon={XMarkIcon} label="Cancel" onClick={onClose} className="btn-outline-secondary" title="Cancel" />
          </div>
          <div className="component-footer-right"></div>
        </div>
      </div>
    </Modal>
  );
}
