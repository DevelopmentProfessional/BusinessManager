import React from "react";
import Modal from "./Modal";
import Button_Toolbar from "../buttons/Button_Toolbar";
import Footer_Actions from "../footers/Footer_Actions";
import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";

const PRESET_COLORS = [
  "#3B82F6", // Blue (default)
  "#0EA5E9", // Sky
  "#06B6D4", // Cyan
  "#14B8A6", // Teal
  "#10B981", // Green
  "#84CC16", // Lime
  "#EAB308", // Yellow
  "#F59E0B", // Amber
  "#F97316", // Orange
  "#EF4444", // Red
  "#F43F5E", // Rose
  "#EC4899", // Pink
  "#A855F7", // Purple
  "#8B5CF6", // Violet
  "#7C3AED", // Deep Violet
  "#6366F1", // Indigo
  "#64748B", // Slate
  "#1E293B", // Dark
];

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

  const normalizedColor = (pendingColor || "#3B82F6").toUpperCase();

  return (
    <Modal isOpen={isOpen} onClose={handleClose} centered noPadding>
      <div className="ui-component-shell">
        <div className="component-header">
          <div className="component-header-left">Theme color</div>
          <div className="component-header-center"></div>
          <div className="component-header-right"></div>
        </div>

        <div className="component-body">
          <div className="component-body-inner">
            <div className="d-flex flex-column align-items-center gap-3 text-center">
              <p className="mb-0 ui-small-muted">Choose your personal theme color. It applies to buttons, highlights, and your calendar events.</p>

              {/* Cross-platform preset color palette (accessible on both mobile and PC) */}
              <div className="d-flex flex-wrap gap-2 justify-content-center" style={{ maxWidth: "22rem" }}>
                {PRESET_COLORS.map((color) => {
                  const isSelected = normalizedColor === color.toUpperCase();
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => onPendingColorChange(color)}
                      className="rounded-circle border-0 flex-shrink-0 transition-all"
                      style={{
                        width: "2.125rem",
                        height: "2.125rem",
                        backgroundColor: color,
                        cursor: saving ? "not-allowed" : "pointer",
                        outline: isSelected ? "3px solid var(--bs-body-color, #fff)" : "1px solid var(--bs-border-color, rgba(0,0,0,0.15))",
                        outlineOffset: "2px",
                        transform: isSelected ? "scale(1.15)" : "scale(1)",
                        boxShadow: isSelected ? "0 0.125rem 0.5rem rgba(0,0,0,0.25)" : "none",
                      }}
                      disabled={saving}
                      title={color}
                      aria-label={`Select ${color}`}
                    />
                  );
                })}
              </div>

              {/* Single color button with value above it (no duplicate display element) */}
              <div className="d-flex flex-column align-items-center gap-1 mt-1">
                <span className="font-monospace fw-semibold small text-body-emphasis">{normalizedColor}</span>
                <input
                  type="color"
                  value={pendingColor}
                  onChange={(e) => onPendingColorChange(e.target.value)}
                  className="form-control form-control-color border rounded-circle shadow-sm"
                  style={{
                    width: "3rem",
                    height: "3rem",
                    padding: "0.2rem",
                    cursor: saving ? "not-allowed" : "pointer",
                    backgroundColor: pendingColor,
                  }}
                  disabled={saving}
                  aria-label="Pick custom color"
                  title="Pick custom color"
                />
              </div>

              {message && (
                <div className={`small mb-0 ${message.includes("Failed") || message.includes("Error") ? "text-danger" : "text-success"}`}>{message}</div>
              )}
            </div>
          </div>
        </div>

        <div className="component-footer">
          <Footer_Actions
            start={<Button_Toolbar icon={CheckIcon} label={saving ? "Saving…" : "Save"} onClick={handleSave} disabled={saving} className="btn-primary" title="Save color" />}
            center={<Button_Toolbar icon={XMarkIcon} label="Close" onClick={handleClose} disabled={saving} className="btn-outline-secondary" title="Close" />}
          />
        </div>
      </div>
    </Modal>
  );
}
