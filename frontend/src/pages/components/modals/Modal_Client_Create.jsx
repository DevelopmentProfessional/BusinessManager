// FILE: Modal_Client_Create.jsx
// Dedicated create client modal wrapping Form_Client
import React from "react";
import Modal from "./Modal";
import Form_Client from "../forms/Form_Client";

export default function Modal_Client_Create({
  isOpen,
  onClose,
  onSubmit,
  error,
  onBulkImport,
  memberships = [],
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} noPadding={true} fullScreen={true} contentGravity="top">
      {isOpen && (
        <Form_Client
          client={null}
          onSubmit={onSubmit}
          onCancel={onClose}
          error={error}
          onBulkImport={onBulkImport}
          memberships={memberships}
        />
      )}
    </Modal>
  );
}
