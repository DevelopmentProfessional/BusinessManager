import React, { useState, useEffect, useMemo } from 'react';
import { BanknotesIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolidIcon } from '@heroicons/react/24/solid';
import { payrollAPI } from '../../services/api';

// --- Helpers ---

function mondayOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function sundayOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** Calculate expected pay for an employee over the given date range */
function calcAmount(employee, periodStart, periodEnd) {
  if (!periodStart || !periodEnd) return null;
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  const days = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);
  const weeks = days / 7;

  if (employee.employment_type === 'salary' && employee.salary > 0) {
    switch (employee.pay_frequency) {
      case 'weekly':    return employee.salary / 52;
      case 'biweekly':  return employee.salary / 26;
      case 'monthly':   return employee.salary / 12;
      default:          return (employee.salary / 365) * days;
    }
  }
  if (employee.employment_type === 'hourly' && employee.hourly_rate > 0) {
    return employee.hourly_rate * 40 * Math.max(1, weeks);
  }
  return null;
}

/** Return true if the employee has a paid slip overlapping [periodStart, periodEnd] */
function isPaidForPeriod(slips, periodStart, periodEnd) {
  if (!slips || !periodStart || !periodEnd) return false;
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  return slips.some(
    slip =>
      slip.status === 'paid' &&
      new Date(slip.pay_period_start) <= end &&
      new Date(slip.pay_period_end) >= start
  );
}

/** Role badge colour classes */
function roleBadgeClass(role) {
  if (role === 'admin') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
  if (role === 'manager') return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
  return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
}

// ---

/**
 * Props:
 *   employees  – full array of employee/user objects from the store
 *   onClose    – called when Cancel is clicked
 */
