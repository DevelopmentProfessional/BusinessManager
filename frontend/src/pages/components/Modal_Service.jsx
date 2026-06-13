/*
 * ============================================================
 * FILE: Modal_Service.jsx
 *
 * PURPOSE:
 *   Global modal for creating a new service record, driven by the Zustand
 *   store's isAddServiceModalOpen flag. On successful creation it adds the
 *   new service to the global store and fires an optional callback (e.g.,
 *   to auto-select the service in Schedule).
 *
 * FUNCTIONAL PARTS:
 *   [1] Store Integration — Reads modal open state and actions from useStore
 *   [2] Submit Handler — POSTs new service via servicesAPI, updates store, fires callback
 *   [3] Cancel Handler — Clears local error and closes the modal
 *   [4] Render — Wraps Form_Service inside the base Modal component
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-06-13 | GitHub Copilot | Created global add-service modal for create-from-search flows
 * ============================================================
 */
import React, { useState } from "react";
import useStore from "../../services/useStore";
import { servicesAPI } from "../../services/api";
import Modal from "./Modal";
import Form_Service from "./Form_Service";

// ─── 1 STORE INTEGRATION ───────────────────────────────────────────────────
export default function Modal_Service() {
  const { isAddServiceModalOpen, closeAddServiceModal, addServiceCallback, addServicePrefill, addService, clearError } = useStore();

  const [formError, setFormError] = useState(null);

  // ─── 2 SUBMIT HANDLER ────────────────────────────────────────────────────
  const handleSubmit = async (serviceData, pendingPhoto = null) => {
    try {
      setFormError(null);
      const response = await servicesAPI.create(serviceData, pendingPhoto);
      const newService = response?.data ?? response;

      addService(newService);

      if (addServiceCallback && typeof addServiceCallback === "function") {
        addServiceCallback(newService);
      }

      closeAddServiceModal();
      clearError();
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || "Failed to create service";
      setFormError(String(detail));
    }
  };

  // ─── 3 CANCEL HANDLER ────────────────────────────────────────────────────
  const handleCancel = () => {
    setFormError(null);
    closeAddServiceModal();
  };

  // ─── 4 RENDER ─────────────────────────────────────────────────────────────
  const initialName = typeof addServicePrefill === "string" ? addServicePrefill : addServicePrefill?.name || "";

  return (
    <Modal isOpen={isAddServiceModalOpen} onClose={handleCancel} noPadding={true} fullScreen={true} contentGravity="top">
      {isAddServiceModalOpen && <Form_Service service={null} initialName={initialName} onSubmit={handleSubmit} onCancel={handleCancel} error={formError} />}
    </Modal>
  );
}
