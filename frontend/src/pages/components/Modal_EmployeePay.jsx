/*
 * ============================================================
 * FILE: Modal_Pay_Employee.jsx
 *
 * PURPOSE:
 *   Small centered modal for processing a single employee payment.
 *   Supports salary, hourly, weekly, daily and other pay frequencies.
 *   Extracted from the inline JSX in Employees.jsx.
 *
 * FUNCTIONAL PARTS:
 *   [1] State         — payForm, payLoading, payError, paySuccess,
 *                       availableWeeks, payWeeksLoading
 *   [2] Helpers       — generateWeeks (builds 26-week window with paid flags)
 *   [3] Effect        — Initialise form + load weeks on open; reset on close
 *   [4] Submit        — processPayment API call; notifies parent via onPaySuccess
 *   [5] Render        — Bootstrap modal-sm centred dialog
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-03-01 | Claude  | Created — extracted from Employees.jsx (P4-A)
 *   2026-08-04 | GitHub Copilot | Default salary gross amount now follows selected pay frequency
 * ============================================================
 */

import React, { useState, useEffect } from "react";
import { payrollAPI } from "../../services/api";
import { XMarkIcon, CheckIcon } from "@heroicons/react/24/outline";
import Modal from "./Modal";
import Button_Toolbar from "./Button_Toolbar";
import Dropdown_Custom from "./Dropdown_Custom";

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/**
 * Generates a rolling 26-week window ending at the current week.
 * Each entry is marked isPaid if its Monday start date appears in paidStartDates.
 */