export default function Modal_Wages({ employees = [], onClose }) {
  const [periodStart, setPeriodStart] = useState(mondayOfWeek);
  const [periodEnd,   setPeriodEnd]   = useState(sundayOfWeek);
  const [nameFilter,  setNameFilter]  = useState('');
  const [roleFilter,  setRoleFilter]  = useState('all');

  const [allPaySlips,  setAllPaySlips]  = useState([]);
  const [slipsLoading, setSlipsLoading] = useState(true);
  const [submitting,   setSubmitting]   = useState(false);
  const [submitResult, setSubmitResult] = useState(null); // { paid, skipped, errors }
  const [submitError,  setSubmitError]  = useState('');

  // Fetch all pay slips once on open so we can check paid status client-side
  useEffect(() => {
    let cancelled = false;
    setSlipsLoading(true);
    payrollAPI.getAll()
      .then(res => {
        if (!cancelled) {
          const data = res?.data ?? res ?? [];
          setAllPaySlips(Array.isArray(data) ? data : []);
        }
      })
      .catch(() => { if (!cancelled) setAllPaySlips([]); })
      .finally(() => { if (!cancelled) setSlipsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Indexed map: employeeId → [slips]
  const slipsByEmployee = useMemo(() => {
    const map = {};
    allPaySlips.forEach(slip => {
      if (!map[slip.employee_id]) map[slip.employee_id] = [];
      map[slip.employee_id].push(slip);
    });
    return map;
  }, [allPaySlips]);

  // Unique roles for the role dropdown
  const roleOptions = useMemo(() => {
    return [...new Set(employees.map(e => e.role).filter(Boolean))].sort();
  }, [employees]);

  // Apply filters (active employees only)
  const filteredEmployees = useMemo(() => {
    const nameLow = nameFilter.toLowerCase();
    return employees.filter(emp => {
      if (!emp.is_active) return false;
      if (nameFilter) {
        const full = `${emp.first_name || ''} ${emp.last_name || ''}`.toLowerCase();
        if (!full.includes(nameLow)) return false;
      }
      if (roleFilter !== 'all' && emp.role !== roleFilter) return false;
      return true;
    });
  }, [employees, nameFilter, roleFilter]);

  const handleAccept = async () => {
    if (!periodStart || !periodEnd) return;
    setSubmitting(true);
    setSubmitError('');
    setSubmitResult(null);

    let paid = 0, skipped = 0, errors = 0;
    const newSlips = [];

    for (const emp of filteredEmployees) {
      // Skip if already paid for this period
      if (isPaidForPeriod(slipsByEmployee[emp.id], periodStart, periodEnd)) {
        skipped++;
        continue;
      }

      const amount = calcAmount(emp, periodStart, periodEnd);
      if (!amount) { skipped++; continue; }

      try {
        const payload = {
          pay_period_start: `${periodStart}T00:00:00`,
          pay_period_end:   `${periodEnd}T23:59:59`,
          gross_amount:     parseFloat(amount.toFixed(2)),
          employment_type:  emp.employment_type || 'salary',
        };
        if (emp.employment_type === 'hourly') {
          payload.hours_worked = 40;
          payload.hourly_rate_snapshot = emp.hourly_rate;
        }

        const res = await payrollAPI.processPayment(emp.id, payload);
        const slip = res?.data ?? res;
        if (slip?.id) { newSlips.push(slip); paid++; }
        else errors++;
      } catch {
        errors++;
      }
    }

    // Merge new slips so the green $ appears immediately
    setAllPaySlips(prev => [...prev, ...newSlips]);
    setSubmitting(false);
    setSubmitResult({ paid, skipped, errors });
  };

  // Summary text colour
  const resultIsError = submitResult && submitResult.errors > 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-gray-900">

      {/* ── Header (no close button) ─────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <BanknotesIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">Wages &amp; Payroll</h2>
      </div>

      {/* ── Body (scrollable) ────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {slipsLoading ? (
          <div className="flex items-center justify-center h-32 text-sm text-gray-400">
            Loading payslip data…
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-16">
                  Paid
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-400">
                    No employees match the current filters.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map(emp => {
                  const paid   = isPaidForPeriod(slipsByEmployee[emp.id], periodStart, periodEnd);
                  const amount = calcAmount(emp, periodStart, periodEnd);
                  return (
                    <tr
                      key={emp.id}
                      className={paid ? 'bg-green-50/60 dark:bg-green-900/10' : ''}
                    >
                      {/* Name */}
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                        {emp.first_name} {emp.last_name}
                      </td>

                      {/* Role */}
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${roleBadgeClass(emp.role)}`}>
                          {emp.role || '—'}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-white">
                        {amount != null ? (
                          `$${amount.toFixed(2)}`
                        ) : (
                          <span className="text-gray-400 font-sans text-xs">No rate set</span>
                        )}
                      </td>

                      {/* Paid indicator */}
                      <td className="px-4 py-3 text-center">
                        {paid ? (
                          <span
                            title="Already paid for this period"
                            className="inline-flex items-center justify-center gap-0.5 text-green-600 dark:text-green-400 font-bold text-base"
                          >
                            $
                            <CheckCircleSolidIcon className="h-3.5 w-3.5" />
                          </span>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600 font-bold text-base">$</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}

        {/* Result banner */}
        {submitResult && (
          <div className={`mx-4 my-3 p-3 rounded-lg text-sm ${
            resultIsError
              ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
              : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
          }`}>
            Processed: <strong>{submitResult.paid}</strong> paid,{' '}
            <strong>{submitResult.skipped}</strong> skipped (already paid or no rate configured),{' '}
            <strong>{submitResult.errors}</strong> errors.
          </div>
        )}

        {submitError && (
          <div className="mx-4 my-2 p-3 rounded-lg text-sm bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300">
            {submitError}
          </div>
        )}
      </div>

      {/* ── Footer (fixed) ───────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">

        {/* Row 1 – Filters */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-gray-100 dark:border-gray-700">

          {/* Period From */}
          <label className="flex items-center gap-1.5 text-xs">
            <span className="text-gray-500 dark:text-gray-400 whitespace-nowrap">From</span>
            <input
              type="date"
              value={periodStart}
              onChange={e => { setPeriodStart(e.target.value); setSubmitResult(null); }}
              className="border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-green-500 focus:outline-none"
            />
          </label>

          {/* Period To */}
          <label className="flex items-center gap-1.5 text-xs">
            <span className="text-gray-500 dark:text-gray-400 whitespace-nowrap">To</span>
            <input
              type="date"
              value={periodEnd}
              onChange={e => { setPeriodEnd(e.target.value); setSubmitResult(null); }}
              className="border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-green-500 focus:outline-none"
            />
          </label>

          {/* Name search */}
          <input
            type="text"
            placeholder="Search name…"
            value={nameFilter}
            onChange={e => setNameFilter(e.target.value)}
            className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2.5 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-1 focus:ring-green-500 focus:outline-none w-36"
          />

          {/* Role filter */}
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-green-500 focus:outline-none"
          >
            <option value="all">All Roles</option>
            {roleOptions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {/* Row 2 – Cancel / Accept */}
        <div className="flex items-center justify-between px-4 py-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleAccept}
            disabled={submitting || slipsLoading || !periodStart || !periodEnd}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 transition-colors font-medium"
          >
            {submitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing…
              </>
            ) : (
              <>
                <CheckCircleIcon className="h-4 w-4" />
                Accept &amp; Pay
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
