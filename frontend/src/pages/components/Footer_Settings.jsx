import React from "react";
import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import Footer_Actions from "./Footer_Actions";
import Button_Toolbar from "./Button_Toolbar";

/** Standard settings footer: Save (left), Close (center). */
export default function Footer_Settings({ onSave, onClose, saveLabel = "Save", saving = false, saveDisabled = false, className="", showClose = true }) {
  return (
    <footer className={`app-footer-shell flex-shrink-0 border-top border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 app-footer-padding app-form-footer app-standard-footer ${className}`.trim()}>
      <Footer_Actions
        start={<Button_Toolbar icon={CheckIcon} label={saving ? "Saving..." : saveLabel} onClick={onSave} className="btn-outline-secondary" disabled={saving || saveDisabled || !onSave} title={saveLabel} />}
        center={
          showClose ? <Button_Toolbar icon={XMarkIcon} label="Close" onClick={onClose} className="btn-outline-secondary" title="Close" disabled={saving} /> : null
        }
      />
    </footer>
  );
}
