/*
 * FILE: Modal_SalesHistory.jsx
 * Full-screen sales / payment history with header, scrollable list, and filter footer.
 */

import React, { useState, useEffect } from "react";
import Modal from "./Modal";
import Button_Toolbar from "../buttons/Button_Toolbar";
import Filter_CatalogCheckboxes from "../dropdowns/Filter_CatalogCheckboxes";
import Filter_SourceToggle from "../dropdowns/Filter_SourceToggle";
import { ClockIcon, ChevronDownIcon, XMarkIcon, CheckIcon } from "../../../icons";
import { saleTransactionsAPI, clientOrdersAPI, clientsAPI, employeesAPI } from "../../../services/api";
import Dropdown_Custom from "../dropdowns/Dropdown_Custom";
import { InputNumber, InputDate } from "../Inputs";
import Badge_Status from "../badges/Badge_Status";

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
  const [clients, setClients] = useState([]);
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    if (isOpen) {
      setLocal({ ...EMPTY_HISTORY_FILTERS, ...historyFilters });
      clientsAPI
        .getAll()
        .then((res) => setClients(Array.isArray(res?.data) ? res.data : []))
        .catch(() => {});
      employeesAPI
        .getAll()
        .then((res) => setEmployees(Array.isArray(res?.data) ? res.data : []))
        .catch(() => {});
    }
  }, [isOpen, historyFilters]);

  const handleApply = () => {
    setHistoryFilters({ ...local });
  };

  const handleClear = () => {
    setLocal({ ...EMPTY_HISTORY_FILTERS });
  };

  return (
    <div className="bg-body sales-history-footer w-100">
      <div className="app-footer-padding app-standard-footer">
        <div className="d-flex flex-column gap-2 sales-history-filter-panel">
          <div className="align-items-center d-flex flex-wrap gap-2 justify-content-between">
            <Filter_CatalogCheckboxes legend="" value={local} onChange={(key, checked) => setLocal((prev) => ({ ...prev, [key]: checked }))} />
            <Filter_SourceToggle value={local.saleSource} onChange={(saleSource) => setLocal((prev) => ({ ...prev, saleSource }))} />
          </div>

          <div className="gap-1 sales-history-filter-grid">
            <Dropdown_Custom
              value={local.clientQuery}
              onChange={(e) => setLocal((prev) => ({ ...prev, clientQuery: e.target.value }))}
              options={clients.map((client) => ({ value: client.name, label: client.name, searchText: client.email }))}
              placeholder="Client"
              searchable
              showClearButton
              className="rounded-pill"
              aria-label="Filter by client"
            />
            <Dropdown_Custom
              value={local.employeeQuery}
              onChange={(e) => setLocal((prev) => ({ ...prev, employeeQuery: e.target.value }))}
              options={employees.map((employee) => {
                const name = `${employee.first_name || ""} ${employee.last_name || ""}`.trim() || employee.email || `#${employee.id}`;
                return { value: name, label: name, searchText: employee.email };
              })}
              placeholder="Employee"
              searchable
              showClearButton
              className="rounded-pill"
              aria-label="Filter by employee"
            />
            <Dropdown_Custom
              value={local.status || ""}
              onChange={(e) => setLocal((prev) => ({ ...prev, status: e.target.value }))}
              className="form-select form-select-sm rounded-pill"
              placeholder="All statuses"
              floatingLabel="Status"
              options={[{ value: "", label: "All statuses" }, ...Object.entries(STATUS_LABELS).map(([statusValue, statusLabel]) => ({ value: statusValue, label: statusLabel }))]}
            />
            <InputNumber min="0" step="0.01" value={local.minPrice} onChange={(e) => setLocal((prev) => ({ ...prev, minPrice: e.target.value }))} placeholder="Min $" className="rounded-pill" aria-label="Minimum total" />
            <InputNumber min="0" step="0.01" value={local.maxPrice} onChange={(e) => setLocal((prev) => ({ ...prev, maxPrice: e.target.value }))} placeholder="Max $" className="rounded-pill" aria-label="Maximum total" />
            <InputDate value={local.startDate} onChange={(e) => setLocal((prev) => ({ ...prev, startDate: e.target.value }))} className="rounded-pill" aria-label="From date" />
            <InputDate value={local.endDate} onChange={(e) => setLocal((prev) => ({ ...prev, endDate: e.target.value }))} className="rounded-pill" aria-label="To date" />
          </div>

          <div className="align-items-center d-flex gap-1 pt-1">
            <Button_Toolbar icon={CheckIcon} label="Apply" title="Apply filters" onClick={handleApply} className="btn-outline-secondary" />
            <Button_Toolbar icon={XMarkIcon} label="Close" title="Close sales history" onClick={onClose} className="btn-outline-secondary" />
            <Button_Toolbar icon={XMarkIcon} label="Clear" title="Clear all filters" onClick={handleClear} className="btn-outline-secondary" />
          </div>
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
    <Modal isOpen={isOpen} onClose={onClose} noPadding fullScreen>
      <div className="ui-component-shell">
        <div className="component-header">
          <div className="component-header-left">
            <ClockIcon className="app-icon me-1 text-muted" aria-hidden="true" />
            Sales History
            <span className="badge bg-secondary-subtle fw-normal ms-1 rounded-pill text-secondary-emphasis">{filteredHistory.length}</span>
          </div>
          <div className="component-header-center"></div>
          <div className="component-header-right"></div>
        </div>

        <div className="component-body">
          <div className="component-body-inner">
            {filteredHistory.length === 0 ? (
              <div className="align-items-center d-flex flex-column h-100 justify-content-center px-1 py-1 text-center">
                <ClockIcon className="mb-3 text-muted" style={{ width: "3rem", height: "3rem" }} aria-hidden="true" />
                <h3 className="h5 mb-1 text-body">No transactions</h3>
                <p className="mb-0 ui-small-muted">Adjust filters, then press Apply.</p>
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
                    <div key={sale.id} className="border-0 border-bottom list-group-item p-0">
                      <button type="button" onClick={() => toggleSale(sale)} className="align-items-center border-0 btn btn-unstyled d-flex gap-3 justify-content-between px-1 py-1 rounded-0 text-start w-100">
                        <div className="flex-grow-1 min-w-0">
                          <div className="align-items-center d-flex flex-wrap gap-1 mb-1">
                            <span className="ui-small-muted">
                              {new Date(sale.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} {new Date(sale.date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            <span className={`badge rounded-pill ${sale.source === "portal" ? "text-bg-primary" : "text-bg-info"}`}>{sale.source === "portal" ? "Portal" : "POS"}</span>
                            {effectiveStatus && <Badge_Status status={effectiveStatus} />}
                          </div>
                          <div className="align-items-center d-flex flex-wrap gap-1">
                            {sale.clientName && <span className="fw-medium small text-truncate">{sale.clientName}</span>}
                            {sale.employeeName && <span className="ui-small-muted">· {sale.employeeName}</span>}
                          </div>
                          <p className="mb-0 ui-small-muted">{effectivePaymentMethod}</p>
                        </div>
                        <div className="align-items-center d-flex flex-shrink-0 gap-2">
                          <span className="fw-semibold">${sale.total.toFixed(2)}</span>
                          <ChevronDownIcon className="app-icon text-muted" style={{ transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.15s ease" }} aria-hidden="true" />
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="bg-body-secondary pb-1 px-1">
                          {sale.source === "portal" && statusError && <p className="mb-2 small text-warning">{statusError}</p>}
                          {sale.source === "portal" && (
                            <div className="align-items-center app-footer-toolbar border-bottom d-flex flex-wrap mb-2 pb-0">
                              {(NEXT_PORTAL_STATUSES[effectiveStatus] || []).map((nextStatus) => (
                                <button key={`${sale.id}-${nextStatus}`} type="button" onClick={() => handlePortalStatusUpdate(sale, nextStatus)} className="btn ui-btn-outline-secondary-sm" disabled={statusUpdatingId === sale.id}>
                                  {STATUS_LABELS[nextStatus] || nextStatus}
                                </button>
                              ))}
                            </div>
                          )}
                          {isLoading ? (
                            <p className="mb-0 ui-small-muted">Loading items…</p>
                          ) : !loadedItems || loadedItems.length === 0 ? (
                            <p className="mb-0 ui-small-muted">No items found.</p>
                          ) : (
                            <div className="pt-1">
                              {sale.subtotal != null && (
                                <div className="border-bottom d-flex justify-content-between mb-2 pb-0 small text-muted">
                                  <span>
                                    Subtotal ${Number(sale.subtotal).toFixed(2)} · Tax ${Number(sale.tax || 0).toFixed(2)}
                                  </span>
                                  <span className="fw-medium text-body">Total ${Number(sale.total).toFixed(2)}</span>
                                </div>
                              )}
                              {loadedItems.map((item, idx) => (
                                <div key={item.id ?? idx} className="align-items-start d-flex gap-2 justify-content-between py-1 small">
                                  <div className="min-w-0">
                                    <span className="text-body">
                                      {item.item_name || item.name || "—"}
                                      {(item.quantity ?? 1) > 1 && <span className="ms-1 text-muted">×{item.quantity}</span>}
                                    </span>
                                    {item.item_type && <span className="ms-1 text-muted">({item.item_type})</span>}
                                    {item.selectedOptions?.length > 0 && (
                                      <p className="mb-0 mt-1 small text-primary">
                                        {item.selectedOptions
                                          .map((o) => `${o.featureName ?? o.feature_name ?? ""}: ${o.optionName ?? o.option_name ?? ""}`)
                                          .filter((s) => s.trim() !== ":")
                                          .join(" · ")}
                                      </p>
                                    )}
                                    {item.unit_price != null && <span className="d-block small text-muted">@ ${Number(item.unit_price).toFixed(2)} each</span>}
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
          {/* /component-body-inner */}
        </div>
        {/* /component-body */}

        <div className="component-footer">
          <div className="component-footer-left">
            <SalesHistoryFilterFooter isOpen={isOpen} historyFilters={historyFilters} setHistoryFilters={setHistoryFilters} onClose={onClose} />
          </div>
          <div className="component-footer-center"></div>
          <div className="component-footer-right"></div>
        </div>
      </div>
    </Modal>
  );
}
