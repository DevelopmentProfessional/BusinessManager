import React from "react";
import Modal from "./Modal";
import Footer_Settings from "../footers/Footer_Settings";

/** Gear-icon page settings modal with a standard Save and Close footer. */
export default function PageControlsModal({ isOpen, onClose, title, children, subpageContent = null, onSave, saveLabel = "Save", saving = false, saveDisabled = false }) {
  const handleSave = async () => {
    const result = await onSave?.();
    if (result !== false) onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={subpageContent ? undefined : title}
      centered
      fullScreen={false}
      noPadding={Boolean(subpageContent)}
      contentGravity="bottom"
      bodyClassName={subpageContent ? "" : "app-settings-body"}
      footer={subpageContent ? null : <Footer_Settings onSave={handleSave} onClose={onClose} saveLabel={saveLabel} saving={saving} saveDisabled={saveDisabled} />}
    >
      {subpageContent || <div className="d-flex flex-column gap-2">{children}</div>}
    </Modal>
  );
}
