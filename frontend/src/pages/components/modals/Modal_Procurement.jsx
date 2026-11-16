/**
 * Supplier product and purchase-order management.
 */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { InputNumber, InputTextarea, InputDate, InputText } from "../Inputs";
import { PlusIcon, XMarkIcon, CheckIcon, DocumentPlusIcon, EyeIcon } from "../../../icons";
import api, { inventoryAPI, documentsAPI, supplierProductsAPI } from "../../../services/api";
import { formatCurrency } from "../../../utils/formatters";
import Modal from "./Modal";
import Footer_Actions from "../footers/Footer_Actions";
import Button_Toolbar from "../buttons/Button_Toolbar";
import Modal_DocumentUpload from "./Modal_DocumentUpload";
import Dropdown_Custom from "../dropdowns/Dropdown_Custom";

const EMPTY_LINE = { supplier_product_id: "", inventory_id: "", quantity_ordered: 1, unit_price: 0 };

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const getErrorMessage = (error, fallback) =>
  String(error?.response?.data?.detail || error?.message || fallback);

const Modal_Procurement = ({ supplierId, embedded = true, initialCreate = false, onPOCreated }) => {
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(initialCreate);
  const [showProducts, setShowProducts] = useState(false);
  const [supplierProducts, setSupplierProducts] = useState([]);
  const [catalogForm, setCatalogForm] = useState({
    inventory_id: "",
    purchase_unit: "unit",
    units_per_purchase_unit: 1,
    unit_price: 0,
    is_preferred: false,
  });
  const [savingCatalog, setSavingCatalog] = useState(false);
  const [procurementError, setProcurementError] = useState("");
  const [detailPoId, setDetailPoId] = useState(null);
  const [detailPo, setDetailPo] = useState(null);
  const [receiptQuantities, setReceiptQuantities] = useState({});
  const [savingReceipt, setSavingReceipt] = useState(false);
  const [newPoLine, setNewPoLine] = useState({ supplier_product_id: "", quantity: 1, unit_price: 0 });
  const [detailLoading, setDetailLoading] = useState(false);
  const [linkedDocs, setLinkedDocs] = useState([]);
  const [showDocUpload, setShowDocUpload] = useState(false);
  const [formData, setFormData] = useState({
    line_items: [{ ...EMPTY_LINE }],
    expected_delivery_date: "",
    notes: "",
    import_tax: "",
    shipping_cost: "",
  });

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
    loadSupplierProducts();
  }, [loadPurchaseOrders, loadInventoryItems, loadSupplierProducts]);

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

  const orderTotal = useMemo(() => lineSubtotal + num(formData.import_tax) + num(formData.shipping_cost), [lineSubtotal, formData.import_tax, formData.shipping_cost]);

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
      import_tax: "",
      shipping_cost: "",
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

  const handleSaveCatalogProduct = async () => {
    if (!catalogForm.inventory_id || !catalogForm.purchase_unit.trim()) return;
    setProcurementError("");
    try {
      setSavingCatalog(true);
      await supplierProductsAPI.save({
        ...catalogForm,
        supplier_id: supplierId,
        units_per_purchase_unit: Math.max(1, Math.round(num(catalogForm.units_per_purchase_unit))),
        unit_price: Math.max(0, num(catalogForm.unit_price)),
      });
      setCatalogForm({
        inventory_id: "",
        purchase_unit: "unit",
        units_per_purchase_unit: 1,
        unit_price: 0,
        is_preferred: false,
      });
      await loadSupplierProducts();
    } catch (error) {
      console.error("Failed to save supplier catalog item:", error);
      setProcurementError(getErrorMessage(error, "Failed to save supplier catalog item."));
    } finally {
      setSavingCatalog(false);
    }
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
        import_tax: num(formData.import_tax),
        shipping_cost: num(formData.shipping_cost),
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
      setShowCreate(false);
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

  const renderCatalog = () => {
    const availableItems = inventoryItems;
    const editingProduct = supplierProducts.find(
      (product) => String(product.inventory_id) === String(catalogForm.inventory_id)
    );
    return (
      <div className="d-flex flex-column flex-grow-1 min-h-0">
        <div className="align-items-center d-flex flex-shrink-0 justify-content-between mb-2">
          <span className="fw-semibold small text-muted">{editingProduct ? "Edit supplier product" : "Supplier products"}</span>
          <button type="button" className="btn ui-btn-outline-secondary-sm" onClick={() => setShowProducts(false)}>Done</button>
        </div>
        <div className="flex-grow-1 min-h-0 overflow-auto">
          <div className="border mb-2 p-2 rounded">
            <div className="mb-2">
              <Dropdown_Custom
                className="form-select ui-control-sm"
                value={catalogForm.inventory_id}
                onChange={(e) => setCatalogForm((prev) => ({ ...prev, inventory_id: e.target.value }))}
                options={[
                  { value: "", label: "Select inventory item…" },
                  ...availableItems.map((item) => ({ value: item.id, label: item.name })),
                ]}
              />
            </div>
            <div className="align-items-end d-flex flex-wrap gap-2">
              <div className="flex-grow-1" style={{ minWidth: 105 }}>
                <InputText
                  aria-label="Purchase unit"
                  className="form-control ui-control-sm"
                  value={catalogForm.purchase_unit}
                  onChange={(e) => setCatalogForm((prev) => ({ ...prev, purchase_unit: e.target.value }))}
                  placeholder="Purchase unit"
                />
              </div>
              <div style={{ width: 110 }}>
                <InputNumber
                  min="1"
                  step="1"
                  className="form-control ui-control-sm"
                  value={catalogForm.units_per_purchase_unit}
                  onChange={(e) => setCatalogForm((prev) => ({ ...prev, units_per_purchase_unit: e.target.value }))}
                  aria-label="Stock units per purchase unit"
                  title="Stock units per purchase unit"
                />
              </div>
              <div style={{ width: 120 }}>
                <InputNumber
                  min="0"
                  step="0.01"
                  className="form-control ui-control-sm"
                  value={catalogForm.unit_price}
                  onChange={(e) => setCatalogForm((prev) => ({ ...prev, unit_price: e.target.value }))}
                  aria-label="Supplier price per purchase unit"
                  title="Supplier price per purchase unit"
                />
              </div>
              <button
                type="button"
                className="align-items-center btn btn-primary btn-sm d-inline-flex gap-1"
                onClick={handleSaveCatalogProduct}
                disabled={savingCatalog || !catalogForm.inventory_id || !catalogForm.purchase_unit.trim()}
              >
                <PlusIcon style={{ width: 14, height: 14 }} />
                <span>{savingCatalog ? "Saving…" : editingProduct ? "Update" : "Add"}</span>
              </button>
            </div>
            <div className="form-check mt-2">
              <input
                className="form-check-input"
                id={`supplier-preferred-${supplierId}`}
                type="checkbox"
                checked={catalogForm.is_preferred}
                onChange={(e) => setCatalogForm((prev) => ({ ...prev, is_preferred: e.target.checked }))}
              />
              <label className="form-check-label small" htmlFor={`supplier-preferred-${supplierId}`}>Preferred supplier for this item</label>
            </div>
          </div>
          {supplierProducts.length === 0 ? (
            <p className="small text-center text-muted">No products in this supplier catalog yet.</p>
          ) : (
            <table className="align-middle mb-0 table table-sm">
              <thead className="table-light">
                <tr><th>Item</th><th>Pack</th><th className="text-end">Price</th><th>Preferred</th><th /></tr>
              </thead>
              <tbody>
                {supplierProducts.map((product) => (
                  <tr key={product.id}>
                    <td>{product.inventory_name}</td>
                    <td>{product.units_per_purchase_unit} stock units / {product.purchase_unit}</td>
                    <td className="text-end">{formatCurrency(product.unit_price)}</td>
                    <td>{product.is_preferred ? "Yes" : "—"}</td>
                    <td className="text-end">
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => setCatalogForm({
                          inventory_id: product.inventory_id,
                          purchase_unit: product.purchase_unit,
                          units_per_purchase_unit: product.units_per_purchase_unit,
                          unit_price: product.unit_price,
                          is_preferred: product.is_preferred,
                        })}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  };

  const openDetail = (po) => {
    setDetailPoId(po.id);
    setShowCreate(false);
  };

  const renderCreateForm = () => (
    <div className="d-flex flex-column flex-grow-1 min-h-0">
      <div className="align-items-center d-flex flex-shrink-0 gap-2 justify-content-between mb-2">
        <span className="fw-semibold small text-muted">Create purchase order</span>
        <button type="button" className="btn ui-btn-outline-secondary-sm" onClick={() => { setShowCreate(false); resetCreateForm(); }}>
          Cancel
        </button>
      </div>
      <div className="flex-grow-1 min-h-0 overflow-auto pe-1">
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

        <div className="border mb-2 rounded table-responsive">
          <table className="mb-0 table table-sm">
            <thead className="table-light">
              <tr>
                <th>Item</th>
                <th style={{ width: 72 }}>Packs</th>
                <th style={{ width: 96 }}>Pack price</th>
                <th className="text-end" style={{ width: 80 }}>
                  Line
                </th>
                <th style={{ width: 36 }} />
              </tr>
            </thead>
            <tbody>
              {formData.line_items.map((item, idx) => (
                <tr key={idx}>
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
                  <td>
                    {formData.line_items.length > 1 && (
                      <button type="button" className="btn btn-bulk-circle btn-outline-danger btn-sm p-0" onClick={() => handleRemoveLineItem(idx)} title="Remove line">
                        <XMarkIcon style={{ width: 14, height: 14 }} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="small text-end text-muted">
                  Subtotal
                </td>
                <td className="fw-medium small text-end">{formatCurrency(lineSubtotal)}</td>
                <td />
              </tr>
              <tr>
                <td colSpan={2} className="small text-end">
                  Import tax
                </td>
                <td>
                  <InputNumber min="0" step="0.01" className="form-control ui-control-sm" value={formData.import_tax} onChange={(e) => setFormData((p) => ({ ...p, import_tax: e.target.value }))} placeholder="0" />
                </td>
                <td colSpan={2} />
              </tr>
              <tr>
                <td colSpan={2} className="small text-end">
                  Shipping
                </td>
                <td>
                  <InputNumber min="0" step="0.01" className="form-control ui-control-sm" value={formData.shipping_cost} onChange={(e) => setFormData((p) => ({ ...p, shipping_cost: e.target.value }))} placeholder="0" />
                </td>
                <td colSpan={2} />
              </tr>
              <tr className="table-light">
                <td colSpan={3} className="fw-semibold small text-end">
                  Sum
                </td>
                <td className="fw-bold small text-end">{formatCurrency(orderTotal)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        <button type="button" onClick={handleAddLineItem} className="align-items-center btn btn-outline-primary btn-sm d-inline-flex gap-1 mb-2">
          <PlusIcon style={{ width: 14, height: 14 }} />
          <span>Add line</span>
        </button>

        <div className="form-floating ui-form-floating-mb2">
          <InputTextarea className="form-control ui-control-sm" style={{ minHeight: 64 }} id={`po_notes_${supplierId}`} value={formData.notes} onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))} placeholder="Notes" />
          <label htmlFor={`po_notes_${supplierId}`}>Notes</label>
        </div>
      </div>
      <div className="border-top d-flex flex-shrink-0 gap-2 justify-content-start pt-0">
        <button type="button" className="align-items-center btn btn-primary btn-sm d-inline-flex gap-1" onClick={handleCreatePO} disabled={loading || formData.line_items.every((i) => !i.supplier_product_id)}>
          <CheckIcon style={{ width: 14, height: 14 }} />
          <span>{loading ? "Saving…" : "Save"}</span>
        </button>
        <button type="button" className="btn ui-btn-outline-secondary-sm" onClick={() => { setShowCreate(false); resetCreateForm(); }} disabled={loading}>
          Cancel
        </button>
      </div>
    </div>
  );

  const renderPoList = () => (
    <>
      <div className="align-items-center d-flex flex-shrink-0 gap-2 justify-content-end mb-2">
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setShowProducts(true)}>
          Products ({supplierProducts.length})
        </button>
        <button
          type="button"
          onClick={() => {
            resetCreateForm();
            setShowCreate(true);
            setDetailPoId(null);
          }}
          className="align-items-center btn btn-primary btn-sm d-inline-flex gap-1"
        >
          <PlusIcon style={{ width: 14, height: 14 }} />
          <span>New</span>
        </button>
      </div>

      <div className="flex-grow-1 min-h-0 overflow-auto">
        <table className="align-middle mb-0 table table-hover table-sm">
          <thead className="sticky-top table-light">
            <tr>
              <th className="pe-1 ps-1">PO#</th>
              <th className="px-1">Date</th>
              <th className="px-1">Status</th>
              <th className="px-1 text-end">Sum</th>
              <th className="pe-1 text-end" style={{ width: 44 }}>
                <span className="visually-hidden">View</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {purchaseOrders.length === 0 ? (
              <tr>
                <td colSpan={5} className="ps-1 py-1 small text-center text-muted">
                  No purchase orders yet.
                </td>
              </tr>
            ) : (
              purchaseOrders.map((po) => (
                <tr key={po.id}>
                  <td className="font-monospace pe-1 ps-1 small">{po.po_number}</td>
                  <td className="px-1 small">{po.order_date ? new Date(po.order_date).toLocaleDateString() : "—"}</td>
                  <td className="px-1 small text-capitalize">{String(po.status || "draft").replaceAll("_", " ")}</td>
                  <td className="fw-medium px-1 small text-end">{formatCurrency(po.total_amount)}</td>
                  <td className="pe-1 text-end">
                    <button type="button" className="btn btn-bulk-circle btn-outline-secondary btn-sm p-0" title="View purchase order" onClick={() => openDetail(po)}>
                      <EyeIcon style={{ width: 14, height: 14 }} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );

  return (
    <div className={`d-flex flex-column min-h-0 h-100 ${embedded ? "procurement-ui--embedded" : ""}`}>
      {procurementError && !detailPoId && (
        <div className="alert alert-danger mb-2 py-1 small" role="alert">
          {procurementError}
        </div>
      )}
      {showCreate ? renderCreateForm() : showProducts ? renderCatalog() : renderPoList()}

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
                      aria-label="Pack price"
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
                          <th className="text-end">Pack price</th>
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
};

export default Modal_Procurement;
