import React from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import Modal from "./Modal";
import Button_Toolbar from "./Button_Toolbar";

/** Gear-icon page settings modal: title only in header, single Close on the bottom-left of the footer. */
export default function PageControlsModal({ isOpen, onClose, title, children, footerExtra = null }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      centered
      showHeaderClose={false}
      footer={
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <Button_Toolbar icon={XMarkIcon} label="Close" onClick={onClose} className="btn-outline-secondary" />
          {footerExtra}
        </div>
      }
    >
      <div className="d-flex flex-column gap-2">{children}</div>
    </Modal>
  );
}
