// FILE: Panel_Profile.jsx
// Renders the personal info accordion panel: photo, name, role, email, phone, hire date, and detail fields.

import React from "react";
import {
  UserIcon,
  BriefcaseIcon,
  EnvelopeIcon,
  PhoneIcon,
  CalendarDaysIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";

const Panel_Profile = ({ user, isMobile, row1PanelBottom, formatDate, getRoleBadgeColor }) => (
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
      <div className="row">
        <div className="col-sm-6">
          <div className="flex wrap mb-1">
            <UserIcon className="w-4" />{" "}
            <div className="fw-medium p-1">
              {user.first_name} {user.last_name}
            </div>
          </div>
        </div>
        <div className="col-sm-6">
          <div className="flex wrap mb-1">
            <BriefcaseIcon className="w-4" />
            <span className={`badge bg-${getRoleBadgeColor(user.role)} text-capitalize`}>{user.role || "Employee"}</span>
          </div>
        </div>
        <div className="col-sm-6">
          <div className="flex wrap mb-1">
            <EnvelopeIcon className="w-4" />
            <div className="fw-medium p-1">{user.email || "Not set"}</div>
          </div>
        </div>
        <div className="col-sm-6">
          <div className="flex wrap mb-1">
            <PhoneIcon className="w-4" />
            <div className="fw-medium p-1">{user.phone || "Not set"}</div>
          </div>
        </div>
        <div className="col-sm-6">
          <div className="flex wrap mb-1">
            <CalendarDaysIcon className="w-4" />
            <div className="fw-medium p-1">{formatDate(user.hire_date)}</div>
          </div>
        </div>
        <div className="col-sm-6">
          <div className="flex wrap mb-1">
            <ClockIcon className="w-4" />
            <div className="fw-medium p-1">{formatDate(user.last_login)}</div>
          </div>
        </div>
      </div>
      <hr className="my-2" />
      <h6 className="fw-semibold mb-2">Details</h6>
      <div className="row g-2">
        <div className="col-sm-6">
          <div className="text-muted small">Username</div>
          <div className="fw-medium">{user.username || "Not set"}</div>
        </div>
        <div className="col-sm-6">
          <div className="text-muted small">Employee ID</div>
          <div className="fw-medium">{user.id || "N/A"}</div>
        </div>
        <div className="col-sm-6">
          <div className="text-muted small">Location</div>
          <div className="fw-medium">{user.location || "Not set"}</div>
        </div>
        <div className="col-sm-6">
          <div className="text-muted small">IOD Number</div>
          <div className="fw-medium">{user.iod_number || "Not set"}</div>
        </div>
        <div className="col-sm-6">
          <div className="text-muted small">Reports To</div>
          <div className="fw-medium">{user.reports_to_name || user.reports_to || "Not set"}</div>
        </div>
        <div className="col-sm-6">
          <div className="text-muted small">Active</div>
          <div className="fw-medium">{user.is_active === false ? "No" : "Yes"}</div>
        </div>
      </div>
    </div>
  </div>
);

export default Panel_Profile;
