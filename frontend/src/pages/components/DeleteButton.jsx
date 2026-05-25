// FILE: DeleteButton.jsx
// Reusable circular delete button — always circular/danger styled,
// NOT affected by training mode or compact mode.
//
// Flow:
//   1. User clicks → first "Are you sure?" confirmation is shown.
//   2. If `linkedMessage` is provided → second warning about linked data is shown.
//   3. If all confirmations pass → `onDelete()` is called.
//
// Usage:
//   <DeleteButton
//     onDelete={() => handleDeleteItem(item.id)}
//     label="this item"
//     linkedMessage="Any service links to this asset will be removed."
//     disabled={isDeletingId === item.id}
//   />
import React, { useState } from "react";
import { TrashIcon } from "@heroicons/react/24/outline";
import { showConfirm } from "../../services/showConfirm";

export default function DeleteButton({
  onDelete,
  label = "this item",
  confirmMessage,
  linkedMessage,
  disabled = false,
  title: titleProp,
  className = "",
}) {
  const [busy, setBusy] = useState(false);

  const handleClick = async (e) => {
    e.stopPropagation();
    if (disabled || busy) return;

    const firstMsg = confirmMessage ?? `Are you sure you want to delete ${label}?`;
    if (!(await showConfirm(firstMsg, { confirmLabel: "Delete" }))) return;

    if (linkedMessage) {
      if (!(await showConfirm(linkedMessage, { confirmLabel: "Yes, continue", danger: true }))) return;
    }

    setBusy(true);
    try {
      await onDelete?.();
    } finally {
      setBusy(false);
    }
  };

  const tooltip = titleProp ?? `Delete ${label}`;

  return (
    <button
      type="button"
      className={`btn btn-delete-action ${className}`.trim()}
      title={tooltip}
      aria-label={tooltip}
      disabled={disabled || busy}
      onClick={handleClick}
    >
      <TrashIcon className="app-icon" />
    </button>
  );
}
