import React from "react";
import Modal from "./Modal";
import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";

/**
 * Per-user theme / active color picker.
 */
export default function Modal_ColorPicker({ isOpen, onClose, pendingColor, onPendingColorChange, onSave, saving = false, message = "" }) {
  const handleClose = () => {
    if (!saving) onClose();
  };

  const handleSave = async () => {
    if (saving) return;
    await onSave();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} centered noPadding>
      <div className="component">
        <div className="component-header">
          <div className="component-header-left">Theme color</div>
          <div className="component-header-center"></div>
          <div className="component-header-right"></div>
        </div>

        <div className="component-body">
          <div className="component-body-inner">
            <div className="d-flex flex-column gap-3">
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
          </div>
        </div>

        <div className="component-footer">
          <div className="component-footer-left">
            <button type="button" onClick={handleSave} disabled={saving} className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1" title="Save color">
              <CheckIcon style={{ width: 16, height: 16 }} />
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
          <div className="component-footer-center">
            <button type="button" onClick={handleClose} disabled={saving} className="btn btn-circle btn-outline-secondary" title="Close">
              <XMarkIcon />
            </button>
          </div>
          <div className="component-footer-right"></div>
        </div>
      </div>
    </Modal>
  );
}
