/**
 * ============================================================
 * FILE: ScheduleSettings.jsx
 *
 * PURPOSE:
 *   User profile schedule settings component. Allows users to
 *   configure business hours, days of operation, attendance
 *   check-in, and auto-accept bookings with grace period settings.
 * ============================================================
 */

import React, { useState, useEffect } from "react";
import { CheckIcon, ExclamationTriangleIcon, ClockIcon } from "@heroicons/react/24/outline";
import api from "../../services/api";
import useDarkMode from "../../store/useDarkMode";

const ScheduleSettings = ({ userId, HelpIcon }) => {
  const { isDarkMode } = useDarkMode();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [formData, setFormData] = useState({
    start_of_day: "06:00",
    end_of_day: "21:00",
    monday_enabled: true,
    tuesday_enabled: true,
    wednesday_enabled: true,
    thursday_enabled: true,
    friday_enabled: true,
    saturday_enabled: true,
    sunday_enabled: true,
    attendance_check_in_required: true,
    auto_accept_client_bookings: false,
    auto_accept_pending_hours: null,
  });

  useEffect(() => {
    loadScheduleSettings();
  }, [userId]);

  const loadScheduleSettings = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/schedule-settings/${userId}`);
      const data = response?.data;
      setSettings(data);
      setFormData({
        start_of_day: data.start_of_day || "06:00",
        end_of_day: data.end_of_day || "21:00",
        monday_enabled: data.monday_enabled ?? true,
        tuesday_enabled: data.tuesday_enabled ?? true,
        wednesday_enabled: data.wednesday_enabled ?? true,
        thursday_enabled: data.thursday_enabled ?? true,
        friday_enabled: data.friday_enabled ?? true,
        saturday_enabled: data.saturday_enabled ?? true,
        sunday_enabled: data.sunday_enabled ?? true,
        attendance_check_in_required: data.attendance_check_in_required ?? true,
        auto_accept_client_bookings: data.auto_accept_client_bookings || false,
        auto_accept_pending_hours: data.auto_accept_pending_hours || null,
      });
    } catch (error) {
      if (error?.response?.status === 404) {
        setFormData({
          start_of_day: "06:00",
          end_of_day: "21:00",
          monday_enabled: true,
          tuesday_enabled: true,
          wednesday_enabled: true,
          thursday_enabled: true,
          friday_enabled: true,
          saturday_enabled: true,
          sunday_enabled: true,
          attendance_check_in_required: true,
          auto_accept_client_bookings: false,
          auto_accept_pending_hours: null,
        });
      } else {
        console.error("Failed to load schedule settings:", error);
        setMessage({ type: "error", text: "Failed to load settings" });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAutoAccept = () => {
    setFormData((prev) => ({
      ...prev,
      auto_accept_client_bookings: !prev.auto_accept_client_bookings,
    }));
  };

  const handleInputChange = (key, value) => {
    setFormData((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleGraceHoursChange = (value) => {
    const numValue = value === "" ? null : parseInt(value);
    setFormData((prev) => ({
      ...prev,
      auto_accept_pending_hours: numValue,
    }));
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      setMessage(null);

      const response = await api.put(`/schedule-settings/${userId}`, formData);
      const updated = response?.data;
      setSettings(updated);
      setMessage({ type: "success", text: "✓ All schedule settings saved successfully" });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error("Failed to save settings:", error);
      setMessage({ type: "error", text: "Error saving settings" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-gray-600">Loading schedule settings...</div>;
  }

  return (
    <div className={`rounded-lg shadow-lg p-6 border-t-4 border-blue-600 space-y-6 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
      <div>
        <h3 className={`text-xl font-bold mb-1 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          <ClockIcon className="h-6 w-6" /> Schedule Settings
        </h3>
        <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Configure your business hours, availability, and booking preferences</p>
      </div>

      {/* Message Display */}
      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${message.type === "success" ? isDarkMode ? "bg-green-900 border border-green-700" : "bg-green-50 border border-green-200" : isDarkMode ? "bg-red-900 border border-red-700" : "bg-red-50 border border-red-200"}`}>
          {message.type === "success" ? <CheckIcon className={`w-5 h-5 flex-shrink-0 ${isDarkMode ? 'text-green-300' : 'text-green-600'}`} /> : <ExclamationTriangleIcon className={`w-5 h-5 flex-shrink-0 ${isDarkMode ? 'text-red-300' : 'text-red-600'}`} />}
          <p className={`text-sm font-medium ${message.type === "success" ? isDarkMode ? "text-green-100" : "text-green-800" : isDarkMode ? "text-red-100" : "text-red-800"}`}>{message.text}</p>
        </div>
      )}

      {/* Business Hours */}
      <div className={`border rounded-lg p-4 ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
        <h4 className={`font-semibold mb-3 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          Business Hours {HelpIcon && <HelpIcon id="business-hours" text="Set the visible time range for your schedule calendar" />}
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="form-floating">
            <input
              type="time"
              id="start_of_day"
              value={formData.start_of_day}
              onChange={(e) => handleInputChange("start_of_day", e.target.value)}
              className={`form-control form-control-sm ${isDarkMode ? 'bg-gray-600 text-white border-gray-500' : ''}`}
              placeholder="Start of Day"
            />
            <label htmlFor="start_of_day" className={isDarkMode ? 'text-gray-300' : ''}>Start of Day</label>
          </div>
          <div className="form-floating">
            <input
              type="time"
              id="end_of_day"
              value={formData.end_of_day}
              onChange={(e) => handleInputChange("end_of_day", e.target.value)}
              className={`form-control form-control-sm ${isDarkMode ? 'bg-gray-600 text-white border-gray-500' : ''}`}
              placeholder="End of Day"
            />
            <label htmlFor="end_of_day" className={isDarkMode ? 'text-gray-300' : ''}>End of Day</label>
          </div>
        </div>
      </div>

      {/* Days of Operation */}
      <div className={`border rounded-lg p-4 ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
        <h4 className={`font-semibold mb-3 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          Days of Operation {HelpIcon && <HelpIcon id="days-of-operation" text="Select which days your business operates" />}
        </h4>
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
            <div key={day.key} className={`flex items-center p-2 rounded-lg border ${isDarkMode ? 'bg-gray-600 border-gray-500' : 'bg-white border-gray-200'}`}>
              <input
                type="checkbox"
                id={day.key}
                checked={formData[day.key]}
                onChange={(e) => handleInputChange(day.key, e.target.checked)}
                className="h-4 w-4 rounded"
              />
              <label htmlFor={day.key} className={`ml-2 text-sm font-medium cursor-pointer ${isDarkMode ? 'text-gray-200' : ''}`}>
                <span className="hidden sm:inline">{day.fullLabel}</span>
                <span className="sm:hidden">{day.label}</span>
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Attendance Check-in */}
      <div className={`border rounded-lg p-4 ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
        <h4 className={`font-semibold mb-3 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          Attendance {HelpIcon && <HelpIcon id="attendance-section" text="Configure employee clock in/out tracking" />}
        </h4>
        <div className={`flex items-center justify-between p-3 rounded-lg border ${isDarkMode ? 'bg-gray-600 border-gray-500' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-200' : ''}`}>Attendance Check-in</span>
            {HelpIcon && <HelpIcon id="attendance" text="Show clock in/out widget on Schedule page" />}
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.attendance_check_in_required}
              onChange={(e) => handleInputChange("attendance_check_in_required", e.target.checked)}
              className="sr-only peer"
            />
            <div className={`w-11 h-6 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${isDarkMode ? 'bg-gray-500 peer-checked:bg-blue-600' : 'bg-gray-200 peer-checked:bg-blue-600'}`}></div>
          </label>
        </div>
      </div>

      {/* Auto-Accept Toggle */}
      <div className={`border rounded-lg p-4 ${isDarkMode ? 'bg-gradient-to-r from-blue-900 to-gray-700 border-blue-700' : 'bg-gradient-to-r from-blue-50 to-transparent border-blue-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h4 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Auto-Accept Client Bookings</h4>
            <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>When enabled, bookings from your client portal will be automatically accepted if they fit within available time slots. You'll still receive notifications.</p>
          </div>
          <label className="ml-4 flex items-center">
            <input type="checkbox" checked={formData.auto_accept_client_bookings} onChange={handleToggleAutoAccept} className="w-6 h-6 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
            <span className={`ml-2 text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>{formData.auto_accept_client_bookings ? "Enabled" : "Disabled"}</span>
          </label>
        </div>

        {/* Grace Period - only show when auto-accept is enabled */}
        {formData.auto_accept_client_bookings && (
          <div className={`mt-4 pt-4 border-t ${isDarkMode ? 'border-blue-700' : 'border-blue-200'}`}>
            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Grace Period for Pending Requests</label>
            <p className={`text-xs mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Bookings pending longer than this period will NOT be auto-accepted, requiring manual review. Leave blank for no limit.</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="168"
                step="1"
                value={formData.auto_accept_pending_hours || ""}
                onChange={(e) => handleGraceHoursChange(e.target.value)}
                placeholder="e.g., 24"
                className={`w-24 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center ${isDarkMode ? 'bg-gray-600 text-white border-gray-500' : 'border-gray-300'}`}
              />
              <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>hours</span>
              {formData.auto_accept_pending_hours && <span className={`ml-2 text-xs px-2 py-1 rounded ${isDarkMode ? 'bg-blue-700 text-blue-100' : 'bg-blue-100 text-blue-700'}`}>Max {formData.auto_accept_pending_hours} hours old</span>}
            </div>
            <p className={`text-xs mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Example: Set to 24 to auto-accept only fresh bookings (less than 24 hours old)</p>
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className={`border rounded-lg p-4 ${isDarkMode ? 'bg-blue-900 border-blue-700' : 'bg-blue-50 border-blue-200'}`}>
        <h5 className={`font-semibold mb-2 ${isDarkMode ? 'text-blue-100' : 'text-blue-900'}`}>💡 How This Works</h5>
        <ul className={`text-sm space-y-1 list-disc list-inside ${isDarkMode ? 'text-blue-100' : 'text-blue-800'}`}>
          <li>Auto-acceptance applies only to bookings within your scheduled availability</li>
          <li>Conflicting bookings are automatically rejected</li>
          <li>You'll receive email notifications for all auto-accepted bookings</li>
          <li>Can be changed anytime; existing bookings are not affected</li>
          <li>Works across client portal and internal booking systems</li>
        </ul>
      </div>

      {/* Current Status */}
      {settings && (
        <div className={`rounded-lg p-3 border text-xs ${isDarkMode ? 'bg-gray-700 border-gray-600 text-gray-400' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
          <p>
            <strong>Last Updated:</strong> {new Date(settings.updated_at).toLocaleString()}
          </p>
        </div>
      )}

      {/* Save Button */}
      <div className={`flex gap-3 pt-4 border-t ${isDarkMode ? 'border-gray-600' : ''}`}>
        <button onClick={loadScheduleSettings} className={`px-4 py-2 border rounded-lg font-medium ${isDarkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
          Reset
        </button>
        <button onClick={handleSaveSettings} disabled={saving} className="ml-auto px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50">
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
};

export default ScheduleSettings;