function isoDate(d) {
  return new Date(d).toISOString().slice(0, 10);
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function fmtRangeLabel(startStr, endStr) {
  const s = new Date(startStr + "T00:00:00");
  const e = new Date(endStr + "T00:00:00");
  return `${s.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${e.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

function isPaidStart(paidStartDates, startStr) {
  return paidStartDates.some((d) => {
    const dStr = typeof d === "string" ? d.slice(0, 10) : isoDate(d);
    return dStr === startStr;
  });
}

function salaryGrossForFrequency(salaryAnnual, payFrequency) {
  const annual = Number(salaryAnnual);
  if (!Number.isFinite(annual)) return null;
  const freq = String(payFrequency || "").toLowerCase();
  if (freq === "weekly") return annual / 52;
  if (freq === "biweekly") return annual / 26;
  if (freq === "monthly") return annual / 12;
  if (freq === "daily") return annual / 260;
  return annual;
}

function salaryFrequencyLabel(payFrequency) {
  const freq = String(payFrequency || "").toLowerCase();
  if (freq === "weekly") return "per week";
  if (freq === "biweekly") return "per bi-week";
  if (freq === "monthly") return "per month";
  if (freq === "daily") return "per day";
  if (freq === "annually") return "per year";
  return "for selected period";
}

function generateRecentPeriods({ paidStartDates, frequency, cycleAnchorDate = null, count = 26 }) {
  const freq = String(frequency || "").toLowerCase();
  if (freq === "monthly") {
    const out = [];
    const today = new Date();
    const m0 = startOfMonth(today);
    for (let i = 0; i < 12; i++) {
      const m = new Date(m0.getFullYear(), m0.getMonth() - i, 1);
      const s = isoDate(startOfMonth(m));
      const e = isoDate(endOfMonth(m));
      out.push({ start: s, end: e, label: fmtRangeLabel(s, e), isPaid: isPaidStart(paidStartDates, s) });
    }
    return out;
  }

  const stepDays = freq === "biweekly" ? 14 : 7;
  const anchor = cycleAnchorDate ? new Date(cycleAnchorDate + "T00:00:00") : new Date("2025-01-06T00:00:00");
  const today = new Date();
  const diffDays = Math.floor((today.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24));
  const periodsFromAnchor = Math.floor(diffDays / stepDays);
  const thisStart = new Date(anchor);
  thisStart.setDate(anchor.getDate() + periodsFromAnchor * stepDays);
  thisStart.setHours(0, 0, 0, 0);

  const out = [];
  for (let i = 0; i < count; i++) {
    const sD = new Date(thisStart);
    sD.setDate(thisStart.getDate() - i * stepDays);
    const eD = new Date(sD);
    eD.setDate(sD.getDate() + (stepDays - 1));
    const s = isoDate(sD);
    const e = isoDate(eD);
    out.push({ start: s, end: e, label: fmtRangeLabel(s, e), isPaid: isPaidStart(paidStartDates, s) });
  }
  return out;
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────
export default function Modal_Pay_Employee({ isOpen, onClose, employee, onPaySuccess }) {
  // ─── [1] STATE ──────────────────────────────────────────────────────────────
  const [payForm, setPayForm] = useState({
    pay_period_start: "",
    pay_period_end: "",
    gross_amount: "",
    hours_worked: "",
    other_deductions: "",
    notes: "",
  });
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState("");
  const [paySuccess, setPaySuccess] = useState("");
  const [availablePeriods, setAvailablePeriods] = useState([]);
  const [schedule, setSchedule] = useState(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  const normalizedEmploymentType = String(employee?.employment_type || "").toLowerCase() || (Number(employee?.hourly_rate || 0) > 0 ? "hourly" : "salary");
  const normalizedPayFrequency = String(employee?.pay_frequency || "").toLowerCase();

  // ─── [2] EFFECT: initialise / reset on open ─────────────────────────────────
  useEffect(() => {
    if (!isOpen || !employee) {
      // Reset everything when closed
      setPayForm({ pay_period_start: "", pay_period_end: "", gross_amount: "", hours_worked: "", other_deductions: "", notes: "" });
      setAvailablePeriods([]);
      setSchedule(null);
      setScheduleLoading(false);
      setPayError("");
      setPaySuccess("");
      return;
    }

    const defaultSalaryGross = salaryGrossForFrequency(employee.salary, normalizedPayFrequency);
    const baseForm = {
      pay_period_start: "",
      pay_period_end: "",
      gross_amount: defaultSalaryGross != null ? String(Math.round(defaultSalaryGross * 100) / 100) : "",
      hours_worked: "",
      other_deductions: "",
      notes: "",
    };

    let cancelled = false;

    const load = async () => {
      setScheduleLoading(true);
      try {
        const [slipsRes, schedRes] = await Promise.all([payrollAPI.getByEmployee(employee.id).catch(() => ({ data: [] })), payrollAPI.getEmployeeSchedule(employee.id).catch(() => ({ data: null }))]);
        if (cancelled) return;
        const slips = slipsRes?.data ?? slipsRes ?? [];
        const paidStarts = Array.isArray(slips) ? slips.map((s) => s.pay_period_start) : [];
        const sched = schedRes?.data ?? schedRes ?? null;
        setSchedule(sched && typeof sched === "object" ? sched : null);

        const effectiveFreq = ["weekly", "biweekly", "monthly"].includes(normalizedPayFrequency) ? normalizedPayFrequency : String(sched?.frequency || normalizedPayFrequency || "monthly").toLowerCase();

        if (effectiveFreq === "daily") {
          const now = new Date();
          const start = isoDate(now);
          setAvailablePeriods([]);
          setPayForm({ ...baseForm, pay_period_start: start, pay_period_end: start });
          return;
        }

        if (["weekly", "biweekly", "monthly"].includes(effectiveFreq)) {
          const periods = generateRecentPeriods({
            paidStartDates: paidStarts,
            frequency: effectiveFreq,
            cycleAnchorDate: sched?.cycle_anchor_date || null,
            count: effectiveFreq === "monthly" ? 12 : 26,
          });
          setAvailablePeriods(periods);
          const firstUnpaid = periods.find((p) => !p.isPaid) ?? periods[0];
          if (firstUnpaid) {
            setPayForm({ ...baseForm, pay_period_start: firstUnpaid.start, pay_period_end: firstUnpaid.end });
          } else {
            setPayForm(baseForm);
          }
          return;
        }

        const now = new Date();
        const start = isoDate(startOfMonth(now));
        const end = isoDate(endOfMonth(now));
        setAvailablePeriods([]);
        setPayForm({ ...baseForm, pay_period_start: start, pay_period_end: end });
      } finally {
        if (!cancelled) setScheduleLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, employee?.id, normalizedPayFrequency]);

  // ─── [3] SUBMIT ─────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setPayError("");
    setPayLoading(true);
    try {
      const isHourly = normalizedEmploymentType === "hourly";
      const payload = {
        pay_period_start: new Date(payForm.pay_period_start).toISOString(),
        pay_period_end: new Date(payForm.pay_period_end).toISOString(),
        other_deductions: payForm.other_deductions !== "" ? parseFloat(payForm.other_deductions) : 0,
        notes: payForm.notes || null,
        employment_type: normalizedEmploymentType || "salary",
      };
      if (isHourly) {
        payload.hours_worked = payForm.hours_worked !== "" ? parseFloat(payForm.hours_worked) : 0;
        payload.hourly_rate_snapshot = employee?.hourly_rate || 0;
      } else {
        payload.gross_amount = payForm.gross_amount !== "" ? parseFloat(payForm.gross_amount) : null;
      }
      await payrollAPI.processPayment(employee.id, payload);
      setPaySuccess("Payment processed successfully!");
      onPaySuccess?.(employee.id);
      setTimeout(() => {
        onClose();
        setPaySuccess("");
      }, 1500);
    } catch (err) {
      setPayError(err.response?.data?.detail || "Failed to process payment");
    } finally {
      setPayLoading(false);
    }
  };

  if (!isOpen || !employee) return null;

  // ─── [4] RENDER ─────────────────────────────────────────────────────────────
  return (
    <Modal isOpen={isOpen} onClose={onClose} noPadding centered>
      <form onSubmit={handleSubmit} className="ui-component-shell">
        <div className="component-header">
          <div className="component-header-left">Pay {employee.first_name} {employee.last_name}</div>
          <div className="component-header-center"></div>
          <div className="component-header-right"></div>
        </div>

        <div className="component-body">
          <div className="component-body-inner">
              {payError && <div className="alert alert-danger mb-2 px-0 py-1 small">{payError}</div>}
              {paySuccess && <div className="alert alert-success mb-2 px-0 py-1 small">{paySuccess}</div>}

              <div className="mb-2 ui-small-muted">
                Type: <strong style={{ textTransform: "capitalize" }}>{normalizedEmploymentType || "salary"}</strong>
                {normalizedPayFrequency && (
                  <>
                    {" "}
                    &middot; Freq: <strong style={{ textTransform: "capitalize" }}>{normalizedPayFrequency.replace("_", "-")}</strong>
                  </>
                )}
                {employee.insurance_plan && (
                  <>
                    {" "}
                    &middot; Insurance: <strong>{employee.insurance_plan}</strong>
                  </>
                )}
              </div>

              {/* Period selector — varies by pay frequency */}
              {(["weekly", "biweekly", "monthly"].includes(normalizedPayFrequency) || availablePeriods.length > 0) && normalizedPayFrequency !== "daily" ? (
                <div className="mb-2">
                  <label className="form-label ui-form-label-sm">Select Period</label>
                  {scheduleLoading ? (
                    <div className="py-1 small text-muted">Loading periods…</div>
                  ) : (
                    <Dropdown_Custom
                      className="form-select ui-control-sm"
                      value={payForm.pay_period_start}
                      onChange={(e) => {
                        const p = availablePeriods.find((w) => w.start === e.target.value);
                        if (!p || p.isPaid) return;
                        setPayForm((f) => ({ ...f, pay_period_start: p.start, pay_period_end: p.end }));
                      }}
                      options={availablePeriods.map((w) => ({
                        value: w.start,
                        label: `${w.label}${w.isPaid ? " ✓ Paid" : ""}`,
                      }))}
                      placeholder="— Select a period —"
                      required
                    />
                  )}
                  {payForm.pay_period_start && (
                    <div className="mt-1 ui-small-muted">
                      {payForm.pay_period_start} → {payForm.pay_period_end}
                    </div>
                  )}
                </div>
              ) : normalizedPayFrequency === "daily" ? (
                <div className="mb-2">
                  <label className="form-label ui-form-label-sm">Payment Date</label>
                  <input type="date" className="form-control ui-control-sm" value={payForm.pay_period_start} onChange={(e) => setPayForm((f) => ({ ...f, pay_period_start: e.target.value, pay_period_end: e.target.value }))} required />
                </div>
              ) : (
                <>
                  <div className="mb-2">
                    <label className="form-label ui-form-label-sm">Pay Period Start</label>
                    <input type="date" className="form-control ui-control-sm" value={payForm.pay_period_start} onChange={(e) => setPayForm((f) => ({ ...f, pay_period_start: e.target.value }))} required />
                  </div>
                  <div className="mb-2">
                    <label className="form-label ui-form-label-sm">Pay Period End</label>
                    <input type="date" className="form-control ui-control-sm" value={payForm.pay_period_end} min={payForm.pay_period_start || undefined} onChange={(e) => setPayForm((f) => ({ ...f, pay_period_end: e.target.value }))} required />
                  </div>
                </>
              )}

              {normalizedEmploymentType === "hourly" ? (
                <div className="mb-2">
                  <label className="form-label ui-form-label-sm">Hours Worked</label>
                  <input type="number" className="form-control ui-control-sm" placeholder="0" min="0" step="0.25" value={payForm.hours_worked} onChange={(e) => setPayForm((f) => ({ ...f, hours_worked: e.target.value }))} required />
                  {employee.hourly_rate && <div className="mt-1 ui-small-muted">Rate: ${employee.hourly_rate}/hr</div>}
                </div>
              ) : (
                <div className="mb-2">
                  <label className="form-label ui-form-label-sm">Gross Amount ($ {salaryFrequencyLabel(normalizedPayFrequency)})</label>
                  <input type="number" className="form-control ui-control-sm" placeholder="0.00" min="0" step="0.01" value={payForm.gross_amount} onChange={(e) => setPayForm((f) => ({ ...f, gross_amount: e.target.value }))} />
                  <div className="mt-1 ui-small-muted">Pre-filled from employee salary using the selected pay frequency.</div>
                </div>
              )}

              <div className="mb-2">
                <label className="form-label ui-form-label-sm">Other Deductions ($)</label>
                <input type="number" className="form-control ui-control-sm" placeholder="0.00" min="0" step="0.01" value={payForm.other_deductions} onChange={(e) => setPayForm((f) => ({ ...f, other_deductions: e.target.value }))} />
              </div>

              <div className="mb-0">
                <label className="form-label ui-form-label-sm">Notes (optional)</label>
                <textarea className="form-control ui-control-sm" rows="2" value={payForm.notes} onChange={(e) => setPayForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
          </div>{/* /component-body-inner */}
        </div>{/* /component-body */}

        <div className="component-footer">
          <div className="component-footer-left">
            <Button_Toolbar type="submit" icon={CheckIcon} label={payLoading ? "…" : "Pay"} className="btn-outline-secondary" title="Process payment" disabled={payLoading} />
          </div>
          <div className="component-footer-center">
            <button type="button" onClick={onClose} className="btn ui-btn-circle-outline-secondary" title="Cancel">
              <XMarkIcon />
            </button>
          </div>
          <div className="component-footer-right"></div>
        </div>
      </form>
    </Modal>
  );
}
