/*
 * Modal_Wages.jsx — Comprehensive Wages & Payroll
 *
 * Tabs:
 *   Run Payroll — smart period navigator (weekly / biweekly / monthly)
 *                 employee list with inline pay expansion per row
 *                 "Pay All Unpaid" batch action
 *   One-Time    — bonus / commission / reimbursement / advance / other
 *   History     — searchable full pay-slip log
 */

import React, { useState, useEffect, useMemo } from "react";
import { BanknotesIcon, XMarkIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { CheckCircleIcon as CheckCircleSolidIcon } from "@heroicons/react/24/solid";
import { payrollAPI } from "../../services/api";
import Button_Toolbar from "./Button_Toolbar";

// ─── Date helpers ──────────────────────────────────────────────────────────────

const iso = (d) => d.toISOString().slice(0, 10);

function getMondayOf(d = new Date()) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  return date;
}

function getWeekNumber(d) {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  return Math.ceil(((dt - yearStart) / 86400000 + 1) / 7);
}

function fmtShort(dateStr, withYear = false) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}) });
}

function getWeekRange(offset) {
  const mon = getMondayOf();
  mon.setDate(mon.getDate() + offset * 7);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return {
    start: iso(mon),
    end: iso(sun),
    label: `Week ${getWeekNumber(mon)} · ${fmtShort(iso(mon))} – ${fmtShort(iso(sun), true)}`,
    shortLabel: `Wk ${getWeekNumber(mon)}`,
  };
}

const BI_EPOCH = new Date("2025-01-06T00:00:00");

function getBiweekRange(offset) {
  const mon = getMondayOf();
  const wks = Math.round((mon - BI_EPOCH) / (7 * 86400000));
  const biStart = new Date(BI_EPOCH);
  biStart.setDate(BI_EPOCH.getDate() + (Math.floor(wks / 2) + offset) * 14);
  const biEnd = new Date(biStart);
  biEnd.setDate(biStart.getDate() + 13);
  return {
    start: iso(biStart),
    end: iso(biEnd),
    label: `${fmtShort(iso(biStart))} – ${fmtShort(iso(biEnd), true)}`,
    shortLabel: fmtShort(iso(biStart)),
  };
}

function getMonthRange(offset) {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const end = new Date(today.getFullYear(), today.getMonth() + offset + 1, 0);
  return {
    start: iso(start),
    end: iso(end),
    label: start.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    shortLabel: start.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
  };
}

function getPeriodRange(freqView, offset) {
  if (freqView === "weekly") return getWeekRange(offset);
  if (freqView === "biweekly") return getBiweekRange(offset);
  return getMonthRange(offset);
}

// ─── Pay calculation ───────────────────────────────────────────────────────────

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

function isPaid(slips, start, end) {
  if (!slips?.length) return false;
  return slips.some((s) => s.status === "paid" && new Date(s.pay_period_start) <= new Date(end + "T23:59:59") && new Date(s.pay_period_end) >= new Date(start + "T00:00:00"));
}

function roleBadge(role) {
  if (role === "admin") return "bg-danger";
  if (role === "manager") return "bg-warning text-dark";
  return "bg-primary";
}

const ONE_TIME_TYPES = [
  { value: "bonus", label: "Bonus" },
  { value: "commission", label: "Commission" },
  { value: "reimbursement", label: "Reimbursement" },
  { value: "advance", label: "Advance" },
  { value: "other", label: "Other" },
];

// ─── Component ─────────────────────────────────────────────────────────────────

