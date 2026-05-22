/*
 * FILE: Modal_Sales_History.jsx
 * Full-screen sales / payment history with header, scrollable list, and filter footer.
 */

import React, { useState, useEffect } from "react";
import Modal, { ModalHeader, ModalFooter } from "./Modal";
import Button_Toolbar from "./Button_Toolbar";
import Footer_Actions from "./Footer_Actions";
import Filter_Catalog_Checkboxes from "./Filter_Catalog_Checkboxes";
import Filter_Source_Toggle from "./Filter_Source_Toggle";
import {
  ClockIcon,
  ChevronDownIcon,
  XMarkIcon,
  CheckIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
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

export const EMPTY_HISTORY_FILTERS = {
  showServices: true,
  showProducts: true,
  showSubscriptions: true,
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

function SalesHistoryFilterFooter({ isOpen, historyFilters, setHistoryFilters, onClose }) {
  const [local, setLocal] = useState({ ...EMPTY_HISTORY_FILTERS, ...historyFilters });

  useEffect(() => {
    if (isOpen) {
      setLocal({ ...EMPTY_HISTORY_FILTERS, ...historyFilters });
    }
  }, [isOpen, historyFilters]);

  const handleApply = () => {
    setHistoryFilters({ ...local });
  };

  const handleClear = () => {
    setLocal({ ...EMPTY_HISTORY_FILTERS });
  };

  return (
    <div className="sales-history-footer w-100 bg-body">
      <div className="app-footer-padding">
        <div className="sales-history-filter-panel d-flex flex-column gap-2">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
            <Filter_Catalog_Checkboxes legend="" value={local} onChange={(key, checked) => setLocal((prev) => ({ ...prev, [key]: checked }))} />
            <Filter_Source_Toggle value={local.saleSource} onChange={(saleSource) => setLocal((prev) => ({ ...prev, saleSource }))} />
          </div>

          <div className="sales-history-filter-grid">
            <input
              type="text"
              value={local.clientQuery || ""}
              onChange={(e) => setLocal((prev) => ({ ...prev, clientQuery: e.target.value }))}
              placeholder="Client"
              className="app-search-input form-control form-control-sm"
              aria-label="Filter by client"
            />
            <input
              type="text"
              value={local.employeeQuery || ""}
              onChange={(e) => setLocal((prev) => ({ ...prev, employeeQuery: e.target.value }))}
              placeholder="Employee"
              className="app-search-input form-control form-control-sm"
              aria-label="Filter by employee"
            />
            <select
              value={local.status || ""}
              onChange={(e) => setLocal((prev) => ({ ...prev, status: e.target.value }))}
              className="form-select form-select-sm"
              aria-label="Status"
            >
              <option value="">All statuses</option>
              {Object.entries(STATUS_LABELS).map(([statusValue, statusLabel]) => (
                <option key={statusValue} value={statusValue}>
                  {statusLabel}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              step="0.01"
              value={local.minPrice}
              onChange={(e) => setLocal((prev) => ({ ...prev, minPrice: e.target.value }))}
              placeholder="Min $"
              className="form-control form-control-sm"
              aria-label="Minimum total"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={local.maxPrice}
              onChange={(e) => setLocal((prev) => ({ ...prev, maxPrice: e.target.value }))}
              placeholder="Max $"
              className="form-control form-control-sm"
              aria-label="Maximum total"
            />
            <input
              type="date"
              value={local.startDate}
              onChange={(e) => setLocal((prev) => ({ ...prev, startDate: e.target.value }))}
              className="form-control form-control-sm"
              aria-label="From date"
            />
            <input
              type="date"
              value={local.endDate}
              onChange={(e) => setLocal((prev) => ({ ...prev, endDate: e.target.value }))}
              className="form-control form-control-sm"
              aria-label="To date"
            />
          </div>

          <Footer_Actions
            start={<Button_Toolbar icon={CheckIcon} label="Apply" title="Apply filters" onClick={handleApply} className="btn-outline-secondary" />}
            center={<Button_Toolbar icon={XMarkIcon} label="Close" title="Close sales history" onClick={onClose} className="btn-outline-secondary" />}
            end={<Button_Toolbar icon={TrashIcon} label="Clear" title="Clear all filters" onClick={handleClear} className="btn-outline-secondary" />}
          />
        </div>
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
      footer={
        <ModalFooter className="p-0 border-0 bg-body">
          <SalesHistoryFilterFooter isOpen={isOpen} historyFilters={historyFilters} setHistoryFilters={setHistoryFilters} onClose={onClose} />
        </ModalFooter>
      }
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
          showClose={false}
          className="px-3 py-2"
        />

        <div className="flex-grow-1 min-h-0 overflow-auto no-scrollbar">
          {filteredHistory.length === 0 ? (
            <div className="h-100 d-flex flex-column align-items-center justify-content-center text-center px-4 py-5">
              <ClockIcon className="text-muted mb-3" style={{ width: "3rem", height: "3rem" }} aria-hidden="true" />
              <h3 className="h5 text-body mb-1">No transactions</h3>
              <p className="small text-muted mb-0">Adjust filters in the footer, then tap Apply.</p>
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
