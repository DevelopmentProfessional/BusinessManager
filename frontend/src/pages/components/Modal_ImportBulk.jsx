/*
 * ============================================================
 * FILE: Modal_BulkImport.jsx
 *
 * PURPOSE:
 *   Reusable bulk import modal. The user pastes one name per line
 *   into a textarea; pressing Save parses the lines and calls
 *   onImport(rows) with a filtered array of { name, photo?, type? } objects.
 *
 * PROPS:
 *   isOpen            {bool}      — controls visibility
 *   onClose           {func}      — called on Cancel or after Save
 *   entityLabel       {string}    — e.g. "Items", "Clients", "Services"
 *   onImport          {func}      — async (rows: Array<{name, photo?, type?}>) => void
 *   allowPhotoUpload  {bool}      — show per-row photo upload slots (default false)
 *   itemTypes         {Array}     — optional [{value, label}] for per-row type select
 *   defaultItemType   {string}    — default type value when itemTypes provided
 *
 * CHANGE LOG:
 *   2026-09-11 | GitHub Copilot | Removed unused CheckIcon import to satisfy ESLint
 *   2026-03-16 | Claude | Initial implementation
 *   2026-03-16 | Claude | Add per-row photo upload support (allowPhotoUpload prop)
 *   2026-03-16 | Claude | Add per-row item type select (itemTypes prop)
 * ============================================================
 */

