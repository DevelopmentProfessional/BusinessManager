import React from "react";
import Modal from "./Modal";
import Dropdown_Custom from "../dropdowns/Dropdown_Custom";
import { XMarkIcon } from "@heroicons/react/24/outline";

export default function Modal_Profile_LeaveRequest({
  isOpen,
  onClose,
  onSubmit,
  leaveForm,
  setLeaveForm,
  leaveModalType,
  setLeaveModalType,
  leaveError,
  setLeaveError,
  leaveSubmitting = false,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New Request"
      footer={
        <div className="component-footer-left d-flex align-items-center gap-1">
          <button type="submit" form="profile-leave-form" className="btn btn-primary btn-sm" disabled={leaveSubmitting}>
            {leaveSubmitting ? "Submitting…" : "Submit"}
          </button>
          <button
            type="button"
            className="btn ui-btn-circle-outline-secondary btn-circle"
            onClick={onClose}
            title="Cancel"
          >
            <XMarkIcon />
          </button>
        </div>
      }
    >
      <form id="profile-leave-form" onSubmit={onSubmit} className="p-1">
        {leaveError && <div className="alert alert-danger mb-2 py-1 small">{leaveError}</div>}
        <div className="mb-2">
          <label className="form-label ui-form-label-sm">Request Type</label>
          <Dropdown_Custom
            className="ui-control-sm"
            value={leaveModalType}
            onChange={(e) => {
              setLeaveModalType(e.target.value);
              setLeaveForm({ start_date: "", end_date: "", notes: "" });
              setLeaveError?.("");
            }}
            options={[
              { value: "vacation", label: "Vacation" },
              { value: "sick", label: "Sick" },
              { value: "onboarding", label: "Onboarding" },
              { value: "offboarding", label: "Offboarding" },
            ]}
            placeholder="Request type"
            closeOnSelect
          />
        </div>
        {leaveModalType === "vacation" || leaveModalType === "sick" ? (
          <>
            <div className="mb-2">
              <label className="form-label ui-form-label-sm">Start Date</label>
              <input type="date" className="form-control ui-control-sm" value={leaveForm.start_date} onChange={(e) => setLeaveForm((f) => ({ ...f, start_date: e.target.value }))} required />
            </div>
            <div className="mb-2">
              <label className="form-label ui-form-label-sm">End Date</label>
              <input type="date" className="form-control ui-control-sm" value={leaveForm.end_date} min={leaveForm.start_date || undefined} onChange={(e) => setLeaveForm((f) => ({ ...f, end_date: e.target.value }))} required />
            </div>
          </>
        ) : (
          <div className="mb-2">
            <label className="form-label ui-form-label-sm">Requested Date (optional)</label>
            <input type="date" className="form-control ui-control-sm" value={leaveForm.start_date} onChange={(e) => setLeaveForm((f) => ({ ...f, start_date: e.target.value }))} />
          </div>
        )}
        <div className="mb-0">
          <label className="form-label ui-form-label-sm">Notes (optional)</label>
          <textarea className="form-control ui-control-sm" rows={6} value={leaveForm.notes} onChange={(e) => setLeaveForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Reason or additional info..." />
        </div>
      </form>
    </Modal>
  );
}
