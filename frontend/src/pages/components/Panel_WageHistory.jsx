// FILE: Panel_WageHistory.jsx
// Embedded wage history for Profile → Wage accordion (scrollable list + bottom filters).

import React, { useMemo, useState } from "react";
import Dropdown_Custom from "./Dropdown_Custom";

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
      className="d-flex flex-column min-h-0 profile-wage-history"
      style={{ borderBottom: "1px solid var(--bs-border-color)", maxHeight, minHeight: "10rem" }}
    >
      <div className="flex-grow-1 min-h-0 overflow-auto profile-wage-history__list pt-0 px-0">
        {paySlipsLoading ? (
          <div className="py-1 text-center">
            <div className="spinner-border spinner-border-sm text-primary" role="status" />
          </div>
        ) : filteredSlips.length === 0 ? (
          <p className="mb-0 py-0 small text-muted">{paySlips.length === 0 ? "No pay slips on record." : "No pay slips match your filters."}</p>
        ) : (
          <div style={{ overflowX: "auto", scrollbarWidth: "none", msOverflowStyle: "none" }}>
            <table className="mb-0 table table-hover table-sm" style={{ fontSize: "0.8rem" }}>
              <thead className="sticky-top table-light">
                <tr>
                  <th>Period</th>
                  <th>Paid At</th>
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
                    <td>{slip.created_at ? new Date(slip.created_at).toLocaleString() : "—"}</td>
                    <td className="text-end">${Number(slip.gross_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="text-danger text-end">-${Number((slip.insurance_deduction ?? 0) + (slip.other_deductions ?? 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="fw-semibold text-end">${Number(slip.net_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td>
                      <button type="button" className="btn btn-outline-secondary btn-sm px-0 py-0" style={{ fontSize: "0.75rem" }} onClick={() => setSelectedSlip(slip)}>
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

      <div className="bg-body border-top flex-shrink-0 profile-wage-history__filters px-0 py-0">
        <div className="align-items-center d-flex flex-wrap gap-2">
          <input
            type="text"
            className="app-search-input flex-grow-1 form-control form-control-sm"
            placeholder="Search period, notes, amount…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search pay history"
          />
          <Dropdown_Custom
            className="flex-shrink-0 form-select form-select-sm"
            style={{ width: "5.75rem" }}
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            options={[
              { value: "all", label: "All years" },
              ...years.map((y) => ({ value: String(y), label: String(y) })),
            ]}
          />
        </div>
      </div>
    </div>
  );
}