import React, { useState, useEffect, useRef } from "react";
import { XMarkIcon, PhotoIcon, CameraIcon, ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import Button_Toolbar from "./Button_Toolbar";
import Modal from "./Modal";
import Dropdown_Custom from "./Dropdown_Custom";

export default function Modal_BulkImport({
  isOpen,
  onClose,
  entityLabel = "Items",
  onImport,
  allowPhotoUpload = false,
  itemTypes = null, // e.g. [{ value: 'PRODUCT', label: 'Product' }, ...]
  defaultItemType = "",
}) {
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState({}); // { [index]: { file: File, url: string } }
  const [types, setTypes] = useState({}); // { [index]: string }
  const [categories, setCategories] = useState({}); // { [index]: string }
  const [saving, setSaving] = useState(false);
  const [resultMsg, setResultMsg] = useState(null);
  const fileInputRefs = useRef({});

  // Reset state whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setText("");
      setPhotos({});
      setTypes({});
      setCategories({});
      setResultMsg(null);
      setSaving(false);
      fileInputRefs.current = {};
    }
  }, [isOpen]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(photos).forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [photos]);

  // Parsed lines (live)
  const parsedNames = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const handlePhotoSelect = (index, file) => {
    if (!file) return;
    if (photos[index]) URL.revokeObjectURL(photos[index].url);
    setPhotos((prev) => ({ ...prev, [index]: { file, url: URL.createObjectURL(file) } }));
  };

  const handleRemovePhoto = (index) => {
    if (photos[index]) URL.revokeObjectURL(photos[index].url);
    setPhotos((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const handleTypeChange = (index, value) => {
    setTypes((prev) => ({ ...prev, [index]: value }));
  };

  const handleSave = async () => {
    if (parsedNames.length === 0) return;

    const rows = parsedNames.map((name, i) => ({
      name,
      photo: photos[i]?.file ?? null,
      ...(itemTypes ? { type: types[i] || defaultItemType } : {}),
      ...(categories[i] ? { category: categories[i] } : {}),
    }));

    setSaving(true);
    setResultMsg(null);
    try {
      await onImport(rows);
      onClose();
    } catch (err) {
      setResultMsg({ type: "error", text: err?.message || "Some items failed to import." });
    } finally {
      setSaving(false);
    }
  };

  const showRowDetails = allowPhotoUpload || itemTypes || true; // always show for category

  return (
    /* Modal wraps backdrop + dialog */
    <Modal isOpen={isOpen} onClose={onClose} noPadding centered>
      <div className="ui-component-shell">
        {/* Body */}
        <div className="component-body">
          <div className="component-body-inner">
          {/* Textarea */}
          <div className="d-flex flex-column gap-1">
            <p className="mb-0 ui-small-muted">Paste one name per line. Each line will be saved as a new {entityLabel.replace(/s$/i, "").toLowerCase()}.</p>
            <textarea className="form-control" style={{ resize: "vertical", minHeight: "120px", fontFamily: "monospace", fontSize: "0.875rem" }} placeholder={`Name 1\nName 2\nName 3`} value={text} onChange={(e) => setText(e.target.value)} disabled={saving} autoFocus />
          </div>

          {/* Per-row details: type + photo (inventory only) */}
          {showRowDetails && parsedNames.length > 0 && (
            <div className="d-flex flex-column gap-1">
              <p className="fw-medium mb-0 small text-muted">
                {allowPhotoUpload && itemTypes ? "Type, Category & Photo" : allowPhotoUpload ? "Photos" : itemTypes ? "Type & Category" : "Category"}
                <span className="fw-normal"> (optional)</span>
              </p>
              <div className="d-flex flex-column gap-1">
                {parsedNames.map((name, i) => (
                  <div key={i} className="align-items-center d-flex gap-2 p-0 rounded" style={{ background: "var(--bs-secondary-bg)", minHeight: "48px" }}>
                    {/* Thumbnail */}
                    {allowPhotoUpload && (
                      <div className="align-items-center d-flex flex-shrink-0 justify-content-center overflow-hidden rounded" style={{ width: 36, height: 36, background: "#dee2e6" }}>
                        {photos[i] ? <img src={photos[i].url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <PhotoIcon style={{ width: 18, height: 18, color: "#adb5bd" }} />}
                      </div>
                    )}

                    {/* Name */}
                    <span className="flex-grow-0 small text-truncate" style={{ minWidth: "60px", maxWidth: "100px" }}>
                      {name}
                    </span>

                    {itemTypes && (
                      <Dropdown_Custom
                        className="form-select ui-control-sm"
                        style={{ width: "7.5rem", fontSize: "0.72rem" }}
                        value={types[i] || defaultItemType || ""}
                        onChange={(e) => handleTypeChange(i, e.target.value)}
                        disabled={saving}
                        options={[
                          { value: "", label: "Type…" },
                          ...itemTypes.map((t) => ({ value: t.value, label: t.label })),
                        ]}
                      />
                    )}

                    <input type="text" className="form-control ui-control-sm" style={{ width: "6.5rem", fontSize: "0.72rem" }} placeholder="Category" value={categories[i] || ""} onChange={(e) => setCategories((prev) => ({ ...prev, [i]: e.target.value }))} disabled={saving} />

                    {/* Photo upload / remove */}
                    {allowPhotoUpload &&
                      (photos[i] ? (
                        <button type="button" className="btn btn-bulk-circle btn-outline-danger flex-shrink-0" onClick={() => handleRemovePhoto(i)} disabled={saving} title="Remove photo">
                          <XMarkIcon style={{ width: 14, height: 14 }} />
                        </button>
                      ) : (
                        <button type="button" className="btn btn-bulk-circle btn-outline-secondary flex-shrink-0" onClick={() => fileInputRefs.current[i]?.click()} disabled={saving} title="Add photo">
                          <CameraIcon style={{ width: 14, height: 14 }} />
                        </button>
                      ))}

                    {/* Hidden file input */}
                    {allowPhotoUpload && (
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        ref={(el) => {
                          fileInputRefs.current[i] = el;
                        }}
                        onChange={(e) => handlePhotoSelect(i, e.target.files?.[0])}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {resultMsg && <div className={`alert alert-${resultMsg.type === "error" ? "danger" : "success"} py-1 mb-0 small`}>{resultMsg.text}</div>}
          </div>{/* /component-body-inner */}
        </div>{/* /component-body */}

        <div className="component-header component-header--bottom">
          <div className="component-header-left">Bulk Import {entityLabel}</div>
          <div className="component-header-center"></div>
          <div className="component-header-right"></div>
        </div>

        {/* Footer */}
        <div className="component-footer">
          <div className="component-footer-left">
            <Button_Toolbar
              icon={ArrowDownTrayIcon}
              label={saving ? "Saving…" : parsedNames.length > 0 ? `Save (${parsedNames.length})` : "Save"}
              onClick={handleSave}
              className="btn-primary"
              disabled={saving || parsedNames.length === 0}
              title="Import rows"
            />
          </div>
          <div className="component-footer-center">
            <button type="button" onClick={onClose} className="btn ui-btn-circle-outline-secondary" disabled={saving} title="Close">
              <XMarkIcon />
            </button>
          </div>
          <div className="component-footer-right"></div>
        </div>
      </div>
    </Modal>
  );
}
