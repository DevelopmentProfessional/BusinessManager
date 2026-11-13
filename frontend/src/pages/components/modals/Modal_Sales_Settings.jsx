// FILE: Modal_Sales_Settings.jsx
// Dedicated settings/controls modal for the Sales page
import React from "react";
import PageControlsModal from "./Page_ControlsModal";
import Dropdown_Custom from "../dropdowns/Dropdown_Custom";

export default function Modal_Sales_Settings({
  isOpen,
  onClose,
  onOpen,
  cardViewMode,
  setCardViewMode,
  receiptSettings,
  setReceiptSettings,
  rcptTemplates = [],
}) {
  return (
    <PageControlsModal
      isOpen={isOpen}
      onClose={onClose}
      title="Sales Page Controls"
      onOpen={onOpen}
    >
      <div className="mb-2 ui-small-muted">Use these controls to manage the sales experience on this page.</div>

      {/* Card Display Settings */}
      <hr className="my-2" />
      <div className="fw-semibold mb-2 ui-text-sm">Card Display Settings</div>

      <div className="mb-2">
        <label className="d-block mb-1 small text-muted">Item Card Style</label>
        <div style={{ maxWidth: "16rem" }}>
          <Dropdown_Custom
            className="ui-control-sm"
            value={cardViewMode}
            onChange={(e) => {
              const nextMode = e.target.value;
              setCardViewMode?.(nextMode);
              try {
                localStorage.setItem("sales_card_view", nextMode);
              } catch {}
            }}
            options={[
              { value: "full", label: "Full Card View" },
              { value: "compact", label: "Compact Card View" },
              { value: "mixed", label: "Mix (Compact without image)" },
            ]}
            placeholder="Card style"
            closeOnSelect
          />
        </div>
        <div className="mt-1 ui-small-muted">
          {cardViewMode === "compact"
            ? "All items display as compact cards."
            : cardViewMode === "mixed"
            ? "Items with images display full-size; items without images display compact."
            : "All items display as full-size cards."}
        </div>
      </div>

      {/* Receipt Settings */}
      <hr className="my-2" />
      <div className="fw-semibold mb-2 ui-text-sm">Receipt Settings</div>

      <div className="mb-2">
        <label className="d-block mb-1 small text-muted">Receipt Template</label>
        <Dropdown_Custom
          className="ui-control-sm"
          value={receiptSettings?.templateId ?? ""}
          onChange={(e) => {
            const id = e.target.value;
            const tpl = rcptTemplates.find((t) => String(t.id) === id);
            const next = { ...receiptSettings, templateId: id || null, templateName: tpl?.name || "" };
            setReceiptSettings?.(next);
            localStorage.setItem("sales_receipt_settings", JSON.stringify(next));
          }}
          options={[{ value: "", label: "— No template selected —" }, ...rcptTemplates.map((t) => ({ value: String(t.id), label: t.name }))]}
          placeholder="Select receipt template"
          closeOnSelect
        />
        {rcptTemplates.length === 0 && <div className="mt-1 ui-small-muted">No receipt templates found. Create one in Documents → Templates.</div>}
      </div>

      <div className="mb-2">
        <label className="d-block mb-1 small text-muted">After Receipt Selected</label>
        <Dropdown_Custom
          className="ui-control-sm"
          value={receiptSettings?.action || "select"}
          onChange={(e) => {
            const next = { ...receiptSettings, action: e.target.value };
            setReceiptSettings?.(next);
            localStorage.setItem("sales_receipt_settings", JSON.stringify(next));
          }}
          options={[
            { value: "select", label: "Ask (show template list)" },
            { value: "print", label: "Print" },
            { value: "email", label: "Email to Client" },
            { value: "pdf-print", label: "Print to PDF" },
            { value: "pdf-download", label: "Download PDF" },
          ]}
          placeholder="Post-selection action"
          closeOnSelect
        />
      </div>
    </PageControlsModal>
  );
}
