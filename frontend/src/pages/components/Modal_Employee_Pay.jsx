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
 * ============================================================
 */

import React, { useState, useEffect } from "react";
import { payrollAPI } from "../../services/api";

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

    const baseForm = {
      pay_period_start: "",
      pay_period_end: "",
      gross_amount: employee.salary ? String(employee.salary) : "",
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
    <div
      className="modal d-block"
      tabIndex="-1"
      style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="modal-dialog modal-sm modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header py-2">
            <h6 className="modal-title mb-0">
              Pay {employee.first_name} {employee.last_name}
            </h6>
            <button type="button" className="btn-close" onClick={onClose} />
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-body py-3">
              {payError && <div className="alert alert-danger py-1 px-2 small mb-2">{payError}</div>}
              {paySuccess && <div className="alert alert-success py-1 px-2 small mb-2">{paySuccess}</div>}

              <div className="mb-2 small text-muted">
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
                  <label className="form-label small mb-1">Select Period</label>
                  {scheduleLoading ? (
                    <div className="text-muted small py-1">Loading periods…</div>
                  ) : (
                    <select
                      className="form-select form-select-sm"
                      value={payForm.pay_period_start}
                      onChange={(e) => {
                        const p = availablePeriods.find((w) => w.start === e.target.value);
                        if (p) setPayForm((f) => ({ ...f, pay_period_start: p.start, pay_period_end: p.end }));
                      }}
                      required
                    >
                      <option value="">— Select a period —</option>
                      {availablePeriods.map((w) => (
                        <option key={w.start} value={w.start} disabled={w.isPaid}>
                          {w.label}
                          {w.isPaid ? " ✓ Paid" : ""}
                        </option>
                      ))}
                    </select>
                  )}
                  {payForm.pay_period_start && (
                    <div className="text-muted small mt-1">
                      {payForm.pay_period_start} → {payForm.pay_period_end}
                    </div>
                  )}
                </div>
              ) : normalizedPayFrequency === "daily" ? (
                <div className="mb-2">
                  <label className="form-label small mb-1">Payment Date</label>
                  <input type="date" className="form-control form-control-sm" value={payForm.pay_period_start} onChange={(e) => setPayForm((f) => ({ ...f, pay_period_start: e.target.value, pay_period_end: e.target.value }))} required />
                </div>
              ) : (
                <>
                  <div className="mb-2">
                    <label className="form-label small mb-1">Pay Period Start</label>
                    <input type="date" className="form-control form-control-sm" value={payForm.pay_period_start} onChange={(e) => setPayForm((f) => ({ ...f, pay_period_start: e.target.value }))} required />
                  </div>
                  <div className="mb-2">
                    <label className="form-label small mb-1">Pay Period End</label>
                    <input type="date" className="form-control form-control-sm" value={payForm.pay_period_end} min={payForm.pay_period_start || undefined} onChange={(e) => setPayForm((f) => ({ ...f, pay_period_end: e.target.value }))} required />
                  </div>
                </>
              )}

              {normalizedEmploymentType === "hourly" ? (
                <div className="mb-2">
                  <label className="form-label small mb-1">Hours Worked</label>
                  <input type="number" className="form-control form-control-sm" placeholder="0" min="0" step="0.25" value={payForm.hours_worked} onChange={(e) => setPayForm((f) => ({ ...f, hours_worked: e.target.value }))} required />
                  {employee.hourly_rate && <div className="text-muted small mt-1">Rate: ${employee.hourly_rate}/hr</div>}
                </div>
              ) : (
                <div className="mb-2">
                  <label className="form-label small mb-1">Gross Amount ($)</label>
                  <input type="number" className="form-control form-control-sm" placeholder="0.00" min="0" step="0.01" value={payForm.gross_amount} onChange={(e) => setPayForm((f) => ({ ...f, gross_amount: e.target.value }))} />
                  <div className="text-muted small mt-1">Leave blank to use employee salary</div>
                </div>
              )}

              <div className="mb-2">
                <label className="form-label small mb-1">Other Deductions ($)</label>
                <input type="number" className="form-control form-control-sm" placeholder="0.00" min="0" step="0.01" value={payForm.other_deductions} onChange={(e) => setPayForm((f) => ({ ...f, other_deductions: e.target.value }))} />
              </div>

              <div className="mb-0">
                <label className="form-label small mb-1">Notes (optional)</label>
                <textarea className="form-control form-control-sm" rows="2" value={payForm.notes} onChange={(e) => setPayForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>

            <div className="modal-footer py-2">
              <button type="button" className="btn btn-sm btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-sm btn-outline-secondary" disabled={payLoading}>
                {payLoading ? "…" : "Pay"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