export default function Modal_Wages({ employees = [], onClose }) {
  // ── Tabs ──────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("payroll");

  // ── Payroll tab state ─────────────────────────────────────────────────────────
  const [payFreqView, setPayFreqView] = useState(() => {
    const cnt = { weekly: 0, biweekly: 0, monthly: 0 };
    employees.forEach((e) => {
      const f = (e.pay_frequency || "").toLowerCase();
      if (f in cnt) cnt[f]++;
    });
    return Object.entries(cnt).sort((a, b) => b[1] - a[1])[0]?.[0] || "weekly";
  });
  const [periodOffset, setPeriodOffset] = useState(0);
  const [nameFilter, setNameFilter] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [expandForms, setExpandForms] = useState({});
  const [processingIds, setProcessingIds] = useState(new Set());
  const [rowErrors, setRowErrors] = useState({});
  const [payAllProgress, setPayAllProgress] = useState(null); // {done,total,paid,errors}

  // ── One-time tab state ────────────────────────────────────────────────────────
  const todayStr = new Date().toISOString().slice(0, 10);
  const [ot, setOt] = useState({ employee_id: "", payment_type: "bonus", amount: "", date: todayStr, notes: "" });
  const [otLoading, setOtLoading] = useState(false);
  const [otResult, setOtResult] = useState(null);

  // ── Slips ─────────────────────────────────────────────────────────────────────
  const [allSlips, setAllSlips] = useState([]);
  const [slipsLoading, setSlipsLoading] = useState(true);
  const [histSearch, setHistSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    setSlipsLoading(true);
    payrollAPI
      .getAll()
      .then((r) => {
        if (!cancelled) {
          const d = r?.data ?? r ?? [];
          setAllSlips(Array.isArray(d) ? d : []);
        }
      })
      .catch(() => {
        if (!cancelled) setAllSlips([]);
      })
      .finally(() => {
        if (!cancelled) setSlipsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Computed ─────────────────────────────────────────────────────────────────
  const period = useMemo(() => getPeriodRange(payFreqView, periodOffset), [payFreqView, periodOffset]);

  const slipMap = useMemo(() => {
    const m = {};
    allSlips.forEach((s) => {
      (m[s.employee_id] ??= []).push(s);
    });
    return m;
  }, [allSlips]);

  const empMap = useMemo(() => {
    const m = {};
    employees.forEach((e) => {
      m[e.id] = `${e.first_name} ${e.last_name}`.trim();
    });
    return m;
  }, [employees]);

  const visibleEmps = useMemo(() => {
    const q = nameFilter.toLowerCase();
    return employees.filter((e) => {
      if (!e.is_active) return false;
      if ((e.pay_frequency || "").toLowerCase() !== payFreqView) return false;
      if (q && !`${e.first_name} ${e.last_name}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [employees, payFreqView, nameFilter]);

  const filteredHistory = useMemo(() => {
    const sorted = [...allSlips].sort((a, b) => new Date(b.pay_period_start) - new Date(a.pay_period_start));
    if (!histSearch) return sorted;
    const q = histSearch.toLowerCase();
    return sorted.filter((s) => (empMap[s.employee_id] || "").toLowerCase().includes(q) || (s.notes || "").toLowerCase().includes(q));
  }, [allSlips, histSearch, empMap]);

  const paidCount = visibleEmps.filter((e) => isPaid(slipMap[e.id], period.start, period.end)).length;
  const unpaidCount = visibleEmps.filter((e) => !isPaid(slipMap[e.id], period.start, period.end)).length;

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const updateForm = (empId, field, value) => setExpandForms((p) => ({ ...p, [empId]: { ...(p[empId] || {}), [field]: value } }));

  const handleExpand = (emp) => {
    if (expandedId === emp.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(emp.id);
    const amt = calcAmount(emp, period.start, period.end);
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
  };

  // ── Submit single payment ─────────────────────────────────────────────────────
  const handlePaySingle = async (emp) => {
    const form = expandForms[emp.id] || {};
    const isH = (emp.employment_type || "").toLowerCase() === "hourly";
    setProcessingIds((p) => new Set([...p, emp.id]));
    setRowErrors((p) => ({ ...p, [emp.id]: "" }));
    try {
      const payload = {
        pay_period_start: `${period.start}T00:00:00`,
        pay_period_end: `${period.end}T23:59:59`,
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
      }
    } catch (err) {
      setRowErrors((p) => ({ ...p, [emp.id]: err?.response?.data?.detail || "Payment failed" }));
    } finally {
      setProcessingIds((p) => {
        const n = new Set(p);
        n.delete(emp.id);
        return n;
      });
    }
  };

  // ── Pay all unpaid ────────────────────────────────────────────────────────────
  const handlePayAll = async () => {
    const unpaid = visibleEmps.filter((e) => !isPaid(slipMap[e.id], period.start, period.end));
    if (!unpaid.length) return;
    setPayAllProgress({ done: 0, total: unpaid.length, paid: 0, errors: 0 });
    const newSlips = [];
    for (const emp of unpaid) {
      const amt = calcAmount(emp, period.start, period.end);
      const isH = (emp.employment_type || "").toLowerCase() === "hourly";
      if (!amt) {
        setPayAllProgress((p) => ({ ...p, done: p.done + 1, errors: p.errors + 1 }));
        continue;
      }
      try {
        const payload = {
          pay_period_start: `${period.start}T00:00:00`,
          pay_period_end: `${period.end}T23:59:59`,
          employment_type: emp.employment_type || "salary",
        };
        if (isH) {
          payload.hours_worked = 40;
          payload.hourly_rate_snapshot = emp.hourly_rate;
        } else {
          payload.gross_amount = parseFloat(amt.toFixed(2));
        }
        const res = await payrollAPI.processPayment(emp.id, payload);
        const slip = res?.data ?? res;
        if (slip?.id) {
          newSlips.push(slip);
          setPayAllProgress((p) => ({ ...p, done: p.done + 1, paid: p.paid + 1 }));
        } else setPayAllProgress((p) => ({ ...p, done: p.done + 1, errors: p.errors + 1 }));
      } catch {
        setPayAllProgress((p) => ({ ...p, done: p.done + 1, errors: p.errors + 1 }));
      }
    }
    setAllSlips((p) => [...p, ...newSlips]);
  };

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

  const payAllBusy = payAllProgress && payAllProgress.done < payAllProgress.total;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 d-flex flex-column bg-white dark:bg-gray-900">
      {/* ── Header + tabs ── */}
      <div className="flex-shrink-0 border-bottom border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 pt-2">
        <div className="d-flex align-items-center gap-2 mb-2">
          <BanknotesIcon className="text-green-600" style={{ width: 20, height: 20 }} />
          <h6 className="mb-0 fw-semibold text-gray-900 dark:text-white">Wages &amp; Payroll</h6>
        </div>
        <div className="d-flex gap-1" style={{ marginBottom: -1 }}>
          {[
            { key: "payroll", label: "Run Payroll" },
            { key: "onetime", label: "One-Time" },
            { key: "history", label: "History" },
          ].map((tab) => (
            <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} className={`btn btn-sm px-3 ${activeTab === tab.key ? "btn-primary" : "btn-outline-secondary"}`} style={{ borderRadius: "0.5rem 0.5rem 0 0", borderBottom: "none", fontSize: "0.82rem" }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-grow-1 overflow-auto no-scrollbar">
        {/* ═══ RUN PAYROLL ═══ */}
        {activeTab === "payroll" && (
          <>
            {/* Sticky controls */}
            <div className="bg-white dark:bg-gray-800 border-bottom border-gray-100 dark:border-gray-700 px-3 py-2" style={{ position: "sticky", top: 0, zIndex: 5 }}>
              {/* Frequency pills */}
              <div className="d-flex gap-1 mb-2">
                {["weekly", "biweekly", "monthly"].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => {
                      setPayFreqView(f);
                      setPeriodOffset(0);
                      setExpandedId(null);
                      setPayAllProgress(null);
                    }}
                    className={`btn btn-sm rounded-pill text-capitalize ${payFreqView === f ? "btn-primary" : "btn-outline-secondary"}`}
                    style={{ fontSize: "0.76rem", padding: "3px 14px" }}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {/* Period navigator */}
              <div className="d-flex align-items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => {
                    setPeriodOffset((p) => p - 1);
                    setExpandedId(null);
                    setPayAllProgress(null);
                  }}
                  className="btn btn-sm btn-outline-secondary d-flex align-items-center justify-content-center flex-shrink-0"
                  style={{ width: 32, height: 32, borderRadius: "50%", padding: 0 }}
                >
                  <ChevronLeftIcon style={{ width: 14, height: 14 }} />
                </button>
                <div className="flex-grow-1 text-center">
                  <div className="fw-semibold" style={{ fontSize: "0.85rem" }}>
                    {period.label}
                  </div>
                  <div className="text-muted" style={{ fontSize: "0.68rem" }}>
                    {period.start} → {period.end}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPeriodOffset((p) => p + 1);
                    setExpandedId(null);
                    setPayAllProgress(null);
                  }}
                  disabled={periodOffset >= 0}
                  className="btn btn-sm btn-outline-secondary d-flex align-items-center justify-content-center flex-shrink-0"
                  style={{ width: 32, height: 32, borderRadius: "50%", padding: 0 }}
                >
                  <ChevronRightIcon style={{ width: 14, height: 14 }} />
                </button>
              </div>

              {/* Name search */}
              <input type="text" placeholder="Search employees…" value={nameFilter} onChange={(e) => setNameFilter(e.target.value)} className="form-control form-control-sm mb-1" />

              {/* Status summary */}
              {!slipsLoading && visibleEmps.length > 0 && (
                <div className="d-flex flex-wrap gap-1 mt-1">
                  <span className="badge bg-success-subtle text-success">{paidCount} paid</span>
                  <span className="badge bg-secondary-subtle text-secondary">{unpaidCount} unpaid</span>
                  {payAllProgress && (
                    <span className={`badge ${payAllProgress.errors > 0 ? "bg-danger-subtle text-danger" : "bg-info-subtle text-info"}`}>
                      {payAllProgress.done}/{payAllProgress.total} processed · {payAllProgress.paid} paid
                      {payAllProgress.errors > 0 && ` · ${payAllProgress.errors} errors`}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Employee rows */}
            {slipsLoading ? (
              <div className="d-flex justify-content-center py-5">
                <div className="spinner-border spinner-border-sm text-primary" role="status" />
              </div>
            ) : visibleEmps.length === 0 ? (
              <div className="text-center text-muted py-5 small">
                <BanknotesIcon className="mx-auto mb-2" style={{ width: 32, height: 32, opacity: 0.25 }} />
                <div>No {payFreqView} employees found.</div>
                <div style={{ fontSize: "0.72rem" }}>
                  Set <strong>Pay Frequency</strong> on employee profiles to see them here.
                </div>
              </div>
            ) : (
              visibleEmps.map((emp) => {
                const paidNow = isPaid(slipMap[emp.id], period.start, period.end);
                const amt = calcAmount(emp, period.start, period.end);
                const isH = (emp.employment_type || "").toLowerCase() === "hourly";
                const isExpanded = expandedId === emp.id;
                const isProc = processingIds.has(emp.id);
                const form = expandForms[emp.id] || {};
                const rowErr = rowErrors[emp.id];

                return (
                  <div key={emp.id} className={`border-bottom border-gray-100 dark:border-gray-700 ${paidNow ? "bg-success-subtle" : ""}`}>
                    {/* Main row */}
                    <div className="d-flex align-items-center gap-2 px-3 py-2">
                      {/* Avatar */}
                      <div className="flex-shrink-0 rounded-circle d-flex align-items-center justify-content-center fw-bold text-white" style={{ width: 36, height: 36, fontSize: "0.7rem", background: paidNow ? "#16a34a" : "#9ca3af" }}>
                        {emp.first_name?.[0]}
                        {emp.last_name?.[0]}
                      </div>

                      {/* Info */}
                      <div className="flex-grow-1 min-w-0">
                        <div className="fw-medium text-truncate" style={{ fontSize: "0.85rem" }}>
                          {emp.first_name} {emp.last_name}
                        </div>
                        <div className="d-flex align-items-center gap-1 flex-wrap" style={{ fontSize: "0.7rem" }}>
                          <span className={`badge ${roleBadge(emp.role)}`} style={{ fontSize: "0.6rem" }}>
                            {emp.role}
                          </span>
                          <span className="text-muted">{isH ? `$${emp.hourly_rate}/hr · hourly` : emp.salary ? `$${Number(emp.salary).toLocaleString()}/yr · salary` : "No rate set"}</span>
                        </div>
                      </div>

                      {/* Amount + action */}
                      <div className="flex-shrink-0 text-end d-flex flex-column align-items-end" style={{ gap: 2 }}>
                        <span className="fw-semibold" style={{ fontSize: "0.88rem" }}>
                          {amt != null ? `$${amt.toFixed(2)}` : <span className="text-muted small">—</span>}
                        </span>
                        {paidNow ? (
                          <span className="text-success d-flex align-items-center gap-1" style={{ fontSize: "0.7rem" }}>
                            <CheckCircleSolidIcon style={{ width: 12, height: 12 }} /> Paid
                          </span>
                        ) : (
                          <button type="button" onClick={() => handleExpand(emp)} className={`btn btn-sm ${isExpanded ? "btn-secondary" : "btn-outline-success"}`} style={{ fontSize: "0.7rem", padding: "1px 10px" }}>
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
                              <input type="number" min="0" step={isH ? "0.25" : "0.01"} className="form-control" value={isH ? (form.hours_worked ?? "") : (form.gross_amount ?? "")} onChange={(e) => updateForm(emp.id, isH ? "hours_worked" : "gross_amount", e.target.value)} />
                              {isH && <span className="input-group-text">hrs</span>}
                            </div>
                            {isH && emp.hourly_rate && (
                              <div className="text-muted mt-1" style={{ fontSize: "0.68rem" }}>
                                @ ${emp.hourly_rate}/hr
                              </div>
                            )}
                          </div>
                          <div className="col-6">
                            <label className="form-label small fw-semibold mb-1">Deductions</label>
                            <div className="input-group input-group-sm">
                              <span className="input-group-text">$</span>
                              <input type="number" min="0" step="0.01" className="form-control" value={form.other_deductions ?? "0"} onChange={(e) => updateForm(emp.id, "other_deductions", e.target.value)} />
                            </div>
                          </div>
                          <div className="col-12">
                            <label className="form-label small fw-semibold mb-1">Notes</label>
                            <input type="text" className="form-control form-control-sm" placeholder="Optional" value={form.notes ?? ""} onChange={(e) => updateForm(emp.id, "notes", e.target.value)} />
                          </div>
                        </div>
                        <div className="d-flex justify-content-end gap-2 mt-2">
                          <button type="button" onClick={() => setExpandedId(null)} className="btn btn-sm btn-outline-secondary">
                            Cancel
                          </button>
                          <button type="button" onClick={() => handlePaySingle(emp)} disabled={isProc} className="btn btn-sm btn-success d-flex align-items-center gap-1">
                            {isProc ? (
                              <>
                                <span className="spinner-border" style={{ width: 12, height: 12 }} /> Processing…
                              </>
                            ) : (
                              <>
                                <CheckIcon style={{ width: 12, height: 12 }} /> Confirm Pay
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </>
        )}

        {/* ═══ ONE-TIME ═══ */}
        {activeTab === "onetime" && (
          <div className="p-3">
            <p className="small text-muted mb-3">Issue a bonus, commission, reimbursement, or any other one-off payment to an employee. These appear in the employee's pay history and do not interfere with regular payroll cycles.</p>

            {otResult?.ok && (
              <div className="alert alert-success py-2 px-3 small d-flex align-items-center gap-2 mb-3">
                <CheckCircleSolidIcon style={{ width: 16, height: 16, flexShrink: 0 }} />${otResult.amount} {otResult.type} paid to {otResult.name}
              </div>
            )}
            {otResult?.ok === false && <div className="alert alert-danger py-2 px-3 small mb-3">{otResult.error}</div>}

            {/* Employee */}
            <div className="mb-3">
              <label className="form-label small fw-semibold mb-1">Employee</label>
              <select className="form-select form-select-sm" value={ot.employee_id} onChange={(e) => setOt((p) => ({ ...p, employee_id: e.target.value }))}>
                <option value="">— Select employee —</option>
                {employees
                  .filter((e) => e.is_active)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.first_name} {e.last_name} · {e.role}
                    </option>
                  ))}
              </select>
            </div>

            {/* Payment type */}
            <div className="mb-3">
              <label className="form-label small fw-semibold mb-1">Payment Type</label>
              <div className="d-flex flex-wrap gap-1">
                {ONE_TIME_TYPES.map((t) => (
                  <button key={t.value} type="button" onClick={() => setOt((p) => ({ ...p, payment_type: t.value }))} className={`btn btn-sm rounded-pill ${ot.payment_type === t.value ? "btn-primary" : "btn-outline-secondary"}`} style={{ fontSize: "0.78rem", padding: "3px 14px" }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount + Date */}
            <div className="row g-2 mb-3">
              <div className="col-6">
                <label className="form-label small fw-semibold mb-1">Amount</label>
                <div className="input-group input-group-sm">
                  <span className="input-group-text">$</span>
                  <input type="number" min="0" step="0.01" className="form-control" placeholder="0.00" value={ot.amount} onChange={(e) => setOt((p) => ({ ...p, amount: e.target.value }))} />
                </div>
              </div>
              <div className="col-6">
                <label className="form-label small fw-semibold mb-1">Date</label>
                <input type="date" className="form-control form-control-sm" value={ot.date} onChange={(e) => setOt((p) => ({ ...p, date: e.target.value }))} />
              </div>
            </div>

            {/* Notes */}
            <div className="mb-3">
              <label className="form-label small fw-semibold mb-1">Notes (optional)</label>
              <input type="text" className="form-control form-control-sm" placeholder="e.g. Year-end bonus, Q1 commission…" value={ot.notes} onChange={(e) => setOt((p) => ({ ...p, notes: e.target.value }))} />
            </div>

            <button type="button" onClick={handleOtSubmit} disabled={otLoading || !ot.employee_id || !ot.amount || !ot.date} className="btn btn-success w-100 d-flex align-items-center justify-content-center gap-2">
              {otLoading ? (
                <>
                  <span className="spinner-border spinner-border-sm" style={{ width: 14, height: 14 }} /> Processing…
                </>
              ) : (
                <>
                  <BanknotesIcon style={{ width: 16, height: 16 }} /> Process Payment
                </>
              )}
            </button>
          </div>
        )}

        {/* ═══ HISTORY ═══ */}
        {activeTab === "history" && (
          <>
            <div className="bg-white dark:bg-gray-800 border-bottom border-gray-100 dark:border-gray-700 px-3 py-2" style={{ position: "sticky", top: 0, zIndex: 5 }}>
              <input type="text" placeholder="Search by employee or notes…" className="form-control form-control-sm" value={histSearch} onChange={(e) => setHistSearch(e.target.value)} />
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
                const periodLabel = sameDay ? `One-time · ${fmtShort(slip.pay_period_start.slice(0, 10), true)}` : `${fmtShort(slip.pay_period_start.slice(0, 10))} – ${fmtShort(slip.pay_period_end.slice(0, 10), true)}`;
                return (
                  <div key={slip.id} className="d-flex align-items-center gap-2 px-3 py-2 border-bottom border-gray-100 dark:border-gray-700">
                    <div className="flex-shrink-0 rounded-circle d-flex align-items-center justify-content-center fw-bold" style={{ width: 32, height: 32, fontSize: "0.65rem", background: "#d1fae5", color: "#065f46" }}>
                      $
                    </div>
                    <div className="flex-grow-1 min-w-0">
                      <div className="fw-medium text-truncate" style={{ fontSize: "0.83rem" }}>
                        {name}
                      </div>
                      <div className="text-muted text-truncate" style={{ fontSize: "0.7rem" }}>
                        {periodLabel}
                        {slip.notes ? ` · ${slip.notes}` : ""}
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-end">
                      <div className="fw-semibold text-success" style={{ fontSize: "0.85rem" }}>
                        ${slip.gross_amount?.toFixed(2)}
                      </div>
                      <div className="text-muted" style={{ fontSize: "0.68rem" }}>
                        net ${slip.net_amount?.toFixed(2)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="flex-shrink-0 pt-2 pb-4 px-3 border-top border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="d-flex align-items-center justify-content-center gap-3">
          <Button_Toolbar icon={XMarkIcon} label="Close" onClick={onClose} className="btn-app-secondary" />
          {activeTab === "payroll" && unpaidCount > 0 && !slipsLoading && (
            <Button_Toolbar icon={BanknotesIcon} label={`Pay All ${unpaidCount}`} onClick={handlePayAll} disabled={!!payAllBusy} className="btn-app-primary" badge={payAllBusy ? <span className="spinner-border ms-1" style={{ width: 11, height: 11, borderWidth: 2 }} /> : null} />
          )}
        </div>
      </div>
    </div>
  );
}
