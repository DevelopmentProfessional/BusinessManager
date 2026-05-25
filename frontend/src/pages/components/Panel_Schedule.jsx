// FILE: Panel_Schedule.jsx
// Renders the schedule settings accordion panel: business hours, days of operation, attendance toggle, and ScheduleSettingsCard.

import React from "react";
import ScheduleSettingsCard from "./Modal_SettingsSchedule";
import Footer_Settings from "./Footer_Settings";

const Panel_Schedule = ({ isMobile, settingsPanelStyle, userId, HelpIcon, onClose, scheduleSettingsRef, onSave, saving = false }) => (
  <div className="accordion-popup d-flex flex-column min-h-0" style={settingsPanelStyle}>
    <div className="flex-grow-1 min-h-0 overflow-auto" style={{ flexShrink: 0, width: "100%" }}>
      <ScheduleSettingsCard ref={scheduleSettingsRef} hideFooter userId={userId} HelpIcon={HelpIcon} />
    </div>
    {onClose && <Footer_Settings onSave={onSave} onClose={onClose} saving={saving} />}
  </div>
);

export default Panel_Schedule;
