/*
 * ============================================================
 * FILE: Modal_Client.jsx
 *
 * PURPOSE:
 *   Global modal for creating a new client record, driven by the Zustand
 *   store's isAddClientModalOpen flag. On successful creation it adds the
 *   new client to the global store and fires an optional callback (e.g.,
 *   to auto-select the client in the Sales cart).
 *
 * FUNCTIONAL PARTS:
 *   [1] Store Integration — Reads modal open state and actions from useStore
 *   [2] Submit Handler — POSTs new client via clientsAPI, updates store, fires callback
 *   [3] Cancel Handler — Clears local error and closes the modal
 *   [4] Render — Wraps Form_Client inside the base Modal component
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-03-01 | Claude  | Added section comments and top-level documentation
 * ============================================================
 */
import React, { useState } from 'react';
import useStore from '../../services/useStore';
import { clientsAPI } from '../../services/api';
import Modal from './Modal';
import Form_Client from './Form_Client';

// ─── 1 STORE INTEGRATION ───────────────────────────────────────────────────
export default function Modal_Client() {
  const {
    isAddClientModalOpen, 
    closeAddClientModal, 
    addClientCallback,
    addClient,
    setError,
    clearError
  } = useStore();
  
  const [formError, setFormError] = useState(null);

  // ─── 2 SUBMIT HANDLER ────────────────────────────────────────────────────
  const handleSubmit = async (clientData) => {
    try {
      setFormError(null);
      const response = await clientsAPI.create(clientData);
      const newClient = response?.data ?? response;
      
      // Add to global store so all components have access
      addClient(newClient);
      
      // Call the callback if provided (e.g., to auto-select the new client)
      if (addClientCallback && typeof addClientCallback === 'function') {
        addClientCallback(newClient);
      }
      
      closeAddClientModal();
      clearError();
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || 'Failed to create client';
      setFormError(String(detail));
    }
  };

  // ─── 3 CANCEL HANDLER ────────────────────────────────────────────────────
  const handleCancel = () => {
    setFormError(null);
    closeAddClientModal();
  };

  // ─── 4 RENDER ─────────────────────────────────────────────────────────────
  return (
    <Modal isOpen={isAddClientModalOpen} onClose={handleCancel}>
      {isAddClientModalOpen && (
        <Form_Client
          client={null}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          error={formError}
        />
      )}
    </Modal>
  );
}
