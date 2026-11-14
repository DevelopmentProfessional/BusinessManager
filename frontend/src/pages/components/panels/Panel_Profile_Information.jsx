import React from "react";
import { UserIcon, ChevronUpIcon } from "@heroicons/react/24/outline";

export default function Panel_Profile_Information({
  user,
  isOpen = true,
  onToggle,
  maxHeight = "52vh",
  formatDate = (d) => (d ? new Date(d).toLocaleDateString() : "Not set"),
  getRoleBadgeColor = () => "primary",
  headerRef = null,
}) {
  if (!user) return null;

  return (
    <div className="border rounded overflow-hidden" style={{ background: "var(--bs-body-bg)" }}>
      {isOpen && (
        <div className="profile-accordion-body p-3" style={{ maxHeight, overflowY: "auto" }}>
          <div className="row g-2">
            <div className="col-sm-6">
              <div className="d-flex align-items-center gap-2 mb-1">
                <UserIcon className="app-icon text-muted" />
                <div className="fw-medium p-1">
                  {user.first_name} {user.last_name}
                </div>
              </div>
            </div>
            <div className="col-sm-6">
              <div className="d-flex align-items-center mb-1">
                <span className={`badge bg-${getRoleBadgeColor(user.role)} text-capitalize`}>{user.role || "Employee"}</span>
              </div>
            </div>
            <div className="col-sm-6">
              <div className="fw-medium p-1 small text-muted">{user.email || "Not set"}</div>
            </div>
            <div className="col-sm-6">
              <div className="fw-medium p-1 small text-muted">{user.phone || "Not set"}</div>
            </div>
            <div className="col-sm-6">
              <div className="fw-medium p-1 small text-muted">Hired: {formatDate(user.hire_date)}</div>
            </div>
            <div className="col-sm-6">
              <div className="fw-medium p-1 small text-muted">Last login: {formatDate(user.last_login)}</div>
            </div>
          </div>
          <hr className="my-2" />
          <h6 className="fw-semibold mb-2 small text-muted">Details</h6>
          <div className="row ui-row-g2 small">
            <div className="col-sm-6">
              <div className="ui-small-muted">Username</div>
              <div className="fw-medium">{user.username || "Not set"}</div>
            </div>
            <div className="col-sm-6">
              <div className="ui-small-muted">Employee ID</div>
              <div className="fw-medium">{user.id || "N/A"}</div>
            </div>
            <div className="col-sm-6">
              <div className="ui-small-muted">Location</div>
              <div className="fw-medium">{user.location || "Not set"}</div>
            </div>
            <div className="col-sm-6">
              <div className="ui-small-muted">IOD Number</div>
              <div className="fw-medium">{user.iod_number || "Not set"}</div>
            </div>
            <div className="col-sm-6">
              <div className="ui-small-muted">Reports To</div>
              <div className="fw-medium">{user.reports_to_name || user.reports_to || "Not set"}</div>
            </div>
            <div className="col-sm-6">
              <div className="ui-small-muted">Active</div>
              <div className="fw-medium">{user.is_active === false ? "No" : "Yes"}</div>
            </div>
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
          <UserIcon className="app-icon" />
          <span className="fw-semibold">Information</span>
        </div>
        <ChevronUpIcon className="app-icon" style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
      </div>
    </div>
  );
}
