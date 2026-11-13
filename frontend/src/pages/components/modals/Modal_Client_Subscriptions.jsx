import React from "react";
import Modal from "./Modal";
import Dropdown_Custom from "../dropdowns/Dropdown_Custom";
import { CheckCircleIcon, XCircleIcon, PencilIcon, TrashIcon, XMarkIcon } from "@heroicons/react/24/outline";

export default function Modal_Client_Subscriptions({
  isOpen,
  onClose,
  memberships = [],
  membershipForm,
  setMembershipForm,
  editingMembershipId,
  onSave,
  onEdit,
  onDelete,
  onReset,
  saving = false,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Manage Subscriptions"
      centered={true}
      contentGravity="top"
      footer={
        <div className="component-footer-left d-flex align-items-center gap-1">
          <button
            type="button"
            onClick={onClose}
            className="btn ui-btn-circle-outline-secondary btn-circle"
            title="Close"
          >
            <XMarkIcon />
          </button>
        </div>
      }
    >
      <div className="d-flex flex-column gap-3 p-1">
        <div className="border d-flex flex-column gap-2 p-2 rounded ui-pill-container bg-body">
          <input type="text" className="form-control ui-control-sm" placeholder="Subscription name" value={membershipForm.name} onChange={(e) => setMembershipForm((p) => ({ ...p, name: e.target.value }))} />
          <div className="d-flex gap-2">
            <input type="number" min="0" step="0.01" className="form-control ui-control-sm ui-number-narrow" placeholder="Price" value={membershipForm.price} onChange={(e) => setMembershipForm((p) => ({ ...p, price: e.target.value }))} />
            <Dropdown_Custom
              className="ui-control-sm flex-grow-1"
              value={membershipForm.billing_frequency}
              onChange={(e) => setMembershipForm((p) => ({ ...p, billing_frequency: e.target.value }))}
              options={[
                { value: "daily", label: "Daily" },
                { value: "weekly", label: "Weekly" },
                { value: "monthly", label: "Monthly" },
                { value: "yearly", label: "Yearly" },
              ]}
              placeholder="Billing frequency"
              closeOnSelect
            />
          </div>
          <div className="d-flex gap-2">
            <input type="number" min="0" className="form-control ui-control-sm ui-number-narrow" placeholder="Lock term" value={membershipForm.lock_term_count} onChange={(e) => setMembershipForm((p) => ({ ...p, lock_term_count: e.target.value }))} />
            <Dropdown_Custom
              className="ui-control-sm flex-grow-1"
              value={membershipForm.lock_term_unit}
              onChange={(e) => setMembershipForm((p) => ({ ...p, lock_term_unit: e.target.value }))}
              options={[
                { value: "days", label: "Days" },
                { value: "weeks", label: "Weeks" },
                { value: "months", label: "Months" },
                { value: "years", label: "Years" },
              ]}
              placeholder="Lock term unit"
              closeOnSelect
            />
          </div>
          <textarea className="ui-description-textarea form-control form-control-sm" rows={6} placeholder="Description" value={membershipForm.description} onChange={(e) => setMembershipForm((p) => ({ ...p, description: e.target.value }))} />
          <div className="d-flex gap-2">
            <button type="button" className="align-items-center btn btn-primary btn-sm d-flex gap-2" onClick={onSave} disabled={saving}>
              <CheckCircleIcon className="ui-icon-4" />
              <span>{editingMembershipId ? "Update" : "Create"}</span>
            </button>
            {editingMembershipId && (
              <button type="button" className="align-items-center btn btn-outline-secondary btn-sm d-flex gap-2" onClick={onReset}>
                <XCircleIcon className="ui-icon-4" />
                <span>Cancel</span>
              </button>
            )}
          </div>
        </div>

        <div className="d-flex flex-column gap-2" style={{ maxHeight: "220px", overflowY: "auto" }}>
          {memberships.map((membership) => (
            <div key={membership.id} className="align-items-start border d-flex gap-2 justify-content-between p-2 rounded bg-body">
              <div className="small">
                <div className="fw-semibold">{membership.name}</div>
                <div className="text-muted">{`$${Number(membership.price || 0).toFixed(2)} / ${membership.billing_frequency || "monthly"}`}</div>
                <div className="text-muted">{`Lock: ${membership.lock_term_count || 0} ${membership.lock_term_unit || "months"}`}</div>
              </div>
              <div className="d-flex gap-1">
                <button type="button" className="align-items-center btn btn-outline-primary btn-sm d-flex gap-1" onClick={() => onEdit(membership)}>
                  <PencilIcon className="ui-icon-4" />
                  <span>Edit</span>
                </button>
                <button type="button" className="btn btn-circle btn-outline-danger" onClick={() => onDelete(membership.id)} title="Delete subscription">
                  <TrashIcon style={{ width: 14, height: 14 }} />
                </button>
              </div>
            </div>
          ))}
          {memberships.length === 0 && <div className="ui-small-muted text-center py-2">No subscriptions yet.</div>}
        </div>
      </div>
    </Modal>
  );
}
