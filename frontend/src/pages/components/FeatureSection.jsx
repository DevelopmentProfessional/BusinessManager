/*
 * ============================================================
 * FILE: FeatureSection.jsx
 *
 * PURPOSE:
 *   Self-contained section component for managing descriptive features
 *   (e.g. "Size", "Color") on an inventory item. Rendered inside
 *   Modal_Detail_Item in inventory mode, below the main form.
 *
 * FUNCTIONAL PARTS:
 *   [1] Helpers       — calcPriceRange, calcTotalStock
 *   [2] FeatureTable  — Per-feature option table (checkbox, qty, price)
 *   [3] FeatureSection — Main export: loads global + item features,
 *                        handles all CRUD, notifies parent of stock/price
 *
 * CHANGE LOG:
 *   2026-03-05 | Claude | Initial implementation
 *   2026-03-11 | Claude | Accordion headers, trash icon, borderless table,
 *                         right-aligned add-option row, options preview in header
 * ============================================================
 */

import React, { useState, useEffect, useCallback } from 'react';
import { TrashIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { featuresAPI, inventoryFeaturesAPI } from '../../services/api';

// ─── 1 HELPERS ──────────────────────────────────────────────────────────────────

function calcPriceRange(features) {
  const active = features.find(f => f.affects_price);
  if (!active) return null;
  const prices = active.options
    .filter(o => o.is_enabled && o.price != null && o.price !== '')
    .map(o => parseFloat(o.price));
  if (!prices.length) return null;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return { min, max };
}

function calcTotalStock(features) {
  return features
    .flatMap(f => f.options)
    .filter(o => o.is_enabled)
    .reduce((sum, o) => sum + (parseInt(o.quantity) || 0), 0);
}

// ─── 2 FEATURE TABLE ─────────────────────────────────────────────────────────
//   • No outer or inner borders — only a single bottom rule under the header row.
//   • thead th have no vertical borders.

function FeatureTable({ feature, affectsPrice, onOptionChange }) {
  return (
    <table className="table table-sm table-borderless mb-0 w-100">
      <thead style={{ borderBottom: '1px solid #dee2e6' }}>
        <tr>
          <th style={{ border: 'none', width: 36 }} className="text-center">✓</th>
          <th style={{ border: 'none' }}>Option</th>
          <th style={{ border: 'none', width: 90 }}>Qty</th>
          {affectsPrice && <th style={{ border: 'none', width: 100 }}>Price ($)</th>}
        </tr>
      </thead>
      <tbody>
        {feature.options.map(opt => (
          <tr key={opt.option_id} className={opt.is_enabled ? '' : 'opacity-50'}>
            <td className="text-center align-middle p-1" style={{ border: 'none' }}>
              <input
                type="checkbox"
                className="form-check-input"
                checked={opt.is_enabled}
                onChange={e =>
                  onOptionChange(feature.feature_id, opt.option_id, 'is_enabled', e.target.checked)
                }
              />
            </td>
            <td className="align-middle" style={{ fontSize: '0.85rem', border: 'none' }}>
              {opt.option_name}
            </td>
            <td className="p-1" style={{ border: 'none' }}>
              <input
                type="number"
                min={0}
                className="form-control form-control-sm"
                style={{ fontSize: '0.8rem' }}
                value={opt.quantity}
                disabled={!opt.is_enabled}
                onChange={e =>
                  onOptionChange(feature.feature_id, opt.option_id, 'quantity', e.target.value)
                }
              />
            </td>
            {affectsPrice && (
              <td className="p-1" style={{ border: 'none' }}>
                {opt.is_enabled ? (
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="form-control form-control-sm"
                    style={{ fontSize: '0.8rem' }}
                    value={opt.price ?? ''}
                    placeholder="0.00"
                    onChange={e =>
                      onOptionChange(feature.feature_id, opt.option_id, 'price', e.target.value)
                    }
                  />
                ) : (
                  <span className="text-muted" style={{ fontSize: '0.8rem' }}>—</span>
                )}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── 3 FEATURE SECTION ───────────────────────────────────────────────────────

export default function FeatureSection({ inventoryId, onStockChange, onPriceRangeChange }) {
  const [globalFeatures, setGlobalFeatures]   = useState([]);
  const [itemFeatures, setItemFeatures]       = useState([]);
  const [searchTerm, setSearchTerm]           = useState('');
  const [newFeatureName, setNewFeatureName]   = useState('');
  const [newOptionInputs, setNewOptionInputs] = useState({}); // featureId → string
  const [dirty, setDirty]                     = useState({}); // featureId → bool
  const [saving, setSaving]                   = useState(false);
  const [error, setError]                     = useState(null);
  const [openFeatures, setOpenFeatures]       = useState({}); // featureId → bool (default open)

  // ── Load ──
  const reload = useCallback(async () => {
    try {
      const [gRes, pRes] = await Promise.all([
        featuresAPI.listAll(),
        inventoryFeaturesAPI.get(inventoryId),
      ]);
      setGlobalFeatures(gRes?.data ?? gRes);
      setItemFeatures(pRes?.data ?? pRes);
    } catch (e) {
      console.error('FeatureSection load error:', e);
    }
  }, [inventoryId]);

  useEffect(() => { reload(); }, [reload]);

  // ── Notify parent ──
  useEffect(() => {
    onStockChange?.(calcTotalStock(itemFeatures));
    onPriceRangeChange?.(calcPriceRange(itemFeatures));
  }, [itemFeatures]); // eslint-disable-line

  // ── Default newly-loaded features to open ──
  useEffect(() => {
    setOpenFeatures(prev => {
      const next = { ...prev };
      itemFeatures.forEach(f => {
        if (!(f.feature_id in next)) next[f.feature_id] = true;
      });
      return next;
    });
  }, [itemFeatures]);

  const toggleFeature = (featureId) =>
    setOpenFeatures(prev => ({ ...prev, [featureId]: !prev[featureId] }));

  // ── Local option edits ──
  const handleOptionChange = (featureId, optionId, field, value) => {
    setItemFeatures(prev => prev.map(f =>
      f.feature_id !== featureId ? f : {
        ...f,
        options: f.options.map(o =>
          o.option_id !== optionId ? o : { ...o, [field]: value }
        ),
      }
    ));
    setDirty(d => ({ ...d, [featureId]: true }));
  };

  // ── Affects-price radio ──
  const handleAffectsPrice = async (featureId) => {
    setItemFeatures(prev => prev.map(f => ({ ...f, affects_price: f.feature_id === featureId })));
    try {
      await inventoryFeaturesAPI.setAffectsPrice(inventoryId, { feature_id: featureId || null });
    } catch {
      await reload();
    }
  };

  const handleClearAffectsPrice = async () => {
    setItemFeatures(prev => prev.map(f => ({ ...f, affects_price: false })));
    try {
      await inventoryFeaturesAPI.setAffectsPrice(inventoryId, { feature_id: null });
    } catch {
      await reload();
    }
  };

  // ── Save dirty features ──
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const dirtyFeatures = itemFeatures.filter(f => dirty[f.feature_id]);
      await Promise.all(
        dirtyFeatures.map(f =>
          inventoryFeaturesAPI.saveOptionData(inventoryId, f.feature_id, f.options.map(o => ({
            option_id: o.option_id,
            is_enabled: o.is_enabled,
            quantity: parseInt(o.quantity) || 0,
            price: o.price !== '' && o.price != null ? parseFloat(o.price) : null,
          })))
        )
      );
      setDirty({});
      await reload();
    } catch (e) {
      setError(e?.response?.data?.detail?.message ?? e?.response?.data?.detail ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // ── Add existing global feature to item ──
  const handleAddFeature = async (featureId) => {
    setError(null);
    try {
      await inventoryFeaturesAPI.addFeature(inventoryId, featureId);
      await reload();
    } catch (e) {
      setError(e?.response?.data?.detail ?? 'Could not add feature');
    }
  };

  // ── Create new global feature then add to item ──
  const handleCreateFeature = async () => {
    const name = newFeatureName.trim();
    if (!name) return;
    setError(null);
    try {
      const res = await featuresAPI.create({ name });
      const created = res?.data ?? res;
      setNewFeatureName('');
      await inventoryFeaturesAPI.addFeature(inventoryId, created.id);
      await reload();
    } catch (e) {
      setError(e?.response?.data?.detail ?? 'Could not create feature');
    }
  };

  // ── Remove feature from item ──
  const handleRemoveFeature = async (featureId) => {
    setError(null);
    try {
      await inventoryFeaturesAPI.removeFeature(inventoryId, featureId);
      await reload();
    } catch (e) {
      setError(e?.response?.data?.detail ?? 'Cannot remove feature');
    }
  };

  // ── Add new option to a global feature ──
  const handleAddOption = async (featureId) => {
    const name = (newOptionInputs[featureId] ?? '').trim();
    if (!name) return;
    setError(null);
    try {
      await featuresAPI.addOption(featureId, { name });
      setNewOptionInputs(prev => ({ ...prev, [featureId]: '' }));
      await reload();
    } catch (e) {
      setError(e?.response?.data?.detail ?? 'Could not add option');
    }
  };

  // ── Derived ──
  const affectingFeatureId = itemFeatures.find(f => f.affects_price)?.feature_id ?? null;
  const addableFeatures = globalFeatures.filter(
    gf => !itemFeatures.find(pf => pf.feature_id === gf.id)
       && gf.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const hasDirty = Object.keys(dirty).length > 0;

  const priceRange = calcPriceRange(itemFeatures);
  const priceDisplay = priceRange
    ? (priceRange.min === priceRange.max
        ? `$${priceRange.min.toFixed(2)}`
        : `From $${priceRange.min.toFixed(2)} to $${priceRange.max.toFixed(2)}`)
    : null;

  return (
    <div className="border-top mt-3 pt-3 px-1">
      <div className="d-flex align-items-center justify-content-between mb-2">
        <h6 className="fw-bold mb-0" style={{ fontSize: '0.9rem' }}>Descriptive Features</h6>
        {priceDisplay && (
          <span className="badge bg-primary-subtle text-primary-emphasis border border-primary-subtle"
                style={{ fontSize: '0.75rem' }}>
            {priceDisplay}
          </span>
        )}
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible py-1 mb-2" style={{ fontSize: '0.8rem' }}>
          {typeof error === 'object' ? JSON.stringify(error) : error}
          <button type="button" className="btn-close btn-sm" onClick={() => setError(null)} />
        </div>
      )}

      {/* ── Affects-price radio group ── */}
      {itemFeatures.length > 0 && (
        <div className="mb-3 p-2 bg-light rounded border">
          <div className="small fw-semibold text-muted mb-1">Which feature sets the price?</div>
          <div className="d-flex flex-wrap gap-3">
            <div className="form-check form-check-inline mb-0">
              <input className="form-check-input" type="radio" name={`ap_${inventoryId}`}
                id={`ap_none_${inventoryId}`}
                checked={affectingFeatureId === null}
                onChange={handleClearAffectsPrice}
              />
              <label className="form-check-label small" htmlFor={`ap_none_${inventoryId}`}>
                None (fixed price)
              </label>
            </div>
            {itemFeatures.map(f => (
              <div key={f.feature_id} className="form-check form-check-inline mb-0">
                <input className="form-check-input" type="radio" name={`ap_${inventoryId}`}
                  id={`ap_${f.feature_id}`}
                  checked={affectingFeatureId === f.feature_id}
                  onChange={() => handleAffectsPrice(f.feature_id)}
                />
                <label className="form-check-label small" htmlFor={`ap_${f.feature_id}`}>
                  {f.feature_name}
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Per-feature accordions ── */}
      {itemFeatures.map(f => {
        const isOpen = openFeatures[f.feature_id] !== false;
        const enabledOptions = f.options.filter(o => o.is_enabled).map(o => o.option_name);
        const optionsPreview = enabledOptions.length > 0 ? enabledOptions.join(', ') : '—';

        return (
          <div key={f.feature_id} className="mb-2 border rounded">

            {/* ── Accordion Header: [Trash][Title][mx-auto][Options preview] ── */}
            <div
              className="d-flex align-items-center gap-2 px-2 py-1 bg-light rounded-top"
              style={{ cursor: 'pointer', minHeight: '2.25rem' }}
              onClick={() => toggleFeature(f.feature_id)}
            >
              {/* Trash — stop click from toggling accordion */}
              <button
                type="button"
                className="btn btn-link p-0 text-danger flex-shrink-0 d-flex align-items-center"
                title="Remove feature"
                onClick={e => { e.stopPropagation(); handleRemoveFeature(f.feature_id); }}
              >
                <TrashIcon style={{ width: 14, height: 14 }} />
              </button>

              {/* Title + badges */}
              <span className="fw-semibold flex-shrink-0" style={{ fontSize: '0.85rem' }}>
                {f.feature_name}
              </span>
              {f.affects_price && (
                <span className="badge bg-primary flex-shrink-0" style={{ fontSize: '0.65rem' }}>
                  Price
                </span>
              )}
              {dirty[f.feature_id] && (
                <span className="badge bg-warning text-dark flex-shrink-0" style={{ fontSize: '0.65rem' }}>
                  Unsaved
                </span>
              )}

              {/* Spacer */}
              <span className="mx-auto" />

              {/* Enabled options preview */}
              <span
                className="text-muted text-truncate flex-shrink-1"
                style={{ fontSize: '0.72rem', maxWidth: '55%', textAlign: 'right' }}
                title={optionsPreview}
              >
                {optionsPreview}
              </span>

              {/* Chevron */}
              <ChevronDownIcon
                className="flex-shrink-0 text-muted"
                style={{
                  width: 13, height: 13,
                  transition: 'transform 0.15s',
                  transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                }}
              />
            </div>

            {/* ── Accordion Body ── */}
            {isOpen && (
              <div className="px-2 pt-2 pb-1">
                <FeatureTable
                  feature={f}
                  affectsPrice={f.affects_price}
                  onOptionChange={handleOptionChange}
                />

                {/* Add option row — right-aligned */}
                <div className="d-flex justify-content-end gap-1 mt-1">
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    style={{ fontSize: '0.78rem', maxWidth: 160 }}
                    placeholder="New option name…"
                    value={newOptionInputs[f.feature_id] ?? ''}
                    onChange={e => setNewOptionInputs(prev => ({ ...prev, [f.feature_id]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handleAddOption(f.feature_id)}
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    style={{ fontSize: '0.75rem' }}
                    onClick={() => handleAddOption(f.feature_id)}
                    disabled={!(newOptionInputs[f.feature_id] ?? '').trim()}
                  >
                    + Option
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* ── Add feature controls ── */}
      <div className="d-flex flex-wrap gap-2 mt-2 pt-2 border-top">
        {/* Search + add existing */}
        <div className="d-flex gap-1">
          <input
            type="text"
            className="form-control form-control-sm"
            style={{ fontSize: '0.78rem', maxWidth: 130 }}
            placeholder="Search features…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          <select
            className="form-select form-select-sm"
            style={{ fontSize: '0.78rem', maxWidth: 170 }}
            value=""
            onChange={e => { if (e.target.value) { handleAddFeature(e.target.value); e.target.value = ''; } }}
          >
            <option value="" disabled>+ Add existing…</option>
            {addableFeatures.map(gf => (
              <option key={gf.id} value={gf.id}>{gf.name}</option>
            ))}
          </select>
        </div>

        {/* Create new global feature */}
        <div className="d-flex gap-1">
          <input
            type="text"
            className="form-control form-control-sm"
            style={{ fontSize: '0.78rem', maxWidth: 150 }}
            placeholder="New feature name"
            value={newFeatureName}
            onChange={e => setNewFeatureName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreateFeature()}
          />
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            style={{ fontSize: '0.75rem' }}
            onClick={handleCreateFeature}
            disabled={!newFeatureName.trim()}
          >
            Create & Add
          </button>
        </div>
      </div>

      {/* ── Save button ── */}
      {hasDirty && (
        <div className="mt-3">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save Feature Data'}
          </button>
          <span className="text-muted ms-2" style={{ fontSize: '0.75rem' }}>
            Unsaved changes in {Object.keys(dirty).length} feature(s)
          </span>
        </div>
      )}
    </div>
  );
}
