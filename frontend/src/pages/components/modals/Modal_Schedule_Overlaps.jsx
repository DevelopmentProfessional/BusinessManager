import React from "react";
import Modal from "./Modal";
import { XMarkIcon } from "@heroicons/react/24/outline";

export default function Modal_Schedule_Overlaps({
  isOpen,
  onClose,
  overlapEvents = [],
  employees = [],
  employeeColorMap = new Map(),
  getAppointmentDisplay = (a) => ({ primaryLabel: a.title || "Appointment", secondaryLabel: "" }),
  canEditAppointment = () => true,
  onSelectAppointment,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Overlapping Appointments"
      contentGravity="bottom"
      footer={
        <div className="component-footer-left d-flex align-items-center gap-1">
          <button type="button" className="btn btn-circle btn-outline-secondary" onClick={onClose} title="Close">
            <XMarkIcon style={{ width: 16, height: 16 }} />
          </button>
        </div>
      }
    >
      <div className="d-flex flex-column justify-content-end p-1">
        <div className="flex-shrink-0 overlap-event-list d-flex flex-column gap-1">
          {[...(overlapEvents || [])]
            .sort((a, b) => {
              const timeA = new Date(a.appointment_date);
              const timeB = new Date(b.appointment_date);
              if (timeA < timeB) return -1;
              if (timeA > timeB) return 1;
              const empA = employees.find((e) => e.id === a.employee_id);
              const empB = employees.find((e) => e.id === b.employee_id);
              const nameA = empA ? `${empA.first_name} ${empA.last_name}`.toLowerCase() : "";
              const nameB = empB ? `${empB.first_name} ${empB.last_name}`.toLowerCase() : "";
              return nameA.localeCompare(nameB);
            })
            .map((appt) => {
              const { primaryLabel, secondaryLabel } = getAppointmentDisplay(appt);
              const emp = employees.find((e) => e.id === appt.employee_id);
              const empName = emp ? `${emp.first_name} ${emp.last_name}` : "";
              const apptTime = new Date(appt.appointment_date);
              const timeStr = apptTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
              const empColor = employeeColorMap.get?.(appt.employee_id) || "#2563eb";
              const duration = appt.duration_minutes || 60;

              return (
                <div
                  key={appt.id}
                  className="overlap-event-item p-2 border rounded cursor-pointer d-flex align-items-center gap-2"
                  onClick={() => {
                    if (!canEditAppointment(appt)) return;
                    onSelectAppointment?.(appt);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <span className="overlap-emp-dot rounded-circle flex-shrink-0" style={{ backgroundColor: empColor, width: 10, height: 10, display: "inline-block" }} />
                  <div className="overlap-event-info flex-grow-1 min-w-0">
                    <div className="overlap-event-primary d-flex align-items-center gap-2">
                      <span className="overlap-event-time fw-bold small">{timeStr}</span>
                      <span className="overlap-event-label small">{primaryLabel}</span>
                      {secondaryLabel && <span className="overlap-event-client small text-muted">{secondaryLabel}</span>}
                    </div>
                    <div className="overlap-event-secondary text-muted ui-small-muted d-flex gap-2">
                      {empName && <span>{empName}</span>}
                      <span>{duration} min</span>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </Modal>
  );
}
