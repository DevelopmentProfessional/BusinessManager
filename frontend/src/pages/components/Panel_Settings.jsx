// FILE: Panel_Settings.jsx
// Renders the personal settings accordion panel: dark mode, theme color, footer alignment, signature, training mode toggle, and logout.

import React from "react";
import { SunIcon, MoonIcon, CalendarDaysIcon, PencilIcon, ArrowLeftOnRectangleIcon, BookOpenIcon, Squares2X2Icon, AdjustmentsHorizontalIcon } from "@heroicons/react/24/outline";
import { PencilSquareIcon } from "@heroicons/react/24/solid";
import Button_Toolbar from "./Button_Toolbar";
import Modal_Color_Picker from "./Modal_Color_Picker";
import api from "../../services/api";

const Panel_Settings = ({
  embedded = false,
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
  buttonTextSize,
  cycleButtonTextSize,
  handleLogout,
  currentDbEnvironment,
  dbLoading,
  dbMessage,
  dbError,
  handleSwitchEnvironment,
  DB_ENVIRONMENTS,
  HelpIcon,
}) => {
  const containerStyle = embedded
    ? {
        position: "relative",
        width: "100%",
        height: "auto",
        overflowY: "visible",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        backgroundColor: "transparent",
        zIndex: "auto",
        paddingTop: 0,
        paddingLeft: 0,
        paddingRight: 0,
        paddingBottom: 0,
        boxShadow: "none",
        display: "flex",
        flexDirection: "column",
      }
    : {
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
      };

  return (
    <div className={embedded ? "" : "accordion-popup"} style={containerStyle}>
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

      {!embedded && <div style={{ flexGrow: isMobile ? 0 : 1, minHeight: isMobile ? 0 : undefined }}></div>}

      <div className="d-flex align-items-center justify-content-start gap-1 mb-3 flex-wrap" style={{ minHeight: "3rem" }}>
        <Button_Toolbar icon={isDarkMode ? MoonIcon : SunIcon} label={isDarkMode ? "Light" : "Dark"} onClick={toggleDarkMode} className={`settings-accordion-btn ${isDarkMode ? "text-white" : ""}`} style={{ backgroundColor: isDarkMode ? "#3B82F6" : "#F59E0B", border: "none" }} />

        <Button_Toolbar
          icon={CalendarDaysIcon}
          label="Color"
          onClick={() => {
            setPendingColor(employeeColor);
            setColorPickerOpen(true);
          }}
          className="settings-accordion-btn"
          style={{ backgroundColor: employeeColor, border: "0px solid var(--bs-border-color, #dee2e6)", color: "white" }}
          disabled={colorUpdating}
          aria-haspopup="dialog"
          aria-expanded={colorPickerOpen}
        />

        <Modal_Color_Picker
          isOpen={colorPickerOpen}
          onClose={() => {
            setPendingColor(employeeColor);
            setColorPickerOpen(false);
          }}
          pendingColor={pendingColor}
          onPendingColorChange={setPendingColor}
          onSave={handleColorSave}
          saving={colorUpdating}
          message={colorMessage}
        />

        <Button_Toolbar icon={FooterAlignIcon} label="Align" onClick={cycleFooterAlign} className="settings-accordion-btn btn-outline-secondary" title="Cycle footer alignment" />

        <Button_Toolbar icon={user?.signature_data || user?.signature_url ? PencilSquareIcon : PencilIcon} label="Sign" onClick={() => setSignatureModalOpen(true)} className="settings-accordion-btn btn-outline-secondary" title="Signature" />

        <Button_Toolbar
          icon={isTrainingMode ? Squares2X2Icon : BookOpenIcon}
          label={isTrainingMode ? "Icons" : "Train"}
          onClick={async () => {
            const nextTrainingMode = !isTrainingMode;
            toggleViewMode();
            if (user?.id) {
              try {
                await api.put(`/isud/user/${user.id}`, {
                  training_mode: nextTrainingMode,
                  training_mode_explicit: true,
                });
              } catch (_) {}
            }
          }}
          className="settings-accordion-btn btn-outline-secondary"
          title={isTrainingMode ? "Switch to compact mode" : "Switch to training mode"}
        />

        <Button_Toolbar icon={AdjustmentsHorizontalIcon} label="Size" onClick={cycleButtonTextSize} className="settings-accordion-btn btn-outline-secondary" title={`Text size: ${buttonTextSize}`} />

        <Button_Toolbar icon={ArrowLeftOnRectangleIcon} label="Exit" onClick={handleLogout} className="settings-accordion-btn btn-outline-secondary" title="Log out" />
      </div>
    </div>
  );
};

export default Panel_Settings;
