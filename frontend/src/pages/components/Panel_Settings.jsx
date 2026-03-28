// FILE: Panel_Settings.jsx
// Renders the personal settings accordion panel: dark mode, calendar color, footer alignment, signature, training mode toggle, and logout.

import React from "react";
import {
  SunIcon,
  MoonIcon,
  CalendarDaysIcon,
  PencilIcon,
  ArrowLeftOnRectangleIcon,
  BookOpenIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";
import { PencilSquareIcon } from "@heroicons/react/24/solid";
import Button_Toolbar from "./Button_Toolbar";
import api from "../../services/api";

const Panel_Settings = ({
  isMobile,
  row1PanelBottom,
  isDarkMode,
  toggleDarkMode,
  employeeColor,
  pendingColor,
  setPendingColor,
  colorPickerOpen,
  setColorPickerOpen,
  colorUpdating,
  colorMessage,
  handleColorSave,
  FooterAlignIcon,
  cycleFooterAlign,
  user,
  setSignatureModalOpen,
  isTrainingMode,
  toggleViewMode,
  handleLogout,
  currentDbEnvironment,
  dbLoading,
  dbMessage,
  dbError,
  handleSwitchEnvironment,
  DB_ENVIRONMENTS,
}) => (
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
      boxShadow: "0 -2px 10px rgba(0,0,0,0.1)",
      display: "flex",
      flexDirection: "column",
    }}
  >
    <div className="d-flex align-items-center flex-wrap gap-1 mb-2">
      <span className="text-muted small me-1">Environment</span>
      {Object.entries(DB_ENVIRONMENTS).map(([key, env]) => {
        const isCurrent = key === currentDbEnvironment;
        return (
          <span
            key={key}
            role="radio"
            aria-checked={isCurrent}
            tabIndex={0}
            className={`badge rounded-pill px-3 py-2 ${isCurrent ? "bg-primary text-white" : "bg-transparent text-secondary border"}`}
            style={{ cursor: isCurrent || dbLoading ? "default" : "pointer", fontSize: "0.8rem", transition: "all 0.15s ease", userSelect: "none" }}
            onClick={() => !isCurrent && !dbLoading && handleSwitchEnvironment(key)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                !isCurrent && !dbLoading && handleSwitchEnvironment(key);
              }
            }}
          >
            {env.name}
          </span>
        );
      })}
      {dbLoading && (
        <div className="spinner-border spinner-border-sm text-primary" role="status">
          <span className="visually-hidden">Updating...</span>
        </div>
      )}
    </div>
    {dbMessage && <div className="small text-success mt-1">{dbMessage}</div>}
    {dbError && <div className="small text-danger mt-1">{dbError}</div>}

    <div style={{ flexGrow: isMobile ? 0 : 1, minHeight: isMobile ? 0 : undefined }}></div>

    <div className="d-flex align-items-center justify-content-start gap-1 mb-3 flex-wrap" style={{ minHeight: "3rem" }}>
      <Button_Toolbar icon={isDarkMode ? MoonIcon : SunIcon} label={isDarkMode ? "Light" : "Dark"} onClick={toggleDarkMode} className={`settings-accordion-btn ${isDarkMode ? "text-white" : ""}`} style={{ backgroundColor: isDarkMode ? "#3B82F6" : "#F59E0B", border: "none" }} />

      <div className="position-relative">
        <Button_Toolbar
          icon={CalendarDaysIcon}
          label="Color"
          onClick={() => {
            setPendingColor(employeeColor);
            setColorPickerOpen((prev) => !prev);
          }}
          className="settings-accordion-btn"
          style={{ backgroundColor: employeeColor, border: "0px solid var(--bs-border-color, #dee2e6)", color: "white" }}
          disabled={colorUpdating}
          aria-expanded={colorPickerOpen}
        />
        {colorPickerOpen && (
          <div className="position-absolute bottom-100 mb-5 start-0  border bg-white dark:bg-gray-800 shadow-lg d-flex justify-content-start gap-4" style={{ zIndex: 10, borderBottomRightRadius: "3rem", borderTopRightRadius: "3rem" }}>
            <div className="d-flex align-items-center gap-1 ">
              <input type="color" value={pendingColor} onChange={(e) => setPendingColor(e.target.value)} className="" style={{ width: "3rem", height: "3rem", padding: "0px", cursor: colorUpdating ? "not-allowed" : "pointer", opacity: colorUpdating ? 0.6 : 1 }} disabled={colorUpdating} />
              <span className="small text-muted">{pendingColor.toUpperCase()}</span>
            </div>
            <div className="d-flex gap-2 justify-content-end">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => {
                  setPendingColor(employeeColor);
                  setColorPickerOpen(false);
                }}
                disabled={colorUpdating}
              >
                Cancel
              </button>
              <button type="button" className="btn btn-sm btn-primary" onClick={handleColorSave} disabled={colorUpdating}>
                Save
              </button>
            </div>
          </div>
        )}
      </div>

      <Button_Toolbar icon={FooterAlignIcon} label="Align" onClick={cycleFooterAlign} className="settings-accordion-btn btn-outline-secondary" title="Cycle footer alignment" />

      <Button_Toolbar icon={user?.signature_data || user?.signature_url ? PencilSquareIcon : PencilIcon} label="Signature" onClick={() => setSignatureModalOpen(true)} className="settings-accordion-btn btn-outline-secondary" />

      <button
        type="button"
        onClick={async () => {
          toggleViewMode();
          if (user?.id) {
            try {
              await api.put(`/isud/user/${user.id}`, { training_mode: !isTrainingMode });
            } catch (_) {}
          }
        }}
        className="btn btn-sm btn-outline-secondary rounded-pill px-2 d-flex justify-content-center align-items-center"
        style={isTrainingMode ? { height: "3rem" } : { width: "3rem", minWidth: "3rem", height: "3rem" }}
        title={isTrainingMode ? "Switch to compact mode" : "Switch to training mode"}
      >
        {isTrainingMode ? (
          <>
            <Squares2X2Icon className="h-5 w-5" />
            <span className="ms-1" style={{ fontSize: "0.78rem" }}>
              Compact
            </span>
          </>
        ) : (
          <BookOpenIcon className="h-5 w-5" />
        )}
      </button>

      <Button_Toolbar icon={ArrowLeftOnRectangleIcon} label="Log out" onClick={handleLogout} className="settings-accordion-btn btn-outline-secondary" />
    </div>

    {colorMessage && <div className={`small mb-2 ${colorMessage.includes("Failed") || colorMessage.includes("Error") ? "text-danger" : "text-success"}`}>{colorMessage}</div>}
  </div>
);

export default Panel_Settings;
