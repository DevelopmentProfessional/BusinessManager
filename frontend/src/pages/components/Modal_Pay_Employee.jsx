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

import React, { useState, useEffect } from 'react';
import { payrollAPI } from '../../services/api';

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/**
 * Generates a rolling 26-week window ending at the current week.
 * Each entry is marked isPaid if its Monday start date appears in paidStartDates.
 */
function generateWeeks(paidStartDates, count = 26) {
  const weeks = [];
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() - daysToMonday);
  thisMonday.setHours(0, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    const monday = new Date(thisMonday);
    monday.setDate(thisMonday.getDate() - i * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const mondayStr = monday.toISOString().slice(0, 10);
    const sundayStr = sunday.toISOString().slice(0, 10);
    const isPaid = paidStartDates.some(d => {
      const dStr = typeof d === 'string' ? d.slice(0, 10) : new Date(d).toISOString().slice(0, 10);
      return dStr === mondayStr;
    });
    weeks.push({
      start: mondayStr,
      end: sundayStr,
      label: `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      isPaid,
    });
  }
  return weeks;
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────
export default function Modal_Pay_Employee({ isOpen, onClose, employee, onPaySuccess }) {

  // ─── [1] STATE ──────────────────────────────────────────────────────────────
  const [payForm, setPayForm] = useState({
    pay_period_start: '',
    pay_period_end: '',
    gross_amount: '',
    hours_worked: '',
    other_deductions: '',
    notes: '',
  });
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState('');
  const [paySuccess, setPaySuccess] = useState('');
  const [availableWeeks, setAvailableWeeks] = useState([]);
  const [payWeeksLoading, setPayWeeksLoading] = useState(false);

  // ─── [2] EFFECT: initialise / reset on open ─────────────────────────────────
  useEffect(() => {
    if (!isOpen || !employee) {
      // Reset everything when closed
      setPayForm({ pay_period_start: '', pay_period_end: '', gross_amount: '', hours_worked: '', other_deductions: '', notes: '' });
      setAvailableWeeks([]);
      setPayError('');
      setPaySuccess('');
      return;
    }

    const baseForm = {
      pay_period_start: '',
      pay_period_end: '',
      gross_amount: employee.salary ? String(employee.salary) : '',
      hours_worked: '',
      other_deductions: '',
      notes: '',
    };

    if (employee.pay_frequency === 'weekly') {
      setPayForm(baseForm);
      setAvailableWeeks([]);
      setPayWeeksLoading(true);
      payrollAPI.getByEmployee(employee.id)
        .then(res => {
          const slips = res?.data ?? res;
          const paidStarts = Array.isArray(slips) ? slips.map(s => s.pay_period_start) : [];
          setAvailableWeeks(generateWeeks(paidStarts));
        })
        .catch(() => setAvailableWeeks(generateWeeks([])))
        .finally(() => setPayWeeksLoading(false));
    } else {
      const now = new Date();
      let start, end;
      if (employee.pay_frequency === 'daily') {
        start = now.toISOString().slice(0, 10);
        end = start;
      } else {
        start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
      }
      setPayForm({ ...baseForm, pay_period_start: start, pay_period_end: end });
    }
  }, [isOpen, employee?.id]);

  // ─── [3] SUBMIT ─────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setPayError('');
    setPayLoading(true);
    try {
      const isHourly = employee?.employment_type === 'hourly';
      const payload = {
        pay_period_start: new Date(payForm.pay_period_start).toISOString(),
        pay_period_end: new Date(payForm.pay_period_end).toISOString(),
        other_deductions: payForm.other_deductions !== '' ? parseFloat(payForm.other_deductions) : 0,
        notes: payForm.notes || null,
        employment_type: employee?.employment_type || 'salary',
      };
      if (isHourly) {
        payload.hours_worked = payForm.hours_worked !== '' ? parseFloat(payForm.hours_worked) : 0;
        payload.hourly_rate_snapshot = employee?.hourly_rate || 0;
      } else {
        payload.gross_amount = payForm.gross_amount !== '' ? parseFloat(payForm.gross_amount) : null;
      }
      await payrollAPI.processPayment(employee.id, payload);
      setPaySuccess('Payment processed successfully!');
      onPaySuccess?.(employee.id);
      setTimeout(() => { onClose(); setPaySuccess(''); }, 1500);
    } catch (err) {
      setPayError(err.response?.data?.detail || 'Failed to process payment');
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
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
      onClick={(e) => { if (e.target === e.currentTarget) { onClose(); } }}
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
                Type: <strong style={{ textTransform: 'capitalize' }}>{employee.employment_type || 'salary'}</strong>
                {employee.pay_frequency && (
                  <> &middot; Freq: <strong style={{ textTransform: 'capitalize' }}>{employee.pay_frequency.replace('_', '-')}</strong></>
                )}
                {employee.insurance_plan && (
                  <> &middot; Insurance: <strong>{employee.insurance_plan}</strong></>
                )}
              </div>

              {/* Period selector — varies by pay frequency */}
              {employee.pay_frequency === 'weekly' ? (
                <div className="mb-2">
                  <label className="form-label small mb-1">Select Week</label>
                  {payWeeksLoading ? (
                    <div className="text-muted small py-1">Loading weeks…</div>
                  ) : (
                    <select
                      className="form-select form-select-sm"
                      value={payForm.pay_period_start}
                      onChange={e => {
                        const week = availableWeeks.find(w => w.start === e.target.value);
                        if (week) setPayForm(f => ({ ...f, pay_period_start: week.start, pay_period_end: week.end }));
                      }}
                      required
                    >
                      <option value="">— Select a week —</option>
                      {availableWeeks.map(w => (
                        <option key={w.start} value={w.start} disabled={w.isPaid}>
                          {w.label}{w.isPaid ? ' ✓ Paid' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                  {payForm.pay_period_start && (
                    <div className="text-muted small mt-1">{payForm.pay_period_start} → {payForm.pay_period_end}</div>
                  )}
                </div>
              ) : employee.pay_frequency === 'daily' ? (
                <div className="mb-2">
                  <label className="form-label small mb-1">Payment Date</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={payForm.pay_period_start}
                    onChange={e => setPayForm(f => ({ ...f, pay_period_start: e.target.value, pay_period_end: e.target.value }))}
                    required
                  />
                </div>
              ) : (
                <>
                  <div className="mb-2">
                    <label className="form-label small mb-1">Pay Period Start</label>
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      value={payForm.pay_period_start}
                      onChange={e => setPayForm(f => ({ ...f, pay_period_start: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="mb-2">
                    <label className="form-label small mb-1">Pay Period End</label>
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      value={payForm.pay_period_end}
                      min={payForm.pay_period_start || undefined}
                      onChange={e => setPayForm(f => ({ ...f, pay_period_end: e.target.value }))}
                      required
                    />
                  </div>
                </>
              )}

              {employee.employment_type === 'hourly' ? (
                <div className="mb-2">
                  <label className="form-label small mb-1">Hours Worked</label>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    placeholder="0"
                    min="0"
                    step="0.25"
                    value={payForm.hours_worked}
                    onChange={e => setPayForm(f => ({ ...f, hours_worked: e.target.value }))}
                    required
                  />
                  {employee.hourly_rate && (
                    <div className="text-muted small mt-1">Rate: ${employee.hourly_rate}/hr</div>
                  )}
                </div>
              ) : (
                <div className="mb-2">
                  <label className="form-label small mb-1">Gross Amount ($)</label>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    value={payForm.gross_amount}
                    onChange={e => setPayForm(f => ({ ...f, gross_amount: e.target.value }))}
                  />
                  <div className="text-muted small mt-1">Leave blank to use employee salary</div>
                </div>
              )}

              <div className="mb-2">
                <label className="form-label small mb-1">Other Deductions ($)</label>
                <input
                  type="number"
                  className="form-control form-control-sm"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  value={payForm.other_deductions}
                  onChange={e => setPayForm(f => ({ ...f, other_deductions: e.target.value }))}
                />
              </div>

              <div className="mb-0">
                <label className="form-label small mb-1">Notes (optional)</label>
                <textarea
                  className="form-control form-control-sm"
                  rows="2"
                  value={payForm.notes}
                  onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>

            <div className="modal-footer py-2">
              <button type="button" className="btn btn-sm btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-sm btn-success" disabled={payLoading}>
                {payLoading ? 'Processing…' : 'Process Payment'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
