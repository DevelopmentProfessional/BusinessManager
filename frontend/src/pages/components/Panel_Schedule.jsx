// FILE: Panel_Schedule.jsx
// Renders the schedule settings accordion panel: business hours, days of operation, attendance toggle, and ScheduleSettingsCard.

import React from "react";
import { ClockIcon, CheckCircleIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import Button_Toolbar from "./Button_Toolbar";
import ScheduleSettingsCard from "./ScheduleSettings";

const Panel_Schedule = ({
  isMobile,
  settingsPanelStyle,
  scheduleSettings,
  handleScheduleSettingsChange,
  handleSaveScheduleSettings,
  scheduleLoading,
  settingsError,
  settingsSuccess,
  userId,
  HelpIcon,
}) => (
  <div className="accordion-popup" style={settingsPanelStyle}>
    <div style={{ flexGrow: isMobile ? 0 : 1, minHeight: isMobile ? 0 : undefined }} />
    <div style={{ flexShrink: 0, width: "100%", overflowY: "auto", minHeight: 0 }}>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <ClockIcon className="h-5 w-5" /> Schedule Settings
      </h2>

      <div className="mb-6">
        <h3 className="text-base font-medium text-gray-900 dark:text-white mb-3 flex items-center">
          Business Hours <HelpIcon id="business-hours" text="Set the visible time range for your schedule calendar" />
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="form-floating">
            <input type="time" id="start_of_day" value={scheduleSettings.start_of_day} onChange={(e) => handleScheduleSettingsChange("start_of_day", e.target.value)} className="form-control form-control-sm" placeholder="Start of Day" />
            <label htmlFor="start_of_day">Start of Day</label>
          </div>
          <div className="form-floating">
            <input type="time" id="end_of_day" value={scheduleSettings.end_of_day} onChange={(e) => handleScheduleSettingsChange("end_of_day", e.target.value)} className="form-control form-control-sm" placeholder="End of Day" />
            <label htmlFor="end_of_day">End of Day</label>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-base font-medium text-gray-900 dark:text-white mb-3 flex items-center">
          Days of Operation <HelpIcon id="days-of-operation" text="Select which days your business operates" />
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { key: "monday_enabled", label: "Mon", fullLabel: "Monday" },
            { key: "tuesday_enabled", label: "Tue", fullLabel: "Tuesday" },
            { key: "wednesday_enabled", label: "Wed", fullLabel: "Wednesday" },
            { key: "thursday_enabled", label: "Thu", fullLabel: "Thursday" },
            { key: "friday_enabled", label: "Fri", fullLabel: "Friday" },
            { key: "saturday_enabled", label: "Sat", fullLabel: "Saturday" },
            { key: "sunday_enabled", label: "Sun", fullLabel: "Sunday" },
          ].map((day) => (
            <div key={day.key} className="flex items-center p-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <input type="checkbox" id={day.key} checked={scheduleSettings[day.key]} onChange={(e) => handleScheduleSettingsChange(day.key, e.target.checked)} className="h-4 w-4 rounded" />
              <label htmlFor={day.key} className="ml-2 text-sm font-medium cursor-pointer">
                <span className="hidden sm:inline">{day.fullLabel}</span>
                <span className="sm:hidden">{day.label}</span>
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-base font-medium text-gray-900 dark:text-white mb-3 flex items-center">
          Attendance <HelpIcon id="attendance-section" text="Configure employee clock in/out tracking" />
        </h3>
        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <div className="flex items-center">
            <span className="text-sm font-medium">Attendance Check-in</span>
            <HelpIcon id="attendance" text="Show clock in/out widget on Schedule page" />
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={scheduleSettings.attendance_check_in_required} onChange={(e) => handleScheduleSettingsChange("attendance_check_in_required", e.target.checked)} className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>

      <Button_Toolbar icon={CheckCircleIcon} label={scheduleLoading ? "Saving…" : "Save"} onClick={handleSaveScheduleSettings} className="btn-primary" disabled={scheduleLoading} />

      <div className="mt-4">
        <ScheduleSettingsCard userId={userId} />
      </div>

      {settingsError && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800 text-sm">
          <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0" />
          {settingsError}
        </div>
      )}
      {settingsSuccess && (
        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-800 text-sm">
          <CheckCircleIcon className="h-4 w-4 flex-shrink-0" />
          {settingsSuccess}
        </div>
      )}
    </div>
  </div>
);

export default Panel_Schedule;
