import React, { useCallback, useEffect, useMemo, useState } from "react";
import Dropdown_Custom from "../dropdowns/Dropdown_Custom";
import Table from "../tables/Table";
import { CheckIcon, PencilSquareIcon, PlusIcon, XMarkIcon } from "../../../icons";
import { inventoryAPI, supplierProductsAPI } from "../../../services/api";
import { showConfirm } from "../../../services/showConfirm";
import Modal_Detail_Item from "../modals/Modal_ItemDetail";
import useStore from "../../../services/useStore";

const EMPTY_FORM = {
  inventory_id: "",
  is_preferred: false,
};

const errorMessage = (error, fallback) =>
  String(error?.response?.data?.detail || error?.message || fallback);

export default function Panel_SupplierProducts({ supplierId, settings = {} }) {
  const hasPermission = useStore((state) => state.hasPermission);
  const openAddInventoryModal = useStore((state) => state.openAddInventoryModal);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [supplierProducts, setSupplierProducts] = useState([]);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [editingProductId, setEditingProductId] = useState(null);
  const [inventoryItemToEdit, setInventoryItemToEdit] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [inventoryResponse, productsResponse] = await Promise.all([
        inventoryAPI.getAll(),
        supplierProductsAPI.getBySupplier(supplierId),
      ]);
      const inventory = inventoryResponse?.data ?? inventoryResponse;
      const products = productsResponse?.data ?? productsResponse;
      if (!Array.isArray(inventory) || !Array.isArray(products)) {
        throw new Error("Invalid supplier product data received.");
      }
      setInventoryItems(inventory);
      setSupplierProducts(products);
    } catch (loadError) {
      setError(errorMessage(loadError, "Failed to load supplier products."));
    } finally {
      setLoading(false);
    }
  }, [supplierId]);

  useEffect(() => {
    void load();
  }, [load]);

  const availableItems = useMemo(() => {
    const linkedIds = new Set(supplierProducts.map((product) => String(product.inventory_id)));
    return inventoryItems.filter(
      (item) => !linkedIds.has(String(item.id)) || String(item.id) === String(formData.inventory_id)
    );
  }, [formData.inventory_id, inventoryItems, supplierProducts]);

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setEditingProductId(null);
  };

  const handleSelectInventory = (event) => {
    setFormData((previous) => ({ ...previous, inventory_id: event.target.value }));
  };

  const handleCreateInventoryFromSearch = (searchTerm) => {
    openAddInventoryModal((newItem) => {
      setInventoryItems((prev) => [...prev, newItem]);
      setFormData((prev) => ({ ...prev, inventory_id: newItem.id }));
    }, searchTerm);
  };

  const handleEdit = (product) => {
    setEditingProductId(product.id);
    setFormData({
      inventory_id: product.inventory_id,
      is_preferred: Boolean(product.is_preferred),
    });
    setError("");
  };

  const handleOpenInventoryItem = (product) => {
    setError("");
    if (!hasPermission("inventory", "write")) {
      setError("You do not have permission to edit inventory items.");
      return;
    }

    const inventoryItem = inventoryItems.find((item) => String(item.id) === String(product.inventory_id));
    if (!inventoryItem) {
      setError("Inventory item details are unavailable.");
      return;
    }
    setInventoryItemToEdit(inventoryItem);
  };

  const handleUpdateInventoryItem = async (inventoryId, updateData) => {
    if (!hasPermission("inventory", "write")) {
      throw new Error("You do not have permission to edit inventory items.");
    }
    await inventoryAPI.update(inventoryId, updateData);
    setInventoryItemToEdit(null);
    await load();
  };

  const handleSave = async () => {
    if (!formData.inventory_id) {
      setError("Select an inventory item to link.");
      return;
    }
    if (!editingProductId && supplierProducts.some((product) => String(product.inventory_id) === String(formData.inventory_id))) {
      setError("This inventory item is already linked to this supplier.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const response = await supplierProductsAPI.save({
        ...formData,
        supplier_id: supplierId,
      });
      if (!(response?.data ?? response)?.id) {
        throw new Error("The supplier product was saved without an ID.");
      }
      resetForm();
      await load();
    } catch (saveError) {
      setError(errorMessage(saveError, "Failed to save supplier product."));
    } finally {
      setSaving(false);
    }
  };

  const handleUnlink = async (product) => {
    const confirmed = await showConfirm(
      `Unlink ${product.inventory_name || "this product"} from this supplier? Purchase-order history will be retained.`,
      { confirmLabel: "Unlink" }
    );
    if (!confirmed) return;

    setDeletingProductId(product.id);
    setError("");
    try {
      await supplierProductsAPI.delete(product.id);
      if (String(editingProductId) === String(product.id)) resetForm();
      await load();
    } catch (deleteError) {
      setError(errorMessage(deleteError, "Failed to unlink supplier product."));
    } finally {
      setDeletingProductId(null);
    }
  };

  return (
    <>
      <section className="border mt-2 p-2 rounded" aria-label="Supplier products">
        <div className="align-items-center d-flex justify-content-between mb-2">
          <h6 className="fw-semibold mb-0">Products supplied</h6>
          {loading && <span className="spinner-border spinner-border-sm" role="status" aria-label="Loading supplier products" />}
        </div>

        {error && <div className="alert alert-danger mb-2 py-1 small" role="alert">{error}</div>}

        {settings.showProductsTable === false ? (
          <div className="small text-muted">The products table is hidden in supplier page settings.</div>
        ) : (
          <div className="mb-2 overflow-auto" style={{ maxHeight: "12rem" }}>
            <Table responsive={false} className="align-middle table-sm" style={{ tableLayout: "fixed", width: "100%" }}>
              <colgroup>
                <col style={{ width: "2rem" }} />
                <col />
                <col style={{ width: "2rem" }} />
                <col style={{ width: "2rem" }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="p-1 text-center"><span className="visually-hidden">Unlink</span></th>
                  <th className="p-1">Item</th>
                  <th className="p-1 text-center"><span className="visually-hidden">Preferred supplier</span></th>
                  <th className="p-1 text-center"><span className="visually-hidden">Edit supplier product</span></th>
                </tr>
              </thead>
              <tbody>
                {supplierProducts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-2 small text-center text-muted">
                      {loading ? "Loading products…" : "No products linked to this supplier yet."}
                    </td>
                  </tr>
                ) : (
                  supplierProducts.map((product) => (
                    <tr key={product.id}>
                      <td className="p-1 text-center">
                        <button
                          type="button"
                          className="align-items-center btn btn-unstyled d-inline-flex justify-content-center p-1 text-danger"
                          onClick={() => handleUnlink(product)}
                          disabled={deletingProductId === product.id}
                          title={`Unlink ${product.inventory_name}`}
                          aria-label={`Unlink ${product.inventory_name}`}
                        >
                          <XMarkIcon className="ui-icon-4" />
                        </button>
                      </td>
                      <td className="p-1 text-break">
                        <button
                          type="button"
                          className="btn btn-link p-0 text-start text-decoration-none"
                          onClick={() => handleOpenInventoryItem(product)}
                          title={`Edit inventory item ${product.inventory_name}`}
                          aria-label={`Edit inventory item ${product.inventory_name}`}
                        >
                          {product.inventory_name || "—"}
                        </button>
                      </td>
                      <td className="p-1 text-center">
                        <span
                          className={`align-items-center border d-inline-flex justify-content-center rounded-1 ${product.is_preferred ? "border-success text-success" : "border-secondary text-muted"}`}
                          style={{ height: "1rem", width: "1rem" }}
                          role="img"
                          aria-label={product.is_preferred ? "Preferred supplier" : "Not preferred supplier"}
                          title={product.is_preferred ? "Preferred supplier" : "Not preferred supplier"}
                        >
                          {product.is_preferred && <CheckIcon className="ui-icon-4" />}
                        </span>
                      </td>
                      <td className="p-1 text-center">
                        <button
                          type="button"
                          className="align-items-center btn btn-unstyled d-inline-flex justify-content-center p-1 text-secondary"
                          onClick={() => handleEdit(product)}
                          title={`Edit supplier product link ${product.inventory_name}`}
                          aria-label={`Edit supplier product link ${product.inventory_name}`}
                        >
                          <PencilSquareIcon className="ui-icon-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        )}

        <div className="border-top pt-2">
          <div className="row g-2">
          <div className="col-12">
            <Dropdown_Custom
              id={`supplier-product-inventory-${supplierId}`}
              floatingLabel="Inventory item"
              value={formData.inventory_id}
              onChange={handleSelectInventory}
              disabled={saving || loading}
              options={[
                { value: "", label: "Select inventory item…" },
                ...availableItems.map((item) => ({ value: item.id, label: item.name })),
              ]}
              searchable
              onCreateFromSearch={handleCreateInventoryFromSearch}
              createButtonTitle="Add item"
            />
          </div>
          <div className="col-12">
            <div className="form-check">
              <input
                id={`supplier-product-preferred-${supplierId}`}
                type="checkbox"
                className="form-check-input"
                checked={formData.is_preferred}
                onChange={(event) => setFormData((previous) => ({ ...previous, is_preferred: event.target.checked }))}
                disabled={saving}
              />
              <label className="form-check-label small" htmlFor={`supplier-product-preferred-${supplierId}`}>
                Preferred supplier for this item
              </label>
            </div>
          </div>
          <div className="col-12 d-flex justify-content-end gap-2">
            {editingProductId && (
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={resetForm} disabled={saving}>
                Cancel edit
              </button>
            )}
            <button
              type="button"
              className="align-items-center btn btn-primary btn-sm d-inline-flex gap-1"
              onClick={handleSave}
              disabled={saving || loading || !formData.inventory_id}
            >
              {editingProductId ? <CheckIcon className="ui-icon-4" /> : <PlusIcon className="ui-icon-4" />}
              <span>{saving ? "Saving…" : editingProductId ? "Save changes" : "Add product"}</span>
            </button>
          </div>
          </div>
        </div>
      </section>
      <Modal_Detail_Item
        isOpen={Boolean(inventoryItemToEdit)}
        onClose={() => setInventoryItemToEdit(null)}
        item={inventoryItemToEdit}
        itemType={inventoryItemToEdit?.type || "product"}
        mode="inventory"
        onUpdateInventory={handleUpdateInventoryItem}
        onStockAdjusted={load}
        onDelete={null}
        canDelete={false}
        existingSkus={inventoryItems.map((item) => item.sku).filter(Boolean)}
      />
    </>
  );
}
