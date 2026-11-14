// FILE: Modal_Service_Form.jsx
// Dedicated modal for creating/editing a service, wrapping Form_Service
import React from "react";
import Modal from "./Modal";
import Form_Service from "../forms/Form_Service";

export default function Modal_Service_Form({
  isOpen,
  onClose,
  service,
  onSubmit,
  onBulkImport,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} noPadding={true} fullScreen={true} contentGravity="top">
      {isOpen && (
        <Form_Service
          service={service}
          onSubmit={onSubmit}
          onCancel={onClose}
          onBulkImport={!service ? onBulkImport : null}
        />
      )}
    </Modal>
  );
}
