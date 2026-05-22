import React from "react";
import { CheckCircleIcon, XMarkIcon } from "@heroicons/react/24/outline";
import Modal from "./Modal";
import Footer_Actions from "./Footer_Actions";
import Button_Toolbar from "./Button_Toolbar";

/**
 * Per-user theme / active color picker — uses shared Modal + footer actions.
 */
export default function Modal_Color_Picker({ isOpen, onClose, pendingColor, onPendingColorChange, onSave, saving = false, message = "" }) {
  const handleClose = () => {
    if (!saving) onClose();
  };

  const handleSave = async () => {
    if (saving) return;
    await onSave();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Theme color"
      centered
      footer={
        <Footer_Actions
          className="app-form-footer p-1"
          start={
            <Button_Toolbar
              icon={CheckCircleIcon}
              label="Save"
              onClick={handleSave}
              className="btn-primary"
              disabled={saving}
              title="Save theme color"
            />
          }
          center={
            <Button_Toolbar
              icon={XMarkIcon}
              label="Cancel"
              onClick={handleClose}
              className="btn-app-cancel"
              disabled={saving}
              title="Cancel"
            />
          }
        />
      }
    >
      <div className="p-2 d-flex flex-column gap-3">
        <p className="small text-muted mb-0">Choose your personal theme color. It applies to buttons, highlights, and your calendar events.</p>
        <div className="d-flex align-items-center gap-3">
          <input
            type="color"
            value={pendingColor}
            onChange={(e) => onPendingColorChange(e.target.value)}
            className="form-control form-control-color flex-shrink-0"
            style={{ width: "3rem", height: "3rem", padding: 0, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}
            disabled={saving}
            aria-label="Pick color"
          />
          <div className="d-flex flex-column gap-1 min-w-0">
            <span className="fw-semibold text-body-emphasis">{pendingColor.toUpperCase()}</span>
            <span
              className="rounded-pill d-inline-block"
              style={{ width: "100%", maxWidth: "8rem", height: "1.25rem", backgroundColor: pendingColor, border: "1px solid var(--bs-border-color)" }}
              aria-hidden="true"
            />
          </div>
        </div>
        {message && (
          <div className={`small mb-0 ${message.includes("Failed") || message.includes("Error") ? "text-danger" : "text-success"}`}>{message}</div>
        )}
      </div>
    </Modal>
  );
}
