// FILE: Panel_Payroll.jsx
// Admin-only payroll schedule settings panel — rendered from Profile.jsx when openAccordion === "payroll"

import React from "react";
import { BanknotesIcon, CheckCircleIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import Button_Toolbar from "./Button_Toolbar";

const DAYS = [
  { key: "mon", label: "Mon", full: "Monday" },
  { key: "tue", label: "Tue", full: "Tuesday" },
  { key: "wed", label: "Wed", full: "Wednesday" },
  { key: "thu", label: "Thu", full: "Thursday" },
  { key: "fri", label: "Fri", full: "Friday" },
  { key: "sat", label: "Sat", full: "Saturday" },
  { key: "sun", label: "Sun", full: "Sunday" },
];

const WEEK_OPTS = [
  { value: 1, label: "1st" },
  { value: 2, label: "2nd" },
  { value: 3, label: "3rd" },
  { value: 4, label: "4th" },
  { value: -1, label: "Last" },
];

function parseWorkDays(str) {
  if (!str) return ["mon", "tue", "wed", "thu", "fri"];
  return str.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);
}

function serializeWorkDays(arr) {
  return arr.join(",");
}

const Panel_Payroll = ({
  isMobile,
  settingsPanelStyle,
  paySchedule,
  setPaySchedule,
  handleSavePaySchedule,
  payScheduleSaving,
  settingsError,
  settingsSuccess,
  HelpIcon,
}) => {
  const freq = paySchedule.frequency || "monthly";
  const workDays = parseWorkDays(paySchedule.work_days);

  const toggleWorkDay = (key) => {
    const current = parseWorkDays(paySchedule.work_days);
    const next = current.includes(key) ? current.filter((d) => d !== key) : [...current, key];
    setPaySchedule((p) => ({ ...p, work_days: serializeWorkDays(next) }));
  };

  return (
    <div className="accordion-popup" style={settingsPanelStyle}>
      <div style={{ flexGrow: isMobile ? 0 : 1, minHeight: isMobile ? 0 : undefined }} />
      <div style={{ flexShrink: 0, width: "100%", overflowY: "auto", minHeight: 0 }}>

        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <BanknotesIcon className="h-5 w-5" /> Payroll Schedule Settings
        </h2>

        {settingsError && (
          <div className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-3">
            <ExclamationTriangleIcon style={{ width: 16, height: 16, flexShrink: 0 }} />
            {settingsError}
          </div>
        )}
        {settingsSuccess && (
          <div className="alert alert-success py-2 px-3 small d-flex align-items-center gap-2 mb-3">
            <CheckCircleIcon style={{ width: 16, height: 16, flexShrink: 0 }} />
            {settingsSuccess}
          </div>
        )}

        {/* ── Frequency ──────────────────────────────────────────── */}
        <div className="mb-5">
          <h3 className="text-base font-medium text-gray-900 dark:text-white mb-3 flex items-center">
            Pay Frequency
            {HelpIcon && <HelpIcon id="pay-freq" text="How often employees are paid" />}
          </h3>
          <div className="d-flex gap-2">
            {["weekly", "biweekly", "monthly"].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setPaySchedule((p) => ({ ...p, frequency: f }))}
                className={`btn btn-sm rounded-pill text-capitalize ${freq === f ? "btn-primary" : "btn-outline-secondary"}`}
                style={{ fontSize: "0.8rem", padding: "4px 16px" }}
              >
                {f === "biweekly" ? "Bi-weekly" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* ── Weekly / Biweekly settings ─────────────────────────── */}
        {(freq === "weekly" || freq === "biweekly") && (
          <>
            <div className="mb-5">
              <h3 className="text-base font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                Work Days
                {HelpIcon && <HelpIcon id="work-days" text="Which days employees work during the pay period" />}
              </h3>
              <div className="d-flex flex-wrap gap-2">
                {DAYS.map((d) => {
                  const active = workDays.includes(d.key);
                  return (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => toggleWorkDay(d.key)}
                      className={`btn btn-sm ${active ? "btn-primary" : "btn-outline-secondary"}`}
                      style={{ minWidth: 48, fontSize: "0.8rem" }}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
              {workDays.length > 0 && (
                <p className="text-muted mt-2" style={{ fontSize: "0.75rem" }}>
                  {workDays.length} day{workDays.length !== 1 ? "s" : ""} per week ·{" "}
                  {workDays.map((d) => DAYS.find((x) => x.key === d)?.full || d).join(", ")}
                </p>
              )}
            </div>

            <div className="mb-5">
              <h3 className="text-base font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                Payday
                {HelpIcon && <HelpIcon id="payday" text="Which day of the week employees receive payment" />}
              </h3>
              <div className="d-flex flex-wrap gap-2">
                {DAYS.map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => setPaySchedule((p) => ({ ...p, payday_weekday: d.key }))}
                    className={`btn btn-sm ${paySchedule.payday_weekday === d.key ? "btn-success" : "btn-outline-secondary"}`}
                    style={{ minWidth: 48, fontSize: "0.8rem" }}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              {paySchedule.payday_weekday && (
                <p className="text-muted mt-2" style={{ fontSize: "0.75rem" }}>
                  Employees are paid on {DAYS.find((d) => d.key === paySchedule.payday_weekday)?.full || paySchedule.payday_weekday}s
                </p>
              )}
            </div>

            <div className="mb-5">
              <h3 className="text-base font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                Cycle Start Date
                {HelpIcon && <HelpIcon id="cycle-anchor" text="The first day of the first pay period. Used to align weekly/bi-weekly cycles." />}
              </h3>
              <input
                type="date"
                className="form-control form-control-sm"
                style={{ maxWidth: 200 }}
                value={paySchedule.cycle_anchor_date || ""}
                onChange={(e) => setPaySchedule((p) => ({ ...p, cycle_anchor_date: e.target.value || null }))}
              />
              <p className="text-muted mt-2" style={{ fontSize: "0.75rem" }}>
                Leave blank to use Jan 6, 2025 as the default anchor.
              </p>
            </div>
          </>
        )}

        {/* ── Monthly settings ───────────────────────────────────── */}
        {freq === "monthly" && (
          <div className="mb-5">
            <h3 className="text-base font-medium text-gray-900 dark:text-white mb-3 flex items-center">
              Payday
              {HelpIcon && <HelpIcon id="monthly-payday" text="When employees are paid each month" />}
            </h3>

            {/* Type selector */}
            <div className="d-flex gap-2 mb-3">
              {[
                { value: "date", label: "Specific date" },
                { value: "weekday", label: "Weekday of month" },
              ].map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setPaySchedule((p) => ({ ...p, monthly_payday_type: t.value }))}
                  className={`btn btn-sm ${paySchedule.monthly_payday_type === t.value ? "btn-primary" : "btn-outline-secondary"}`}
                  style={{ fontSize: "0.8rem" }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Specific date */}
            {paySchedule.monthly_payday_type === "date" && (
              <div className="d-flex align-items-center gap-2">
                <label className="form-label small fw-semibold mb-0">Day of month</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  className="form-control form-control-sm"
                  style={{ width: 80 }}
                  value={paySchedule.monthly_payday_date || ""}
                  onChange={(e) => setPaySchedule((p) => ({ ...p, monthly_payday_date: parseInt(e.target.value) || null }))}
                />
                <span className="text-muted small">(e.g. 28 = the 28th of every month)</span>
              </div>
            )}

            {/* Specific weekday */}
            {paySchedule.monthly_payday_type === "weekday" && (
              <div className="d-flex flex-wrap align-items-center gap-2">
                <label className="form-label small fw-semibold mb-0">The</label>
                <select
                  className="form-select form-select-sm"
                  style={{ width: "auto" }}
                  value={paySchedule.monthly_payday_week ?? ""}
                  onChange={(e) => setPaySchedule((p) => ({ ...p, monthly_payday_week: parseInt(e.target.value) || null }))}
                >
                  <option value="">—</option>
                  {WEEK_OPTS.map((w) => (
                    <option key={w.value} value={w.value}>{w.label}</option>
                  ))}
                </select>
                <select
                  className="form-select form-select-sm"
                  style={{ width: "auto" }}
                  value={paySchedule.monthly_payday_weekday || ""}
                  onChange={(e) => setPaySchedule((p) => ({ ...p, monthly_payday_weekday: e.target.value || null }))}
                >
                  <option value="">— day —</option>
                  {DAYS.map((d) => <option key={d.key} value={d.key}>{d.full}</option>)}
                </select>
                <span className="text-muted small">of the month</span>
              </div>
            )}
          </div>
        )}

        {/* ── Pay Timing ─────────────────────────────────────────── */}
        <div className="mb-5">
          <h3 className="text-base font-medium text-gray-900 dark:text-white mb-3 flex items-center">
            Pay Timing
            {HelpIcon && <HelpIcon id="pay-timing" text="Whether employees are paid before or after the work period" />}
          </h3>
          <div className="d-flex flex-column gap-2">
            {[
              {
                value: "arrears",
                label: "Arrears — pay after work is done",
                desc: "Employees receive payment at the end of the period for work already completed.",
              },
              {
                value: "advance",
                label: "Advance — pay before work begins",
                desc: "Employees receive payment before the upcoming work period starts.",
              },
            ].map((opt) => (
              <div
                key={opt.value}
                onClick={() => setPaySchedule((p) => ({ ...p, pay_timing: opt.value }))}
                className={`p-3 rounded border cursor-pointer ${paySchedule.pay_timing === opt.value ? "border-primary bg-primary bg-opacity-10" : "border-secondary-subtle"}`}
                style={{ cursor: "pointer" }}
              >
                <div className="d-flex align-items-center gap-2 mb-1">
                  <input
                    type="radio"
                    readOnly
                    checked={paySchedule.pay_timing === opt.value}
                    className="form-check-input mt-0"
                  />
                  <span className="fw-medium small">{opt.label}</span>
                </div>
                <p className="mb-0 text-muted" style={{ fontSize: "0.75rem", paddingLeft: 24 }}>
                  {opt.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Save ───────────────────────────────────────────────── */}
        <Button_Toolbar
          icon={CheckCircleIcon}
          label={payScheduleSaving ? "Saving…" : "Save Payroll Settings"}
          onClick={handleSavePaySchedule}
          disabled={payScheduleSaving}
          className="btn btn-primary w-100 d-flex align-items-center justify-content-center gap-2"
          style={{ height: "2.5rem" }}
        />
      </div>
    </div>
  );
};

export default Panel_Payroll;
