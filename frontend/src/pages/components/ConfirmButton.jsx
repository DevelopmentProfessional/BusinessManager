// FILE: ConfirmButton.jsx
// wraps destructive actions with a single confirm step; replaces showConfirm() calls
import React, { useState } from "react";
import Button_Toolbar from "./Button_Toolbar";
import { TrashIcon, CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";

export default function ConfirmButton({ icon: Icon = TrashIcon, label = "Delete", onConfirm, className = "btn-app-danger", disabled = false }) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="d-flex gap-1">
        <Button_Toolbar icon={CheckIcon} label="Confirm" onClick={() => { setConfirming(false); onConfirm(); }} className="btn-app-danger" />
        <Button_Toolbar icon={XMarkIcon} label="Cancel" onClick={() => setConfirming(false)} className="btn-app-secondary" />
      </div>
    );
  }

  return <Button_Toolbar icon={Icon} label={label} onClick={() => setConfirming(true)} className={className} disabled={disabled} />;
}
