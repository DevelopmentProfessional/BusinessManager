// FILE: Modal_Document_Form.jsx
// Dedicated modal for uploading a document, wrapping Form_Document_Upload
import React from "react";
import Modal from "./Modal";
import Form_Document_Upload from "../forms/Form_Document_Upload";

export default function Modal_Document_Form({
  isOpen,
  onClose,
  onSubmit,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} noPadding={true} fullScreen={true} contentGravity="top">
      {isOpen && <Form_Document_Upload onSubmit={onSubmit} onCancel={onClose} />}
    </Modal>
  );
}
