/*
 * Modal_Wages.jsx — Comprehensive Wages & Payroll
 *
 * Tabs:
 *   Calendar  — monthly calendar showing pay periods with paid/unpaid counts per period
 *   Process   — schedule-driven period navigator; employee checkboxes; batch + single pay
 *   One-Time  — bonus / commission / reimbursement / advance / other
 *   History   — searchable full pay-slip log
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  BanknotesIcon, XMarkIcon, CheckIcon,
  ChevronLeftIcon, ChevronRightIcon,
  CalendarDaysIcon, UserGroupIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon as CheckCircleSolidIcon } from "@heroicons/react/24/solid";
import { payrollAPI } from "../../services/api";

// ─── Constants ─────────────────────────────────────────────────────────────────

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Colors for consecutive pay periods (cycle repeats)
const PERIOD_COLORS = [
  { bg: "#dbeafe", border: "#93c5fd", text: "#1d4ed8" }, // blue
  { bg: "#dcfce7", border: "#86efac", text: "#166534" }, // green
  { bg: "#fef3c7", border: "#fcd34d", text: "#92400e" }, // amber
  { bg: "#fce7f3", border: "#f9a8d4", text: "#9d174d" }, // pink
  { bg: "#ede9fe", border: "#c4b5fd", text: "#5b21b6" }, // purple
];

// Anchor for bi-weekly cycle alignment (Jan 6 2025 = a Monday)
const BI_EPOCH = new Date("2025-01-06T00:00:00");

const ONE_TIME_TYPES = [
  { value: "bonus", label: "Bonus" },
  { value: "commission", label: "Commission" },
  { value: "reimbursement", label: "Reimbursement" },
  { value: "advance", label: "Advance" },
  { value: "other", label: "Other" },
];

// ─── Date helpers ──────────────────────────────────────────────────────────────

const iso = (d) => d.toISOString().slice(0, 10);

function fmtShort(dateStr, withYear = false) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short", day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

function fmtMonthYear(year, month) {
  return new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// Find the nth weekday of a given month. week=-1 = last.
function nthWeekdayOfMonth(year, month, week, weekdayKey) {
  const dow = WEEKDAY_KEYS.indexOf(weekdayKey);
  if (dow < 0 || !week) return null;
  if (week === -1) {
    const lastDay = new Date(year, month + 1, 0);
    while (lastDay.getDay() !== dow) lastDay.setDate(lastDay.getDate() - 1);
    return iso(lastDay);
  }
  const d = new Date(year, month, 1);
  while (d.getDay() !== dow) d.setDate(d.getDate() + 1);
  d.setDate(d.getDate() + (week - 1) * 7);
  return d.getMonth() === month ? iso(d) : null;
}

// Compute the payday date for a given period + schedule
function computePayday(periodStart, periodEnd, schedule) {
  if (!schedule) return null;
  const freq = schedule.frequency || "monthly";

  if (freq === "monthly") {
    const d = new Date(periodStart + "T00:00:00");
    const y = d.getFullYear();
    const m = d.getMonth();
    if (schedule.monthly_payday_type === "date" && schedule.monthly_payday_date) {
      const maxDay = new Date(y, m + 1, 0).getDate();
      const day = Math.min(schedule.monthly_payday_date, maxDay);
      const paydayD = new Date(y, m, day);
      const periodEndD = new Date(periodEnd + "T00:00:00");
      if (schedule.pay_timing === "arrears" && paydayD <= periodEndD) {
        // Push to same day next month
        const nm = new Date(y, m + 1, 0).getDate();
        return iso(new Date(y, m + 1, Math.min(day, nm)));
      }
      return iso(paydayD);
    }
    if (schedule.monthly_payday_type === "weekday" && schedule.monthly_payday_week && schedule.monthly_payday_weekday) {
      return nthWeekdayOfMonth(y, m, schedule.monthly_payday_week, schedule.monthly_payday_weekday);
    }
    return periodEnd;
  }

  // weekly / biweekly
  if (!schedule.payday_weekday) return null;
  const paydayDow = WEEKDAY_KEYS.indexOf(schedule.payday_weekday);
  if (paydayDow < 0) return null;

  if (schedule.pay_timing === "advance") {
    // Find payday on or before period start
    const d = new Date(periodStart + "T00:00:00");
    while (d.getDay() !== paydayDow) d.setDate(d.getDate() - 1);
    return iso(d);
  } else {
    // Find payday on or after period end
    const d = new Date(periodEnd + "T00:00:00");
    while (d.getDay() !== paydayDow) d.setDate(d.getDate() + 1);
    return iso(d);
  }
}

// Compute all pay periods that overlap with the given year/month
function computePayPeriods(year, month, schedule) {
  const freq = schedule?.frequency || "monthly";
  const periods = [];

  if (freq === "monthly") {
    const s = new Date(year, month, 1);
    const e = new Date(year, month + 1, 0);
    const sStr = iso(s);
    const eStr = iso(e);
    periods.push({
      start: sStr, end: eStr,
      payday: computePayday(sStr, eStr, schedule),
      label: fmtMonthYear(year, month),
    });
    return periods;
  }

  const stepDays = freq === "biweekly" ? 14 : 7;
  const anchor = schedule?.cycle_anchor_date
    ? new Date(schedule.cycle_anchor_date + "T00:00:00")
    : BI_EPOCH;
  const mStart = new Date(year, month, 1);
  const mEnd = new Date(year, month + 1, 0);

  // Find the period index whose start is just before or at mStart
  const diffMs = mStart - anchor;
  const diffDays = Math.floor(diffMs / 86400000);
  let offsetPeriods = Math.floor(diffDays / stepDays);
  if (offsetPeriods < 0) offsetPeriods = 0;

  // Go back one to make sure we catch periods that start before this month but overlap
  let pStart = new Date(anchor);
  pStart.setDate(anchor.getDate() + (offsetPeriods - 1) * stepDays);

  let safety = 0;
  while (pStart <= mEnd && safety < 20) {
    safety++;
    const pEnd = new Date(pStart);
    pEnd.setDate(pStart.getDate() + stepDays - 1);

    if (pEnd >= mStart) {
      const sStr = iso(pStart);
      const eStr = iso(pEnd);
      periods.push({
        start: sStr, end: eStr,
        payday: computePayday(sStr, eStr, schedule),
        label: `${fmtShort(sStr)} – ${fmtShort(eStr, true)}`,
      });
    }
    pStart = new Date(pStart);
    pStart.setDate(pStart.getDate() + stepDays);
  }

  return periods;
}

// Return true if any pay slip for this employee covers the given period
function isPaid(slips, start, end) {
  if (!slips?.length) return false;
  return slips.some(
    (s) =>
      s.status === "paid" &&
      new Date(s.pay_period_start) <= new Date(end + "T23:59:59") &&
      new Date(s.pay_period_end) >= new Date(start + "T00:00:00")
  );
}

// Calculate the default pay amount for a single employee over a period
function calcAmount(emp, start, end) {
  if (!start || !end) return null;
  const days = Math.max(1, Math.round((new Date(end + "T00:00:00") - new Date(start + "T00:00:00")) / 86400000) + 1);
  const weeks = days / 7;
  const empType = (emp.employment_type || "").toLowerCase() || (Number(emp.hourly_rate) > 0 ? "hourly" : "salary");
  const freq = (emp.pay_frequency || "").toLowerCase();
  const salary = Number(emp.salary || 0);
  const rate = Number(emp.hourly_rate || 0);
  if (empType === "salary" && salary > 0) {
    if (freq === "weekly") return salary / 52;
    if (freq === "biweekly") return salary / 26;
    if (freq === "monthly") return salary / 12;
    return (salary / 365) * days;
  }
  if (empType === "hourly" && rate > 0) return rate * 40 * Math.max(1, weeks);
  return null;
}

function roleBadge(role) {
  if (role === "admin") return "bg-danger";
  if (role === "manager") return "bg-warning text-dark";
  return "bg-primary";
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function PaydayBadge({ payday, schedule }) {
  if (!payday) return null;
  const d = new Date(payday + "T00:00:00");
  const dow = WEEKDAY_LABELS[d.getDay()];
  const timing = schedule?.pay_timing === "advance" ? "paid before work" : "paid after work";
  return (
    <span className="badge bg-success-subtle text-success border border-success-subtle" style={{ fontSize: "0.68rem" }}>
      Payday: {dow} {fmtShort(payday)} · {timing}
    </span>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function Modal_Wages({ employees = [], onClose }) {
  // ── Global state ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("calendar");
  const [schedule, setSchedule] = useState(null);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [allSlips, setAllSlips] = useState([]);
  const [slipsLoading, setSlipsLoading] = useState(true);

  // ── Calendar tab state ────────────────────────────────────────────────────────
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedPeriod, setSelectedPeriod] = useState(null);

  // ── Process tab state ─────────────────────────────────────────────────────────
  const [procYear, setProcYear] = useState(today.getFullYear());
  const [procMonth, setProcMonth] = useState(today.getMonth());
  const [procPeriodIdx, setProcPeriodIdx] = useState(0);
  const [selectedEmpIds, setSelectedEmpIds] = useState(new Set());
  const [expandForms, setExpandForms] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const [processingIds, setProcessingIds] = useState(new Set());
  const [rowErrors, setRowErrors] = useState({});
  const [batchProgress, setBatchProgress] = useState(null);

  // ── One-time tab state ────────────────────────────────────────────────────────
  const todayStr = today.toISOString().slice(0, 10);
  const [ot, setOt] = useState({ employee_id: "", payment_type: "bonus", amount: "", date: todayStr, notes: "" });
  const [otLoading, setOtLoading] = useState(false);
  const [otResult, setOtResult] = useState(null);

  // ── History tab state ─────────────────────────────────────────────────────────
  const [histSearch, setHistSearch] = useState("");

  // ── Data loading ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    setScheduleLoading(true);
    payrollAPI.getSchedule()
      .then((r) => { if (!cancelled) setSchedule(r?.data ?? r ?? null); })
      .catch(() => { if (!cancelled) setSchedule(null); })
      .finally(() => { if (!cancelled) setScheduleLoading(false); });

    setSlipsLoading(true);
    payrollAPI.getAll()
      .then((r) => {
        if (!cancelled) {
          const d = r?.data ?? r ?? [];
          setAllSlips(Array.isArray(d) ? d : []);
        }
      })
      .catch(() => { if (!cancelled) setAllSlips([]); })
      .finally(() => { if (!cancelled) setSlipsLoading(false); });

    return () => { cancelled = true; };
  }, []);

  // ── Derived maps ──────────────────────────────────────────────────────────────
  const slipMap = useMemo(() => {
    const m = {};
    allSlips.forEach((s) => { (m[s.employee_id] ??= []).push(s); });
    return m;
  }, [allSlips]);

  const empMap = useMemo(() => {
    const m = {};
    employees.forEach((e) => { m[e.id] = `${e.first_name} ${e.last_name}`.trim(); });
    return m;
  }, [employees]);

  const activeEmps = useMemo(() => employees.filter((e) => e.is_active), [employees]);

  // ── Calendar periods ──────────────────────────────────────────────────────────
  const calPeriods = useMemo(
    () => (scheduleLoading ? [] : computePayPeriods(calYear, calMonth, schedule)),
    [calYear, calMonth, schedule, scheduleLoading]
  );

  // ── Process periods ───────────────────────────────────────────────────────────
  const procPeriods = useMemo(
    () => (scheduleLoading ? [] : computePayPeriods(procYear, procMonth, schedule)),
    [procYear, procMonth, schedule, scheduleLoading]
  );

  const currentProcPeriod = procPeriods[procPeriodIdx] ?? null;

  // When proc month/periods change, clamp the index
  useEffect(() => {
    if (procPeriodIdx >= procPeriods.length && procPeriods.length > 0) {
      setProcPeriodIdx(procPeriods.length - 1);
    }
  }, [procPeriods, procPeriodIdx]);

  // ── Process helpers ───────────────────────────────────────────────────────────
  const updateForm = (empId, field, value) =>
    setExpandForms((p) => ({ ...p, [empId]: { ...(p[empId] || {}), [field]: value } }));

  const handleExpandEmp = useCallback((emp) => {
    if (!currentProcPeriod) return;
    if (expandedId === emp.id) { setExpandedId(null); return; }
    setExpandedId(emp.id);
    const amt = calcAmount(emp, currentProcPeriod.start, currentProcPeriod.end);
    const isH = (emp.employment_type || "").toLowerCase() === "hourly";
    setExpandForms((p) => ({
      ...p,
      [emp.id]: {
        gross_amount: !isH && amt ? amt.toFixed(2) : "",
        hours_worked: isH ? "40" : "",
        other_deductions: "0",
        notes: "",
      },
    }));
    setRowErrors((p) => ({ ...p, [emp.id]: "" }));
  }, [expandedId, currentProcPeriod]);

  // Pay a single employee
  const handlePaySingle = useCallback(async (emp) => {
    if (!currentProcPeriod) return;
    const form = expandForms[emp.id] || {};
    const isH = (emp.employment_type || "").toLowerCase() === "hourly";
    setProcessingIds((p) => new Set([...p, emp.id]));
    setRowErrors((p) => ({ ...p, [emp.id]: "" }));
    try {
      const payload = {
        pay_period_start: `${currentProcPeriod.start}T00:00:00`,
        pay_period_end: `${currentProcPeriod.end}T23:59:59`,
        employment_type: emp.employment_type || "salary",
        other_deductions: parseFloat(form.other_deductions || 0),
        notes: form.notes || null,
      };
      if (isH) {
        payload.hours_worked = parseFloat(form.hours_worked || 0);
        payload.hourly_rate_snapshot = emp.hourly_rate;
      } else {
        payload.gross_amount = parseFloat(form.gross_amount || 0);
      }
      const res = await payrollAPI.processPayment(emp.id, payload);
      const slip = res?.data ?? res;
      if (slip?.id) {
        setAllSlips((p) => [...p, slip]);
        setExpandedId(null);
        setSelectedEmpIds((p) => { const n = new Set(p); n.delete(emp.id); return n; });
      }
    } catch (err) {
      setRowErrors((p) => ({ ...p, [emp.id]: err?.response?.data?.detail || "Payment failed" }));
    } finally {
      setProcessingIds((p) => { const n = new Set(p); n.delete(emp.id); return n; });
    }
  }, [currentProcPeriod, expandForms]);

  // Pay all selected unpaid employees
  const handlePaySelected = useCallback(async () => {
    if (!currentProcPeriod) return;
    const toPay = activeEmps.filter(
      (e) => selectedEmpIds.has(e.id) && !isPaid(slipMap[e.id], currentProcPeriod.start, currentProcPeriod.end)
    );
    if (!toPay.length) return;
    setBatchProgress({ done: 0, total: toPay.length, paid: 0, errors: 0 });
    const newSlips = [];
    for (const emp of toPay) {
      const amt = calcAmount(emp, currentProcPeriod.start, currentProcPeriod.end);
      const isH = (emp.employment_type || "").toLowerCase() === "hourly";
      try {
        const payload = {
          pay_period_start: `${currentProcPeriod.start}T00:00:00`,
          pay_period_end: `${currentProcPeriod.end}T23:59:59`,
          employment_type: emp.employment_type || "salary",
        };
        if (isH) {
          payload.hours_worked = 40;
          payload.hourly_rate_snapshot = emp.hourly_rate;
        } else {
          payload.gross_amount = amt ? parseFloat(amt.toFixed(2)) : 0;
        }
        const res = await payrollAPI.processPayment(emp.id, payload);
        const slip = res?.data ?? res;
        if (slip?.id) {
          newSlips.push(slip);
          setBatchProgress((p) => ({ ...p, done: p.done + 1, paid: p.paid + 1 }));
        } else {
          setBatchProgress((p) => ({ ...p, done: p.done + 1, errors: p.errors + 1 }));
        }
      } catch {
        setBatchProgress((p) => ({ ...p, done: p.done + 1, errors: p.errors + 1 }));
      }
    }
    setAllSlips((p) => [...p, ...newSlips]);
    setSelectedEmpIds(new Set());
  }, [currentProcPeriod, activeEmps, selectedEmpIds, slipMap]);

  // ── One-time payment ──────────────────────────────────────────────────────────
  const handleOtSubmit = async () => {
    const emp = employees.find((e) => e.id === ot.employee_id);
    if (!emp || !ot.amount || !ot.date) return;
    setOtLoading(true);
    setOtResult(null);
    try {
      const typeLabel = ONE_TIME_TYPES.find((t) => t.value === ot.payment_type)?.label || "Payment";
      const payload = {
        pay_period_start: `${ot.date}T00:00:00`,
        pay_period_end: `${ot.date}T23:59:59`,
        gross_amount: parseFloat(ot.amount),
        employment_type: emp.employment_type || "salary",
        notes: [typeLabel, ot.notes].filter(Boolean).join(": "),
      };
      const res = await payrollAPI.processPayment(emp.id, payload);
      const slip = res?.data ?? res;
      if (slip?.id) {
        setAllSlips((p) => [...p, slip]);
        setOtResult({ ok: true, name: empMap[emp.id], amount: ot.amount, type: typeLabel });
        setOt((p) => ({ ...p, employee_id: "", amount: "", notes: "" }));
      }
    } catch (err) {
      setOtResult({ ok: false, error: err?.response?.data?.detail || "Payment failed" });
    } finally {
      setOtLoading(false);
    }
  };

  // ── History filtering ─────────────────────────────────────────────────────────
  const filteredHistory = useMemo(() => {
    const sorted = [...allSlips].sort((a, b) => new Date(b.pay_period_start) - new Date(a.pay_period_start));
    if (!histSearch) return sorted;
    const q = histSearch.toLowerCase();
    return sorted.filter(
      (s) =>
        (empMap[s.employee_id] || "").toLowerCase().includes(q) ||
        (s.notes || "").toLowerCase().includes(q)
    );
  }, [allSlips, histSearch, empMap]);

  // ──────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 d-flex flex-column bg-white dark:bg-gray-900">

      {/* ── Header + tabs ── */}
      <div className="flex-shrink-0 border-bottom border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 pt-2">
        <div className="d-flex align-items-center gap-2 mb-2">
          <BanknotesIcon className="text-green-600" style={{ width: 20, height: 20 }} />
          <h6 className="mb-0 fw-semibold text-gray-900 dark:text-white flex-grow-1">Wages &amp; Payroll</h6>
          <button type="button" onClick={onClose} className="btn btn-sm btn-outline-secondary p-1">
            <XMarkIcon style={{ width: 16, height: 16 }} />
          </button>
        </div>
        <div className="d-flex gap-1" style={{ marginBottom: -1 }}>
          {[
            { key: "calendar", label: "Calendar", Icon: CalendarDaysIcon },
            { key: "process", label: "Process", Icon: BanknotesIcon },
            { key: "onetime", label: "One-Time", Icon: CheckIcon },
            { key: "history", label: "History", Icon: UserGroupIcon },
          ].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`btn btn-sm px-3 ${activeTab === key ? "btn-primary" : "btn-outline-secondary"}`}
              style={{ borderRadius: "0.5rem 0.5rem 0 0", borderBottom: "none", fontSize: "0.82rem" }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-grow-1 overflow-auto no-scrollbar">

        {/* ═══ CALENDAR TAB ═══ */}
        {activeTab === "calendar" && (
          <CalendarTab
            calYear={calYear} setCalYear={setCalYear}
            calMonth={calMonth} setCalMonth={setCalMonth}
            calPeriods={calPeriods}
            selectedPeriod={selectedPeriod} setSelectedPeriod={setSelectedPeriod}
            activeEmps={activeEmps}
            slipMap={slipMap}
            slipsLoading={slipsLoading}
            scheduleLoading={scheduleLoading}
            schedule={schedule}
            onGoToProcess={(period) => {
              // Jump to process tab with the correct month/period
              const d = new Date(period.start + "T00:00:00");
              setProcYear(d.getFullYear());
              setProcMonth(d.getMonth());
              // Index will be set once procPeriods recomputes
              setActiveTab("process");
            }}
          />
        )}

        {/* ═══ PROCESS TAB ═══ */}
        {activeTab === "process" && (
          <ProcessTab
            schedule={schedule}
            scheduleLoading={scheduleLoading}
            setProcYear={setProcYear}
            procMonth={procMonth} setProcMonth={setProcMonth}
            procPeriods={procPeriods}
            procPeriodIdx={procPeriodIdx} setProcPeriodIdx={setProcPeriodIdx}
            currentProcPeriod={currentProcPeriod}
            activeEmps={activeEmps}
            slipMap={slipMap}
            slipsLoading={slipsLoading}
            selectedEmpIds={selectedEmpIds} setSelectedEmpIds={setSelectedEmpIds}
            expandedId={expandedId}
            expandForms={expandForms}
            processingIds={processingIds}
            rowErrors={rowErrors}
            batchProgress={batchProgress} setBatchProgress={setBatchProgress}
            handleExpandEmp={handleExpandEmp}
            handlePaySingle={handlePaySingle}
            handlePaySelected={handlePaySelected}
            updateForm={updateForm}
          />
        )}

        {/* ═══ ONE-TIME TAB ═══ */}
        {activeTab === "onetime" && (
          <OneTimeTab
            employees={employees}
            ot={ot} setOt={setOt}
            otLoading={otLoading}
            otResult={otResult}
            handleOtSubmit={handleOtSubmit}
          />
        )}

        {/* ═══ HISTORY TAB ═══ */}
        {activeTab === "history" && (
          <HistoryTab
            slipsLoading={slipsLoading}
            filteredHistory={filteredHistory}
            histSearch={histSearch} setHistSearch={setHistSearch}
            empMap={empMap}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CALENDAR TAB
// ─────────────────────────────────────────────────────────────────────────────

function CalendarTab({
  calYear, setCalYear, calMonth, setCalMonth,
  calPeriods, selectedPeriod, setSelectedPeriod,
  activeEmps, slipMap, slipsLoading, scheduleLoading, schedule, onGoToProcess,
}) {
  const prevMonth = () => {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
    setSelectedPeriod(null);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
    setSelectedPeriod(null);
  };

  // Build the grid: Monday-first 7-col grid
  const firstDow = (new Date(calYear, calMonth, 1).getDay() + 6) % 7; // 0=Mon
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  // Map each ISO date to its period index
  function getPeriodIdx(day) {
    if (!day) return -1;
    const dateStr = iso(new Date(calYear, calMonth, day));
    return calPeriods.findIndex(p => p.start <= dateStr && p.end >= dateStr);
  }

  const todayStr = iso(new Date());

  return (
    <div>
      {/* Month navigator */}
      <div className="d-flex align-items-center gap-2 px-3 py-2 border-bottom border-gray-100 dark:border-gray-700">
        <button type="button" onClick={prevMonth} className="btn btn-sm btn-outline-secondary d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 30, height: 30, borderRadius: "50%", padding: 0 }}>
          <ChevronLeftIcon style={{ width: 14, height: 14 }} />
        </button>
        <div className="fw-semibold flex-grow-1 text-center" style={{ fontSize: "0.9rem" }}>
          {fmtMonthYear(calYear, calMonth)}
        </div>
        <button type="button" onClick={nextMonth} className="btn btn-sm btn-outline-secondary d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 30, height: 30, borderRadius: "50%", padding: 0 }}>
          <ChevronRightIcon style={{ width: 14, height: 14 }} />
        </button>
      </div>

      {scheduleLoading || slipsLoading ? (
        <div className="d-flex justify-content-center py-5">
          <div className="spinner-border spinner-border-sm text-primary" role="status" />
        </div>
      ) : (
        <>
          {/* Calendar grid */}
          <div className="px-2 pt-2">
            {/* Day-of-week headers */}
            <div className="d-grid mb-1" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                <div key={i} className="text-center text-muted fw-medium" style={{ fontSize: "0.7rem", padding: "2px 0" }}>{d}</div>
              ))}
            </div>

            {/* Day cells grouped in rows */}
            {Array.from({ length: cells.length / 7 }, (_, rowIdx) => (
              <div key={rowIdx} className="d-grid" style={{ gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 2 }}>
                {cells.slice(rowIdx * 7, rowIdx * 7 + 7).map((day, colIdx) => {
                  const cellIdx = rowIdx * 7 + colIdx;
                  const pidx = getPeriodIdx(day);
                  const pColor = pidx >= 0 ? PERIOD_COLORS[pidx % PERIOD_COLORS.length] : null;
                  const period = pidx >= 0 ? calPeriods[pidx] : null;
                  const isSelected = period && selectedPeriod?.start === period.start;
                  const dateStr = day ? iso(new Date(calYear, calMonth, day)) : null;
                  const isToday = dateStr === todayStr;

                  // Rounding: first day of period in this row gets left-rounded, last gets right-rounded
                  const prevPidx = getPeriodIdx(day ? day - 1 : null);
                  const nextPidx = getPeriodIdx(day ? day + 1 : null);
                  const isFirst = pidx >= 0 && (colIdx === 0 || prevPidx !== pidx);
                  const isLast  = pidx >= 0 && (colIdx === 6 || nextPidx !== pidx);

                  return (
                    <div
                      key={cellIdx}
                      onClick={() => period && setSelectedPeriod(isSelected ? null : period)}
                      style={{
                        padding: "5px 2px",
                        textAlign: "center",
                        fontSize: "0.8rem",
                        fontWeight: isToday ? "700" : "400",
                        background: !day ? "transparent"
                          : isSelected ? (pColor?.border || "#93c5fd")
                          : pColor ? pColor.bg
                          : "transparent",
                        color: isSelected ? "#fff" : isToday ? "#2563eb" : "inherit",
                        borderRadius: !day ? 0
                          : isFirst && isLast ? "50%"
                          : isFirst ? "50% 0 0 50%"
                          : isLast ? "0 50% 50% 0"
                          : 0,
                        cursor: period ? "pointer" : "default",
                        transition: "background 0.15s",
                      }}
                    >
                      {day || ""}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Period legend + stats */}
          <div className="px-3 pt-3 pb-2">
            <div className="fw-medium text-muted mb-2" style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Pay Periods
            </div>
            {calPeriods.length === 0 ? (
              <p className="text-muted small text-center py-3">No pay periods for this month.</p>
            ) : (
              calPeriods.map((period, idx) => {
                const color = PERIOD_COLORS[idx % PERIOD_COLORS.length];
                const paidEmps = activeEmps.filter((e) => isPaid(slipMap[e.id], period.start, period.end));
                const unpaidEmps = activeEmps.filter((e) => !isPaid(slipMap[e.id], period.start, period.end));
                const isSelected = selectedPeriod?.start === period.start;

                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedPeriod(isSelected ? null : period)}
                    className={`d-flex align-items-center gap-2 py-2 px-2 rounded mb-1 ${isSelected ? "shadow-sm" : ""}`}
                    style={{
                      background: isSelected ? color.bg : "var(--bs-tertiary-bg, #f8f9fa)",
                      border: `1px solid ${isSelected ? color.border : "transparent"}`,
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: color.border, flexShrink: 0 }} />
                    <div className="flex-grow-1 min-w-0">
                      <div className="fw-medium text-truncate" style={{ fontSize: "0.82rem" }}>{period.label}</div>
                      {period.payday && (
                        <div style={{ fontSize: "0.7rem" }}>
                          <PaydayBadge payday={period.payday} schedule={schedule} />
                        </div>
                      )}
                    </div>
                    <div className="d-flex gap-1 flex-shrink-0">
                      {paidEmps.length > 0 && (
                        <span className="badge bg-success" style={{ fontSize: "0.65rem" }}>{paidEmps.length} paid</span>
                      )}
                      {unpaidEmps.length > 0 && (
                        <span className="badge bg-secondary" style={{ fontSize: "0.65rem" }}>{unpaidEmps.length} unpaid</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Selected period: employee breakdown */}
          {selectedPeriod && (
            <div className="border-top border-gray-100 dark:border-gray-700 px-3 pt-3 pb-2">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <div className="fw-semibold" style={{ fontSize: "0.85rem" }}>
                  {selectedPeriod.label}
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  style={{ fontSize: "0.72rem" }}
                  onClick={() => onGoToProcess(selectedPeriod)}
                >
                  Process Payroll →
                </button>
              </div>
              {activeEmps.length === 0 ? (
                <p className="text-muted small">No active employees.</p>
              ) : (
                activeEmps.map((emp) => {
                  const paid = isPaid(slipMap[emp.id], selectedPeriod.start, selectedPeriod.end);
                  const emp_slips = (slipMap[emp.id] || []).filter(
                    (s) => s.status === "paid" &&
                      new Date(s.pay_period_start) <= new Date(selectedPeriod.end + "T23:59:59") &&
                      new Date(s.pay_period_end) >= new Date(selectedPeriod.start + "T00:00:00")
                  );
                  const slip = emp_slips[0];
                  return (
                    <div key={emp.id} className="d-flex align-items-center gap-2 py-1 border-bottom border-gray-50 dark:border-gray-800">
                      <div className="flex-shrink-0 rounded-circle d-flex align-items-center justify-content-center fw-bold text-white" style={{ width: 28, height: 28, fontSize: "0.62rem", background: paid ? "#16a34a" : "#9ca3af" }}>
                        {emp.first_name?.[0]}{emp.last_name?.[0]}
                      </div>
                      <div className="flex-grow-1 min-w-0">
                        <div className="fw-medium text-truncate" style={{ fontSize: "0.8rem" }}>{emp.first_name} {emp.last_name}</div>
                      </div>
                      <div className="flex-shrink-0 text-end">
                        {paid ? (
                          <div>
                            <span className="text-success d-flex align-items-center gap-1" style={{ fontSize: "0.7rem" }}>
                              <CheckCircleSolidIcon style={{ width: 12, height: 12 }} /> ${slip?.net_amount?.toFixed(2)}
                            </span>
                            {slip?.created_at && (
                              <div className="text-muted" style={{ fontSize: "0.62rem" }}>
                                {fmtShort(slip.created_at.slice(0, 10), true)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted" style={{ fontSize: "0.7rem" }}>Unpaid</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROCESS TAB
// ─────────────────────────────────────────────────────────────────────────────

function ProcessTab({
  schedule, scheduleLoading,
  setProcYear, procMonth, setProcMonth,
  procPeriods, procPeriodIdx, setProcPeriodIdx,
  currentProcPeriod,
  activeEmps, slipMap, slipsLoading,
  selectedEmpIds, setSelectedEmpIds,
  expandedId, expandForms, processingIds, rowErrors,
  batchProgress, setBatchProgress,
  handleExpandEmp, handlePaySingle, handlePaySelected,
  updateForm,
}) {
  const prevPeriod = () => {
    if (procPeriodIdx > 0) {
      setProcPeriodIdx((i) => i - 1);
    } else {
      // Go to previous month, last period
      if (procMonth === 0) { setProcYear(y => y - 1); setProcMonth(11); }
      else setProcMonth(m => m - 1);
      // procPeriodIdx will clamp to last via useEffect in parent — set to large number
      setProcPeriodIdx(999);
    }
    setBatchProgress(null);
  };

  const nextPeriod = () => {
    if (procPeriodIdx < procPeriods.length - 1) {
      setProcPeriodIdx((i) => i + 1);
    } else {
      if (procMonth === 11) { setProcYear(y => y + 1); setProcMonth(0); }
      else setProcMonth(m => m + 1);
      setProcPeriodIdx(0);
    }
    setBatchProgress(null);
  };

  // Determine if we can still navigate forward (don't go past today)
  const today = iso(new Date());
  const canGoForward = currentProcPeriod ? currentProcPeriod.start <= today : true;

  if (scheduleLoading || slipsLoading) {
    return (
      <div className="d-flex justify-content-center py-5">
        <div className="spinner-border spinner-border-sm text-primary" role="status" />
      </div>
    );
  }

  if (!currentProcPeriod) {
    return <div className="text-center text-muted py-5 small">No pay periods configured.</div>;
  }

  const unpaidEmps = activeEmps.filter((e) => !isPaid(slipMap[e.id], currentProcPeriod.start, currentProcPeriod.end));
  const paidEmps   = activeEmps.filter((e) =>  isPaid(slipMap[e.id], currentProcPeriod.start, currentProcPeriod.end));
  const selectedUnpaid = activeEmps.filter(
    (e) => selectedEmpIds.has(e.id) && !isPaid(slipMap[e.id], currentProcPeriod.start, currentProcPeriod.end)
  );
  const totalSelectedAmt = selectedUnpaid.reduce((acc, e) => {
    const a = calcAmount(e, currentProcPeriod.start, currentProcPeriod.end);
    return acc + (a || 0);
  }, 0);

  const allUnpaidSelected =
    unpaidEmps.length > 0 && unpaidEmps.every((e) => selectedEmpIds.has(e.id));

  const toggleAllUnpaid = () => {
    if (allUnpaidSelected) {
      setSelectedEmpIds((p) => {
        const n = new Set(p);
        unpaidEmps.forEach((e) => n.delete(e.id));
        return n;
      });
    } else {
      setSelectedEmpIds((p) => {
        const n = new Set(p);
        unpaidEmps.forEach((e) => n.add(e.id));
        return n;
      });
    }
  };

  const batchBusy = batchProgress && batchProgress.done < batchProgress.total;

  return (
    <>
      {/* Period header */}
      <div className="bg-white dark:bg-gray-800 border-bottom border-gray-100 dark:border-gray-700 px-3 py-2" style={{ position: "sticky", top: 0, zIndex: 5 }}>

        {/* Period navigator */}
        <div className="d-flex align-items-center gap-2 mb-2">
          <button type="button" onClick={prevPeriod} className="btn btn-sm btn-outline-secondary d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 30, height: 30, borderRadius: "50%", padding: 0 }}>
            <ChevronLeftIcon style={{ width: 14, height: 14 }} />
          </button>
          <div className="flex-grow-1 text-center">
            <div className="fw-semibold" style={{ fontSize: "0.88rem" }}>
              {currentProcPeriod.label}
            </div>
            <div className="text-muted" style={{ fontSize: "0.68rem" }}>
              Work period: {fmtShort(currentProcPeriod.start)} – {fmtShort(currentProcPeriod.end, true)}
            </div>
          </div>
          <button type="button" onClick={nextPeriod} disabled={!canGoForward} className="btn btn-sm btn-outline-secondary d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 30, height: 30, borderRadius: "50%", padding: 0 }}>
            <ChevronRightIcon style={{ width: 14, height: 14 }} />
          </button>
        </div>

        {/* Payday + timing info */}
        <div className="d-flex flex-wrap gap-1 mb-1">
          {currentProcPeriod.payday ? (
            <PaydayBadge payday={currentProcPeriod.payday} schedule={schedule} />
          ) : (
            <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle" style={{ fontSize: "0.68rem" }}>
              No payday configured — set in Profile → Payroll
            </span>
          )}
          {batchProgress && (
            <span className={`badge ${batchProgress.errors > 0 ? "bg-danger-subtle text-danger" : "bg-info-subtle text-info"}`} style={{ fontSize: "0.68rem" }}>
              {batchProgress.done}/{batchProgress.total} · {batchProgress.paid} paid
              {batchProgress.errors > 0 && ` · ${batchProgress.errors} errors`}
            </span>
          )}
        </div>

        {/* Select-all row */}
        {unpaidEmps.length > 0 && (
          <div className="d-flex align-items-center gap-2 mt-1">
            <input
              type="checkbox"
              className="form-check-input mt-0"
              checked={allUnpaidSelected}
              onChange={toggleAllUnpaid}
              id="chk-all-unpaid"
            />
            <label htmlFor="chk-all-unpaid" className="form-check-label small" style={{ fontSize: "0.78rem" }}>
              Select all unpaid ({unpaidEmps.length})
            </label>
            <span className="ms-auto text-muted" style={{ fontSize: "0.68rem" }}>
              {paidEmps.length} of {activeEmps.length} paid
            </span>
          </div>
        )}
      </div>

      {/* Employee list */}
      {activeEmps.length === 0 ? (
        <div className="text-center text-muted py-5 small">
          <BanknotesIcon className="mx-auto mb-2" style={{ width: 32, height: 32, opacity: 0.25 }} />
          <div>No active employees found.</div>
        </div>
      ) : (
        activeEmps.map((emp) => {
          const paidNow = isPaid(slipMap[emp.id], currentProcPeriod.start, currentProcPeriod.end);
          const isSelected = selectedEmpIds.has(emp.id);
          const isH = (emp.employment_type || "").toLowerCase() === "hourly";
          const amt = calcAmount(emp, currentProcPeriod.start, currentProcPeriod.end);
          const isExpanded = expandedId === emp.id;
          const isProc = processingIds.has(emp.id);
          const form = expandForms[emp.id] || {};
          const rowErr = rowErrors[emp.id];

          return (
            <div key={emp.id} className={`border-bottom border-gray-100 dark:border-gray-700 ${paidNow ? "bg-success-subtle" : ""}`}>
              {/* Main row */}
              <div className="d-flex align-items-center gap-2 px-3 py-2">
                {/* Checkbox (only for unpaid) */}
                {!paidNow && (
                  <input
                    type="checkbox"
                    className="form-check-input mt-0 flex-shrink-0"
                    checked={isSelected}
                    onChange={() =>
                      setSelectedEmpIds((p) => {
                        const n = new Set(p);
                        if (n.has(emp.id)) n.delete(emp.id);
                        else n.add(emp.id);
                        return n;
                      })
                    }
                  />
                )}
                {paidNow && <div style={{ width: 16, flexShrink: 0 }} />}

                {/* Avatar */}
                <div
                  className="flex-shrink-0 rounded-circle d-flex align-items-center justify-content-center fw-bold text-white"
                  style={{ width: 34, height: 34, fontSize: "0.68rem", background: paidNow ? "#16a34a" : "#9ca3af" }}
                >
                  {emp.first_name?.[0]}{emp.last_name?.[0]}
                </div>

                {/* Info */}
                <div className="flex-grow-1 min-w-0">
                  <div className="fw-medium text-truncate" style={{ fontSize: "0.84rem" }}>
                    {emp.first_name} {emp.last_name}
                  </div>
                  <div className="d-flex align-items-center gap-1 flex-wrap" style={{ fontSize: "0.68rem" }}>
                    <span className={`badge ${roleBadge(emp.role)}`} style={{ fontSize: "0.58rem" }}>{emp.role}</span>
                    <span className="text-muted">
                      {isH ? `$${emp.hourly_rate}/hr` : emp.salary ? `$${Number(emp.salary).toLocaleString()}/yr` : "No rate"}
                    </span>
                  </div>
                </div>

                {/* Amount + action */}
                <div className="flex-shrink-0 text-end d-flex flex-column align-items-end" style={{ gap: 2 }}>
                  <span className="fw-semibold" style={{ fontSize: "0.86rem" }}>
                    {amt != null ? `$${amt.toFixed(2)}` : <span className="text-muted small">—</span>}
                  </span>
                  {paidNow ? (
                    <span className="text-success d-flex align-items-center gap-1" style={{ fontSize: "0.68rem" }}>
                      <CheckCircleSolidIcon style={{ width: 11, height: 11 }} /> Paid
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleExpandEmp(emp)}
                      className={`btn btn-sm ${isExpanded ? "btn-secondary" : "btn-outline-success"}`}
                      style={{ fontSize: "0.68rem", padding: "1px 9px" }}
                    >
                      {isExpanded ? "Cancel" : "Pay"}
                    </button>
                  )}
                </div>
              </div>

              {/* Inline pay form */}
              {isExpanded && !paidNow && (
                <div className="px-3 pb-3 pt-1" style={{ background: "var(--bs-tertiary-bg, #f8f9fa)" }}>
                  {rowErr && <div className="alert alert-danger py-1 px-2 small mb-2">{rowErr}</div>}
                  <div className="row g-2">
                    <div className="col-6">
                      <label className="form-label small fw-semibold mb-1">{isH ? "Hours Worked" : "Gross Amount"}</label>
                      <div className="input-group input-group-sm">
                        {!isH && <span className="input-group-text">$</span>}
                        <input
                          type="number" min="0" step={isH ? "0.25" : "0.01"}
                          className="form-control"
                          value={isH ? (form.hours_worked ?? "") : (form.gross_amount ?? "")}
                          onChange={(e) => updateForm(emp.id, isH ? "hours_worked" : "gross_amount", e.target.value)}
                        />
                        {isH && <span className="input-group-text">hrs</span>}
                      </div>
                      {isH && emp.hourly_rate && (
                        <div className="text-muted mt-1" style={{ fontSize: "0.66rem" }}>@ ${emp.hourly_rate}/hr</div>
                      )}
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold mb-1">Deductions</label>
                      <div className="input-group input-group-sm">
                        <span className="input-group-text">$</span>
                        <input
                          type="number" min="0" step="0.01"
                          className="form-control"
                          value={form.other_deductions ?? "0"}
                          onChange={(e) => updateForm(emp.id, "other_deductions", e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="col-12">
                      <label className="form-label small fw-semibold mb-1">Notes</label>
                      <input
                        type="text" className="form-control form-control-sm" placeholder="Optional"
                        value={form.notes ?? ""}
                        onChange={(e) => updateForm(emp.id, "notes", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="d-flex justify-content-end gap-2 mt-2">
                    <button type="button" onClick={() => handleExpandEmp(emp)} className="btn btn-sm btn-outline-secondary">Cancel</button>
                    <button type="button" onClick={() => handlePaySingle(emp)} disabled={isProc} className="btn btn-sm btn-success d-flex align-items-center gap-1">
                      {isProc ? <><span className="spinner-border" style={{ width: 11, height: 11 }} /> Processing…</> : <><CheckIcon style={{ width: 11, height: 11 }} /> Confirm Pay</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Sticky footer: Pay selected */}
      {selectedUnpaid.length > 0 && (
        <div className="border-top border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2" style={{ position: "sticky", bottom: 0 }}>
          <div className="d-flex align-items-center justify-content-between">
            <div>
              <div className="fw-medium" style={{ fontSize: "0.84rem" }}>
                {selectedUnpaid.length} employee{selectedUnpaid.length !== 1 ? "s" : ""} selected
              </div>
              <div className="text-muted" style={{ fontSize: "0.72rem" }}>
                Total: ${totalSelectedAmt.toFixed(2)}
              </div>
            </div>
            <button
              type="button"
              onClick={handlePaySelected}
              disabled={batchBusy}
              className="btn btn-success d-flex align-items-center gap-2"
              style={{ fontSize: "0.82rem" }}
            >
              {batchBusy ? (
                <><span className="spinner-border spinner-border-sm" style={{ width: 13, height: 13 }} /> Processing…</>
              ) : (
                <><BanknotesIcon style={{ width: 15, height: 15 }} /> Pay {selectedUnpaid.length}</>
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ONE-TIME TAB
// ─────────────────────────────────────────────────────────────────────────────

function OneTimeTab({ employees, ot, setOt, otLoading, otResult, handleOtSubmit }) {
  return (
    <div className="p-3">
      <p className="small text-muted mb-3">
        Issue a bonus, commission, reimbursement, or any one-off payment. These appear in the employee's pay history and do not affect regular payroll cycles.
      </p>

      {otResult?.ok && (
        <div className="alert alert-success py-2 px-3 small d-flex align-items-center gap-2 mb-3">
          <CheckCircleSolidIcon style={{ width: 16, height: 16, flexShrink: 0 }} />
          ${otResult.amount} {otResult.type} paid to {otResult.name}
        </div>
      )}
      {otResult?.ok === false && <div className="alert alert-danger py-2 px-3 small mb-3">{otResult.error}</div>}

      <div className="mb-3">
        <label className="form-label small fw-semibold mb-1">Employee</label>
        <select className="form-select form-select-sm" value={ot.employee_id} onChange={(e) => setOt((p) => ({ ...p, employee_id: e.target.value }))}>
          <option value="">— Select employee —</option>
          {employees.filter((e) => e.is_active).map((e) => (
            <option key={e.id} value={e.id}>{e.first_name} {e.last_name} · {e.role}</option>
          ))}
        </select>
      </div>

      <div className="mb-3">
        <label className="form-label small fw-semibold mb-1">Payment Type</label>
        <div className="d-flex flex-wrap gap-1">
          {ONE_TIME_TYPES.map((t) => (
            <button key={t.value} type="button"
              onClick={() => setOt((p) => ({ ...p, payment_type: t.value }))}
              className={`btn btn-sm rounded-pill ${ot.payment_type === t.value ? "btn-primary" : "btn-outline-secondary"}`}
              style={{ fontSize: "0.78rem", padding: "3px 14px" }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="row g-2 mb-3">
        <div className="col-6">
          <label className="form-label small fw-semibold mb-1">Amount</label>
          <div className="input-group input-group-sm">
            <span className="input-group-text">$</span>
            <input type="number" min="0" step="0.01" className="form-control" placeholder="0.00"
              value={ot.amount} onChange={(e) => setOt((p) => ({ ...p, amount: e.target.value }))} />
          </div>
        </div>
        <div className="col-6">
          <label className="form-label small fw-semibold mb-1">Date</label>
          <input type="date" className="form-control form-control-sm"
            value={ot.date} onChange={(e) => setOt((p) => ({ ...p, date: e.target.value }))} />
        </div>
      </div>

      <div className="mb-3">
        <label className="form-label small fw-semibold mb-1">Notes (optional)</label>
        <input type="text" className="form-control form-control-sm" placeholder="e.g. Year-end bonus, Q1 commission…"
          value={ot.notes} onChange={(e) => setOt((p) => ({ ...p, notes: e.target.value }))} />
      </div>

      <button type="button" onClick={handleOtSubmit}
        disabled={otLoading || !ot.employee_id || !ot.amount || !ot.date}
        className="btn btn-success w-100 d-flex align-items-center justify-content-center gap-2">
        {otLoading
          ? <><span className="spinner-border spinner-border-sm" style={{ width: 14, height: 14 }} /> Processing…</>
          : <><BanknotesIcon style={{ width: 16, height: 16 }} /> Process Payment</>}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HISTORY TAB
// ─────────────────────────────────────────────────────────────────────────────

function HistoryTab({ slipsLoading, filteredHistory, histSearch, setHistSearch, empMap }) {
  return (
    <>
      <div className="bg-white dark:bg-gray-800 border-bottom border-gray-100 dark:border-gray-700 px-3 py-2" style={{ position: "sticky", top: 0, zIndex: 5 }}>
        <input type="text" placeholder="Search by employee or notes…" className="form-control form-control-sm"
          value={histSearch} onChange={(e) => setHistSearch(e.target.value)} />
      </div>

      {slipsLoading ? (
        <div className="d-flex justify-content-center py-5">
          <div className="spinner-border spinner-border-sm text-primary" role="status" />
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="text-center text-muted py-5 small">No pay history yet.</div>
      ) : (
        filteredHistory.map((slip) => {
          const name = empMap[slip.employee_id] || "Unknown";
          const sameDay = slip.pay_period_start?.slice(0, 10) === slip.pay_period_end?.slice(0, 10);
          const periodLabel = sameDay
            ? `One-time · ${fmtShort(slip.pay_period_start.slice(0, 10), true)}`
            : `${fmtShort(slip.pay_period_start.slice(0, 10))} – ${fmtShort(slip.pay_period_end.slice(0, 10), true)}`;
          const paidOn = slip.created_at ? fmtShort(slip.created_at.slice(0, 10), true) : null;

          return (
            <div key={slip.id} className="d-flex align-items-center gap-2 px-3 py-2 border-bottom border-gray-100 dark:border-gray-700">
              <div className="flex-shrink-0 rounded-circle d-flex align-items-center justify-content-center fw-bold" style={{ width: 32, height: 32, fontSize: "0.65rem", background: "#d1fae5", color: "#065f46" }}>$</div>
              <div className="flex-grow-1 min-w-0">
                <div className="fw-medium text-truncate" style={{ fontSize: "0.83rem" }}>{name}</div>
                <div className="text-muted text-truncate" style={{ fontSize: "0.7rem" }}>
                  {periodLabel}{slip.notes ? ` · ${slip.notes}` : ""}
                  {paidOn && <span className="ms-1">· paid {paidOn}</span>}
                </div>
              </div>
              <div className="flex-shrink-0 text-end">
                <div className="fw-semibold text-success" style={{ fontSize: "0.85rem" }}>${slip.gross_amount?.toFixed(2)}</div>
                <div className="text-muted" style={{ fontSize: "0.68rem" }}>net ${slip.net_amount?.toFixed(2)}</div>
              </div>
            </div>
          );
        })
      )}
    </>
  );
}
