/**
 * ============================================================
 * FILE: Modal_SettingsSchedule.jsx
 *
 * PURPOSE:
 *   Schedule page settings component. Allows users to
 *   configure business hours, days of operation, attendance
 *   check-in, and auto-accept bookings with grace period settings.
 * ============================================================
 */

import React, { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { CheckIcon, ExclamationTriangleIcon, ArrowPathIcon } from "../../../icons";
import { settingsAPI } from "../../../services/api";
import Button_Toolbar from "../buttons/Button_Toolbar";
import Dropdown_Custom from "../dropdowns/Dropdown_Custom";
import { Accordion } from "../accordions";
import { InputCheckbox, InputNumber } from "../Inputs";

const Modal_SettingsSchedule = forwardRef(function Modal_SettingsSchedule({ userId, HelpIcon, onSaved, onSavingChange, hideFooter = false }, ref) {
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
    attendance_check_in_required: false,
    reminder_time_minutes: 30,
    reminder_send_notification: true,
    auto_accept_client_bookings: false,
    auto_accept_pending_hours: null,
  });

  useEffect(() => {
    loadScheduleSettings();
  }, [userId]);

  const loadScheduleSettings = async () => {
    try {
      setLoading(true);
      const response = await settingsAPI.getScheduleSettings();
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
        attendance_check_in_required: data.attendance_check_in_required ?? false,
        reminder_time_minutes: data.reminder_time_minutes ?? 30,
        reminder_send_notification: data.reminder_send_notification ?? true,
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
          attendance_check_in_required: false,
          reminder_time_minutes: 30,
          reminder_send_notification: true,
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

      const response = await settingsAPI.updateScheduleSettings(formData);
      const updated = response?.data;
      setSettings(updated);
      setMessage({ type: "success", text: "✓ All schedule settings saved successfully" });
      if (typeof onSaved === "function") {
        onSaved(updated);
      }
      setTimeout(() => setMessage(null), 3000);
      return true;
    } catch (error) {
      console.error("Failed to save settings:", error);
      setMessage({ type: "error", text: "Error saving settings" });
      return false;
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    onSavingChange?.(saving);
  }, [saving, onSavingChange]);

  useImperativeHandle(ref, () => ({
    save: handleSaveSettings,
    saving,
  }));

  if (loading) {
    return <div className="small text-muted">Loading schedule settings...</div>;
  }

  return (
    <div className="d-flex flex-column gap-2">
      {/* Message Display */}
      {message && (
        <div className={`alert ${message.type === "success" ? "alert-success" : "alert-danger"} align-items-center d-flex gap-2 mb-0 py-2`} role={message.type === "error" ? "alert" : "status"}>
          {message.type === "success" ? <CheckIcon className="ui-icon-4 flex-shrink-0" /> : <ExclamationTriangleIcon className="ui-icon-4 flex-shrink-0" />}
          <span className="small fw-medium">{message.text}</span>
        </div>
      )}

      {/* Business Hours */}
      <Accordion variant="settings" header="Business hours" defaultOpen>
        {HelpIcon && <div className="mb-2"><HelpIcon id="business-hours" text="Set the visible time range for your schedule calendar" /></div>}
        <div className="row g-2">
          <div className="col-6">
            <div className="form-floating">
              <input type="time" id="start_of_day" value={formData.start_of_day} onChange={(e) => handleInputChange("start_of_day", e.target.value)} className="form-control form-control-sm" placeholder="Start of Day" />
              <label htmlFor="start_of_day">
                Start of Day
              </label>
            </div>
          </div>
          <div className="col-6">
            <div className="form-floating">
              <input type="time" id="end_of_day" value={formData.end_of_day} onChange={(e) => handleInputChange("end_of_day", e.target.value)} className="form-control form-control-sm" placeholder="End of Day" />
              <label htmlFor="end_of_day">
                End of Day
              </label>
            </div>
          </div>
        </div>
      </Accordion>

      {/* Days of Operation */}
      <Accordion variant="settings" header="Days of operation">
        {HelpIcon && <div className="mb-2"><HelpIcon id="days-of-operation" text="Select which days your business operates" /></div>}
        <Dropdown_Custom
          className="ui-control-sm"
          options={[
            { value: "monday_enabled", label: "Monday" },
            { value: "tuesday_enabled", label: "Tuesday" },
            { value: "wednesday_enabled", label: "Wednesday" },
            { value: "thursday_enabled", label: "Thursday" },
            { value: "friday_enabled", label: "Friday" },
            { value: "saturday_enabled", label: "Saturday" },
            { value: "sunday_enabled", label: "Sunday" },
          ]}
          value={[
            "monday_enabled", "tuesday_enabled", "wednesday_enabled",
            "thursday_enabled", "friday_enabled", "saturday_enabled", "sunday_enabled"
          ].filter((k) => formData[k])}
          onChange={(e) => {
            const nextVals = Array.isArray(e.target.value) ? e.target.value : [];
            const updated = {};
            [
              "monday_enabled", "tuesday_enabled", "wednesday_enabled",
              "thursday_enabled", "friday_enabled", "saturday_enabled", "sunday_enabled"
            ].forEach((k) => {
              updated[k] = nextVals.includes(k);
            });
            setFormData((p) => ({ ...p, ...updated }));
          }}
          placeholder="Select operating days"
          floatingLabel="Operating Days"
          multiSelect={true}
          searchable={true}
          closeOnSelect={false}
        />
      </Accordion>

      {/* Attendance Check-in */}
      <Accordion variant="settings" header="Attendance">
        {HelpIcon && <div className="mb-2"><HelpIcon id="attendance-section" text="Configure employee clock in/out tracking" /></div>}
        <div className="form-check form-switch mb-0">
          <InputCheckbox id="attendance_check_in_required" checked={formData.attendance_check_in_required} onChange={(e) => handleInputChange("attendance_check_in_required", e.target.checked)} className="form-check-input" />
          <label className="form-check-label" htmlFor="attendance_check_in_required">Attendance Check-in</label>
          {HelpIcon && <HelpIcon id="attendance" text="Show clock in/out widget on Schedule page" />}
        </div>
      </Accordion>

      {/* Appointment Reminder Settings */}
      <Accordion variant="settings" header="Appointment reminder">
        {HelpIcon && <div className="mb-2"><HelpIcon id="appointment-reminders" text="Configure default reminder timing and whether reminder notifications are sent" /></div>}
        <div className="row g-2">
          <div className="col-12 col-sm-6">
            <div className="form-floating">
              <InputNumber
                id="reminder_time_minutes"
                min="0"
                max="10080"
                step="5"
                value={formData.reminder_time_minutes ?? 30}
                onChange={(e) => handleInputChange("reminder_time_minutes", Number(e.target.value || 0))}
                className="form-control form-control-sm"
                placeholder="Reminder minutes"
              />
              <label htmlFor="reminder_time_minutes">
                Reminder Time (minutes before)
              </label>
            </div>
          </div>

          <div className="col-12 col-sm-6 align-self-center">
            <div className="form-check form-switch mb-0">
              <InputCheckbox id="reminder_send_notification" checked={!!formData.reminder_send_notification} onChange={(e) => handleInputChange("reminder_send_notification", e.target.checked)} className="form-check-input" />
              <label className="form-check-label" htmlFor="reminder_send_notification">Send Reminder Notification</label>
            </div>
          </div>
        </div>
      </Accordion>

      {/* Auto-Accept Toggle */}
      <Accordion variant="settings" header="Auto-accept client bookings">
        <div className="align-items-center d-flex justify-content-between gap-2">
          <div className="form-check form-switch mb-0">
            <InputCheckbox id="auto_accept_client_bookings" checked={formData.auto_accept_client_bookings} onChange={handleToggleAutoAccept} className="form-check-input" />
            <label className="form-check-label" htmlFor="auto_accept_client_bookings">{formData.auto_accept_client_bookings ? "Enabled" : "Disabled"}</label>
          </div>
        </div>

        {/* Grace Period - only show when auto-accept is enabled */}
        {formData.auto_accept_client_bookings && (
          <div className="border-top mt-3 pt-3">
            <label className="form-label fw-medium mb-1">Grace Period for Pending Requests</label>
            <p className="small text-muted mb-2">Bookings pending longer than this period will NOT be auto-accepted, requiring manual review. Leave blank for no limit.</p>
            <div className="d-flex align-items-center gap-2">
              <InputNumber
                min="0"
                max="168"
                step="1"
                value={formData.auto_accept_pending_hours || ""}
                onChange={(e) => handleGraceHoursChange(e.target.value)}
                placeholder="e.g., 24"
                className="form-control form-control-sm text-center"
                style={{ maxWidth: "6rem" }}
              />
              <span className="small text-muted">hours</span>
              {formData.auto_accept_pending_hours && <span className="badge text-bg-primary">Max {formData.auto_accept_pending_hours} hours old</span>}
            </div>
            <p className="small text-muted mt-2 mb-0">Example: Set to 24 to auto-accept only fresh bookings (less than 24 hours old)</p>
          </div>
        )}
      </Accordion>

      {/* Current Status */}
      {settings && (
        <div className="border-top pt-2 small text-muted">
          <p className="mb-0">
            <strong>Last Updated:</strong> {settings.updated_at && !isNaN(new Date(settings.updated_at).getTime()) ? new Date(settings.updated_at).toLocaleString() : "N/A"}
          </p>
        </div>
      )}

      {!hideFooter && (
        <div className="d-flex gap-2 pt-2 border-top justify-content-start align-items-center">
          <Button_Toolbar
            icon={CheckIcon}
            label={saving ? "Saving..." : "Save"}
            onClick={handleSaveSettings}
            disabled={saving}
            className="btn-primary"
            title="Save schedule settings"
          />
          <Button_Toolbar
            icon={ArrowPathIcon}
            label="Reset"
            onClick={loadScheduleSettings}
            className="btn-outline-secondary"
            title="Reset settings"
          />
        </div>
      )}
    </div>
  );
});

export default Modal_SettingsSchedule;
