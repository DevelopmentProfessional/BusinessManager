// FILE: Panel_Wages.jsx
// Renders the pay slips history panel with a table of wage records and a view-detail button.

import React from "react";

const Panel_Wages = ({ isMobile, row1PanelBottom, paySlipsLoading, paySlips, setSelectedSlip }) => (
  <div
    className="accordion-popup"
    style={{
      position: "fixed",
      top: 0,
      bottom: `${row1PanelBottom}px`,
      left: 0,
      right: 0,
      width: "100%",
      height: `calc(var(--vvp-height, 100dvh) - ${row1PanelBottom}px)`,
      overflowY: "auto",
      scrollbarWidth: "none",
      msOverflowStyle: "none",
      backgroundColor: "var(--bs-body-bg)",
      zIndex: 1000,
      paddingTop: "1rem",
      paddingLeft: "1rem",
      paddingRight: "1rem",
      paddingBottom: "0.25rem",
      display: "flex",
      flexDirection: "column",
    }}
  >
    <div style={{ flexGrow: isMobile ? 0 : 1, minHeight: isMobile ? 0 : undefined }} />
    <div style={{ flexShrink: 0, overflowY: "auto", minHeight: 0 }}>
      <h6 className="fw-semibold mb-3">Wage History</h6>
      {paySlipsLoading ? (
        <div className="text-center py-4">
          <div className="spinner-border spinner-border-sm text-primary" role="status" />
        </div>
      ) : paySlips.length === 0 ? (
        <p className="text-muted small">No pay slips on record.</p>
      ) : (
        <div style={{ overflowX: "auto", scrollbarWidth: "none", msOverflowStyle: "none" }}>
          <table className="table table-sm table-hover mb-0" style={{ fontSize: "0.8rem" }}>
            <thead className="table-light">
              <tr>
                <th>Period</th>
                <th className="text-end">Gross</th>
                <th className="text-end">Deductions</th>
                <th className="text-end">Net</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paySlips.map((slip) => (
                <tr key={slip.id}>
                  <td>{slip.pay_period_start ? new Date(slip.pay_period_start).toLocaleDateString() : "—"}</td>
                  <td className="text-end">${Number(slip.gross_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="text-end text-danger">-${Number((slip.insurance_deduction ?? 0) + (slip.other_deductions ?? 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="text-end fw-semibold">${Number(slip.net_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td>
                    <button type="button" className="btn btn-sm btn-outline-secondary py-0 px-1" style={{ fontSize: "0.7rem" }} onClick={() => setSelectedSlip(slip)}>
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
  </div>
);

export default Panel_Wages;
