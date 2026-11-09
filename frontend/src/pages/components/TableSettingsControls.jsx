import React from "react";
import { TABLE_TEXT_SIZES } from "../../services/useTableSettings";

export default function TableSettingsControls({ settings, onChange, toggles = [] }) {
  const currentTextSize = settings?.textSize || "medium";

  return (
    <div className="border-top dark:border-gray-700 mt-2 pt-2">
      <div className="fw-semibold mb-2 small">Table Preferences</div>

      {/* Text Size Controls */}
      <div className="mb-2">
        <label className="d-block mb-1 text-muted text-xs">Table Text Size</label>
        <div className="btn-group btn-group-sm w-100" role="group" aria-label="Table text size">
          {TABLE_TEXT_SIZES.map((size) => (
            <button
              key={size.id}
              type="button"
              onClick={() => onChange({ textSize: size.id })}
              className={`btn ${currentTextSize === size.id ? "btn-primary" : "btn-outline-secondary"}`}
            >
              {size.label}
            </button>
          ))}
        </div>
      </div>

      {/* Column Visibility Toggles */}
      {toggles.length > 0 && (
        <div className="d-flex flex-column gap-2 mt-2">
          <label className="d-block mb-0 text-muted text-xs">Column Visibility</label>
          {toggles.map((toggle) => {
            const isChecked = settings?.[toggle.key] !== false;
            return (
              <div key={toggle.key} className="align-items-center d-flex justify-content-between">
                <div>
                  <div className="small fw-medium">{toggle.label}</div>
                  {toggle.description && <div className="text-muted text-xxs">{toggle.description}</div>}
                </div>
                <div className="form-check form-switch m-0">
                  <input
                    type="checkbox"
                    role="switch"
                    id={`toggle-${toggle.key}`}
                    checked={isChecked}
                    onChange={(e) => onChange({ [toggle.key]: e.target.checked })}
                    className="form-check-input cursor-pointer"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
