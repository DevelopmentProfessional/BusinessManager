/*
 * ============================================================
 * FILE: Modal_Item.jsx
 *
 * PURPOSE:
 *   Global modal for creating a new inventory item record, driven by the
 *   Zustand store's isAddInventoryModalOpen flag. On successful creation it
 *   adds the new item to the global store and fires an optional callback
 *   (e.g., to auto-select the item in Schedule production tasks).
 *
 * FUNCTIONAL PARTS:
 *   [1] Store Integration — Reads modal open state and actions from useStore
 *   [2] Submit Handler — POSTs new item via inventoryAPI, updates store, fires callback
 *   [3] Cancel Handler — Clears local error and closes the modal
 *   [4] Render — Wraps Form_Item inside the base Modal component
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-06-13 | GitHub Copilot | Created global add-item modal for production quick-create flows
 * ============================================================
 */
import React, { useState } from "react";
import useStore from "../../services/useStore";
import { inventoryAPI } from "../../services/api";
import Modal from "./Modal";
import Form_Item from "./Form_Item";

// ─── 1 STORE INTEGRATION ───────────────────────────────────────────────────
export default function Modal_Item() {
  const { isAddInventoryModalOpen, closeAddInventoryModal, addInventoryCallback, addInventoryPrefill, addInventory, clearError } = useStore();

  const [formError, setFormError] = useState(null);

  // ─── 2 SUBMIT HANDLER ────────────────────────────────────────────────────
  const handleSubmit = async (itemData) => {
    try {
      setFormError(null);
      const response = await inventoryAPI.create(itemData);
      const newItem = response?.data ?? response;

      addInventory(newItem);

      if (addInventoryCallback && typeof addInventoryCallback === "function") {
        addInventoryCallback(newItem);
      }

      closeAddInventoryModal();
      clearError();
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || "Failed to create item";
      setFormError(String(detail));
    }
  };

  // ─── 3 CANCEL HANDLER ────────────────────────────────────────────────────
  const handleCancel = () => {
    setFormError(null);
    closeAddInventoryModal();
  };

  // ─── 4 RENDER ─────────────────────────────────────────────────────────────
  const initialName = typeof addInventoryPrefill === "string" ? addInventoryPrefill : addInventoryPrefill?.name || "";

  return (
    <Modal isOpen={isAddInventoryModalOpen} onClose={handleCancel} noPadding={true} fullScreen={true} contentGravity="top">
      {isAddInventoryModalOpen && <Form_Item item={null} initialName={initialName} showScanner onCancel={handleCancel} onSubmit={handleSubmit} error={formError} />}
    </Modal>
  );
}
