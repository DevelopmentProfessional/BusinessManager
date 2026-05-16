// FILE: Panel_Schedule.jsx
// Renders the schedule settings accordion panel: business hours, days of operation, attendance toggle, and ScheduleSettingsCard.

import React from "react";
import ScheduleSettingsCard from "./ScheduleSettings";

const Panel_Schedule = ({
  isMobile,
  settingsPanelStyle,
  userId,
  HelpIcon,
}) => (
  <div className="accordion-popup" style={settingsPanelStyle}>
    <div style={{ flexGrow: isMobile ? 0 : 1, minHeight: isMobile ? 0 : undefined }} />
    <div style={{ flexShrink: 0, width: "100%", overflowY: "auto", minHeight: 0 }}>
      <ScheduleSettingsCard userId={userId} HelpIcon={HelpIcon} />
    </div>
  </div>
);

export default Panel_Schedule;
