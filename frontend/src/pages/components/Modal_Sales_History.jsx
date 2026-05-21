/*
 * FILE: Modal_Sales_History.jsx
 * Full-screen sales / payment history with header, scrollable list, and filter footer.
 */

import React, { useState } from "react";
import Modal, { ModalHeader } from "./Modal";
import Button_Toolbar from "./Button_Toolbar";
import { ClockIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import { saleTransactionsAPI, clientOrdersAPI } from "../../services/api";

const STATUS_LABELS = {
  payment_pending: "Payment Pending",
  ordered: "Ordered",
  processing: "Processing",
  ready_for_pickup: "Ready for Pickup",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  picked_up: "Picked Up",
  cancelled: "Cancelled",
  refunded: "Refunded",
  completed: "Completed",
};

const NEXT_PORTAL_STATUSES = {
  payment_pending: ["ordered", "cancelled"],
  ordered: ["processing", "cancelled", "refunded"],
  processing: ["ready_for_pickup", "out_for_delivery", "cancelled", "refunded"],
  ready_for_pickup: ["picked_up", "cancelled"],
  out_for_delivery: ["delivered", "cancelled"],
  picked_up: ["refunded"],
  delivered: ["refunded"],
};

const EMPTY_HISTORY_FILTERS = {
  showServices: true,
  showProducts: true,
  minPrice: "",
  maxPrice: "",
  startDate: "",
  endDate: "",
  clientQuery: "",
  employeeQuery: "",
  saleSource: "all",
  status: "",
};

function parseOptions(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function SalesHistoryFilterFooter({ historyFilters, setHistoryFilters }) {
  return (
    <div className="sales-history-footer w-100">
      <div className="px-3 py-2 border-bottom">
        <div className="row g-2">
          <div className="col-12 col-md-6">
            <label className="form-label small text-muted mb-1">Client</label>
            <input
              type="text"
              value={historyFilters.clientQuery || ""}
              onChange={(e) => setHistoryFilters((prev) => ({ ...prev, clientQuery: e.target.value }))}
              placeholder="Search client name…"
              className="form-control form-control-sm"
            />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label small text-muted mb-1">Employee</label>
            <input
              type="text"
              value={historyFilters.employeeQuery || ""}
              onChange={(e) => setHistoryFilters((prev) => ({ ...prev, employeeQuery: e.target.value }))}
              placeholder="Search employee name…"
              className="form-control form-control-sm"
            />
          </div>
        </div>
      </div>

      <div className="px-3 py-2 border-bottom">
        <div className="row g-2 align-items-end">
          <div className="col-12 col-sm-6 col-lg-3">
            <label className="form-label small text-muted mb-1">Status</label>
            <select
              value={historyFilters.status || ""}
              onChange={(e) => setHistoryFilters((prev) => ({ ...prev, status: e.target.value }))}
              className="form-select form-select-sm"
            >
              <option value="">All statuses</option>
              <option value="completed">Completed (POS)</option>
              <option value="payment_pending">Payment Pending</option>
              <option value="ordered">Ordered</option>
              <option value="processing">Processing</option>
              <option value="ready_for_pickup">Ready for Pickup</option>
              <option value="out_for_delivery">Out for Delivery</option>
              <option value="delivered">Delivered</option>
              <option value="picked_up">Picked Up</option>
              <option value="cancelled">Cancelled</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>
          <div className="col-6 col-sm-3 col-lg-2">
            <label className="form-label small text-muted mb-1">Min $</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={historyFilters.minPrice}
              onChange={(e) => setHistoryFilters((prev) => ({ ...prev, minPrice: e.target.value }))}
              placeholder="Min"
              className="form-control form-control-sm"
            />
          </div>
          <div className="col-6 col-sm-3 col-lg-2">
            <label className="form-label small text-muted mb-1">Max $</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={historyFilters.maxPrice}
              onChange={(e) => setHistoryFilters((prev) => ({ ...prev, maxPrice: e.target.value }))}
              placeholder="Max"
              className="form-control form-control-sm"
            />
          </div>
          <div className="col-6 col-sm-6 col-lg-2">
            <label className="form-label small text-muted mb-1">From</label>
            <input
              type="date"
              value={historyFilters.startDate}
              onChange={(e) => setHistoryFilters((prev) => ({ ...prev, startDate: e.target.value }))}
              className="form-control form-control-sm"
            />
          </div>
          <div className="col-6 col-sm-6 col-lg-3">
            <label className="form-label small text-muted mb-1">To</label>
            <input
              type="date"
              value={historyFilters.endDate}
              onChange={(e) => setHistoryFilters((prev) => ({ ...prev, endDate: e.target.value }))}
              className="form-control form-control-sm"
            />
          </div>
        </div>
      </div>

      <div className="px-3 py-2 app-footer-toolbar d-flex align-items-center flex-wrap">
        {[
          ["all", "All"],
          ["pos", "POS"],
          ["portal", "Portal"],
        ].map(([value, label]) => (
          <Button_Toolbar
            key={value}
            label={label}
            onClick={() => setHistoryFilters((prev) => ({ ...prev, saleSource: value }))}
            className={historyFilters.saleSource === value ? "btn-primary" : "btn-outline-secondary"}
            data-active={historyFilters.saleSource === value}
          />
        ))}
        <Button_Toolbar
          label="Services"
          onClick={() => setHistoryFilters((prev) => ({ ...prev, showServices: !prev.showServices }))}
          className={historyFilters.showServices ? "btn-primary" : "btn-outline-secondary"}
          data-active={historyFilters.showServices}
        />
        <Button_Toolbar
          label="Products"
          onClick={() => setHistoryFilters((prev) => ({ ...prev, showProducts: !prev.showProducts }))}
          className={historyFilters.showProducts ? "btn-primary" : "btn-outline-secondary"}
          data-active={historyFilters.showProducts}
        />
        <Button_Toolbar label="Clear" onClick={() => setHistoryFilters({ ...EMPTY_HISTORY_FILTERS })} className="btn-outline-secondary" />
      </div>
    </div>
  );
}

export default function Modal_History_Sales({ isOpen, onClose, filteredHistory, historyFilters, setHistoryFilters, onPortalOrderUpdated }) {
  const [expandedId, setExpandedId] = useState(null);
  const [itemsCache, setItemsCache] = useState({});
  const [loadingId, setLoadingId] = useState(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const [statusError, setStatusError] = useState("");
  const [portalStatusOverrides, setPortalStatusOverrides] = useState({});

  const toggleSale = async (sale) => {
    if (expandedId === sale.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(sale.id);
    if (itemsCache[sale.id]) return;
    setLoadingId(sale.id);
    try {
      const res = sale.source === "portal" ? await clientOrdersAPI.getItems(sale.id) : await saleTransactionsAPI.getItems(sale.id);
      const raw = Array.isArray(res?.data) ? res.data : [];
      const items = raw.map((item) => ({
        ...item,
        selectedOptions: parseOptions(item.options_json),
      }));
      setItemsCache((prev) => ({ ...prev, [sale.id]: items }));
    } catch {
      setItemsCache((prev) => ({ ...prev, [sale.id]: [] }));
    } finally {
      setLoadingId(null);
    }
  };

  const handlePortalStatusUpdate = async (sale, nextStatus) => {
    if (!sale?.id) return;
    setStatusError("");
    setStatusUpdatingId(sale.id);
    try {
      const currentStatus = portalStatusOverrides[sale.id]?.status || sale.status || "payment_pending";
      const isPaymentTransition = currentStatus === "payment_pending" && nextStatus === "ordered";
      const normalizedPaymentMethod = String(sale.paymentMethod || "").toLowerCase();
      const payMethod = normalizedPaymentMethod && normalizedPaymentMethod !== "pending" ? sale.paymentMethod : "card";
      const res = isPaymentTransition ? await clientOrdersAPI.pay(sale.id, { payment_method: payMethod }) : await clientOrdersAPI.updateStatus(sale.id, nextStatus);
      const updated = res?.data ?? res;
      setPortalStatusOverrides((prev) => ({
        ...prev,
        [sale.id]: {
          status: updated?.status || nextStatus,
          paymentMethod: updated?.payment_method || payMethod,
        },
      }));
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setStatusError(typeof detail === "string" ? detail : "Failed to update order status.");
    } finally {
      setStatusUpdatingId(null);
    }

    if (onPortalOrderUpdated) {
      try {
        await onPortalOrderUpdated();
      } catch (err) {
        console.error("Refresh callback failed after status update attempt:", err);
      }
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      noPadding
      fullScreen
      footer={<SalesHistoryFilterFooter historyFilters={historyFilters} setHistoryFilters={setHistoryFilters} />}
    >
      <div className="d-flex flex-column h-100 min-h-0 bg-body">
        <ModalHeader
          title={
            <span className="d-inline-flex align-items-center gap-2 flex-wrap">
              <ClockIcon className="app-icon text-muted" aria-hidden="true" />
              <span>Sales History</span>
              <span className="badge rounded-pill bg-secondary-subtle text-secondary-emphasis fw-normal">{filteredHistory.length}</span>
            </span>
          }
          onClose={onClose}
          className="px-3 py-2"
        />

        <div className="flex-grow-1 min-h-0 overflow-auto no-scrollbar">
          {filteredHistory.length === 0 ? (
            <div className="h-100 d-flex flex-column align-items-center justify-content-center text-center px-4 py-5">
              <ClockIcon className="text-muted mb-3" style={{ width: "3rem", height: "3rem" }} aria-hidden="true" />
              <h3 className="h5 text-body mb-1">No transactions</h3>
              <p className="small text-muted mb-0">Try adjusting filters in the footer or complete a sale.</p>
            </div>
          ) : (
            <div className="list-group list-group-flush">
              {filteredHistory.map((sale) => {
                const effectiveStatus = portalStatusOverrides[sale.id]?.status || sale.status;
                const effectivePaymentMethod = portalStatusOverrides[sale.id]?.paymentMethod || sale.paymentMethod;
                const isExpanded = expandedId === sale.id;
                const isLoading = loadingId === sale.id;
                const loadedItems = itemsCache[sale.id];

                return (
                  <div key={sale.id} className="list-group-item p-0 border-0 border-bottom">
                    <button
                      type="button"
                      onClick={() => toggleSale(sale)}
                      className="w-100 px-3 py-3 d-flex align-items-center justify-content-between gap-3 text-start btn btn-unstyled border-0 rounded-0"
                    >
                      <div className="min-w-0 flex-grow-1">
                        <div className="d-flex align-items-center flex-wrap gap-1 mb-1">
                          <span className="small text-muted">
                            {new Date(sale.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}{" "}
                            {new Date(sale.date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          <span className={`badge rounded-pill ${sale.source === "portal" ? "text-bg-primary" : "text-bg-info"}`}>{sale.source === "portal" ? "Portal" : "POS"}</span>
                          {effectiveStatus && <span className="badge rounded-pill text-bg-secondary">{STATUS_LABELS[effectiveStatus] || effectiveStatus}</span>}
                        </div>
                        <div className="d-flex align-items-center flex-wrap gap-1">
                          {sale.clientName && <span className="small fw-medium text-truncate">{sale.clientName}</span>}
                          {sale.employeeName && <span className="small text-muted">· {sale.employeeName}</span>}
                        </div>
                        <p className="small text-muted mb-0">{effectivePaymentMethod}</p>
                      </div>
                      <div className="d-flex align-items-center gap-2 flex-shrink-0">
                        <span className="fw-semibold">${sale.total.toFixed(2)}</span>
                        <ChevronDownIcon className="app-icon text-muted" style={{ transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.15s ease" }} aria-hidden="true" />
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-3 pb-3 bg-body-secondary">
                        {sale.source === "portal" && statusError && <p className="small text-warning mb-2">{statusError}</p>}
                        {sale.source === "portal" && (
                          <div className="app-footer-toolbar d-flex align-items-center flex-wrap pb-2 mb-2 border-bottom">
                            {(NEXT_PORTAL_STATUSES[effectiveStatus] || []).map((nextStatus) => (
                              <button
                                key={`${sale.id}-${nextStatus}`}
                                type="button"
                                onClick={() => handlePortalStatusUpdate(sale, nextStatus)}
                                className="btn btn-sm btn-outline-secondary"
                                disabled={statusUpdatingId === sale.id}
                              >
                                {STATUS_LABELS[nextStatus] || nextStatus}
                              </button>
                            ))}
                          </div>
                        )}
                        {isLoading ? (
                          <p className="small text-muted mb-0">Loading items…</p>
                        ) : !loadedItems || loadedItems.length === 0 ? (
                          <p className="small text-muted mb-0">No items found.</p>
                        ) : (
                          <div className="pt-1">
                            {sale.subtotal != null && (
                              <div className="d-flex justify-content-between small text-muted pb-2 mb-2 border-bottom">
                                <span>
                                  Subtotal ${Number(sale.subtotal).toFixed(2)} · Tax ${Number(sale.tax || 0).toFixed(2)}
                                </span>
                                <span className="fw-medium text-body">Total ${Number(sale.total).toFixed(2)}</span>
                              </div>
                            )}
                            {loadedItems.map((item, idx) => (
                              <div key={item.id ?? idx} className="d-flex justify-content-between align-items-start gap-2 py-1 small">
                                <div className="min-w-0">
                                  <span className="text-body">
                                    {item.item_name || item.name || "—"}
                                    {(item.quantity ?? 1) > 1 && <span className="text-muted ms-1">×{item.quantity}</span>}
                                  </span>
                                  {item.item_type && <span className="text-muted ms-1">({item.item_type})</span>}
                                  {item.selectedOptions?.length > 0 && (
                                    <p className="small text-primary mb-0 mt-1">
                                      {item.selectedOptions
                                        .map((o) => `${o.featureName ?? o.feature_name ?? ""}: ${o.optionName ?? o.option_name ?? ""}`)
                                        .filter((s) => s.trim() !== ":")
                                        .join(" · ")}
                                    </p>
                                  )}
                                  {item.unit_price != null && <span className="small text-muted d-block">@ ${Number(item.unit_price).toFixed(2)} each</span>}
                                </div>
                                <span className="text-muted text-nowrap">{item.line_total != null ? `$${Number(item.line_total).toFixed(2)}` : ""}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
