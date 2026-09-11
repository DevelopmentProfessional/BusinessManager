/*
 * FILE: Modal_SalesHistory.jsx
 * Full-screen sales / payment history with header, scrollable list, and filter footer.
 */

import React, { useState, useEffect, useRef } from "react";
import Modal from "./Modal";
import Button_Toolbar from "./Button_Toolbar";
import Filter_CatalogCheckboxes from "./Filter_CatalogCheckboxes";
import Filter_SourceToggle from "./Filter_SourceToggle";
import { ClockIcon, ChevronDownIcon, XMarkIcon, CheckIcon, UserIcon, UserCircleIcon } from "@heroicons/react/24/outline";
import { saleTransactionsAPI, clientOrdersAPI, clientsAPI, employeesAPI } from "../../services/api";
import Dropdown_Custom from "./Dropdown_Custom";

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
  const [clientSearch, setClientSearch] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [clientDropupOpen, setClientDropupOpen] = useState(false);
  const [employeeDropupOpen, setEmployeeDropupOpen] = useState(false);
  const clientRef = useRef(null);
  const employeeRef = useRef(null);

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

  useEffect(() => {
    const handleOutside = (e) => {
      if (clientRef.current && !clientRef.current.contains(e.target)) setClientDropupOpen(false);
      if (employeeRef.current && !employeeRef.current.contains(e.target)) setEmployeeDropupOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

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
            {/* Client dropup search */}
            <div className="ui-pos-rel" ref={clientRef}>
              <div className="input-group input-group-sm">
                <span className="input-group-text">
                  <UserIcon style={{ width: 14, height: 14 }} />
                </span>
                <input
                  type="text"
                  value={clientSearch || local.clientQuery || ""}
                  onChange={(e) => {
                    setClientSearch(e.target.value);
                    setClientDropupOpen(true);
                  }}
                  onFocus={() => setClientDropupOpen(true)}
                  placeholder={local.clientQuery ? `\u2713 ${local.clientQuery}` : "Client"}
                  className="form-control ui-control-sm"
                  aria-label="Filter by client"
                />
                {local.clientQuery && (
                  <button
                    className="btn ui-btn-outline-secondary-sm"
                    type="button"
                    onClick={() => {
                      setLocal((p) => ({ ...p, clientQuery: "" }));
                      setClientSearch("");
                    }}
                  >
                    <XMarkIcon style={{ width: 12, height: 12 }} />
                  </button>
                )}
              </div>
              {clientDropupOpen && (
                <div className="app-menu-panel bg-body border bottom-100 mb-1 position-absolute rounded-2 shadow start-0" style={{ zIndex: 60, minWidth: "14rem", maxHeight: "13rem", overflowY: "auto" }}>
                  {clients
                    .filter((c) => !clientSearch || c.name?.toLowerCase().includes(clientSearch.toLowerCase()) || c.email?.toLowerCase().includes(clientSearch.toLowerCase()))
                    .slice(0, 8)
                    .map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="app-menu-item bg-transparent border-0 px-0 py-1 text-start w-100"
                        style={{ cursor: "pointer" }}
                        onClick={() => {
                          setLocal((p) => ({ ...p, clientQuery: c.name }));
                          setClientSearch("");
                          setClientDropupOpen(false);
                        }}
                      >
                        <div className="fw-semibold">{c.name}</div>
                        {c.email && <div className="text-muted">{c.email}</div>}
                      </button>
                    ))}
                  {clients.filter((c) => !clientSearch || c.name?.toLowerCase().includes(clientSearch.toLowerCase())).length === 0 && <div className="app-menu-empty px-0 py-1 text-muted">No matches</div>}
                </div>
              )}
            </div>

            {/* Employee dropup search */}
            <div className="ui-pos-rel" ref={employeeRef}>
              <div className="input-group input-group-sm">
                <span className="input-group-text">
                  <UserCircleIcon style={{ width: 14, height: 14 }} />
                </span>
                <input
                  type="text"
                  value={employeeSearch || local.employeeQuery || ""}
                  onChange={(e) => {
                    setEmployeeSearch(e.target.value);
                    setEmployeeDropupOpen(true);
                  }}
                  onFocus={() => setEmployeeDropupOpen(true)}
                  placeholder={local.employeeQuery ? `\u2713 ${local.employeeQuery}` : "Employee"}
                  className="form-control ui-control-sm"
                  aria-label="Filter by employee"
                />
                {local.employeeQuery && (
                  <button
                    className="btn ui-btn-outline-secondary-sm"
                    type="button"
                    onClick={() => {
                      setLocal((p) => ({ ...p, employeeQuery: "" }));
                      setEmployeeSearch("");
                    }}
                  >
                    <XMarkIcon style={{ width: 12, height: 12 }} />
                  </button>
                )}
              </div>
              {employeeDropupOpen && (
                <div className="app-menu-panel bg-body border bottom-100 mb-1 position-absolute rounded-2 shadow start-0" style={{ zIndex: 60, minWidth: "14rem", maxHeight: "13rem", overflowY: "auto" }}>
                  {employees
                    .filter((e) => {
                      if (!employeeSearch) return true;
                      const name = `${e.first_name || ""} ${e.last_name || ""}`.trim();
                      return name.toLowerCase().includes(employeeSearch.toLowerCase()) || e.email?.toLowerCase().includes(employeeSearch.toLowerCase());
                    })
                    .slice(0, 8)
                    .map((e) => {
                      const name = `${e.first_name || ""} ${e.last_name || ""}`.trim() || e.email || `#${e.id}`;
                      return (
                        <button
                          key={e.id}
                          type="button"
                          className="bg-transparent border-0 px-0 py-1 small text-start w-100"
                          style={{ cursor: "pointer" }}
                          onClick={() => {
                            setLocal((p) => ({ ...p, employeeQuery: name }));
                            setEmployeeSearch("");
                            setEmployeeDropupOpen(false);
                          }}
                        >
                          <div className="fw-semibold">{name}</div>
                          {e.email && (
                            <div className="text-muted" style={{ fontSize: "0.7rem" }}>
                              {e.email}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  {employees.length === 0 && <div className="px-0 py-1 small text-muted">No employees loaded</div>}
                </div>
              )}
            </div>
            <Dropdown_Custom
              value={local.status || ""}
              onChange={(e) => setLocal((prev) => ({ ...prev, status: e.target.value }))}
              className="form-select form-select-sm rounded-pill"
              options={[
                { value: "", label: "All statuses" },
                ...Object.entries(STATUS_LABELS).map(([statusValue, statusLabel]) => ({ value: statusValue, label: statusLabel })),
              ]}
            />
            <input type="number" min="0" step="0.01" value={local.minPrice} onChange={(e) => setLocal((prev) => ({ ...prev, minPrice: e.target.value }))} placeholder="Min $" className="form-control form-control-sm rounded-pill" aria-label="Minimum total" />
            <input type="number" min="0" step="0.01" value={local.maxPrice} onChange={(e) => setLocal((prev) => ({ ...prev, maxPrice: e.target.value }))} placeholder="Max $" className="form-control form-control-sm rounded-pill" aria-label="Maximum total" />
            <input type="date" value={local.startDate} onChange={(e) => setLocal((prev) => ({ ...prev, startDate: e.target.value }))} className="form-control form-control-sm rounded-pill" aria-label="From date" />
            <input type="date" value={local.endDate} onChange={(e) => setLocal((prev) => ({ ...prev, endDate: e.target.value }))} className="form-control form-control-sm rounded-pill" aria-label="To date" />
          </div>

          <div className="align-items-center d-flex gap-1 pt-1">
            <Button_Toolbar icon={CheckIcon} label="Apply" title="Apply filters" onClick={handleApply} className="btn-outline-secondary" />
            <button type="button" onClick={onClose} className="btn ui-btn-circle-outline-secondary" title="Close sales history">
              <XMarkIcon />
            </button>
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
                <p className="mb-0 ui-small-muted">Adjust filters in the footer, then tap Apply.</p>
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
                            {effectiveStatus && <span className="badge rounded-pill text-bg-secondary">{STATUS_LABELS[effectiveStatus] || effectiveStatus}</span>}
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
