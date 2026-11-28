/*
 * ============================================================
 * FILE: Modal_Requests_Employee.jsx
 *
 * PURPOSE:
 *   Bottom-sheet manager that displays and manages employee requests (leave, onboarding,
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

import React, { useEffect, useMemo, useState } from "react";
import Modal from "./Modal";
import Button_Toolbar from "../buttons/Button_Toolbar";
import { CheckIcon, XMarkIcon } from "../../../icons";
import Dropdown_Custom from "../dropdowns/Dropdown_Custom";
import { InputDropup } from "../Inputs";
import { EmptyState, LoadingSpinner } from "../feedback";
import Badge_Status from "../badges/Badge_Status";
import SettingsMasterDetail, { SettingsMasterDetailTable } from "../layout/Settings_MasterDetail";

const getRequestKey = (request) => `${request._requestType || request._typeLabel || "request"}-${request.id}`;

export default function Modal_Requests_Employee({ isOpen, onClose, container, allRequests, requestTypeFilter, setRequestTypeFilter, requestTimeFilter, setRequestTimeFilter, requestsLoading, employees, onRequestAction, loadRequests }) {
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const filteredRequests = useMemo(() => {
    const now = new Date();
    return (allRequests || []).filter((request) => {
      if (requestTimeFilter === "all" || !request.created_at) return true;
      const ageDays = (now.getTime() - new Date(request.created_at).getTime()) / (1000 * 60 * 60 * 24);
      if (requestTimeFilter === "7d") return ageDays <= 7;
      if (requestTimeFilter === "30d") return ageDays <= 30;
      if (requestTimeFilter === "90d") return ageDays <= 90;
      return true;
    });
  }, [allRequests, requestTimeFilter]);
  const selectedRequest = filteredRequests.find((request) => getRequestKey(request) === selectedRequestId);

  useEffect(() => {
    if (selectedRequestId && !filteredRequests.some((request) => getRequestKey(request) === selectedRequestId)) {
      setSelectedRequestId(null);
    }
  }, [filteredRequests, selectedRequestId]);

  const closeDetail = () => setSelectedRequestId(null);
  const employee = selectedRequest && employees.find((item) => String(item.id) === String(selectedRequest.user_id));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      container={container}
      noPadding
      contentGravity="bottom"
      title="Requests"
      footer={
        <>
          {selectedRequest?.status === "pending" && (
            <>
              <Button_Toolbar icon={CheckIcon} label="Approve" onClick={() => onRequestAction(selectedRequest, "approved")} className="btn-primary" title="Approve request" />
              <Button_Toolbar icon={XMarkIcon} label="Deny" onClick={() => onRequestAction(selectedRequest, "denied")} className="btn-outline-danger" title="Deny request" />
            </>
          )}
          <Button_Toolbar icon={XMarkIcon} label="" onClick={onClose} className="btn-outline-secondary" title="Cancel" />
        </>
      }
    >
      <div className="ui-component-shell">
        <div className="component-footer" style={{ flexWrap: "wrap", gap: "0.4rem", order: 2 }}>
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
          </div>
          <div className="component-footer-right"></div>
        </div>
        <div className="component-body" style={{ order: 1 }}>
          <div className="component-body-inner h-100">
            {requestsLoading ? (
              <div className="py-1 text-center"><LoadingSpinner label="Loading employee requests" /></div>
            ) : filteredRequests.length === 0 ? (
              <EmptyState title="No requests found" className="justify-content-center" />
            ) : (
              <SettingsMasterDetail
                detailOpen={Boolean(selectedRequestId && selectedRequest)}
                onBack={closeDetail}
                list={
                  <div className="d-flex flex-column gap-3">
                    {["pending", "approved", "denied"].map((statusGroup) => {
                      const grouped = filteredRequests.filter((request) => request.status === statusGroup);
                      if (grouped.length === 0) return null;
                      return (
                        <div key={statusGroup}>
                          <h6 className="mb-2 text-capitalize text-muted">{statusGroup} ({grouped.length})</h6>
                          <SettingsMasterDetailTable columns={[{ label: "Employee" }, { label: "Request" }, { label: "Dates" }]}>
                            {grouped.map((request) => {
                              const requestEmployee = employees.find((item) => String(item.id) === String(request.user_id));
                              return (
                                <tr key={getRequestKey(request)} className={getRequestKey(request) === selectedRequestId ? "table-primary" : ""}>
                                  <td>
                                    <button type="button" className="btn btn-link fw-medium p-0 text-start text-decoration-none" onClick={() => setSelectedRequestId(getRequestKey(request))}>
                                      {requestEmployee ? `${requestEmployee.first_name} ${requestEmployee.last_name}` : "Unknown Employee"}
                                    </button>
                                  </td>
                                  <td>{request._typeLabel || "Request"}</td>
                                  <td>{request._dateInfo || "—"}</td>
                                </tr>
                              );
                            })}
                          </SettingsMasterDetailTable>
                        </div>
                      );
                    })}
                  </div>
                }
                detail={
                  selectedRequest ? (
                    <div className="d-flex flex-column gap-3">
                      <div className="align-items-start d-flex justify-content-between">
                        <div>
                          <h5 className="mb-1">{employee ? `${employee.first_name} ${employee.last_name}` : "Unknown Employee"}</h5>
                          <div className="text-muted">{selectedRequest._typeLabel || "Request"}</div>
                        </div>
                        <Badge_Status status={selectedRequest.status} />
                      </div>
                      <div className="border rounded p-3">
                        <div className="fw-semibold mb-1">Dates</div>
                        <div>{selectedRequest._dateInfo || "No date information"}</div>
                      </div>
                      <div className="border rounded p-3">
                        <div className="fw-semibold mb-1">Notes</div>
                        <div className={selectedRequest.notes ? "" : "text-muted"}>{selectedRequest.notes || "No notes provided."}</div>
                      </div>
                    </div>
                  ) : <div className="text-muted">Select a request to review it.</div>
                }
              />
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
