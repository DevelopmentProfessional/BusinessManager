import React from "react";
import Modal from "./Modal";
import Settings_Footer from "./Settings_Footer";

/** Gear-icon page settings modal: title in header, Save (left) and Close (center) in footer. */
export default function PageControlsModal({ isOpen, onClose, title, children, onSave, saveLabel = "Save", saving = false, saveDisabled = false }) {
  const handleSave = async () => {
    if (onSave) {
      await onSave();
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      centered
      showHeaderClose={false}
      footer={<Settings_Footer onSave={handleSave} onClose={onClose} saveLabel={saveLabel} saving={saving} saveDisabled={saveDisabled} />}
    >
      <div className="d-flex flex-column gap-2">{children}</div>
    </Modal>
  );
}
