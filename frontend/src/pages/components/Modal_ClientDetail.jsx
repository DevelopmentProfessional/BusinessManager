/*
 * ============================================================
 * FILE: Modal_Detail_Client.jsx
 *
 * PURPOSE:
 *   Full-screen modal for viewing and editing a client's full profile,
 *   including contact info, membership tier/points, and quick access to
 *   service history, purchase history, and the client's saved cart.
 *
 * FUNCTIONAL PARTS:
 *   [1] Helper Constants & Utilities — Membership tier colours, badge classes, labels,
 *       and date formatting functions
 *   [2] ServiceHistoryModal (sub-component) — Full-screen sub-modal listing upcoming
 *       and past scheduled appointments fetched from the API
 *   [3] PurchaseHistoryModal (sub-component) — Full-screen sub-modal listing
 *       transactions with expandable line-item details
 *   [4] Main Component State & Effects — Form data initialisation and cart count sync
 *   [5] Form Handlers — handleChange, handleSubmit, handleDelete
 *   [6] Header — "Client Details" title bar with close button
 *   [7] Avatar & Action Buttons — Initials avatar, tier badge, service history,
 *       purchase history, and cart shortcut buttons
 *   [8] Editable Form Fields — Contact info inputs and membership section
 *   [9] Fixed Footer — Delete, Cancel, and Save Changes actions
 *   [10] Sub-modal Mounts — ServiceHistoryModal, PurchaseHistoryModal, Modal_ClientCart
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-03-01 | Claude  | Added section comments and top-level documentation
 *   2026-09-11 | GitHub Copilot | Fixed hook dependencies and re-mounted service history modal usage
 * ============================================================
 */
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { XMarkIcon, CheckIcon, ShoppingBagIcon, ClockIcon, SparklesIcon, CheckCircleIcon, ShoppingCartIcon, ArrowTrendingUpIcon, FunnelIcon } from "@heroicons/react/24/outline";
import Modal from "./Modal";
import Button_Toolbar from "./Button_Toolbar";
import Footer_Actions from "./Footer_Actions";
import { showConfirm } from "../../services/showConfirm";
import { clientsAPI, servicesAPI, clientCartAPI, clientOrdersAPI } from "../../services/api";
import Modal_ClientCart from "./Modal_ClientCart";
import Modal_TemplateUse from "./Modal_TemplateUse";
import { formatDate, formatDateTime } from "../../utils/dateFormatters";

// ─── 1 HELPER CONSTANTS & UTILITIES ────────────────────────────────────────
const getTierAvatarColor = (membershipCount) => {
  if (membershipCount >= 3) return "#7c3aed";
  if (membershipCount === 2) return "#2563eb";
  if (membershipCount === 1) return "#0d9488";
  return "#3b82f6";
};

const getTierBadgeClass = (membershipCount) => {
  if (membershipCount >= 3) return "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300";
  if (membershipCount === 2) return "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300";
  if (membershipCount === 1) return "bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300";
  return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400";
};

const getMembershipLabel = (membershipNames) => {
  if (!Array.isArray(membershipNames) || membershipNames.length === 0) return "No Subscription";
  if (membershipNames.length === 1) return membershipNames[0];
  return `${membershipNames[0]} +${membershipNames.length - 1}`;
};

