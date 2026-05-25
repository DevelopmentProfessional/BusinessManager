// FILE: Panel_WageHistory.jsx
// Embedded wage history for Profile → Wage accordion (scrollable list + bottom filters).

import React, { useMemo, useState } from "react";

function slipYear(slip) {
  if (!slip?.pay_period_start) return null;
  return new Date(slip.pay_period_start).getFullYear();
}

export default function Panel_WageHistory({ paySlips, paySlipsLoading, setSelectedSlip, maxHeight }) {
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("all");

  const years = useMemo(() => {
    const set = new Set();
    paySlips.forEach((s) => {
      const y = slipYear(s);
      if (y) set.add(y);
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [paySlips]);

  const filteredSlips = useMemo(() => {
    let list = [...paySlips].sort((a, b) => new Date(b.pay_period_start || 0) - new Date(a.pay_period_start || 0));
    if (yearFilter !== "all") {
      const y = Number(yearFilter);
      list = list.filter((s) => slipYear(s) === y);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((s) => {
        const period = s.pay_period_start ? new Date(s.pay_period_start).toLocaleDateString() : "";
        const end = s.pay_period_end ? new Date(s.pay_period_end).toLocaleDateString() : "";
        return (
          period.toLowerCase().includes(q) ||
          end.toLowerCase().includes(q) ||
          (s.notes || "").toLowerCase().includes(q) ||
          String(s.gross_amount ?? "").includes(q) ||
          String(s.net_amount ?? "").includes(q)
        );
      });
    }
    return list;
  }, [paySlips, search, yearFilter]);

  return (
    <div
      className="profile-wage-history d-flex flex-column min-h-0"
      style={{ borderBottom: "1px solid var(--bs-border-color)", maxHeight, minHeight: "10rem" }}
    >
      <div className="profile-wage-history__list flex-grow-1 min-h-0 overflow-auto px-2 pt-2">
        {paySlipsLoading ? (
          <div className="text-center py-4">
            <div className="spinner-border spinner-border-sm text-primary" role="status" />
          </div>
        ) : filteredSlips.length === 0 ? (
          <p className="text-muted small mb-0 py-2">{paySlips.length === 0 ? "No pay slips on record." : "No pay slips match your filters."}</p>
        ) : (
          <div style={{ overflowX: "auto", scrollbarWidth: "none", msOverflowStyle: "none" }}>
            <table className="table table-sm table-hover mb-0" style={{ fontSize: "0.8rem" }}>
              <thead className="table-light sticky-top">
                <tr>
                  <th>Period</th>
                  <th className="text-end">Gross</th>
                  <th className="text-end">Deductions</th>
                  <th className="text-end">Net</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredSlips.map((slip) => (
                  <tr key={slip.id}>
                    <td>{slip.pay_period_start ? new Date(slip.pay_period_start).toLocaleDateString() : "—"}</td>
                    <td className="text-end">${Number(slip.gross_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="text-end text-danger">-${Number((slip.insurance_deduction ?? 0) + (slip.other_deductions ?? 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="text-end fw-semibold">${Number(slip.net_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td>
                      <button type="button" className="btn btn-sm btn-outline-secondary py-0 px-2" style={{ fontSize: "0.75rem" }} onClick={() => setSelectedSlip(slip)}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="profile-wage-history__filters flex-shrink-0 border-top bg-body px-2 py-2">
        <div className="d-flex flex-wrap align-items-center gap-2">
          <input
            type="text"
            className="app-search-input form-control form-control-sm flex-grow-1"
            placeholder="Search period, notes, amount…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search pay history"
          />
          <select className="form-select form-select-sm flex-shrink-0" style={{ width: "5.75rem" }} value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} aria-label="Filter by year">
            <option value="all">All years</option>
            {years.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
