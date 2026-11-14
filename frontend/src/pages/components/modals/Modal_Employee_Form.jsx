// FILE: Modal_Employee_Form.jsx
// Dedicated modal for creating/editing an employee, wrapping Form_Employee
import React from "react";
import Modal from "./Modal";
import Form_Employee from "../forms/Form_Employee";

export default function Modal_Employee_Form({
  isOpen,
  onClose,
  employee,
  onSubmit,
  onManagePermissions,
  employees = [],
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} noPadding={true} fullScreen={true} contentGravity="top">
      {isOpen && (
        <Form_Employee
          employee={employee}
          onSubmit={onSubmit}
          onCancel={onClose}
          onManagePermissions={onManagePermissions}
          employees={employees}
        />
      )}
    </Modal>
  );
}
