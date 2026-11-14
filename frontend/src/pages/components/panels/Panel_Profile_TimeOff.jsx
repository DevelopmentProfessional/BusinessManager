import React from "react";
import { ChevronUpIcon, PlusCircleIcon, CalendarDaysIcon } from "@heroicons/react/24/outline";
import Button_InsuranceDocument from "../buttons/Button_InsuranceDocument";

export default function Panel_Profile_TimeOff({
  user,
  isOpen = true,
  onToggle,
  maxHeight = "52vh",
  insurancePlans = [],
  leaveRequestsLoading = false,
  vacUsed = 0,
  vacTotal = 0,
  vacRemaining = 0,
  sickUsed = 0,
  sickTotal = 0,
  sickRemaining = 0,
  vacationRequests = [],
  sickRequests = [],
  onOpenNewRequest,
  headerRef = null,
}) {
  if (!user) return null;

  const allRequests = [...vacationRequests, ...sickRequests];
  const pendingRequests = allRequests.filter((r) => r.status === "pending");
  const historyRequests = allRequests.filter((r) => r.status !== "pending");

  return (
    <div className="border rounded overflow-hidden" style={{ background: "var(--bs-body-bg)" }}>
      {isOpen && (
        <div className="profile-accordion-body p-3" style={{ maxHeight, overflowY: "auto" }}>
          <div className="g-2 mb-3 row">
            <div className="col-sm-6">
              <div className="ui-small-muted">Salary</div>
              <div className="fw-medium">{user.salary != null ? `$${Number(user.salary).toLocaleString()}` : "Not set"}</div>
            </div>
            <div className="col-sm-6">
              <div className="ui-small-muted">Pay Frequency</div>
              <div className="fw-medium text-capitalize">{user.pay_frequency || "Not set"}</div>
            </div>
            <div className="col-sm-6">
              <div className="ui-small-muted">Insurance Plan</div>
              <div className="ui-flex-center-gap-2">
                <span className="fw-medium">{user.insurance_plan || "Not set"}</span>
                {user.insurance_plan && <Button_InsuranceDocument planId={insurancePlans.find((p) => p.name === user.insurance_plan)?.id} planName={user.insurance_plan} insurancePlans={insurancePlans} title="View plan document" />}
              </div>
            </div>
          </div>

          <div className="border-top pt-2">
            <h6 className="fw-semibold mb-3">Requests</h6>

            {leaveRequestsLoading ? (
              <div className="py-2 text-center">
                <div className="spinner-border spinner-border-sm text-primary" role="status" />
              </div>
            ) : (
              <>
                <div className="g-2 mb-3 row">
                  <div className="col-6">
                    <div className="bg-light dark:bg-gray-800 p-2 rounded small">
                      <div className="fw-semibold text-primary">Vacation Days</div>
                      <div className="mb-1 small text-muted">
                        {vacUsed} / {vacTotal} used
                      </div>
                      <div className="progress" style={{ height: 6 }}>
                        <div className="bg-primary progress-bar" style={{ width: `${vacTotal > 0 ? Math.min(100, (vacUsed / vacTotal) * 100) : 0}%` }} />
                      </div>
                      <div className="mt-1 ui-small-muted">{vacRemaining} remaining</div>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="bg-light dark:bg-gray-800 p-2 rounded small">
                      <div className="fw-semibold text-warning">Sick Days</div>
                      <div className="mb-1 small text-muted">
                        {sickUsed} / {sickTotal} used
                      </div>
                      <div className="progress" style={{ height: 6 }}>
                        <div className="bg-warning progress-bar" style={{ width: `${sickTotal > 0 ? Math.min(100, (sickUsed / sickTotal) * 100) : 0}%` }} />
                      </div>
                      <div className="mt-1 ui-small-muted">{sickRemaining} remaining</div>
                    </div>
                  </div>
                </div>

                <div className="mb-3">
                  <h6 className="fw-semibold mb-2 ui-text-sm">Pending Requests</h6>
                  {pendingRequests.length === 0 ? (
                    <div className="small text-muted py-1">No pending requests</div>
                  ) : (
                    <div className="d-flex flex-column gap-1">
                      {pendingRequests.map((r) => (
                        <div key={r.id} className="d-flex justify-content-between align-items-center small p-1 border rounded">
                          <span>{r.type || "Leave"}: {r.start_date} to {r.end_date}</span>
                          <span className="badge bg-warning-subtle text-warning">{r.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mb-3">
                  <h6 className="fw-semibold mb-2 ui-text-sm">History</h6>
                  {historyRequests.length === 0 ? (
                    <div className="small text-muted py-1">No leave history yet</div>
                  ) : (
                    <div className="d-flex flex-column gap-1">
                      {historyRequests.map((r) => (
                        <div key={r.id} className="d-flex justify-content-between align-items-center small p-1 border rounded">
                          <span>{r.type || "Leave"}: {r.start_date} to {r.end_date}</span>
                          <span className={`badge ${r.status === "approved" ? "bg-success-subtle text-success" : "bg-secondary-subtle text-secondary"}`}>{r.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button type="button" className="btn btn-primary btn-sm w-100 d-flex align-items-center justify-content-center gap-1" onClick={onOpenNewRequest}>
                  <PlusCircleIcon className="h-4 w-4" />
                  <span>New Request</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}
      <div
        ref={headerRef}
        role="button"
        tabIndex={0}
        className="profile-accordion-header d-flex justify-content-between align-items-center p-2 border-top bg-body-tertiary"
        data-active={isOpen}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle?.();
          }
        }}
        style={{ cursor: "pointer" }}
      >
        <div className="d-flex align-items-center gap-2">
          <CalendarDaysIcon className="app-icon" />
          <span className="fw-semibold">Time Off</span>
        </div>
        <ChevronUpIcon className="app-icon" style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
      </div>
    </div>
  );
}
