import React, { useState } from 'react';
import useStore from '../../services/useStore';
import { clientsAPI } from '../../services/api';
import Modal from './Modal';
import Form_Client from './Form_Client';

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

  const handleCancel = () => {
    setFormError(null);
    closeAddClientModal();
  };

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
