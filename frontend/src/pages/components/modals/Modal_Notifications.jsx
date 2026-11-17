/*
 * ============================================================
 * FILE: Modal_Notifications.jsx
 *
 * PURPOSE:
 *   Shows the signed-in employee's open tasks, upcoming schedule items,
 *   low-stock inventory, updated HR request statuses, and unread chats.
 * ============================================================
 */
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArchiveBoxIcon, ArrowTopRightOnSquareIcon, BellIcon, CalendarDaysIcon, ChatBubbleLeftRightIcon, ClipboardDocumentCheckIcon, DocumentPlusIcon } from "../../../icons";
import useStore from "../../../services/useStore";
import { chatAPI, inventoryAPI, notificationsAPI, purchaseOrdersAPI, supplierProductsAPI, suppliersAPI, tasksAPI } from "../../../services/api";
import { EmptyState, LoadingSpinner } from "../feedback";
import Accordion from "../accordions/Accordion";
import Modal from "./Modal";

const EMPTY_DATA = {
  tasks: [],
  inventory: [],
  purchaseOrders: [],
  suppliers: [],
  supplierProducts: [],
  chats: {},
  requests: {
    leave_requests: [],
    onboarding_requests: [],
    offboarding_requests: [],
  },
};

const getResponseData = (response) => response?.data ?? response;

const formatDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
};

const localActionPath = (value) => (typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : null);

function SectionHeader({ icon: Icon, label, count }) {
  return (
    <span className="align-items-center d-flex gap-2">
      <Icon className="app-icon flex-shrink-0" />
      <span>{label}</span>
      <span className="badge bg-secondary rounded-pill">{count}</span>
    </span>
  );
}

function ActionLink({ to, onClick, children }) {
  return (
    <Link to={to} onClick={onClick} className="btn btn-primary btn-sm mt-2">
      {children}
      <ArrowTopRightOnSquareIcon className="app-icon ms-1" />
    </Link>
  );
}

