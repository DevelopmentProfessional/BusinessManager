/*
 * ============================================================
 * FILE: Form_Client.jsx
 *
 * PURPOSE:
 *   Renders a create/edit form for a single client record. Handles
 *   contact details, membership tier and date fields, address, and
 *   notes. Surfaces field-level validation errors returned by the
 *   parent (e.g. duplicate name) and provides Cancel / Save actions.
 *
 * FUNCTIONAL PARTS:
 *   [1] Constants          — MEMBERSHIP_TIERS lookup array
 *   [2] State & Effects    — form data initialisation, error mapping
 *   [3] Handlers           — handleChange, handleSubmit
 *   [4] Render: Header     — title ("Add Client" / "Edit Client")
 *   [5] Render: Form Body  — contact fields, membership section, address/notes
 *   [6] Render: Footer     — Cancel and Save/Create action buttons
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-03-01 | Claude  | Added section comments and top-level documentation
 *   2026-03-07 | Claude  | Converted membership tier select to custom dropdown with per-option help
 * ============================================================
 */

import React, { useState, useEffect } from "react";
import { XMarkIcon, CheckIcon, ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import Button_Toolbar from "./Button_Toolbar";
import Modal_BulkImport from "./Modal_Import_Bulk";

// ─── 2 STATE & EFFECTS ─────────────────────────────────────────────────────────
export default function Form_Client({ client, onSubmit, onCancel, error = null, onBulkImport = null, memberships = [] }) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    notes: "",
    membership_tier: "none",
    membership_since: new Date().toISOString().split("T")[0],
    membership_expires: "",
    membership_points: 0,
    membership_ids: [],
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);

  useEffect(() => {
    if (client) {
      setFormData({
        name: client.name || "",
        email: client.email || "",
        phone: client.phone || "",
        address: client.address || "",
        notes: client.notes || "",
        membership_tier: client.membership_tier || "none",
        membership_since: client.membership_since ? client.membership_since.split("T")[0] : "",
        membership_expires: client.membership_expires ? client.membership_expires.split("T")[0] : "",
        membership_points: client.membership_points || 0,
        membership_ids: Array.isArray(client.membership_ids) ? client.membership_ids : [],
      });
    }
  }, [client]);

  // ─── 3 HANDLERS ──────────────────────────────────────────────────────────────
  const formatPhone = (raw) => {
    const digits = raw.replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "phone" ? formatPhone(value) : type === "number" ? parseInt(value, 10) || 0 : value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setFieldErrors({});
    const submitData = { ...formData };
    const primaryMembership = memberships.find((m) => submitData.membership_ids?.includes(m.id));
    submitData.membership_tier = primaryMembership?.name ? String(primaryMembership.name).toLowerCase() : "none";
    if (!submitData.membership_since) submitData.membership_since = null;
    if (!submitData.membership_expires) submitData.membership_expires = null;
    onSubmit(submitData);
  };

  const toggleMembership = (membershipId) => {
    setFormData((prev) => {
      const exists = prev.membership_ids.includes(membershipId);
      return {
        ...prev,
        membership_ids: exists ? prev.membership_ids.filter((id) => id !== membershipId) : [...prev.membership_ids, membershipId],
      };
    });
  };

  useEffect(() => {
    if (error) {
      const newFieldErrors = {};
      if (error.includes("name") && error.includes("already exists")) {
        newFieldErrors.name = "This client name already exists";
      }
      setFieldErrors(newFieldErrors);
    }
  }, [error]);

  // ─── 4 RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="d-flex flex-column bg-white dark:bg-gray-900" style={{ height: "100%" }}>
      {/* Header */}
      <div className="flex-shrink-0 p-2 border-bottom border-gray-200 dark:border-gray-700 d-flex justify-content-between align-items-center bg-white dark:bg-gray-900">
        <h6 className="mb-0 fw-semibold text-gray-900 dark:text-gray-100">{client ? "Edit Client" : "Add Client"}</h6>
        {!client && onBulkImport && (
          <button type="button" title="Bulk Import" onClick={() => setIsBulkImportOpen(true)} className="btn btn-sm p-1 text-gray-500 dark:text-gray-400" style={{ lineHeight: 1 }}>
            <ArrowUpTrayIcon style={{ width: 18, height: 18 }} />
          </button>
        )}
      </div>

      {isBulkImportOpen && (
        <Modal_BulkImport
          isOpen={isBulkImportOpen}
          onClose={() => setIsBulkImportOpen(false)}
          entityLabel="Clients"
          onImport={async (rows) => {
            await onBulkImport(rows.map((r) => r.name));
            setIsBulkImportOpen(false);
          }}
        />
      )}

      {/* ─── 5 RENDER: FORM BODY ────────────────────────────────────────────────── */}
      {/* Scrollable content */}
      <div className="flex-grow-1 overflow-auto no-scrollbar px-3 pt-3 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <form id="client-form" onSubmit={handleSubmit}>
          <div className="form-floating mb-2">
            <input type="text" id="fc_name" name="name" required value={formData.name} onChange={handleChange} className={`form-control form-control-sm ${fieldErrors.name ? "is-invalid" : ""}`} placeholder="Name" />
            <label htmlFor="fc_name">Name *</label>
            {fieldErrors.name && <div className="invalid-feedback">{fieldErrors.name}</div>}
          </div>

          <div className="form-floating mb-2">
            <input type="email" id="fc_email" name="email" value={formData.email} onChange={handleChange} className="form-control form-control-sm" placeholder="Email" />
            <label htmlFor="fc_email">Email</label>
          </div>

          <div className="form-floating mb-2">
            <input type="tel" id="fc_phone" name="phone" value={formData.phone} onChange={handleChange} className="form-control form-control-sm" placeholder="(555) 555-5555" pattern="\(\d{3}\) \d{3}-\d{4}" title="Phone number format: (555) 555-5555" />
            <label htmlFor="fc_phone">Phone</label>
          </div>

          {/* Membership section - below phone */}
          <hr className="my-2" />
          <div className="small fw-semibold text-muted mb-2">Subscriptions</div>

          <div className="row g-2 mb-2">
            <div className="col-12">
              <div className="border rounded p-2">
                <div className="small text-muted mb-2">A client can belong to multiple subscriptions.</div>
                <div className="d-flex flex-column gap-2" style={{ maxHeight: "170px", overflowY: "auto" }}>
                  {memberships.length === 0 ? (
                    <div className="small text-muted">No subscriptions created yet.</div>
                  ) : (
                    memberships.map((membership) => (
                      <label key={membership.id} className="d-flex align-items-start gap-2">
                        <input type="checkbox" checked={formData.membership_ids.includes(membership.id)} onChange={() => toggleMembership(membership.id)} />
                        <span className="small">
                          <span className="fw-semibold">{membership.name}</span>
                          <span className="text-muted"> {`- $${Number(membership.price || 0).toFixed(2)} / ${membership.billing_frequency || "monthly"}`}</span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div className="col-6">
              <div className="form-floating">
                <input type="number" id="fc_points" name="membership_points" min="0" value={formData.membership_points} onChange={handleChange} className="form-control form-control-sm" placeholder="0" />
                <label htmlFor="fc_points">Points</label>
              </div>
            </div>
            <div className="col-6">
              <div className="form-floating">
                <input type="date" id="fc_since" name="membership_since" value={formData.membership_since} onChange={handleChange} className="form-control form-control-sm" placeholder="Member Since" />
                <label htmlFor="fc_since">Member Since</label>
              </div>
            </div>
            <div className="col-6">
              <div className="form-floating">
                <input type="date" id="fc_expires" name="membership_expires" value={formData.membership_expires} onChange={handleChange} className="form-control form-control-sm" placeholder="Expires" />
                <label htmlFor="fc_expires">Expires</label>
              </div>
            </div>
          </div>

          {/* Address & Notes - border-top above */}
          <hr className="my-2" />
          <div className="form-floating mb-2">
            <textarea id="fc_address" name="address" value={formData.address} onChange={handleChange} className="form-control form-control-sm border-0" placeholder="Address" style={{ height: "60px" }} />
            <label htmlFor="fc_address">Address</label>
          </div>

          <div className="form-floating mb-2">
            <textarea id="fc_notes" name="notes" value={formData.notes} onChange={handleChange} className="form-control form-control-sm border-0" placeholder="Notes" style={{ height: "80px" }} />
            <label htmlFor="fc_notes">Notes</label>
          </div>
        </form>
      </div>

      {/* ─── 6 RENDER: FOOTER ───────────────────────────────────────────────────── */}
      {/* Footer */}
      <div className="flex-shrink-0 pt-2 pb-4 px-3 border-top border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="d-flex align-items-center">
          <div style={{ width: 40 }} />
          <div className="flex-grow-1 d-flex gap-3 justify-content-center">
            <Button_Toolbar icon={XMarkIcon} label="Cancel" onClick={onCancel} className="btn-outline-secondary" />
            <Button_Toolbar icon={CheckIcon} label={client ? "Save Changes" : "Create Client"} type="submit" form="client-form" className="btn-primary" />
          </div>
          <div style={{ width: 40 }} />
        </div>
      </div>
    </div>
  );
}
