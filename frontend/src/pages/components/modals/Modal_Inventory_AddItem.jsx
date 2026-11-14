// FILE: Modal_Inventory_AddItem.jsx
// Dedicated modal for adding a new inventory item, wrapping Form_Item
import React from "react";
import Modal from "./Modal";
import Form_Item from "../forms/Form_Item";

export default function Modal_Inventory_AddItem({
  isOpen,
  onClose,
  existingSkus = [],
  onCreate,
  onCreateWithExtras,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} fullScreen noPadding contentGravity="top">
      {isOpen && (
        <Form_Item
          item={null}
          showInitialQuantity
          showScanner
          existingSkus={existingSkus}
          onCancel={onClose}
          onSubmit={onCreate}
          onSubmitWithExtras={onCreateWithExtras}
        />
      )}
    </Modal>
  );
}
