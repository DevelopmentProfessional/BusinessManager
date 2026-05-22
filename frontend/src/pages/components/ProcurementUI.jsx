/**
 * Procurement order management for a supplier (Inventory → Suppliers → Procurement).
 */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { PlusIcon, XMarkIcon, CheckIcon, DocumentPlusIcon, EyeIcon, TrashIcon } from "@heroicons/react/24/outline";
import api, { inventoryAPI, documentsAPI } from "../../services/api";
import { formatCurrency } from "../../utils/formatters";
import Modal from "./Modal";
import Footer_Actions from "./Footer_Actions";
import Button_Toolbar from "./Button_Toolbar";
import Modal_Document_Upload from "./Modal_Document_Upload";

const EMPTY_LINE = { inventory_id: "", quantity_ordered: 1, unit_price: 0 };

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const ProcurementUI = ({ supplierId, onPOCreated }) => {
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [detailPoId, setDetailPoId] = useState(null);
  const [detailPo, setDetailPo] = useState(null);
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
    }
  }, [supplierId]);

  const loadInventoryItems = useCallback(async () => {
    try {
      const response = await inventoryAPI.getAll();
      setInventoryItems(response?.data ?? response ?? []);
    } catch (error) {
      console.error("Failed to load inventory:", error);
    }
  }, []);

  useEffect(() => {
    loadPurchaseOrders();
    loadInventoryItems();
  }, [loadPurchaseOrders, loadInventoryItems]);

  const loadDetail = async (poId) => {
    setDetailLoading(true);
    try {
      const poRes = await api.get(`/purchase-orders/${poId}`);
      setDetailPo(poRes?.data ?? null);
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
      if (field === "inventory_id") {
        next.inventory_id = value;
        const inv = inventoryItems.find((i) => String(i.id) === String(value));
        if (inv && (next.unit_price === 0 || next.unit_price === "")) {
          next.unit_price = num(inv.cost ?? inv.price ?? 0);
        }
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
    const validLines = formData.line_items.filter((i) => i.inventory_id);
    if (validLines.length === 0) return;
    try {
      setLoading(true);
      const payload = {
        supplier_id: supplierId,
        expected_delivery_date: formData.expected_delivery_date || null,
        notes: formData.notes || null,
        import_tax: num(formData.import_tax),
        shipping_cost: num(formData.shipping_cost),
        items: validLines.map((item) => ({
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
    } finally {
      setLoading(false);
    }
  };

  const openDetail = (po) => {
    setDetailPoId(po.id);
    setShowCreate(false);
  };

  return (
    <div className="d-flex flex-column min-h-0 h-100 pe-0">
      <div className="d-flex align-items-center justify-content-between gap-2 mb-2 flex-shrink-0">
        <h6 className="mb-0 fw-semibold">Procurement</h6>
        <button type="button" onClick={() => { resetCreateForm(); setShowCreate(true); setDetailPoId(null); }} className="btn btn-primary btn-sm d-inline-flex align-items-center gap-1">
          <PlusIcon style={{ width: 16, height: 16 }} />
          <span>New</span>
        </button>
      </div>

      <div className="flex-grow-1 overflow-auto min-h-0" style={{ maxHeight: "min(50vh, 20rem)" }}>
        <table className="table table-sm table-hover mb-0 align-middle">
          <thead className="table-light sticky-top">
            <tr>
              <th className="ps-2 pe-1">PO Number</th>
              <th className="px-1">Order date</th>
              <th className="text-end px-1">Total</th>
              <th className="text-end pe-2" style={{ width: 48 }}>
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {purchaseOrders.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center text-muted small py-4 ps-2">
                  No purchase orders yet.
                </td>
              </tr>
            ) : (
              purchaseOrders.map((po) => (
                <tr key={po.id}>
                  <td className="ps-2 pe-1 font-monospace small">{po.po_number}</td>
                  <td className="px-1 small">{po.order_date ? new Date(po.order_date).toLocaleDateString() : "—"}</td>
                  <td className="text-end px-1 small fw-medium">{formatCurrency(po.total_amount)}</td>
                  <td className="text-end pe-2">
                    <button type="button" className="btn btn-sm btn-outline-secondary btn-bulk-circle p-0" title="View purchase order" onClick={() => openDetail(po)}>
                      <EyeIcon style={{ width: 16, height: 16 }} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create PO — matches supplier panel modal pattern */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} fullScreen noPadding>
        <div className="d-flex flex-column bg-white dark:bg-gray-900 min-h-0" style={{ minHeight: "100%" }}>
          <div className="flex-shrink-0 p-2 border-bottom">
            <h6 className="mb-0 fw-semibold">Create purchase order</h6>
          </div>
          <div className="flex-grow-1 overflow-auto p-3 min-h-0">
            <div className="form-floating mb-3">
              <input
                type="date"
                id="po_expected_delivery"
                className="form-control form-control-sm"
                value={formData.expected_delivery_date}
                onChange={(e) => setFormData((p) => ({ ...p, expected_delivery_date: e.target.value }))}
              />
              <label htmlFor="po_expected_delivery">Expected delivery date</label>
            </div>

            <div className="table-responsive border rounded mb-3">
              <table className="table table-sm mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Item</th>
                    <th style={{ width: 88 }}>Qty</th>
                    <th style={{ width: 110 }}>Unit price</th>
                    <th className="text-end" style={{ width: 96 }}>
                      Line total
                    </th>
                    <th style={{ width: 40 }} />
                  </tr>
                </thead>
                <tbody>
                  {formData.line_items.map((item, idx) => (
                    <tr key={idx}>
                      <td>
                        <select className="form-select form-select-sm" value={item.inventory_id} onChange={(e) => handleLineItemChange(idx, "inventory_id", e.target.value)}>
                          <option value="">Select item…</option>
                          {inventoryItems.map((inv) => (
                            <option key={inv.id} value={inv.id}>
                              {inv.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input type="number" min="1" className="form-control form-control-sm" value={item.quantity_ordered} onChange={(e) => handleLineItemChange(idx, "quantity_ordered", e.target.value)} />
                      </td>
                      <td>
                        <input type="number" min="0" step="0.01" className="form-control form-control-sm" value={item.unit_price} onChange={(e) => handleLineItemChange(idx, "unit_price", e.target.value)} />
                      </td>
                      <td className="text-end small fw-medium">{formatCurrency(num(item.quantity_ordered) * num(item.unit_price))}</td>
                      <td>
                        {formData.line_items.length > 1 && (
                          <button type="button" className="btn btn-sm btn-outline-danger btn-bulk-circle p-0" onClick={() => handleRemoveLineItem(idx)} title="Remove line">
                            <TrashIcon style={{ width: 14, height: 14 }} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} className="text-end small text-muted">
                      Subtotal
                    </td>
                    <td className="text-end small fw-medium">{formatCurrency(lineSubtotal)}</td>
                    <td />
                  </tr>
                  <tr>
                    <td colSpan={2} className="text-end small">
                      Import tax (optional)
                    </td>
                    <td>
                      <input type="number" min="0" step="0.01" className="form-control form-control-sm" value={formData.import_tax} onChange={(e) => setFormData((p) => ({ ...p, import_tax: e.target.value }))} placeholder="0" />
                    </td>
                    <td />
                    <td />
                  </tr>
                  <tr>
                    <td colSpan={2} className="text-end small">
                      Shipping (optional)
                    </td>
                    <td>
                      <input type="number" min="0" step="0.01" className="form-control form-control-sm" value={formData.shipping_cost} onChange={(e) => setFormData((p) => ({ ...p, shipping_cost: e.target.value }))} placeholder="0" />
                    </td>
                    <td />
                    <td />
                  </tr>
                  <tr className="table-light">
                    <td colSpan={3} className="text-end fw-semibold">
                      Total
                    </td>
                    <td className="text-end fw-bold">{formatCurrency(orderTotal)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="d-flex justify-content-start mb-3">
              <button type="button" onClick={handleAddLineItem} className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1">
                <PlusIcon style={{ width: 16, height: 16 }} />
                <span>Add</span>
              </button>
            </div>

            <div className="form-floating">
              <textarea className="form-control form-control-sm" style={{ minHeight: 72 }} id="po_notes" value={formData.notes} onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))} placeholder="Notes" />
              <label htmlFor="po_notes">Notes</label>
            </div>
          </div>
          <div className="flex-shrink-0 border-top app-footer-padding">
            <Footer_Actions
              start={<Button_Toolbar icon={CheckIcon} label={loading ? "Saving…" : "Save"} onClick={handleCreatePO} className="btn-primary" disabled={loading || formData.line_items.every((i) => !i.inventory_id)} title="Save purchase order" />}
              center={<Button_Toolbar icon={XMarkIcon} label="Close" onClick={() => setShowCreate(false)} className="btn-outline-secondary" disabled={loading} title="Close" />}
            />
          </div>
        </div>
      </Modal>

      {/* PO detail */}
      <Modal isOpen={!!detailPoId} onClose={() => { setDetailPoId(null); setDetailPo(null); }} fullScreen noPadding>
        <div className="d-flex flex-column bg-white dark:bg-gray-900 min-h-0" style={{ minHeight: "100%" }}>
          <div className="flex-shrink-0 p-2 border-bottom">
            <h6 className="mb-0 fw-semibold">{detailPo?.po_number || "Purchase order"}</h6>
          </div>
          <div className="flex-grow-1 overflow-auto p-3 min-h-0">
            {detailLoading ? (
              <div className="text-center py-4 text-muted small">Loading…</div>
            ) : detailPo ? (
              <>
                <div className="row g-2 mb-3 small">
                  <div className="col-6">
                    <span className="text-muted">Order date</span>
                    <div>{detailPo.order_date ? new Date(detailPo.order_date).toLocaleDateString() : "—"}</div>
                  </div>
                  <div className="col-6">
                    <span className="text-muted">Expected delivery</span>
                    <div>{detailPo.expected_delivery_date ? new Date(detailPo.expected_delivery_date).toLocaleDateString() : "—"}</div>
                  </div>
                  <div className="col-12">
                    <span className="text-muted">Total</span>
                    <div className="fw-bold">{formatCurrency(detailPo.total_amount)}</div>
                  </div>
                </div>
                {detailPo.line_items?.length > 0 && (
                  <div className="table-responsive border rounded mb-3">
                    <table className="table table-sm mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Item</th>
                          <th className="text-end">Qty</th>
                          <th className="text-end">Unit</th>
                          <th className="text-end">Line</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailPo.line_items.map((ln) => (
                          <tr key={ln.id}>
                            <td>{inventoryName(ln.inventory_id)}</td>
                            <td className="text-end">{ln.quantity_ordered}</td>
                            <td className="text-end">{formatCurrency(ln.unit_price)}</td>
                            <td className="text-end">{formatCurrency(ln.line_total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="border-top pt-3">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span className="fw-semibold small">Documents</span>
                    <button type="button" className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1" onClick={() => setShowDocUpload(true)}>
                      <DocumentPlusIcon style={{ width: 16, height: 16 }} />
                      <span>Attach</span>
                    </button>
                  </div>
                  {linkedDocs.length === 0 ? (
                    <p className="text-muted small mb-0">No documents linked. Attach invoices or supporting files.</p>
                  ) : (
                    <ul className="list-group list-group-flush small">
                      {linkedDocs.map((doc) => (
                        <li key={doc.id} className="list-group-item px-0 d-flex justify-content-between align-items-center">
                          <span className="text-truncate me-2">{doc.original_filename || doc.filename}</span>
                          <a href={documentsAPI.fileUrl(doc.id)} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-link flex-shrink-0">
                            Open
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            ) : (
              <p className="text-muted small">Could not load purchase order.</p>
            )}
          </div>
          <div className="flex-shrink-0 border-top app-footer-padding">
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
          </div>
        </div>
      </Modal>

      <Modal_Document_Upload
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

export default ProcurementUI;
