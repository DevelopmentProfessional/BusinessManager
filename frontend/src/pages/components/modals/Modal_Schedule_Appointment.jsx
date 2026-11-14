// FILE: Modal_Schedule_Appointment.jsx
// Dedicated modal for creating/editing an appointment, wrapping Form_Schedule
import React from "react";
import Modal from "./Modal";
import Form_Schedule from "../forms/Form_Schedule";

export default function Modal_Schedule_Appointment({
  isOpen,
  onClose,
  appointment,
  onSubmit,
  onDelete,
  onSendReminder,
  clients = [],
  services = [],
  employees = [],
  attendees = [],
  scheduleSettings = {},
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} noPadding={true} fullScreen={true} contentGravity="top">
      {isOpen && (
        <Form_Schedule
          appointment={appointment}
          onSubmit={onSubmit}
          onCancel={onClose}
          onDelete={onDelete}
          onSendReminder={onSendReminder}
          clients={clients}
          services={services}
          employees={employees}
          attendees={attendees}
          scheduleSettings={scheduleSettings}
        />
      )}
    </Modal>
  );
}
