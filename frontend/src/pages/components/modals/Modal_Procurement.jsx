/**
 * Supplier product and purchase-order management.
 */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { InputNumber, InputTextarea, InputDate } from "../Inputs";
import { PlusIcon, XMarkIcon, CheckIcon, DocumentPlusIcon, EyeIcon } from "../../../icons";
import api, { inventoryAPI, inventoryCategoriesAPI, documentsAPI, supplierProductsAPI } from "../../../services/api";
import { formatCurrency } from "../../../utils/formatters";
import Modal from "./Modal";
import Footer_Actions from "../footers/Footer_Actions";
import Button_Toolbar from "../buttons/Button_Toolbar";
import Modal_DocumentUpload from "./Modal_DocumentUpload";
import Dropdown_Custom from "../dropdowns/Dropdown_Custom";
import PageTableHeader from "../tables/Page_TableHeader";
import PageTableRow from "../tables/Page_TableRow";
import Table from "../tables/Table";

const EMPTY_LINE = { supplier_product_id: "", inventory_id: "", quantity_ordered: 1, unit_price: 0 };

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const getErrorMessage = (error, fallback) =>
  String(error?.response?.data?.detail || error?.message || fallback);

const Modal_Procurement = ({
  supplierId,
  supplier,
  supplierName,
  settings = {},
  isOpen = true,
  onClose,
  embedded = true,
  initialCreate = false,
  view: controlledView,
  onViewChange,
  onPOCreated,
  initialLineItems = null,
}) => {
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [inventoryCategories, setInventoryCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [localView, setLocalView] = useState(initialCreate ? "create" : "orders");
  const view = controlledView ?? localView;
  const isViewControlled = controlledView !== undefined;
  const setView = (nextView) => {
    if (isViewControlled) onViewChange?.(nextView);
    else setLocalView(nextView);
  };
  const [supplierProducts, setSupplierProducts] = useState([]);
  const [procurementError, setProcurementError] = useState("");
  const [detailPoId, setDetailPoId] = useState(null);
  const [detailPo, setDetailPo] = useState(null);
  const [receiptQuantities, setReceiptQuantities] = useState({});
  const [savingReceipt, setSavingReceipt] = useState(false);
  const [newPoLine, setNewPoLine] = useState({ supplier_product_id: "", quantity: 1, unit_price: 0 });
  const [detailLoading, setDetailLoading] = useState(false);
  const [linkedDocs, setLinkedDocs] = useState([]);
  const [showDocUpload, setShowDocUpload] = useState(false);
  const [formData, setFormData] = useState(() => ({
    line_items: Array.isArray(initialLineItems) && initialLineItems.length > 0
      ? initialLineItems.map((line) => ({
          supplier_product_id: line.supplier_product_id || "",
          inventory_id: line.inventory_id || "",
          quantity_ordered: line.quantity_ordered ?? 1,
          unit_price: num(line.unit_price),
          purchase_unit: line.purchase_unit || "unit",
          units_per_purchase_unit: line.units_per_purchase_unit || 1,
        }))
      : [{ ...EMPTY_LINE }],
    expected_delivery_date: "",
    notes: "",
  }));

  const loadPurchaseOrders = useCallback(async () => {
    try {
      const response = await api.get(`/purchase-orders?supplier_id=${supplierId}`);
      const rows = Array.isArray(response?.data) ? response.data : [];
      setPurchaseOrders(
        rows.map((po) => ({
          ...po,
          total_amount: num(po.total_amount),
        }))
      );
    } catch (error) {
      console.error("Failed to load POs:", error);
      setProcurementError(getErrorMessage(error, "Failed to load purchase orders."));
    }
  }, [supplierId]);

  const loadInventoryItems = useCallback(async () => {
    try {
      const response = await inventoryAPI.getAll();
      setInventoryItems(response?.data ?? response ?? []);
    } catch (error) {
      console.error("Failed to load inventory:", error);
      setProcurementError(getErrorMessage(error, "Failed to load inventory items."));
    }
  }, []);

  const loadInventoryCategories = useCallback(async () => {
    try {
      const response = await inventoryCategoriesAPI.getAll();
      const rows = response?.data ?? response ?? [];
      if (!Array.isArray(rows)) throw new Error("Invalid inventory category data received.");
      setInventoryCategories(rows);
    } catch (error) {
      console.error("Failed to load inventory categories:", error);
      setProcurementError(getErrorMessage(error, "Failed to load inventory categories."));
    }
  }, []);

  const loadSupplierProducts = useCallback(async () => {
    try {
      const response = await supplierProductsAPI.getBySupplier(supplierId);
      setSupplierProducts(Array.isArray(response?.data) ? response.data : []);
    } catch (error) {
      console.error("Failed to load supplier catalog:", error);
      setProcurementError(getErrorMessage(error, "Failed to load supplier catalog."));
      setSupplierProducts([]);
    }
  }, [supplierId]);

  useEffect(() => {
    loadPurchaseOrders();
    loadInventoryItems();
    loadInventoryCategories();
    loadSupplierProducts();
  }, [loadPurchaseOrders, loadInventoryItems, loadInventoryCategories, loadSupplierProducts]);

  useEffect(() => {
    if (Array.isArray(initialLineItems) && initialLineItems.length > 0) {
      setFormData((prev) => ({
        ...prev,
        line_items: initialLineItems.map((line) => ({
          supplier_product_id: line.supplier_product_id || "",
          inventory_id: line.inventory_id || "",
          quantity_ordered: line.quantity_ordered ?? 1,
          unit_price: num(line.unit_price),
          purchase_unit: line.purchase_unit || "unit",
          units_per_purchase_unit: line.units_per_purchase_unit || 1,
        })),
      }));
    }
  }, [initialLineItems]);

  useEffect(() => {
    if (supplierProducts.length > 0) {
      setFormData((prev) => {
        let changed = false;
        const updated = prev.line_items.map((line) => {
          if (!line.inventory_id) return line;
          const sp = supplierProducts.find((product) =>
            String(product.inventory_id) === String(line.inventory_id)
            || (line.supplier_product_id && String(product.id) === String(line.supplier_product_id))
          );
          if (!sp) return line;
          const next = {
            ...line,
            supplier_product_id: sp.id,
            unit_price: line.unit_price || num(sp.unit_price),
            purchase_unit: sp.purchase_unit || "unit",
            units_per_purchase_unit: Number(sp.units_per_purchase_unit || 1),
          };
          if (
            next.supplier_product_id !== line.supplier_product_id
            || next.unit_price !== line.unit_price
            || next.purchase_unit !== line.purchase_unit
            || next.units_per_purchase_unit !== line.units_per_purchase_unit
          ) changed = true;
          return next;
        });
        return changed ? { ...prev, line_items: updated } : prev;
      });
    }
  }, [supplierProducts]);

  useEffect(() => {
    if (!initialLineItems || initialLineItems.length === 0 || !supplierId) return;
    const missing = initialLineItems.filter(
      (line) => line.inventory_id && !supplierProducts.some((p) => String(p.inventory_id) === String(line.inventory_id))
    );
    if (missing.length > 0) {
      Promise.all(
        missing.map((item) =>
          supplierProductsAPI.save({
            supplier_id: supplierId,
            inventory_id: item.inventory_id,
            is_preferred: Boolean(item.is_preferred),
          })
        )
      )
        .then(() => loadSupplierProducts())
        .catch((err) => console.warn("Could not auto-register supplier product:", err));
    }
  }, [initialLineItems, supplierId, supplierProducts, loadSupplierProducts]);

  const loadDetail = async (poId) => {
    setDetailLoading(true);
    try {
      const poRes = await api.get(`/purchase-orders/${poId}`);
      setDetailPo(poRes?.data ?? null);
      const detail = poRes?.data ?? null;
      setReceiptQuantities(
        Object.fromEntries(
          (detail?.line_items || []).map((line) => [
            line.id,
            Math.max(0, Number(line.quantity_ordered) - Number(line.quantity_received || 0)),
          ])
        )
      );
      let docs = [];
      try {
        const docsRes = await documentsAPI.getByEntity("purchase_order", poId);
        const raw = docsRes?.data;
        docs = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
      } catch {
        /* fallback below */
      }
      if (docs.length === 0) {
        try {
          const allRes = await documentsAPI.getAll();
          const all = Array.isArray(allRes?.data) ? allRes.data : [];
          docs = all.filter((d) => d.entity_type === "purchase_order" && String(d.entity_id) === String(poId));
        } catch {
          docs = [];
        }
      }
      setLinkedDocs(docs);
    } catch (err) {
      console.error("Failed to load PO detail:", err);
      setProcurementError(getErrorMessage(err, "Failed to load purchase order."));
      setDetailPo(null);
      setLinkedDocs([]);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (detailPoId) loadDetail(detailPoId);
  }, [detailPoId]);

  const lineSubtotal = useMemo(
    () => formData.line_items.reduce((sum, item) => sum + num(item.quantity_ordered) * num(item.unit_price), 0),
    [formData.line_items]
  );

  const importTaxTotal = useMemo(() => {
    const categoryRates = new Map(
      inventoryCategories.map((category) => [
        `${String(category.item_type || "").trim().toLowerCase()}|${String(category.name || "").trim().toLocaleLowerCase()}`,
        num(category.import_tax_rate),
      ])
    );
    return formData.line_items.reduce((total, line) => {
      const inventory = inventoryItems.find((item) => String(item.id) === String(line.inventory_id));
      const key = `${String(inventory?.type || "").trim().toLowerCase()}|${String(inventory?.category || "").trim().toLocaleLowerCase()}`;
      return total + num(line.quantity_ordered) * num(line.unit_price) * (categoryRates.get(key) || 0) / 100;
    }, 0);
  }, [formData.line_items, inventoryCategories, inventoryItems]);

  const shippingCost = useMemo(() => {
    const rate = num(supplier?.shipping_rate);
    return supplier?.shipping_rate_type === "percentage" ? lineSubtotal * rate / 100 : rate;
  }, [lineSubtotal, supplier?.shipping_rate, supplier?.shipping_rate_type]);

  const orderTotal = lineSubtotal + importTaxTotal + shippingCost;

  const inventoryName = (id) => inventoryItems.find((i) => String(i.id) === String(id))?.name || "—";
  const supplierProductLabel = (product) => {
    const itemName = product.inventory_name || inventoryName(product.inventory_id);
    return `${itemName} — ${formatCurrency(num(product.unit_price))} / ${product.purchase_unit}`;
  };

  const resetCreateForm = () => {
    setFormData({
      line_items: [{ ...EMPTY_LINE }],
      expected_delivery_date: "",
      notes: "",
    });
  };

  const handleAddLineItem = () => {
    setFormData((prev) => ({
      ...prev,
      line_items: [...prev.line_items, { ...EMPTY_LINE }],
    }));
  };

  const handleRemoveLineItem = (index) => {
    setFormData((prev) => ({
      ...prev,
      line_items: prev.line_items.length > 1 ? prev.line_items.filter((_, i) => i !== index) : prev.line_items,
    }));
  };

  const handleLineItemChange = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.line_items];
      const next = { ...updated[index] };
      if (field === "supplier_product_id") {
        const product = supplierProducts.find((row) => String(row.id) === String(value));
        next.supplier_product_id = value;
        next.inventory_id = product?.inventory_id || "";
        next.unit_price = num(product?.unit_price);
        next.purchase_unit = product?.purchase_unit || "unit";
        next.units_per_purchase_unit = Number(product?.units_per_purchase_unit || 1);
      } else if (field === "quantity_ordered" || field === "unit_price") {
        next[field] = value === "" ? "" : num(value);
      } else {
        next[field] = value;
      }
      updated[index] = next;
      return { ...prev, line_items: updated };
    });
  };

  const handleCreatePO = async () => {
    const validLines = formData.line_items.filter((i) => i.supplier_product_id);
    if (validLines.length === 0) return;
    setProcurementError("");
    try {
      setLoading(true);
      const payload = {
        supplier_id: supplierId,
        expected_delivery_date: formData.expected_delivery_date || null,
        notes: formData.notes || null,
        items: validLines.map((item) => ({
          supplier_product_id: item.supplier_product_id,
          inventory_id: item.inventory_id,
          quantity: Math.max(1, Math.round(num(item.quantity_ordered))),
          unit_price: num(item.unit_price),
        })),
      };
      const response = await api.post("/purchase-orders", payload);
      const newPO = response?.data;
      if (newPO?.id) {
        setPurchaseOrders((prev) => [{ ...newPO, total_amount: num(newPO.total_amount) }, ...prev]);
      } else {
        await loadPurchaseOrders();
      }
      setView("orders");
      resetCreateForm();
      onPOCreated?.();
    } catch (error) {
      console.error("Failed to create PO:", error);
      setProcurementError(getErrorMessage(error, "Failed to create purchase order."));
    } finally {
      setLoading(false);
    }
  };

  const handleMarkSent = async () => {
    if (!detailPoId) return;
    setProcurementError("");
    try {
      setSavingReceipt(true);
      await api.put(`/purchase-orders/${detailPoId}/send`);
      await Promise.all([loadDetail(detailPoId), loadPurchaseOrders()]);
    } catch (error) {
      console.error("Failed to mark PO sent:", error);
      setProcurementError(getErrorMessage(error, "Failed to mark purchase order as sent."));
    } finally {
      setSavingReceipt(false);
    }
  };

  const handleReceiveItems = async () => {
    if (!detailPoId || !detailPo?.line_items?.length) return;
    const items = detailPo.line_items
      .map((line) => ({
        line_id: line.id,
        quantity: Math.max(0, Math.round(num(receiptQuantities[line.id]))),
      }))
      .filter((line) => line.quantity > 0);
    if (items.length === 0) return;
    setProcurementError("");
    try {
      setSavingReceipt(true);
      await api.post(`/purchase-orders/${detailPoId}/receive`, { items });
      await Promise.all([loadDetail(detailPoId), loadPurchaseOrders(), loadInventoryItems()]);
      onPOCreated?.();
    } catch (error) {
      console.error("Failed to receive PO items:", error);
      setProcurementError(getErrorMessage(error, "Failed to receive purchase order items."));
    } finally {
      setSavingReceipt(false);
    }
  };

  const handleAddOpenPoLine = async () => {
    if (!detailPoId || !newPoLine.supplier_product_id) return;
    const product = supplierProducts.find((row) => String(row.id) === String(newPoLine.supplier_product_id));
    if (!product) return;
    setProcurementError("");
    try {
      setSavingReceipt(true);
      await api.post(`/purchase-orders/${detailPoId}/items`, {
        items: [{
          inventory_id: product.inventory_id,
          quantity: Math.max(1, Math.round(num(newPoLine.quantity))),
          unit_price: Math.max(0, num(newPoLine.unit_price)),
        }],
      });
      setNewPoLine({ supplier_product_id: "", quantity: 1, unit_price: 0 });
      await Promise.all([loadDetail(detailPoId), loadPurchaseOrders()]);
    } catch (error) {
      console.error("Failed to add item to purchase order:", error);
      setProcurementError(getErrorMessage(error, "Failed to add item to purchase order."));
    } finally {
      setSavingReceipt(false);
    }
  };

  const openDetail = (po) => {
    setDetailPoId(po.id);
    setView("orders");
  };

  const renderCreateForm = () => (
    <div className="d-flex flex-column flex-grow-1 min-h-0">
      {embedded && (
        <div className="align-items-center d-flex flex-shrink-0 gap-2 justify-content-between mb-2">
          <span className="fw-semibold small text-muted">{supplierName || supplier?.name || "Purchase order"}</span>
          <button type="button" className="btn btn-bulk-circle btn-outline-secondary btn-sm p-0" onClick={() => { setView("orders"); resetCreateForm(); }} title="Cancel" aria-label="Cancel">
            <XMarkIcon style={{ width: 14, height: 14 }} />
          </button>
        </div>
      )}
      <div className="flex-grow-1 min-h-0 overflow-auto pe-1">
        {settings.showPODeliveryDate !== false && (
          <div className="form-floating ui-form-floating-mb2">
            <InputDate
              type="date"
              id={`po_expected_delivery_${supplierId}`}
              className="form-control ui-control-sm"
              value={formData.expected_delivery_date}
              onChange={(e) => setFormData((p) => ({ ...p, expected_delivery_date: e.target.value }))}
            />
            <label htmlFor={`po_expected_delivery_${supplierId}`}>Expected delivery date</label>
          </div>
        )}

        <div className="border mb-2 rounded table-responsive">
          <table className="mb-0 table table-sm">
            <thead className="table-light">
              <tr>
                <th style={{ width: 36 }} />
                <th>Item</th>
                <th style={{ width: 72 }}>Quantity</th>
                <th style={{ width: 96 }}>Price / unit</th>
                <th className="text-end" style={{ width: 80 }}>Line</th>
              </tr>
            </thead>
            <tbody>
              {formData.line_items.map((item, idx) => (
                <tr key={idx}>
                  <td className="text-center">
                    {formData.line_items.length > 1 && (
                      <button type="button" className="btn btn-bulk-circle btn-outline-danger btn-sm p-0" onClick={() => handleRemoveLineItem(idx)} title="Remove line" aria-label={`Remove line ${idx + 1}`}>
                        <XMarkIcon style={{ width: 14, height: 14 }} />
                      </button>
                    )}
                  </td>
                  <td>
                    <Dropdown_Custom
                      className="form-select ui-control-sm"
                      value={item.supplier_product_id}
                      onChange={(e) => handleLineItemChange(idx, "supplier_product_id", e.target.value)}
                      options={[
                        { value: "", label: "Select…" },
                        ...supplierProducts.map((product) => ({ value: product.id, label: supplierProductLabel(product) })),
                      ]}
                    />
                  </td>
                  <td>
                    <InputNumber min="1" className="form-control ui-control-sm" value={item.quantity_ordered} onChange={(e) => handleLineItemChange(idx, "quantity_ordered", e.target.value)} />
                  </td>
                  <td>
                    <InputNumber min="0" step="0.01" className="form-control ui-control-sm" value={item.unit_price} onChange={(e) => handleLineItemChange(idx, "unit_price", e.target.value)} />
                  </td>
                  <td className="fw-medium small text-end">{formatCurrency(num(item.quantity_ordered) * num(item.unit_price))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="small text-end text-muted">Subtotal</td>
                <td className="fw-medium small text-end">{formatCurrency(lineSubtotal)}</td>
              </tr>
              {settings.showPOImportTax !== false && (
                <tr>
                  <td colSpan={4} className="small text-end">Import tax</td>
                  <td className="small text-end">{formatCurrency(importTaxTotal)}</td>
                </tr>
              )}
              {settings.showPOShipping !== false && (
                <tr>
                  <td colSpan={4} className="small text-end">
                    Shipping {supplier?.shipping_rate_type === "percentage" ? `(${num(supplier?.shipping_rate)}%)` : ""}
                  </td>
                  <td className="small text-end">{formatCurrency(shippingCost)}</td>
                </tr>
              )}
              <tr className="table-light">
                <td colSpan={4} className="fw-semibold small text-end">Sum</td>
                <td className="fw-bold small text-end">{formatCurrency(orderTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {settings.showPONotes !== false && (
          <div className="form-floating ui-form-floating-mb2">
            <InputTextarea className="form-control ui-control-sm" style={{ minHeight: 64 }} id={`po_notes_${supplierId}`} value={formData.notes} onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))} placeholder="Notes" />
            <label htmlFor={`po_notes_${supplierId}`}>Notes</label>
          </div>
        )}
      </div>
      {embedded && (
        <Footer_Actions
          start={
            <button type="button" onClick={handleAddLineItem} className="align-items-center btn btn-outline-primary btn-sm d-inline-flex gap-1">
              <PlusIcon style={{ width: 14, height: 14 }} />
              <span>Add line</span>
            </button>
          }
          center={
            <button type="button" className="btn btn-bulk-circle btn-outline-secondary btn-sm p-0" onClick={() => { setView("orders"); resetCreateForm(); }} disabled={loading} title="Cancel" aria-label="Cancel">
              <XMarkIcon style={{ width: 14, height: 14 }} />
            </button>
          }
          end={
            <Button_Toolbar
              icon={CheckIcon}
              label={loading ? "Saving…" : "Save"}
              onClick={handleCreatePO}
              disabled={loading || formData.line_items.every((i) => !i.supplier_product_id)}
              className="btn-primary"
              title="Save purchase order"
            />
          }
        />
      )}
    </div>
  );

  const renderPoList = () => {
    const columns = [
      { key: "po-number", label: "PO#", className: "app-col-flex" },
      ...(settings.showPODate !== false ? [{ key: "date", label: "Date", className: "app-col-action-90" }] : []),
      ...(settings.showPOStatus !== false ? [{ key: "status", label: "Status", className: "app-col-action-90" }] : []),
      ...(settings.showPOAmount !== false ? [{ key: "amount", label: "Sum", className: "app-col-action-90 text-end" }] : []),
      { key: "view", label: <span className="visually-hidden">View</span>, className: "app-col-action-56 text-center" },
    ];

    return (
      <>
      {!isViewControlled && (
        <div className="align-items-center d-flex flex-shrink-0 gap-2 justify-content-end mb-2">
          <button
            type="button"
            onClick={() => {
              resetCreateForm();
              setView("create");
              setDetailPoId(null);
            }}
            className="align-items-center btn btn-primary btn-sm d-inline-flex gap-1"
          >
            <PlusIcon style={{ width: 14, height: 14 }} />
            <span>New</span>
          </button>
        </div>
      )}

      <div className="app-page-scroll-surface d-flex flex-column-reverse flex-grow-1 min-h-0 overflow-auto">
        {settings.showPurchaseOrdersTable === false ? (
          <div className="align-items-center d-flex flex-grow-1 justify-content-center py-3 small text-center text-muted">
            The purchase-orders table is hidden in supplier page settings.
          </div>
        ) : (
          <Table responsive={false} className="app-main-page-table table-borderless table-hover w-100">
            <colgroup>
              {columns.map((column) => <col key={column.key} className={column.className} />)}
            </colgroup>
            <tbody>
              {purchaseOrders.length === 0 ? (
                <PageTableRow>
                  <td colSpan={columns.length} className="main-page-table-data py-2 small text-center text-muted">
                    No purchase orders yet.
                  </td>
                </PageTableRow>
              ) : (
                purchaseOrders.map((po) => (
                  <PageTableRow key={po.id}>
                    <td className="font-monospace main-page-table-data small">{po.po_number}</td>
                    {settings.showPODate !== false && (
                      <td className="main-page-table-data small">{po.order_date ? new Date(po.order_date).toLocaleDateString() : "—"}</td>
                    )}
                    {settings.showPOStatus !== false && (
                      <td className="main-page-table-data small text-capitalize">{String(po.status || "draft").replaceAll("_", " ")}</td>
                    )}
                    {settings.showPOAmount !== false && (
                      <td className="fw-medium main-page-table-data small text-end">{formatCurrency(po.total_amount)}</td>
                    )}
                    <td className="main-page-table-data text-center">
                      <button type="button" className="btn btn-bulk-circle btn-outline-secondary btn-sm p-0" title="View purchase order" onClick={() => openDetail(po)}>
                        <EyeIcon className="ui-icon-4" />
                      </button>
                    </td>
                  </PageTableRow>
                ))
              )}
            </tbody>
          </Table>
        )}
        {settings.showPurchaseOrdersTable !== false && <PageTableHeader columns={columns} />}
      </div>
      </>
    );
  };

  const content = (
    <div className={`d-flex flex-column min-h-0 h-100 ${embedded ? "procurement-ui--embedded" : ""}`}>
      {procurementError && !detailPoId && (
        <div className="alert alert-danger mb-2 py-1 small" role="alert">
          {procurementError}
        </div>
      )}
      {view === "create" ? renderCreateForm() : renderPoList()}

      <Modal
        isOpen={!!detailPoId}
        onClose={() => { setDetailPoId(null); setDetailPo(null); }}
        title={detailPo?.po_number || "Purchase order"}
        footer={
          <Footer_Actions
            center={
              <Button_Toolbar
                icon={XMarkIcon}
                label="Close"
                onClick={() => {
                  setDetailPoId(null);
                  setDetailPo(null);
                }}
                className="btn-outline-secondary"
                title="Close"
              />
            }
          />
        }
      >
        <div className="flex-grow-1 min-h-0 overflow-auto p-1">
            {procurementError && detailPoId && (
              <div className="alert alert-danger py-1 small" role="alert">
                {procurementError}
              </div>
            )}
            {detailLoading ? (
              <div className="py-1 small text-center text-muted">Loading…</div>
            ) : detailPo ? (
              <>
                <div className="g-2 mb-3 row small">
                  <div className="col-6">
                    <span className="text-muted">Date</span>
                    <div>{detailPo.order_date ? new Date(detailPo.order_date).toLocaleDateString() : "—"}</div>
                  </div>
                  <div className="col-6">
                    <span className="text-muted">Expected delivery</span>
                    <div>{detailPo.expected_delivery_date ? new Date(detailPo.expected_delivery_date).toLocaleDateString() : "—"}</div>
                  </div>
                  <div className="col-12">
                    <span className="text-muted">Sum</span>
                    <div className="fw-bold">{formatCurrency(detailPo.total_amount)}</div>
                  </div>
                  <div className="col-12">
                    <span className="text-muted">Status</span>
                    <div className="text-capitalize">{String(detailPo.status || "draft").replaceAll("_", " ")}</div>
                  </div>
                </div>
                {detailPo.status === "draft" && (
                  <button type="button" className="btn btn-outline-primary btn-sm mb-2" onClick={handleMarkSent} disabled={savingReceipt}>
                    {savingReceipt ? "Saving…" : "Mark as sent"}
                  </button>
                )}
                {["draft", "sent", "confirmed", "partially_received"].includes(detailPo.status) && (
                  <div className="align-items-center border d-flex flex-wrap gap-2 mb-2 p-2 rounded">
                    <Dropdown_Custom
                      className="form-select ui-control-sm flex-grow-1"
                      value={newPoLine.supplier_product_id}
                      onChange={(e) => {
                        const product = supplierProducts.find((row) => String(row.id) === String(e.target.value));
                        setNewPoLine((prev) => ({
                          ...prev,
                          supplier_product_id: e.target.value,
                          unit_price: num(product?.unit_price),
                        }));
                      }}
                      options={[
                        { value: "", label: "Add product…" },
                        ...supplierProducts.map((product) => ({ value: product.id, label: supplierProductLabel(product) })),
                      ]}
                    />
                    <InputNumber
                      min="1"
                      step="1"
                      className="form-control ui-control-sm"
                      style={{ width: 82 }}
                      value={newPoLine.quantity}
                      onChange={(e) => setNewPoLine((prev) => ({ ...prev, quantity: e.target.value }))}
                      aria-label="Quantity to add"
                    />
                    <InputNumber
                      min="0"
                      step="0.01"
                      className="form-control ui-control-sm"
                      style={{ width: 110 }}
                      value={newPoLine.unit_price}
                      onChange={(e) => setNewPoLine((prev) => ({ ...prev, unit_price: e.target.value }))}
                      aria-label="Purchase-unit price"
                    />
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm"
                      onClick={handleAddOpenPoLine}
                      disabled={savingReceipt || !newPoLine.supplier_product_id}
                    >
                      Add to order
                    </button>
                  </div>
                )}
                {detailPo.line_items?.length > 0 && (
                  <div className="border mb-3 rounded table-responsive">
                    <table className="mb-0 table table-sm">
                      <thead className="table-light">
                        <tr>
                          <th>Item</th>
                          <th className="text-end">Ordered</th>
                          <th className="text-end">Received</th>
                          <th className="text-end">Price / unit</th>
                          <th className="text-end">Line</th>
                          {["sent", "confirmed", "partially_received"].includes(detailPo.status) && <th className="text-end">Receive</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {detailPo.line_items.map((ln) => (
                          <tr key={ln.id}>
                            <td>{inventoryName(ln.inventory_id)}</td>
                            <td className="text-end">{ln.quantity_ordered} {ln.purchase_unit}</td>
                            <td className="text-end">{ln.quantity_received || 0}</td>
                            <td className="text-end">{formatCurrency(ln.unit_price)}</td>
                            <td className="text-end">{formatCurrency(ln.line_total)}</td>
                            {["sent", "confirmed", "partially_received"].includes(detailPo.status) && (
                              <td className="text-end">
                                <InputNumber
                                  min="0"
                                  max={Math.max(0, Number(ln.quantity_ordered) - Number(ln.quantity_received || 0))}
                                  step="1"
                                  className="form-control ui-control-sm text-end"
                                  style={{ width: 78 }}
                                  value={receiptQuantities[ln.id] ?? 0}
                                  onChange={(e) => setReceiptQuantities((prev) => ({ ...prev, [ln.id]: e.target.value }))}
                                  aria-label={`Quantity received for ${inventoryName(ln.inventory_id)}`}
                                />
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {["sent", "confirmed", "partially_received"].includes(detailPo.status) && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm mb-3"
                    onClick={handleReceiveItems}
                    disabled={savingReceipt || !Object.values(receiptQuantities).some((quantity) => num(quantity) > 0)}
                  >
                    {savingReceipt ? "Saving…" : "Receive selected quantities"}
                  </button>
                )}
                <div className="border-top pt-1">
                  <div className="align-items-center d-flex justify-content-between mb-2">
                    <span className="fw-semibold ui-text-sm">Documents</span>
                    <button type="button" className="align-items-center btn btn-outline-primary btn-sm d-inline-flex gap-1" onClick={() => setShowDocUpload(true)}>
                      <DocumentPlusIcon style={{ width: 14, height: 14 }} />
                      <span>Attach</span>
                    </button>
                  </div>
                  {linkedDocs.length === 0 ? (
                    <p className="mb-0 ui-small-muted">No documents linked.</p>
                  ) : (
                    <ul className="list-group list-group-flush small">
                      {linkedDocs.map((doc) => (
                        <li key={doc.id} className="align-items-center d-flex justify-content-between list-group-item px-0">
                          <span className="me-2 text-truncate">{doc.original_filename || doc.filename}</span>
                          <a href={documentsAPI.fileUrl(doc.id)} target="_blank" rel="noopener noreferrer" className="btn btn-link btn-sm flex-shrink-0">
                            Open
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            ) : (
              <p className="ui-small-muted">Could not load purchase order.</p>
            )}
        </div>
      </Modal>

      <Modal_DocumentUpload
        isOpen={showDocUpload}
        onClose={() => setShowDocUpload(false)}
        entityType="purchase_order"
        entityId={detailPoId}
        title="Attach document to purchase order"
        onUploaded={() => detailPoId && loadDetail(detailPoId)}
      />
    </div>
  );

  if (embedded) return content;

  const cancelButton = (label, onClick) => (
    <button
      type="button"
      className="btn btn-bulk-circle btn-outline-secondary btn-sm p-0"
      onClick={onClick}
      title={label}
      aria-label={label}
      disabled={loading}
    >
      <XMarkIcon style={{ width: 14, height: 14 }} />
    </button>
  );
  const modalFooter = view === "create" ? (
    <Footer_Actions
      start={
        <Button_Toolbar
          icon={PlusIcon}
          label="Add line"
          onClick={handleAddLineItem}
          className="btn-outline-primary"
          title="Add purchase-order line"
        />
      }
      center={cancelButton("Cancel", () => { setView("orders"); resetCreateForm(); })}
      end={
        <Button_Toolbar
          icon={CheckIcon}
          label={loading ? "Saving…" : "Save"}
          onClick={handleCreatePO}
          disabled={loading || formData.line_items.every((item) => !item.supplier_product_id)}
          className="btn-primary"
          title="Save purchase order"
        />
      }
    />
  ) : (
    <Footer_Actions
      start={
        <>
          {settings.showPurchaseOrderForm !== false && (
            <Button_Toolbar
              icon={PlusIcon}
              label="New"
              onClick={() => {
                resetCreateForm();
                setDetailPoId(null);
                setView("create");
              }}
              className="btn-primary"
              title="Create a purchase order"
            />
          )}
        </>
      }
      center={cancelButton("Close", onClose)}
    />
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={supplierName || supplier?.name || "Supplier"}
      fullScreen
      noPadding
      contentGravity="bottom"
      bodyClassName={view === "create" ? "pt-32" : ""}
      footer={modalFooter}
    >
      <div className="d-flex flex-column h-100 min-h-0 p-1">{content}</div>
    </Modal>
  );
};

export default Modal_Procurement;
