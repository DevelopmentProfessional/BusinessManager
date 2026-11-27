/*
 * ============================================================
 * FILE: Modal_Notifications.jsx
 *
 * PURPOSE:
 *   Shows the signed-in employee's open tasks, upcoming schedule items,
 *   low-stock inventory, updated HR request statuses, and unread chats.
 * ============================================================
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArchiveBoxIcon,
  ArrowTopRightOnSquareIcon,
  BellIcon,
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  ClipboardDocumentCheckIcon,
  DocumentPlusIcon,
  ShoppingCartIcon,
  XMarkIcon,
} from "../../../icons";
import useStore from "../../../services/useStore";
import {
  chatAPI,
  clientOrdersAPI,
  inventoryAPI,
  notificationsAPI,
  purchaseOrdersAPI,
  supplierProductsAPI,
  suppliersAPI,
  tasksAPI,
} from "../../../services/api";
import { EmptyState, LoadingSpinner } from "../feedback";
import Accordion from "../accordions/Accordion";
import Modal from "./Modal";
import Footer_Actions from "../footers/Footer_Actions";
import Button_Toolbar from "../buttons/Button_Toolbar";
import InputButton from "../Inputs/InputButton";
import Badge from "../badges/Badge";
import Badge_Status from "../badges/Badge_Status";

const EMPTY_DATA = {
  tasks: [],
  orders: [],
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

function ActionLink({ to, onClick, children }) {
  const navigate = useNavigate();
  return (
    <InputButton
      type="button"
      onClick={() => {
        onClick?.();
        navigate(to);
      }}
      className="btn btn-primary btn-sm w-100 mt-2 d-flex align-items-center justify-content-center gap-1"
    >
      <span>{children}</span>
      <ArrowTopRightOnSquareIcon className="app-icon flex-shrink-0" />
    </InputButton>
  );
}

export default function Modal_Notifications({ isOpen, onClose, onCountChange }) {
  const navigate = useNavigate();
  const user = useStore((state) => state.user);
  const employees = useStore((state) => state.employees);
  const appointments = useStore((state) => state.appointments);
  const hasPermission = useStore((state) => state.hasPermission);
  const canViewLowStock = hasPermission("inventory", "write_all");
  const canViewOrders = hasPermission("sales", "read") || hasPermission("clients", "read");
  const [data, setData] = useState(EMPTY_DATA);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [updatingTaskIds, setUpdatingTaskIds] = useState(() => new Set());
  const [taskActionErrors, setTaskActionErrors] = useState({});
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!isOpen && hasLoadedRef.current) return undefined;

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

    if (canViewOrders) {
      sources.push({ key: "orders", label: "client orders", load: () => clientOrdersAPI.getAll(), isValid: Array.isArray });
    }

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
      hasLoadedRef.current = true;
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen, user?.id, canViewLowStock, canViewOrders]);

  const updateTaskStatus = async (task, status) => {
    setUpdatingTaskIds((current) => new Set(current).add(task.id));
    setTaskActionErrors((current) => ({ ...current, [task.id]: "" }));
    try {
      const response = await tasksAPI.updateStatus(task.id, status);
      const updatedTask = getResponseData(response);
      setData((current) => ({
        ...current,
        tasks: status === "completed"
          ? current.tasks.filter((item) => item.id !== task.id)
          : current.tasks.map((item) => item.id === task.id ? { ...item, ...updatedTask } : item),
      }));
    } catch (error) {
      setTaskActionErrors((current) => ({
        ...current,
        [task.id]: error?.response?.data?.detail || error?.message || "Could not update this task.",
      }));
    } finally {
      setUpdatingTaskIds((current) => {
        const next = new Set(current);
        next.delete(task.id);
        return next;
      });
    }
  };

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

        const packSize = Math.max(1, Number(chosenProduct?.units_per_purchase_unit || item.units_per_purchase_unit || 1));
        const suggestedPacks = Math.max(1, Math.ceil(deficit / packSize));

        group.items.push({
          item,
          supplierProduct: chosenProduct || null,
          deficit,
          packSize,
          suggestedPacks,
          isPreferred: Boolean(chosenProduct?.is_preferred),
          purchaseUnit: chosenProduct?.purchase_unit || item.purchase_unit || "unit",
          unitPrice: chosenProduct ? Number(chosenProduct.unit_price || 0) : Number(item.cost || 0) * packSize,
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

  const pendingOrders = useMemo(() => {
    const ordersList = Array.isArray(data.orders) ? data.orders : [];
    return ordersList.filter((order) => ["ordered", "processing"].includes(String(order.status || "").toLowerCase()));
  }, [data.orders]);

  const totalItems = data.tasks.length + upcomingAppointments.length + lowStockBySupplier.totalCount + data.purchaseOrders.length + changedRequests.length + chatThreads.length + pendingOrders.length;

  useEffect(() => {
    onCountChange?.(totalItems);
  }, [totalItems, onCountChange]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Notifications"
      fullScreen
      noPadding
      contentGravity="bottom"
      footer={
        <Footer_Actions
          center={
            <Button_Toolbar
              icon={XMarkIcon}
              label="Cancel"
              onClick={onClose}
              className="btn-outline-secondary"
              title="Cancel"
            />
          }
        />
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
          <Accordion
            variant="settings"
            bodyPlacement="above"
            icon={ClipboardDocumentCheckIcon}
            iconClassName="app-icon"
            header="My Tasks"
            titleExtra={<Badge variant="gray" pill label={data.tasks.length} className="flex-shrink-0" />}
          >
            <div className="d-flex flex-column gap-2">
              {data.tasks.map((task) => {
                const actionPath = localActionPath(task.action_path);
                return (
                  <Accordion
                    key={task.id}
                    variant="settings"
                    bodyPlacement="above"
                    header={<span className="text-truncate">{task.title}</span>}
                    titleExtra={<Badge_Status status={task.status || "pending"} pill />}
                  >
                    <div className="small">
                      {task.description && <p className="mb-1">{task.description}</p>}
                      <div>Priority: <span className="text-capitalize">{task.priority || "normal"}</span></div>
                      {formatDate(task.due_date) && <div>Due: {formatDate(task.due_date)}</div>}
                      {actionPath && <ActionLink to={actionPath} onClick={onClose}>Open task</ActionLink>}
                      {taskActionErrors[task.id] && <div className="alert alert-danger mt-2 py-1" role="alert">{taskActionErrors[task.id]}</div>}
                      <div className="d-flex flex-column gap-2 mt-2">
                        {task.status === "pending" && (
                          <InputButton
                            type="button"
                            className="btn btn-outline-primary btn-sm w-100"
                            disabled={updatingTaskIds.has(task.id)}
                            onClick={() => updateTaskStatus(task, "in_progress")}
                          >
                            Start
                          </InputButton>
                        )}
                        <InputButton
                          type="button"
                          className="btn btn-primary btn-sm w-100"
                          disabled={updatingTaskIds.has(task.id)}
                          onClick={() => updateTaskStatus(task, "completed")}
                        >
                          {updatingTaskIds.has(task.id) ? "Saving..." : "Mark complete"}
                        </InputButton>
                      </div>
                    </div>
                  </Accordion>
                );
              })}
            </div>
          </Accordion>
        )}

        {upcomingAppointments.length > 0 && (
          <Accordion
            variant="settings"
            bodyPlacement="above"
            icon={CalendarDaysIcon}
            iconClassName="app-icon"
            header="Upcoming Calendar"
            titleExtra={<Badge variant="gray" pill label={upcomingAppointments.length} className="flex-shrink-0" />}
          >
            <div className="d-flex flex-column gap-2">
              {upcomingAppointments.map((appointment) => (
                <Accordion
                  key={appointment.id}
                  variant="settings"
                  bodyPlacement="above"
                  header={<span className="text-truncate">{appointment.title || appointment.appointment_type || "Scheduled event"}</span>}
                  titleExtra={formatDate(appointment.appointment_date) ? <span className="text-muted text-nowrap flex-shrink-0 small">{formatDate(appointment.appointment_date)}</span> : null}
                >
                  <div className="small">
                    {appointment.notes && <p className="mb-1">{appointment.notes}</p>}
                    <ActionLink to="/schedule" onClick={onClose}>Open calendar</ActionLink>
                  </div>
                </Accordion>
              ))}
            </div>
          </Accordion>
        )}

        {pendingOrders.length > 0 && (
          <Accordion
            variant="settings"
            bodyPlacement="above"
            icon={ShoppingCartIcon}
            iconClassName="app-icon"
            header="Client Orders"
            titleExtra={<Badge variant="gray" pill label={pendingOrders.length} className="flex-shrink-0" />}
          >
            <div className="d-flex flex-column gap-2">
              {pendingOrders.map((order) => (
                <Accordion
                  key={order.id}
                  variant="settings"
                  bodyPlacement="above"
                  header={<span className="text-truncate">{order.client_name ? `${order.client_name} — ` : ""}Order #{String(order.id).slice(0, 8)}</span>}
                  titleExtra={<Badge_Status status={order.status} pill />}
                >
                  <div className="small">
                    <div>Total: ${Number(order.total || 0).toFixed(2)}</div>
                    <div>Status: <span className="text-capitalize">{String(order.status || "").replaceAll("_", " ")}</span></div>
                    {formatDate(order.created_at) && <div>Placed: {formatDate(order.created_at)}</div>}
                    <ActionLink to="/sales" onClick={onClose}>Open sales</ActionLink>
                  </div>
                </Accordion>
              ))}
            </div>
          </Accordion>
        )}

        {lowStockBySupplier.totalCount > 0 && (
          <Accordion
            variant="settings"
            bodyPlacement="above"
            icon={ArchiveBoxIcon}
            iconClassName="app-icon"
            header="Low Stock"
            titleExtra={<Badge variant="gray" pill label={lowStockBySupplier.totalCount} className="flex-shrink-0" />}
          >
            <div className="d-flex flex-column gap-2">
              {lowStockBySupplier.groups.map((group) => (
                <Accordion
                  key={group.supplier.id}
                  variant="settings"
                  bodyPlacement="above"
                  header={<span className="text-truncate">{group.supplier.name}</span>}
                  titleExtra={
                    <span className="align-items-center d-flex flex-nowrap gap-1 flex-shrink-0">
                      {group.isPreferred && <Badge variant="green" pill label="Preferred Supplier" />}
                      <Badge variant="gray" pill label={`${group.items.length} ${group.items.length === 1 ? "item" : "items"}`} />
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
                            <Badge variant="green" pill label="Preferred" className="flex-shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>
                    <InputButton
                      type="button"
                      className="btn btn-primary btn-sm w-100 mt-2 d-flex align-items-center justify-content-center gap-1"
                      onClick={() => handleDraftPurchaseOrder(group)}
                    >
                      <span>Draft purchase order</span>
                      <ArrowTopRightOnSquareIcon className="app-icon flex-shrink-0" />
                    </InputButton>
                  </div>
                </Accordion>
              ))}

              {lowStockBySupplier.unassigned.length > 0 && (
                <Accordion
                  variant="settings"
                  bodyPlacement="above"
                  header={<span className="text-truncate">Unassigned / Other</span>}
                  titleExtra={<Badge variant="gray" pill label={lowStockBySupplier.unassigned.length} className="flex-shrink-0" />}
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
          <Accordion
            variant="settings"
            bodyPlacement="above"
            icon={DocumentPlusIcon}
            iconClassName="app-icon"
            header="Draft Purchase Orders"
            titleExtra={<Badge variant="gray" pill label={data.purchaseOrders.length} className="flex-shrink-0" />}
          >
            <div className="d-flex flex-column gap-2">
              {data.purchaseOrders.map((order) => (
                <Accordion
                  key={order.id}
                  variant="settings"
                  bodyPlacement="above"
                  header={<span className="text-truncate">{order.po_number || "Purchase order"}</span>}
                  titleExtra={<Badge_Status status={order.status || "draft"} pill />}
                >
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
          <Accordion
            variant="settings"
            bodyPlacement="above"
            icon={BellIcon}
            iconClassName="app-icon"
            header="Request Updates"
            titleExtra={<Badge variant="gray" pill label={changedRequests.length} className="flex-shrink-0" />}
          >
            <div className="d-flex flex-column gap-2">
              {changedRequests.map((request) => (
                <Accordion
                  key={`${request.kind}-${request.id}`}
                  variant="settings"
                  bodyPlacement="above"
                  header={<span className="text-truncate">{request.kind}</span>}
                  titleExtra={<Badge_Status status={request.status} pill />}
                >
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
          <Accordion
            variant="settings"
            bodyPlacement="above"
            icon={ChatBubbleLeftRightIcon}
            iconClassName="app-icon"
            header="Unread Chats"
            titleExtra={<Badge variant="red" pill label={chatThreads.reduce((total, thread) => total + thread.count, 0)} className="flex-shrink-0" />}
          >
            <div className="d-flex flex-column gap-2">
              {chatThreads.map((thread) => (
                <Accordion
                  key={thread.senderId}
                  variant="settings"
                  bodyPlacement="above"
                  header={<span className="text-truncate">{thread.senderName}</span>}
                  titleExtra={<Badge variant="red" pill label={thread.count} className="flex-shrink-0" />}
                >
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