export default function Modal_Notifications({ isOpen, onClose }) {
  const navigate = useNavigate();
  const user = useStore((state) => state.user);
  const employees = useStore((state) => state.employees);
  const appointments = useStore((state) => state.appointments);
  const hasPermission = useStore((state) => state.hasPermission);
  const canViewLowStock = hasPermission("inventory", "write_all");
  const [data, setData] = useState(EMPTY_DATA);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    if (!isOpen) return undefined;

    if (!user?.id) {
      setErrors(["Your account information is not available."]);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    const sources = [
      { key: "tasks", label: "assigned tasks", load: () => tasksAPI.getMine(), isValid: Array.isArray },
      { key: "chats", label: "unread chats", load: () => chatAPI.getUnreadCounts(), isValid: (value) => value && typeof value === "object" && !Array.isArray(value) },
      {
        key: "requests",
        label: "request statuses",
        load: () => notificationsAPI.getMyRequests(),
        isValid: (value) =>
          value &&
          Array.isArray(value.leave_requests) &&
          Array.isArray(value.onboarding_requests) &&
          Array.isArray(value.offboarding_requests),
      },
    ];

    if (canViewLowStock) {
      sources.push({ key: "inventory", label: "inventory levels", load: () => inventoryAPI.getAll(), isValid: Array.isArray });
      sources.push({ key: "purchaseOrders", label: "draft purchase orders", load: () => purchaseOrdersAPI.getDrafts(), isValid: Array.isArray });
      sources.push({ key: "suppliers", label: "suppliers", load: () => suppliersAPI.getAll(), isValid: Array.isArray });
      sources.push({ key: "supplierProducts", label: "supplier products", load: () => supplierProductsAPI.getAll(), isValid: Array.isArray });
    }

    setLoading(true);
    setErrors([]);
    setData(EMPTY_DATA);

    Promise.all(
      sources.map(async (source) => {
        try {
          const value = getResponseData(await source.load());
          if (!source.isValid(value)) {
            throw new Error(`Unexpected response while loading ${source.label}.`);
          }
          return { key: source.key, value };
        } catch (error) {
          const detail = error?.response?.data?.detail || error?.message || `Unable to load ${source.label}.`;
          return { key: source.key, error: `${source.label}: ${detail}` };
        }
      })
    ).then((results) => {
      if (cancelled) return;
      const nextData = { ...EMPTY_DATA };
      const nextErrors = [];
      results.forEach((result) => {
        if (result.error) nextErrors.push(result.error);
        else nextData[result.key] = result.value;
      });
      setData(nextData);
      setErrors(nextErrors);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen, user?.id, canViewLowStock]);

  const upcomingAppointments = useMemo(() => {
    const now = Date.now();
    return (Array.isArray(appointments) ? appointments : [])
      .filter((appointment) => {
        const appointmentTime = new Date(appointment.appointment_date).getTime();
        return String(appointment.employee_id) === String(user?.id) && appointmentTime >= now && !["cancelled", "completed"].includes(String(appointment.status || "").toLowerCase());
      })
      .sort((left, right) => new Date(left.appointment_date) - new Date(right.appointment_date));
  }, [appointments, user?.id]);

  const lowStockBySupplier = useMemo(() => {
    const lowItems = data.inventory.filter((item) => {
      const quantity = Number(item.quantity);
      const minimum = Number(item.min_stock_level);
      return Number.isFinite(quantity) && Number.isFinite(minimum) && quantity <= minimum;
    });

    if (lowItems.length === 0) {
      return { groups: [], unassigned: [], totalCount: 0 };
    }

    const suppliersList = Array.isArray(data.suppliers) ? data.suppliers : [];
    const supplierProductsList = Array.isArray(data.supplierProducts) ? data.supplierProducts : [];

    const supplierGroups = new Map();
    const unassignedItems = [];

    lowItems.forEach((item) => {
      const quantity = Number(item.quantity) || 0;
      const minimum = Number(item.min_stock_level) || 0;
      const deficit = Math.max(1, Math.round(minimum - quantity));

      const matchingProducts = supplierProductsList.filter(
        (sp) => String(sp.inventory_id) === String(item.id)
      );

      // 1. Preferred supplier product
      let chosenProduct = matchingProducts.find((sp) => sp.is_preferred);

      // 2. If no preferred, match by item.supplier_id or first supplier product
      if (!chosenProduct && matchingProducts.length > 0) {
        if (item.supplier_id) {
          chosenProduct = matchingProducts.find((sp) => String(sp.supplier_id) === String(item.supplier_id)) || matchingProducts[0];
        } else {
          chosenProduct = matchingProducts[0];
        }
      }

      const chosenSupplierId = chosenProduct?.supplier_id || item.supplier_id;
      const chosenSupplier = suppliersList.find((s) => String(s.id) === String(chosenSupplierId));

      if (chosenSupplier) {
        const supIdStr = String(chosenSupplier.id);
        if (!supplierGroups.has(supIdStr)) {
          supplierGroups.set(supIdStr, {
            supplier: chosenSupplier,
            isPreferred: Boolean(chosenProduct?.is_preferred),
            items: [],
          });
        }
        const group = supplierGroups.get(supIdStr);
        if (chosenProduct?.is_preferred) {
          group.isPreferred = true;
        }

        const packSize = Math.max(1, Number(chosenProduct?.units_per_purchase_unit || 1));
        const suggestedPacks = Math.max(1, Math.ceil(deficit / packSize));

        group.items.push({
          item,
          supplierProduct: chosenProduct || null,
          deficit,
          packSize,
          suggestedPacks,
          isPreferred: Boolean(chosenProduct?.is_preferred),
          purchaseUnit: chosenProduct?.purchase_unit || item.stock_unit || "unit",
          unitPrice: chosenProduct ? Number(chosenProduct.unit_price || 0) : Number(item.cost || 0),
        });
      } else {
        unassignedItems.push({
          item,
          deficit,
        });
      }
    });

    const sortedGroups = Array.from(supplierGroups.values()).sort((a, b) => {
      if (a.isPreferred && !b.isPreferred) return -1;
      if (!a.isPreferred && b.isPreferred) return 1;
      return String(a.supplier.name || "").localeCompare(String(b.supplier.name || ""));
    });

    return {
      groups: sortedGroups,
      unassigned: unassignedItems,
      totalCount: lowItems.length,
    };
  }, [data.inventory, data.suppliers, data.supplierProducts]);

  const handleDraftPurchaseOrder = (group) => {
    onClose?.();
    const initialLineItems = group.items.map((entry) => ({
      supplier_product_id: entry.supplierProduct?.id || "",
      inventory_id: entry.item.id,
      inventory_name: entry.item.name,
      quantity_ordered: entry.suggestedPacks,
      unit_price: entry.unitPrice,
      purchase_unit: entry.purchaseUnit,
      units_per_purchase_unit: entry.packSize,
      is_preferred: entry.isPreferred,
    }));

    navigate("/suppliers", {
      state: {
        draftPoSupplierId: group.supplier.id,
        initialLineItems,
      },
    });
  };

  const changedRequests = useMemo(
    () =>
      [
        ...data.requests.leave_requests.map((request) => ({ ...request, kind: request.leave_type === "sick" ? "Sick leave" : "Vacation request" })),
        ...data.requests.onboarding_requests.map((request) => ({ ...request, kind: "Onboarding request" })),
        ...data.requests.offboarding_requests.map((request) => ({ ...request, kind: "Offboarding request" })),
      ]
        .filter((request) => String(request.status || "").toLowerCase() !== "pending")
        .sort((left, right) => new Date(right.updated_at || right.created_at || 0) - new Date(left.updated_at || left.created_at || 0)),
    [data.requests]
  );

  const chatThreads = useMemo(
    () =>
      Object.entries(data.chats)
        .map(([senderId, count]) => {
          const sender = employees.find((employee) => String(employee.id) === senderId);
          const senderName = sender ? `${sender.first_name || ""} ${sender.last_name || ""}`.trim() || sender.username : "A coworker";
          return { senderId, count: Number(count) || 0, senderName };
        })
        .filter((thread) => thread.count > 0),
    [data.chats, employees]
  );

  const totalItems = data.tasks.length + upcomingAppointments.length + lowStockBySupplier.totalCount + data.purchaseOrders.length + changedRequests.length + chatThreads.length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Notifications"
      fullScreen
      noPadding
      contentGravity="bottom"
      footer={
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Done
        </button>
      }
    >
      <div className="d-flex flex-column gap-2 p-2">
        {loading && <LoadingSpinner label="Loading notifications" />}

        {errors.length > 0 && (
          <div className="alert alert-warning mb-0" role="alert">
            <div className="fw-semibold">Some notifications could not be loaded.</div>
            <ul className="mb-0 mt-1 ps-3">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {!loading && totalItems === 0 && errors.length === 0 && <EmptyState title="You’re all caught up" description="No pending tasks or new updates." />}

        {data.tasks.length > 0 && (
          <Accordion header={<SectionHeader icon={ClipboardDocumentCheckIcon} label="My tasks" count={data.tasks.length} />}>
            <div className="d-flex flex-column gap-2">
              {data.tasks.map((task) => {
                const actionPath = localActionPath(task.action_path);
                return (
                  <Accordion key={task.id} header={<span>{task.title} <span className="badge bg-secondary ms-1 text-capitalize">{String(task.status || "pending").replaceAll("_", " ")}</span></span>}>
                    <div className="small">
                      {task.description && <p className="mb-1">{task.description}</p>}
                      <div>Priority: <span className="text-capitalize">{task.priority || "normal"}</span></div>
                      {formatDate(task.due_date) && <div>Due: {formatDate(task.due_date)}</div>}
                      {actionPath && <ActionLink to={actionPath} onClick={onClose}>Open task</ActionLink>}
                    </div>
                  </Accordion>
                );
              })}
            </div>
          </Accordion>
        )}

        {upcomingAppointments.length > 0 && (
          <Accordion header={<SectionHeader icon={CalendarDaysIcon} label="Upcoming calendar" count={upcomingAppointments.length} />}>
            <div className="d-flex flex-column gap-2">
              {upcomingAppointments.map((appointment) => (
                <Accordion key={appointment.id} header={<span>{appointment.title || appointment.appointment_type || "Scheduled event"} — {formatDate(appointment.appointment_date)}</span>}>
                  <div className="small">
                    {appointment.notes && <p className="mb-1">{appointment.notes}</p>}
                    <ActionLink to="/schedule" onClick={onClose}>Open calendar</ActionLink>
                  </div>
                </Accordion>
              ))}
            </div>
          </Accordion>
        )}

        {lowStockBySupplier.totalCount > 0 && (
          <Accordion header={<SectionHeader icon={ArchiveBoxIcon} label="Low stock" count={lowStockBySupplier.totalCount} />}>
            <div className="d-flex flex-column gap-2">
              {lowStockBySupplier.groups.map((group) => (
                <Accordion
                  key={group.supplier.id}
                  header={
                    <span className="align-items-center d-flex flex-wrap gap-1">
                      <span className="fw-medium">{group.supplier.name}</span>
                      {group.isPreferred && (
                        <span className="badge bg-success ms-1">Preferred Supplier</span>
                      )}
                      <span className="badge bg-secondary rounded-pill ms-1">
                        {group.items.length} {group.items.length === 1 ? "item" : "items"}
                      </span>
                    </span>
                  }
                >
                  <div className="small">
                    <div className="d-flex flex-column gap-1 mb-2">
                      {group.items.map((entry) => (
                        <div key={entry.item.id} className="d-flex justify-content-between align-items-center py-1 border-bottom">
                          <div>
                            <span className="fw-medium">{entry.item.name}</span>
                            <span className="text-muted ms-2">
                              On hand: {entry.item.quantity} · Minimum: {entry.item.min_stock_level}
                            </span>
                            {entry.suggestedPacks > 0 && (
                              <span className="text-muted ms-1">
                                (Need {entry.suggestedPacks} {entry.purchaseUnit}{entry.suggestedPacks > 1 ? "s" : ""})
                              </span>
                            )}
                          </div>
                          {entry.isPreferred && (
                            <span className="badge bg-outline-success border text-success" style={{ fontSize: "0.7rem" }}>
                              Preferred
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm mt-1"
                      onClick={() => handleDraftPurchaseOrder(group)}
                    >
                      Draft purchase order
                      <ArrowTopRightOnSquareIcon className="app-icon ms-1" />
                    </button>
                  </div>
                </Accordion>
              ))}

              {lowStockBySupplier.unassigned.length > 0 && (
                <Accordion
                  header={
                    <span className="align-items-center d-flex flex-wrap gap-1">
                      <span>Unassigned / Other</span>
                      <span className="badge bg-secondary rounded-pill ms-1">
                        {lowStockBySupplier.unassigned.length}
                      </span>
                    </span>
                  }
                >
                  <div className="small">
                    <div className="d-flex flex-column gap-1 mb-2">
                      {lowStockBySupplier.unassigned.map((entry) => (
                        <div key={entry.item.id} className="py-1 border-bottom">
                          <span className="fw-medium">{entry.item.name}</span>
                          <span className="text-muted ms-2">
                            On hand: {entry.item.quantity} · Minimum: {entry.item.min_stock_level}
                          </span>
                        </div>
                      ))}
                    </div>
                    <ActionLink to="/inventory" onClick={onClose}>
                      Open inventory
                    </ActionLink>
                  </div>
                </Accordion>
              )}
            </div>
          </Accordion>
        )}

        {data.purchaseOrders.length > 0 && (
          <Accordion header={<SectionHeader icon={ClipboardDocumentCheckIcon} label="Draft purchase orders" count={data.purchaseOrders.length} />}>
            <div className="d-flex flex-column gap-2">
              {data.purchaseOrders.map((order) => (
                <Accordion key={order.id} header={<span>{order.po_number || "Purchase order"} <span className="badge bg-secondary ms-1 text-capitalize">{order.status || "draft"}</span></span>}>
                  <div className="small">
                    <div>Total: ${Number(order.total_amount || 0).toFixed(2)}</div>
                    {formatDate(order.expected_delivery_date) && <div>Expected: {formatDate(order.expected_delivery_date)}</div>}
                    <ActionLink to="/inventory" onClick={onClose}>Review purchase order</ActionLink>
                  </div>
                </Accordion>
              ))}
            </div>
          </Accordion>
        )}

        {changedRequests.length > 0 && (
          <Accordion header={<SectionHeader icon={BellIcon} label="Request updates" count={changedRequests.length} />}>
            <div className="d-flex flex-column gap-2">
              {changedRequests.map((request) => (
                <Accordion key={`${request.kind}-${request.id}`} header={<span>{request.kind} <span className="badge bg-secondary ms-1 text-capitalize">{request.status}</span></span>}>
                  <div className="small">
                    {request.notes && <p className="mb-1">{request.notes}</p>}
                    {formatDate(request.updated_at || request.created_at) && <div>Updated: {formatDate(request.updated_at || request.created_at)}</div>}
                    <ActionLink to="/profile" onClick={onClose}>Open profile</ActionLink>
                  </div>
                </Accordion>
              ))}
            </div>
          </Accordion>
        )}

        {chatThreads.length > 0 && (
          <Accordion header={<SectionHeader icon={ChatBubbleLeftRightIcon} label="Unread chats" count={chatThreads.reduce((total, thread) => total + thread.count, 0)} />}>
            <div className="d-flex flex-column gap-2">
              {chatThreads.map((thread) => (
                <Accordion key={thread.senderId} header={<span>{thread.senderName} <span className="badge bg-danger ms-1">{thread.count}</span></span>}>
                  <div className="small">
                    {thread.count} unread {thread.count === 1 ? "message" : "messages"}.
                    <ActionLink to="/employees" onClick={onClose}>Open messages</ActionLink>
                  </div>
                </Accordion>
              ))}
            </div>
          </Accordion>
        )}
      </div>
    </Modal>
  );
}