const PORTAL_STATUS_LABELS = {
  payment_pending: "Payment Pending",
  ordered: "Ordered",
  processing: "Processing",
  ready_for_pickup: "Ready for Pickup",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  picked_up: "Picked Up",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

const PORTAL_STATUS_CLASSES = {
  payment_pending: "bg-warning-subtle text-warning",
  ordered: "bg-primary-subtle text-primary",
  processing: "bg-info-subtle text-info",
  ready_for_pickup: "bg-secondary-subtle text-secondary",
  out_for_delivery: "bg-dark text-white",
  delivered: "bg-success-subtle text-success",
  picked_up: "bg-success-subtle text-success",
  cancelled: "bg-danger-subtle text-danger",
  refunded: "bg-info-subtle text-info",
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

function parseOrderOptions(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ─── 2 SERVICE HISTORY SUB-MODAL ───────────────────────────────────────────

function ServiceHistoryModal({ isOpen, onClose, client, onEditSchedule }) {
  const [schedules, setSchedules] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen || !client) return;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [schedRes, svcRes] = await Promise.all([clientsAPI.getSchedules(client.id), servicesAPI.getAll()]);
        setSchedules(schedRes?.data ?? []);
        const svcData = svcRes?.data ?? svcRes ?? [];
        setServices(Array.isArray(svcData) ? svcData : []);
      } catch {
        setError("Failed to load service history.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isOpen, client]);

  const now = new Date();
  const serviceMap = Object.fromEntries(services.map((s) => [s.id, s]));
  // Ascending — oldest at top, most recent near the bottom
  const sorted = [...schedules].sort((a, b) => new Date(a.appointment_date) - new Date(b.appointment_date));
  const past = sorted.filter((s) => new Date(s.appointment_date) < now);
  const upcoming = sorted.filter((s) => new Date(s.appointment_date) >= now);

  const renderRow = (schedule, isUpcoming) => {
    const svc = serviceMap[schedule.service_id];
    const inner = (
      <>
        <div
          className="align-items-center d-flex flex-shrink-0 justify-content-center rounded-circle"
          style={{
            width: 32,
            height: 32,
            background: isUpcoming ? "#dbeafe" : "#f3f4f6",
            color: isUpcoming ? "#2563eb" : "#9ca3af",
          }}
        >
          {isUpcoming ? <ClockIcon style={{ width: 16, height: 16 }} /> : <CheckCircleIcon style={{ width: 16, height: 16 }} />}
        </div>
        <div className="flex-grow-1 min-w-0">
          <div className="fw-medium text-truncate">{svc?.name || "Service"}</div>
          <div className="ui-small-muted">{formatDateTime(schedule.appointment_date)}</div>
          {schedule.notes && <div className="small text-muted text-truncate">{schedule.notes}</div>}
        </div>
        <span className={`badge rounded-pill flex-shrink-0 ${isUpcoming ? "bg-primary" : "bg-secondary"}`}>{schedule.status || "scheduled"}</span>
      </>
    );

    if (isUpcoming) {
      return (
        <button type="button" key={schedule.id} className="align-items-start bg-transparent border-0 border-bottom border-gray-100 btn-tab btn-unstyled d-flex dark:border-gray-700 gap-2 px-1 py-0 text-start w-100" onClick={() => onEditSchedule?.(schedule)}>
          {inner}
        </button>
      );
    }

    return (
      <div key={schedule.id} className="align-items-start border-bottom border-gray-100 d-flex dark:border-gray-700 gap-2 px-1 py-0">
        {inner}
      </div>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} noPadding={true} fullScreen={true} contentGravity="bottom">
      <div className="ui-page-shell">
        {/* Header */}
        <div className="align-items-center bg-white border-bottom border-gray-200 d-flex dark:bg-gray-900 dark:border-gray-700 flex-shrink-0 p-0">
          <h6 className="ui-heading-strong">Service History</h6>
        </div>

        {/* Scrollable body */}
        <div className="bg-white d-flex dark:bg-gray-900 dark:text-gray-100 flex-column flex-grow-1 min-h-0 no-scrollbar overflow-auto text-gray-900">
          {loading && (
            <div className="d-flex justify-content-center py-1">
              <div className="spinner-border spinner-border-sm text-primary" role="status" />
            </div>
          )}
          {error && <div className="alert alert-danger mx-3 py-0 small">{error}</div>}

          {!loading && !error && (
            <>
              {schedules.length === 0 && (
                <div className="py-1 text-center text-muted">
                  <SparklesIcon style={{ width: 32, height: 32, margin: "0 auto 8px" }} />
                  <div>No service history yet</div>
                </div>
              )}

              {/* Past — oldest at top */}
              {past.length > 0 && (
                <div className="mb-2">
                  <div className="fw-semibold mb-1 pt-0 px-1 small text-muted">Past ({past.length})</div>
                  {past.map((s) => renderRow(s, false))}
                </div>
              )}

              {/* Upcoming — nearest first, furthest at bottom; tap to edit */}
              {upcoming.length > 0 && (
                <div>
                  <div className="fw-semibold mb-1 pt-0 px-1 small text-primary">Upcoming ({upcoming.length}) — tap to edit</div>
                  {upcoming.map((s) => renderRow(s, true))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="app-footer-padding app-form-footer app-standard-footer ui-form-footer-shell">
          <Footer_Actions center={<Button_Toolbar icon={XMarkIcon} label="Close" onClick={onClose} className="btn-outline-secondary" title="Close" />} />
        </div>
      </div>
    </Modal>
  );
}

function buildPurchasePeriods(transactions, portalOrders) {
  const byKey = new Map();
  const addDate = (dateStr) => {
    if (!dateStr) return;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return;
    const year = d.getFullYear();
    const month = d.getMonth();
    const key = `${year}-${month}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        year,
        month,
        label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      });
    }
  };
  transactions.forEach((tx) => addDate(tx.created_at));
  portalOrders.forEach((order) => addDate(order.created_at));
  return Array.from(byKey.values()).sort((a, b) => b.year - a.year || b.month - a.month);
}

function matchesPurchasePeriod(createdAt, periodFilter) {
  if (!periodFilter) return true;
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return false;
  return d.getFullYear() === periodFilter.year && d.getMonth() === periodFilter.month;
}

/** Month/year filter dropup — bottom-left of purchase history footer. */
function PurchasePeriodFilterDropup({ periods, value, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const activeLabel = value ? periods.find((p) => p.year === value.year && p.month === value.month)?.label : "All";

  return (
    <div ref={rootRef} className="position-relative purchase-period-filter-dropup">
      <button type="button" onClick={() => setOpen((v) => !v)} className={`app-menu-trigger btn btn-sm d-inline-flex align-items-center gap-1 ${value ? "btn-primary" : "btn-outline-secondary"}`} aria-expanded={open} aria-haspopup="listbox" title="Filter by month">
        <FunnelIcon className="flex-shrink-0 h-4 w-4" />
        <span className="text-nowrap">{activeLabel}</span>
      </button>
      {open && (
        <div role="listbox" className="app-menu-panel bg-white border border-gray-200 bottom-100 dark:bg-gray-900 dark:border-gray-700 mb-1 overflow-auto position-absolute rounded-3 shadow-sm start-0" style={{ zIndex: 30, width: "14rem", maxWidth: "90vw", maxHeight: "16rem", margin: 0 }}>
          <div
            role="option"
            tabIndex={0}
            aria-selected={!value}
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className={`app-menu-item py-0 px-1${!value ? " bg-primary text-white" : " text-body"}`}
            style={{ cursor: "pointer", width: "100%", margin: 0 }}
          >
            All periods
          </div>
          {periods.length === 0 ? (
            <div className="app-menu-empty px-1 py-0 text-muted">No dated transactions</div>
          ) : (
            periods.map((period) => {
              const isActive = value?.year === period.year && value?.month === period.month;
              return (
                <div
                  key={`${period.year}-${period.month}`}
                  role="option"
                  tabIndex={0}
                  aria-selected={isActive}
                  onClick={() => {
                    onChange({ year: period.year, month: period.month });
                    setOpen(false);
                  }}
                  className={`app-menu-item py-0 px-1${isActive ? " bg-primary text-white" : " text-body"}`}
                  style={{ cursor: "pointer", width: "100%", margin: 0 }}
                >
                  {period.label}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ─── 3 PURCHASE HISTORY SUB-MODAL ──────────────────────────────────────────

function PurchaseHistoryModal({ isOpen, onClose, client, currentUser, appSettings }) {
  const [transactions, setTransactions] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [items, setItems] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [invoiceTx, setInvoiceTx] = useState(null);
  const [tab, setTab] = useState("pos");
  const [portalOrders, setPortalOrders] = useState([]);
  const [portalItems, setPortalItems] = useState({});
  const [periodFilter, setPeriodFilter] = useState(null);
  const [statusUpdateError, setStatusUpdateError] = useState("");
  const [statusUpdatingOrderId, setStatusUpdatingOrderId] = useState(null);

  useEffect(() => {
    if (!isOpen) {
      setPeriodFilter(null);
      setTab("pos");
      setExpandedId(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !client) return;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await clientsAPI.getTransactions(client.id);
        const txns = Array.isArray(res?.data) ? res.data : [];
        const sorted = [...txns].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        setTransactions(sorted);

        try {
          const portalRes = await clientsAPI.getPortalOrders(client.id);
          const orders = Array.isArray(portalRes?.data) ? portalRes.data : [];
          const sortedOrders = [...orders].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
          setPortalOrders(sortedOrders);
        } catch (portalErr) {
          console.warn("Failed to load portal orders:", portalErr);
          setPortalOrders([]);
        }
      } catch {
        setError("Failed to load purchase history.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isOpen, client]);

  const availablePeriods = useMemo(() => buildPurchasePeriods(transactions, portalOrders), [transactions, portalOrders]);
  const posCount = transactions.length;
  const portalCount = portalOrders.length;

  const filteredTransactions = useMemo(() => transactions.filter((tx) => matchesPurchasePeriod(tx.created_at, periodFilter)), [transactions, periodFilter]);

  const filteredPortalOrders = useMemo(() => portalOrders.filter((order) => matchesPurchasePeriod(order.created_at, periodFilter)), [portalOrders, periodFilter]);

  useEffect(() => {
    setExpandedId(null);
  }, [periodFilter, tab]);

  const loadItems = async (txId) => {
    if (items[txId]) {
      setExpandedId(txId);
      return;
    }
    try {
      const res = await clientsAPI.getTransactionItems(txId);
      setItems((prev) => ({ ...prev, [txId]: Array.isArray(res?.data) ? res.data : [] }));
      setExpandedId(txId);
    } catch {
      setExpandedId(txId);
    }
  };

  const loadPortalItems = async (orderId) => {
    if (portalItems[orderId]) {
      setExpandedId(orderId);
      return;
    }
    try {
      const res = await clientsAPI.getPortalOrderItems(orderId);
      setPortalItems((prev) => ({ ...prev, [orderId]: Array.isArray(res?.data) ? res.data : [] }));
      setExpandedId(orderId);
    } catch {
      setExpandedId(orderId);
    }
  };

  const toggleExpand = (txId) => {
    if (expandedId === txId) {
      setExpandedId(null);
      return;
    }
    loadItems(txId);
  };

  const togglePortalExpand = (orderId) => {
    setStatusUpdateError("");
    if (expandedId === orderId) {
      setExpandedId(null);
      return;
    }
    loadPortalItems(orderId);
  };

  const handleOpenInvoice = async (tx) => {
    if (!items[tx.id]) await loadItems(tx.id);
    setInvoiceTx(tx);
  };

  const handlePortalStatusUpdate = async (order, status) => {
    if (!order?.id) return;
    setStatusUpdateError("");
    setStatusUpdatingOrderId(order.id);
    try {
      const isPaymentTransition = (order.status || "payment_pending") === "payment_pending" && status === "ordered";
      const normalizedPaymentMethod = String(order.payment_method || "").toLowerCase();
      const payMethod = normalizedPaymentMethod && normalizedPaymentMethod !== "pending" ? order.payment_method : "card";
      const res = isPaymentTransition ? await clientOrdersAPI.pay(order.id, { payment_method: payMethod }) : await clientOrdersAPI.updateStatus(order.id, status);
      const updated = res?.data ?? res;
      setPortalOrders((prev) => prev.map((entry) => (entry.id === order.id ? updated : entry)));
    } catch (err) {
      console.error("Failed to update portal order status:", err);
      const detail = err?.response?.data?.detail;
      setStatusUpdateError(typeof detail === "string" ? detail : "Failed to update order status.");
    } finally {
      setStatusUpdatingOrderId(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} noPadding={true} fullScreen={true} contentGravity="bottom">
      <div className="ui-page-shell">
        <div className="bg-white border-bottom border-gray-200 dark:bg-gray-900 dark:border-gray-700 flex-shrink-0 p-0">
          <h6 className="ui-heading-strong">Purchase History</h6>
        </div>

        <div className="bg-white d-flex dark:bg-gray-900 dark:text-gray-100 flex-column flex-grow-1 min-h-0 no-scrollbar overflow-auto text-gray-900">
          {loading && (
            <div className="d-flex justify-content-center py-1">
              <div className="spinner-border spinner-border-sm text-primary" role="status" />
            </div>
          )}

          {error && <div className="alert alert-danger mx-3 py-0 small">{error}</div>}

          {!loading && !error && tab === "pos" && filteredTransactions.length === 0 && (
            <div className="py-1 text-center text-muted">
              <ShoppingBagIcon style={{ width: 32, height: 32, margin: "0 auto 8px" }} />
              <div>{transactions.length === 0 ? "No purchases yet" : "No POS purchases for this period"}</div>
            </div>
          )}

          {!loading && !error && tab === "portal" && filteredPortalOrders.length === 0 && (
            <div className="py-1 text-center text-muted">
              <ShoppingBagIcon style={{ width: 32, height: 32, margin: "0 auto 8px" }} />
              <div>{portalOrders.length === 0 ? "No portal orders yet" : "No portal orders for this period"}</div>
            </div>
          )}

          {!loading && tab === "pos" && filteredTransactions.length > 0 && (
            <div>
              {filteredTransactions.map((tx) => (
                <div key={tx.id} className="border-bottom border-gray-100 dark:border-gray-700">
                  <div className="align-items-center d-flex">
                    <button type="button" onClick={() => toggleExpand(tx.id)} className="align-items-center bg-transparent border-0 d-flex flex-grow-1 gap-2 px-1 py-0 text-start" style={{ cursor: "pointer" }}>
                      <div className="flex-grow-1">
                        <div className="fw-medium">${tx.total?.toFixed(2) ?? "0.00"}</div>
                        <div className="ui-small-muted">{formatDate(tx.created_at)}</div>
                      </div>
                      <div className="ui-flex-center-gap-2">
                        <span className="badge bg-secondary-subtle text-capitalize text-secondary">{tx.payment_method || "cash"}</span>
                        <span className="ui-small-muted">{expandedId === tx.id ? "▲" : "▼"}</span>
                      </div>
                    </button>
                    <button type="button" onClick={() => handleOpenInvoice(tx)} className="btn btn-outline-secondary btn-sm flex-shrink-0 me-2" title="Generate invoice for this transaction" style={{ fontSize: 10, padding: "2px 6px" }}>
                      Invoice
                    </button>
                  </div>

                  {expandedId === tx.id && (
                    <div className="pb-0 px-1">
                      {(items[tx.id] || []).length === 0 ? (
                        <div className="ui-small-muted">No items found</div>
                      ) : (
                        <table className="mb-0 table table-borderless table-sm">
                          <tbody>
                            {(items[tx.id] || []).map((item) => (
                              <tr key={item.id}>
                                <td className="ps-0 py-1 small">
                                  <span className={`badge me-1 ${item.item_type === "service" ? "bg-primary-subtle text-primary" : "bg-secondary-subtle text-secondary"}`}>{item.item_type}</span>
                                  {item.item_name}
                                </td>
                                <td className="py-1 small text-end text-muted">x{item.quantity}</td>
                                <td className="fw-medium py-1 small text-end">${item.line_total?.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr>
                              <td colSpan={2} className="ps-0 pt-1 small text-muted">
                                Tax
                              </td>
                              <td className="pt-1 small text-end">${tx.tax_amount?.toFixed(2)}</td>
                            </tr>
                            <tr>
                              <td colSpan={2} className="fw-semibold ps-0">
                                Total
                              </td>
                              <td className="fw-semibold text-end">${tx.total?.toFixed(2)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {!loading && tab === "portal" && filteredPortalOrders.length > 0 && (
            <div>
              {filteredPortalOrders.map((order) => (
                <div key={order.id} className="border-bottom border-gray-100 dark:border-gray-700">
                  <div className="align-items-center d-flex">
                    <button type="button" onClick={() => togglePortalExpand(order.id)} className="align-items-center bg-transparent border-0 d-flex flex-grow-1 gap-2 px-1 py-0 text-start" style={{ cursor: "pointer" }}>
                      <div className="flex-grow-1">
                        <div className="fw-medium">${order.total?.toFixed(2) ?? "0.00"}</div>
                        <div className="ui-small-muted">{formatDate(order.created_at)}</div>
                      </div>
                      <div className="ui-flex-center-gap-2">
                        <span className={`badge ${PORTAL_STATUS_CLASSES[order.status] || "bg-secondary-subtle text-secondary"}`}>{PORTAL_STATUS_LABELS[order.status] || order.status || "Payment Pending"}</span>
                        <span className="ui-small-muted">{expandedId === order.id ? "▲" : "▼"}</span>
                      </div>
                    </button>
                  </div>

                  {expandedId === order.id && (
                    <div className="pb-0 px-1">
                      {statusUpdateError && <div className="alert alert-warning mb-2 px-0 py-1 small">{statusUpdateError}</div>}
                      <div className="align-items-center d-flex flex-wrap gap-2 justify-content-between mb-2">
                        <div className="ui-small-muted">
                          <div>Created: {formatDate(order.created_at)}</div>
                          {order.paid_at && <div>Paid: {formatDate(order.paid_at)}</div>}
                          {order.fulfilled_at && <div>Fulfilled: {formatDate(order.fulfilled_at)}</div>}
                        </div>
                        <div className="d-flex flex-wrap gap-2">
                          {(NEXT_PORTAL_STATUSES[order.status] || []).map((nextStatus) => (
                            <button key={nextStatus} type="button" onClick={() => handlePortalStatusUpdate(order, nextStatus)} className="btn ui-btn-outline-secondary-sm" style={{ fontSize: 11 }} disabled={statusUpdatingOrderId === order.id}>
                              {PORTAL_STATUS_LABELS[nextStatus] || nextStatus}
                            </button>
                          ))}
                        </div>
                      </div>
                      {(portalItems[order.id] || []).length === 0 ? (
                        <div className="ui-small-muted">No items found</div>
                      ) : (
                        <table className="mb-0 table table-borderless table-sm">
                          <tbody>
                            {(portalItems[order.id] || []).map((item) => {
                              const selectedOptions = parseOrderOptions(item.options_json);
                              return (
                                <tr key={item.id}>
                                  <td className="ps-0 py-1 small">
                                    <span className={`badge me-1 ${item.item_type === "service" ? "bg-primary-subtle text-primary" : "bg-secondary-subtle text-secondary"}`}>{item.item_type}</span>
                                    {item.item_name}
                                    {selectedOptions.length > 0 && (
                                      <div className="text-muted" style={{ fontSize: 11 }}>
                                        {selectedOptions.map((option) => `${option.feature_name || option.featureName || ""}: ${option.option_name || option.optionName || ""}`).join(" · ")}
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-1 small text-end text-muted">x{item.quantity}</td>
                                  <td className="fw-medium py-1 small text-end">${item.line_total?.toFixed(2)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr>
                              <td colSpan={2} className="ps-0 pt-1 small text-muted">
                                Tax
                              </td>
                              <td className="pt-1 small text-end">${order.tax_amount?.toFixed(2)}</td>
                            </tr>
                            <tr>
                              <td colSpan={2} className="fw-semibold ps-0">
                                Total
                              </td>
                              <td className="fw-semibold text-end">${order.total?.toFixed(2)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="app-footer-padding app-form-footer app-standard-footer ui-form-footer-shell">
          <Footer_Actions
            start={
              <div className="align-items-center d-flex flex-wrap gap-1">
                <PurchasePeriodFilterDropup periods={availablePeriods} value={periodFilter} onChange={setPeriodFilter} />
                <button
                  type="button"
                  onClick={() => {
                    setTab("pos");
                    setExpandedId(null);
                  }}
                  className={`btn btn-sm position-relative ${tab === "pos" ? "btn-primary" : "btn-outline-secondary"}`}
                >
                  POS
                  {posCount > 0 && (
                    <span className="badge bg-danger position-absolute rounded-pill start-100 top-0 translate-middle" style={{ fontSize: "0.6rem", minWidth: "18px" }}>
                      {posCount > 99 ? "99+" : posCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTab("portal");
                    setExpandedId(null);
                  }}
                  className={`btn btn-sm position-relative ${tab === "portal" ? "btn-primary" : "btn-outline-secondary"}`}
                >
                  Portal
                  {portalCount > 0 && (
                    <span className="badge bg-danger position-absolute rounded-pill start-100 top-0 translate-middle" style={{ fontSize: "0.6rem", minWidth: "18px" }}>
                      {portalCount > 99 ? "99+" : portalCount}
                    </span>
                  )}
                </button>
              </div>
            }
            center={<Button_Toolbar icon={XMarkIcon} label="Close" onClick={onClose} className="btn-outline-secondary" title="Close" />}
          />
        </div>
      </div>

      {invoiceTx && (
        <div className="fixed inset-0 z-[60]">
          <Modal_TemplateUse page="sales" entity={invoiceTx} client={client} items={items[invoiceTx.id] || []} currentUser={currentUser} settings={appSettings} filterType="invoice" onClose={() => setInvoiceTx(null)} />
        </div>
      )}
    </Modal>
  );
}

// ─── 4 MAIN COMPONENT ──────────────────────────────────────────────────────

export default function Modal_Detail_Client({ isOpen, onClose, client, onUpdate, onDelete, canDelete = false, currentUser = null, appSettings = null, memberships = [] }) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    notes: "",
    membership_tier: "none",
    membership_since: "",
    membership_expires: "",
    membership_points: 0,
    membership_ids: [],
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [showServiceHistory, setShowServiceHistory] = useState(false);
  const [showPurchaseHistory, setShowPurchaseHistory] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [cartItems, setCartItems] = useState([]);
  const [purchaseHistoryCount, setPurchaseHistoryCount] = useState(0);

  useEffect(() => {
    if (isOpen && client) {
      setFormData({
        name: client.name || "",
        email: client.email || "",
        phone: client.phone || "",
        address: client.address || "",
        notes: client.notes || "",
        membership_tier: client.membership_tier || "none",
        membership_since: client.membership_since ? client.membership_since.split("T")[0] : "",
        membership_expires: client.membership_expires ? client.membership_expires.split("T")[0] : "",
        membership_points: client.membership_points || 0,
        membership_ids: Array.isArray(client.membership_ids) ? client.membership_ids : [],
      });
      setFieldErrors({});
      // Load cart items for badge count
      clientCartAPI
        .getItems(client.id)
        .then((res) => setCartItems(Array.isArray(res?.data) ? res.data : []))
        .catch(() => setCartItems([]));

      // Load purchase history counts
      Promise.all([clientsAPI.getTransactions(client.id).catch(() => ({ data: [] })), clientsAPI.getPortalOrders(client.id).catch(() => ({ data: [] }))]).then(([txRes, portalRes]) => {
        const txns = Array.isArray(txRes?.data) ? txRes.data : [];
        const orders = Array.isArray(portalRes?.data) ? portalRes.data : [];
        setPurchaseHistoryCount(txns.length + orders.length);
      });
    }
  }, [isOpen, client]);

  // ─── 5 FORM HANDLERS ──────────────────────────────────────────────────────
  const formatPhone = (raw) => {
    const digits = raw.replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "phone" ? formatPhone(value) : type === "number" ? parseInt(value, 10) || 0 : value,
    }));
  };

  const handleSubmit = () => {
    const submitData = { ...formData };
    const primaryMembership = memberships.find((m) => submitData.membership_ids?.includes(m.id));
    submitData.membership_tier = primaryMembership?.name ? String(primaryMembership.name).toLowerCase() : "none";
    if (!submitData.membership_since) submitData.membership_since = null;
    if (!submitData.membership_expires) submitData.membership_expires = null;
    onUpdate?.(client.id, submitData);
  };

  const toggleMembership = (membershipId) => {
    setFormData((prev) => {
      const exists = prev.membership_ids.includes(membershipId);
      return {
        ...prev,
        membership_ids: exists ? prev.membership_ids.filter((id) => id !== membershipId) : [...prev.membership_ids, membershipId],
      };
    });
  };

  const handleDelete = async () => {
    if (!(await showConfirm("Are you sure you want to delete this client?"))) return;
    onDelete?.(client.id);
    onClose();
  };

  const handleEditScheduleFromHistory = (schedule) => {
    if (!schedule?.id) return;
    onClose?.();
    navigate(`/schedule?edit_schedule_id=${encodeURIComponent(schedule.id)}`);
  };

  const cartCount = cartItems.reduce((s, i) => s + (i.quantity || 1), 0);
  const selectedMembershipNames = memberships.filter((m) => formData.membership_ids.includes(m.id)).map((m) => m.name);
  const badgeMembershipNames = selectedMembershipNames.length > 0 ? selectedMembershipNames : formData.membership_tier && String(formData.membership_tier).toLowerCase() !== "none" ? [String(formData.membership_tier)] : [];
  const avatarColor = getTierAvatarColor(badgeMembershipNames.length);
  const initials = (formData.name || "?")
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (!client) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} noPadding={true} fullScreen={true} contentGravity="top">
      <div className="ui-page-shell">
        {/* ─── 6 HEADER ─────────────────────────────────────────────────── */}
        {/* Header */}
        <div className="align-items-center bg-white border-bottom border-gray-200 d-flex dark:bg-gray-900 dark:border-gray-700 flex-shrink-0 gap-2 justify-content-between p-0">
          <h6 className="ui-heading-strong">Client Details</h6>
          {canDelete && (
            <button type="button" className="btn btn-bulk-circle btn-outline-danger flex-shrink-0" onClick={handleDelete} title="Delete client" aria-label="Delete client">
              <XMarkIcon style={{ width: 18, height: 18 }} />
            </button>
          )}
        </div>

        {/* Scrollable content */}
        <div className="bg-white dark:bg-gray-900 dark:text-gray-100 flex-grow-1 min-h-0 no-scrollbar overflow-auto pe-0 pt-1 px-1 text-gray-900">
          {/* ─── 7 AVATAR & ACTION BUTTONS ───────────────────────────────── */}
          {/* Avatar + name + tier */}
          <div className="align-items-center d-flex gap-3 mb-3">
            <div className="align-items-center d-flex flex-shrink-0 fw-bold justify-content-center rounded-circle text-white" style={{ width: 56, height: 56, background: avatarColor, fontSize: "1.25rem" }}>
              {initials}
            </div>
            <div className="min-w-0">
              <div className="fs-6 fw-bold text-truncate">{formData.name || "Client"}</div>
              <span className={`badge rounded-pill ${getTierBadgeClass(badgeMembershipNames.length)}`}>
                {getMembershipLabel(badgeMembershipNames)} · {formData.membership_points} pts
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 items-center mb-3">
            <button
              type="button"
              onClick={() => setShowServiceHistory(true)}
              className="bg-blue-100 dark:bg-blue-800 dark:hover:bg-blue-700 dark:text-white flex flex-shrink-0 h-12 hover:bg-blue-200 items-center justify-center relative rounded-full shadow-lg text-blue-800 transition-all w-12"
              title="Service History"
            >
              <ClockIcon style={{ width: 24, height: 24 }} />
            </button>
            <button
              type="button"
              onClick={() => setShowPurchaseHistory(true)}
              className="bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white flex flex-shrink-0 h-12 hover:bg-gray-200 items-center justify-center relative rounded-full shadow-lg text-gray-800 transition-all w-12"
              title="Purchase History"
            >
              <ArrowTrendingUpIcon style={{ width: 24, height: 24 }} />
              {purchaseHistoryCount > 0 && <span className="-right-1 -top-1 absolute bg-red-500 flex font-bold h-5 items-center justify-center min-w-[20px] px-1 rounded-full text-white text-xs">{purchaseHistoryCount}</span>}
            </button>
            <button type="button" onClick={() => setShowCart(true)} className="bg-secondary-600 flex flex-shrink-0 h-12 hover:bg-secondary-700 hover:shadow-xl items-center justify-center relative rounded-full shadow-lg text-white transition-all w-12" title="View Cart">
              <ShoppingCartIcon style={{ width: 24, height: 24 }} />
              {cartCount > 0 && <span className="-right-1 -top-1 absolute bg-red-500 flex font-bold h-5 items-center justify-center min-w-[20px] px-1 rounded-full text-white text-xs">{cartCount}</span>}
            </button>
          </div>

          {/* ─── 8 EDITABLE FORM FIELDS ──────────────────────────────────── */}
          <div className="form-floating ui-form-floating-mb2">
            <input type="text" id="dc_name" name="name" value={formData.name} onChange={handleChange} className={`form-control form-control-sm ${fieldErrors.name ? "is-invalid" : ""}`} placeholder="Name" required />
            <label htmlFor="dc_name">Name *</label>
            {fieldErrors.name && <div className="invalid-feedback">{fieldErrors.name}</div>}
          </div>

          <div className="form-floating ui-form-floating-mb2">
            <input type="email" id="dc_email" name="email" value={formData.email} onChange={handleChange} className="form-control ui-control-sm" placeholder="Email" />
            <label htmlFor="dc_email">Email</label>
          </div>

          <div className="form-floating ui-form-floating-mb2">
            <input type="tel" id="dc_phone" name="phone" value={formData.phone} onChange={handleChange} className="form-control ui-control-sm" placeholder="(555) 555-5555" pattern="\(\d{3}\) \d{3}-\d{4}" title="Phone number format: (555) 555-5555" />
            <label htmlFor="dc_phone">Phone</label>
          </div>

          {/* Membership section — only shown when the client already has a subscription */}
          {formData.membership_ids.length > 0 && (
            <>
              <hr className="my-2" />
              <div className="fw-semibold mb-2 small text-muted">Subscriptions</div>
              <div className="g-2 mb-2 row">
                <div className="col-12">
                  <div className="border p-0 rounded">
                    <div className="mb-2 ui-small-muted">Assign one or more subscriptions to this client.</div>
                    <div className="d-flex flex-column gap-2" style={{ maxHeight: "170px", overflowY: "auto" }}>
                      {memberships.length === 0 ? (
                        <div className="ui-small-muted">No subscriptions created yet.</div>
                      ) : (
                        memberships.map((membership) => (
                          <label key={membership.id} className="align-items-start d-flex gap-2">
                            <input type="checkbox" checked={formData.membership_ids.includes(membership.id)} onChange={() => toggleMembership(membership.id)} />
                            <span className="small">
                              <span className="fw-semibold">{membership.name}</span>
                              <span className="text-muted"> {`- $${Number(membership.price || 0).toFixed(2)} / ${membership.billing_frequency || "monthly"}`}</span>
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                </div>
                <div className="col-6">
                  <div className="form-floating">
                    <input type="number" id="dc_points" name="membership_points" min="0" value={formData.membership_points} onChange={handleChange} className="form-control ui-control-sm" placeholder="0" />
                    <label htmlFor="dc_points">Points</label>
                  </div>
                </div>
                <div className="col-6">
                  <div className="form-floating">
                    <input type="date" id="dc_since" name="membership_since" value={formData.membership_since} onChange={handleChange} className="form-control ui-control-sm" placeholder="Member Since" />
                    <label htmlFor="dc_since">Member Since</label>
                  </div>
                </div>
                <div className="col-6">
                  <div className="form-floating">
                    <input type="date" id="dc_expires" name="membership_expires" value={formData.membership_expires} onChange={handleChange} className="form-control ui-control-sm" placeholder="Expires" />
                    <label htmlFor="dc_expires">Expires</label>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Address & Notes */}
          <hr className="my-2" />
          <div className="form-floating ui-form-floating-mb2">
            <textarea id="dc_address" name="address" value={formData.address} onChange={handleChange} className="border-0 form-control form-control-sm" placeholder="Address" />
            <label htmlFor="dc_address">Address</label>
          </div>

          <div className="form-floating ui-form-floating-mb2">
            <textarea id="dc_notes" name="notes" value={formData.notes} onChange={handleChange} className="border-0 form-control form-control-sm" placeholder="Notes" />
            <label htmlFor="dc_notes">Notes</label>
          </div>
        </div>

        {/* ─── 9 FIXED FOOTER ──────────────────────────────────────────────── */}
        {/* Fixed footer */}
        <div className="app-footer-padding app-form-footer app-standard-footer ui-form-footer-shell">
          <Footer_Actions start={<Button_Toolbar icon={CheckIcon} label="Save" onClick={handleSubmit} className="btn-outline-secondary" title="Save changes" />} center={<Button_Toolbar icon={XMarkIcon} label="Cancel" onClick={onClose} className="btn-outline-secondary" title="Cancel" />} />
        </div>
      </div>

      {/* ─── 10 SUB-MODAL MOUNTS ──────────────────────────────────────────── */}
      {/* Service History Sub-modal */}
      <ServiceHistoryModal isOpen={showServiceHistory} onClose={() => setShowServiceHistory(false)} client={client} onEditSchedule={handleEditScheduleFromHistory} />

      {/* Purchase History Sub-modal */}
      <PurchaseHistoryModal isOpen={showPurchaseHistory} onClose={() => setShowPurchaseHistory(false)} client={client} currentUser={currentUser} appSettings={appSettings} />

      {/* Client Cart Modal */}
      <Modal_ClientCart
        isOpen={showCart}
        onClose={() => {
          setShowCart(false);
          // Reload inline cart items after editing
          if (client?.id) {
            clientCartAPI
              .getItems(client.id)
              .then((res) => setCartItems(Array.isArray(res?.data) ? res.data : []))
              .catch(() => {});
          }
        }}
        client={client}
      />
    </Modal>
  );
}
