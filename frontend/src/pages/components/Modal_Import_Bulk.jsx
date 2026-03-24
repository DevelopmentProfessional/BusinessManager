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
 *   2026-03-16 | Claude | Initial implementation
 *   2026-03-16 | Claude | Add per-row photo upload support (allowPhotoUpload prop)
 *   2026-03-16 | Claude | Add per-row item type select (itemTypes prop)
 * ============================================================
 */

import React, { useState, useEffect, useRef } from 'react';
import { XMarkIcon, CheckIcon, PhotoIcon } from '@heroicons/react/24/outline';
import useViewMode from '../../services/useViewMode';

export default function Modal_BulkImport({
  isOpen,
  onClose,
  entityLabel = 'Items',
  onImport,
  allowPhotoUpload = false,
  itemTypes = null,       // e.g. [{ value: 'PRODUCT', label: 'Product' }, ...]
  defaultItemType = '',
}) {
  const { footerAlign } = useViewMode();
  const alignClass = footerAlign === 'center' ? 'justify-content-center' : footerAlign === 'right' ? 'justify-content-end' : 'justify-content-start';

  const [text, setText] = useState('');
  const [photos, setPhotos] = useState({});       // { [index]: { file: File, url: string } }
  const [types, setTypes] = useState({});          // { [index]: string }
  const [saving, setSaving] = useState(false);
  const [resultMsg, setResultMsg] = useState(null);
  const fileInputRefs = useRef({});

  // Reset state whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setText('');
      setPhotos({});
      setTypes({});
      setResultMsg(null);
      setSaving(false);
      fileInputRefs.current = {};
    }
  }, [isOpen]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(photos).forEach(p => URL.revokeObjectURL(p.url));
    };
  }, [photos]);

  if (!isOpen) return null;

  // Parsed lines (live)
  const parsedNames = text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const handlePhotoSelect = (index, file) => {
    if (!file) return;
    if (photos[index]) URL.revokeObjectURL(photos[index].url);
    setPhotos(prev => ({ ...prev, [index]: { file, url: URL.createObjectURL(file) } }));
  };

  const handleRemovePhoto = (index) => {
    if (photos[index]) URL.revokeObjectURL(photos[index].url);
    setPhotos(prev => { const next = { ...prev }; delete next[index]; return next; });
  };

  const handleTypeChange = (index, value) => {
    setTypes(prev => ({ ...prev, [index]: value }));
  };

  const handleSave = async () => {
    if (parsedNames.length === 0) return;

    const rows = parsedNames.map((name, i) => ({
      name,
      photo: photos[i]?.file ?? null,
      ...(itemTypes ? { type: types[i] || defaultItemType } : {}),
    }));

    setSaving(true);
    setResultMsg(null);
    try {
      await onImport(rows);
      onClose();
    } catch (err) {
      setResultMsg({ type: 'error', text: err?.message || 'Some items failed to import.' });
    } finally {
      setSaving(false);
    }
  };

  const showRowDetails = allowPhotoUpload || itemTypes;

  return (
    /* Backdrop */
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1060,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Dialog */}
      <div
        className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded shadow-lg d-flex flex-column"
        style={{ width: '100%', maxWidth: '520px', maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 d-flex justify-content-between align-items-center p-3 border-bottom border-gray-200 dark:border-gray-700">
          <h6 className="mb-0 fw-semibold">Bulk Import {entityLabel}</h6>
          <button
            type="button"
            className="btn btn-sm p-0 text-gray-500 dark:text-gray-400"
            onClick={onClose}
            style={{ lineHeight: 1 }}
          >
            <XMarkIcon style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-grow-1 overflow-auto no-scrollbar p-3 d-flex flex-column gap-3" style={{ minHeight: 0 }}>

          {/* Textarea */}
          <div className="d-flex flex-column gap-1">
            <p className="small text-muted mb-0">
              Paste one name per line. Each line will be saved as a new {entityLabel.replace(/s$/i, '').toLowerCase()}.
            </p>
            <textarea
              className="form-control"
              style={{ resize: 'vertical', minHeight: '120px', fontFamily: 'monospace', fontSize: '0.875rem' }}
              placeholder={`Name 1\nName 2\nName 3`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={saving}
              autoFocus
            />
          </div>

          {/* Per-row details: type + photo (inventory only) */}
          {showRowDetails && parsedNames.length > 0 && (
            <div className="d-flex flex-column gap-1">
              <p className="small text-muted mb-0 fw-medium">
                {allowPhotoUpload && itemTypes ? 'Type & Photo' : allowPhotoUpload ? 'Photos' : 'Type'}
                <span className="fw-normal"> (optional)</span>
              </p>
              <div className="d-flex flex-column gap-1">
                {parsedNames.map((name, i) => (
                  <div
                    key={i}
                    className="d-flex align-items-center gap-2 p-2 rounded"
                    style={{ background: 'var(--bs-secondary-bg)', minHeight: '48px' }}
                  >
                    {/* Thumbnail */}
                    {allowPhotoUpload && (
                      <div
                        className="flex-shrink-0 rounded overflow-hidden d-flex align-items-center justify-content-center"
                        style={{ width: 36, height: 36, background: '#dee2e6' }}
                      >
                        {photos[i] ? (
                          <img src={photos[i].url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <PhotoIcon style={{ width: 18, height: 18, color: '#adb5bd' }} />
                        )}
                      </div>
                    )}

                    {/* Name */}
                    <span className="flex-grow-1 small text-truncate" style={{ minWidth: 0 }}>{name}</span>

                    {/* Type select */}
                    {itemTypes && (
                      <select
                        className="form-select form-select-sm flex-shrink-0"
                        style={{ width: 'auto', fontSize: '0.72rem' }}
                        value={types[i] || defaultItemType}
                        onChange={(e) => handleTypeChange(i, e.target.value)}
                        disabled={saving}
                      >
                        {itemTypes.map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    )}

                    {/* Photo upload / remove */}
                    {allowPhotoUpload && (
                      photos[i] ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger py-0 px-2 flex-shrink-0"
                          style={{ fontSize: '0.7rem' }}
                          onClick={() => handleRemovePhoto(i)}
                          disabled={saving}
                        >
                          ✕
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary py-0 px-2 flex-shrink-0"
                          style={{ fontSize: '0.7rem' }}
                          onClick={() => fileInputRefs.current[i]?.click()}
                          disabled={saving}
                        >
                          Photo
                        </button>
                      )
                    )}

                    {/* Hidden file input */}
                    {allowPhotoUpload && (
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        ref={(el) => { fileInputRefs.current[i] = el; }}
                        onChange={(e) => handlePhotoSelect(i, e.target.files?.[0])}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {resultMsg && (
            <div className={`alert alert-${resultMsg.type === 'error' ? 'danger' : 'success'} py-1 mb-0 small`}>
              {resultMsg.text}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 py-3 border-top border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="row g-0">
            <div className={`col-10 d-flex align-items-center gap-2 px-4 flex-wrap ${alignClass}`}>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary d-flex align-items-center gap-1"
                onClick={handleSave}
                disabled={saving || parsedNames.length === 0}
              >
                <CheckIcon style={{ width: 14, height: 14 }} />
                {saving ? 'Saving…' : `Save${parsedNames.length > 0 ? ` (${parsedNames.length})` : ''}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
