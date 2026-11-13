import React from "react";
import Modal from "./Modal";
import Button_Toolbar from "../buttons/Button_Toolbar";
import Footer_Actions from "../footers/Footer_Actions";
import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";

export default function Modal_Reports_SaveFilter({
  isOpen,
  onClose,
  filterName = "",
  setFilterName,
  onSave,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Save Filter"
      contentGravity="top"
      footer={
        <Footer_Actions
          start={<Button_Toolbar icon={CheckIcon} label="Save" className="btn-primary" onClick={onSave} disabled={!filterName?.trim()} title="Save filter" />}
          center={<Button_Toolbar icon={XMarkIcon} label="Cancel" className="btn-outline-secondary" onClick={onClose} title="Cancel" />}
        />
      }
    >
      <div className="p-2 d-flex flex-column gap-2">
        <div className="form-floating">
          <input
            type="text"
            id="report_filter_name_input"
            className="form-control ui-control-sm"
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            placeholder="Filter Name"
            onKeyDown={(e) => {
              if (e.key === "Enter" && filterName.trim()) {
                onSave();
              }
            }}
            autoFocus
          />
          <label htmlFor="report_filter_name_input">Filter Name</label>
        </div>
      </div>
    </Modal>
  );
}
