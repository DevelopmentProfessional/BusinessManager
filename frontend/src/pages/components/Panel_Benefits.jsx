// FILE: Panel_Benefits.jsx
// Renders the leave/vacation/sick days panel with leave summary, pending requests table, and request button.

import React from "react";
import { PlusCircleIcon } from "@heroicons/react/24/outline";

const Panel_Benefits = ({
  user,
  isMobile,
  row1PanelBottom,
  leaveRequestsLoading,
  vacationRequests,
  sickRequests,
  vacTotal,
  vacUsed,
  vacRemaining,
  sickTotal,
  sickUsed,
  sickRemaining,
  statusColor,
  openLeaveModal,
}) => (
  <div
    className="accordion-popup"
    style={{
      position: "fixed",
      top: 0,
      bottom: `${row1PanelBottom}px`,
      left: 0,
      right: 0,
      width: "100%",
      height: `calc(var(--vvp-height, 100dvh) - ${row1PanelBottom}px)`,
      overflowY: "auto",
      scrollbarWidth: "none",
      msOverflowStyle: "none",
      backgroundColor: "var(--bs-body-bg)",
      zIndex: 1000,
      paddingTop: "1rem",
      paddingLeft: "1rem",
      paddingRight: "1rem",
      paddingBottom: "0.25rem",
      display: "flex",
      flexDirection: "column",
    }}
  >
    <div style={{ flexGrow: isMobile ? 0 : 1, minHeight: isMobile ? 0 : undefined }} />
    <div style={{ flexShrink: 0, overflowY: "auto", minHeight: 0 }}>
      <div className="row g-2 mb-3">
        <div className="col-sm-6">
          <div className="text-muted small">Salary</div>
          <div className="fw-medium">{user.salary != null ? `$${Number(user.salary).toLocaleString()}` : "Not set"}</div>
        </div>
        <div className="col-sm-6">
          <div className="text-muted small">Pay Frequency</div>
          <div className="fw-medium" style={{ textTransform: "capitalize" }}>
            {user.pay_frequency || "Not set"}
          </div>
        </div>
        <div className="col-sm-6">
          <div className="text-muted small">Insurance Plan</div>
          <div className="fw-medium">{user.insurance_plan || "Not set"}</div>
        </div>
      </div>

      <div className="border-top pt-3">
        <h6 className="fw-semibold mb-3">Leave Management</h6>

        {leaveRequestsLoading ? (
          <div className="text-center py-4">
            <div className="spinner-border spinner-border-sm text-primary" role="status" />
          </div>
        ) : (
          <>
            <div className="row g-2 mb-3">
              <div className="col-6">
                <div className="bg-light rounded p-2 small">
                  <div className="fw-semibold text-primary">Vacation Days</div>
                  <div className="text-muted small mb-1">
                    {vacUsed} / {vacTotal} used
                  </div>
                  <div className="progress" style={{ height: "4px" }}>
                    <div
                      className="progress-bar bg-primary"
                      style={{
                        width: `${vacTotal > 0 ? Math.min(100, (vacUsed / vacTotal) * 100) : 0}%`,
                      }}
                    />
                  </div>
                  <div className="text-muted small mt-1">{vacRemaining} remaining</div>
                </div>
              </div>
              <div className="col-6">
                <div className="bg-light rounded p-2 small">
                  <div className="fw-semibold text-warning">Sick Days</div>
                  <div className="text-muted small mb-1">
                    {sickUsed} / {sickTotal} used
                  </div>
                  <div className="progress" style={{ height: "4px" }}>
                    <div
                      className="progress-bar bg-warning"
                      style={{
                        width: `${sickTotal > 0 ? Math.min(100, (sickUsed / sickTotal) * 100) : 0}%`,
                      }}
                    />
                  </div>
                  <div className="text-muted small mt-1">{sickRemaining} remaining</div>
                </div>
              </div>
            </div>

            <div className="mb-3">
              <h6 className="small fw-semibold mb-2">Pending Requests</h6>
              {vacationRequests.filter((r) => r.status === "pending").length === 0 && sickRequests.filter((r) => r.status === "pending").length === 0 ? (
                <p className="text-muted small mb-0">No pending requests</p>
              ) : (
                <div style={{ overflowX: "auto", scrollbarWidth: "none", msOverflowStyle: "none" }}>
                  <table className="table table-sm table-hover mb-0" style={{ fontSize: "0.8rem" }}>
                    <thead className="table-light">
                      <tr>
                        <th>Type</th>
                        <th>From</th>
                        <th>To</th>
                        <th>Days</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...vacationRequests, ...sickRequests]
                        .filter((r) => r.status === "pending")
                        .map((req) => (
                          <tr key={req.id}>
                            <td>{req.leave_type === "vacation" ? "🏖️ Vacation" : "🤒 Sick"}</td>
                            <td>{req.start_date}</td>
                            <td>{req.end_date}</td>
                            <td>{req.days_requested ?? "—"}</td>
                            <td>
                              <span className={`badge bg-${statusColor(req.status)}`} style={{ fontSize: "0.7rem" }}>
                                {req.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <button type="button" className="btn btn-primary btn-sm w-100" onClick={() => openLeaveModal()}>
              <PlusCircleIcon className="h-4 w-4 me-1" style={{ display: "inline" }} />
              Request Leave
            </button>
          </>
        )}
      </div>
    </div>
  </div>
);

export default Panel_Benefits;
