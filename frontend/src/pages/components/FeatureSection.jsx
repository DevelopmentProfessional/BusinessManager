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
import { showConfirm } from '../../services/showConfirm';

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

function calcFeatureTotal(feature) {
  return feature.options
    .filter(o => o.is_enabled)
    .reduce((sum, o) => sum + (parseInt(o.quantity) || 0), 0);
}

function calcTotalStock(features, combinations = []) {
  if (combinations.length > 0) {
    return combinations.reduce((sum, row) => sum + (parseInt(row.quantity, 10) || 0), 0);
  }
  if (!features.length) return 0;
  const totals = features.map(calcFeatureTotal);
  return Math.min(...totals);
}

function buildOptionLookup(features) {
  const lookup = {};
  features.forEach(feature => {
    feature.options.forEach(option => {
      lookup[option.option_id] = {
        featureId: feature.feature_id,
        featureName: feature.feature_name,
        optionName: option.option_name,
      };
    });
  });
  return lookup;
}

// ─── 2 FEATURE TABLE ─────────────────────────────────────────────────────────
//   • No outer or inner borders — only a single bottom rule under the header row.
//   • thead th have no vertical borders.

function FeatureTable({ feature, affectsPrice, onOptionChange, quantityReadOnly = false }) {
  return (
    <table className="table table-sm table-borderless mb-0 w-100">
      <thead style={{ borderBottom: '1px solid #dee2e6' }}>
        <tr>
          <th style={{ border: 'none', width: 36 }} className="text-center">✓</th>
          <th style={{ border: 'none' }}>Option</th>
          <th style={{ border: 'none', width: 90 }}>{quantityReadOnly ? 'Linked' : 'Qty'}</th>
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
                disabled={quantityReadOnly}
                readOnly={quantityReadOnly}
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
  const [combinationRows, setCombinationRows] = useState([]);
  const [searchTerm, setSearchTerm]           = useState('');
  const [isAddExistingOpen, setIsAddExistingOpen] = useState(false);
  const [newFeatureName, setNewFeatureName]   = useState('');
  const [newOptionInputs, setNewOptionInputs] = useState({}); // featureId → string
  const [newOptionQtyInputs, setNewOptionQtyInputs] = useState({}); // featureId → string qty
  const [combinationDraft, setCombinationDraft] = useState({ selections: {}, quantity: '' });
  const [dirty, setDirty]                     = useState({}); // featureId → bool
  const [combinationDirty, setCombinationDirty] = useState(false);
  const [saving, setSaving]                   = useState(false);
  const [lastSavedAt, setLastSavedAt]         = useState(null);
  const [error, setError]                     = useState(null);
  const [openFeatures, setOpenFeatures]       = useState({}); // featureId → bool (default open)

  // ── Load ──
  const reload = useCallback(async () => {
    try {
      const [gRes, pRes, cRes] = await Promise.all([
        featuresAPI.listAll(),
        inventoryFeaturesAPI.get(inventoryId),
        inventoryFeaturesAPI.getCombinations(inventoryId),
      ]);
      setGlobalFeatures(gRes?.data ?? gRes);
      setItemFeatures(pRes?.data ?? pRes);
      setCombinationRows(cRes?.data ?? cRes ?? []);
    } catch (e) {
      console.error('FeatureSection load error:', e);
    }
  }, [inventoryId]);

  useEffect(() => { reload(); }, [reload]);

  // ── Notify parent ──
  useEffect(() => {
    onStockChange?.(itemFeatures.length > 0 ? calcTotalStock(itemFeatures, combinationRows) : null);
    onPriceRangeChange?.(calcPriceRange(itemFeatures));
  }, [itemFeatures, combinationRows]); // eslint-disable-line

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
        options: f.options.map(o => {
          if (o.option_id !== optionId) return o;
          if (field !== 'quantity') return { ...o, [field]: value };
          const nextQty = Math.max(0, parseInt(value, 10) || 0);
          return {
            ...o,
            quantity: value,
            is_enabled: nextQty > 0 ? true : o.is_enabled,
          };
        }),
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
  const persistFeatures = useCallback(async (featureIds) => {
    if (!featureIds?.length) return;
    setSaving(true);
    setError(null);
    try {
      const idSet = new Set(featureIds.map(id => String(id)));
      const dirtyFeatures = itemFeatures.filter(f => idSet.has(String(f.feature_id)));
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
      setDirty(prev => {
        const next = { ...prev };
        featureIds.forEach(id => {
          delete next[id];
          delete next[String(id)];
        });
        return next;
      });
      setLastSavedAt(Date.now());
    } catch (e) {
      setError(e?.response?.data?.detail?.message ?? e?.response?.data?.detail ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [inventoryId, itemFeatures]);

  const persistCombinations = useCallback(async (rows) => {
    const payload = rows.map(row => ({
      option_ids: row.option_ids,
      quantity: Math.max(0, parseInt(row.quantity, 10) || 0),
    }));
    await inventoryFeaturesAPI.saveCombinations(inventoryId, payload);
  }, [inventoryId]);

  const handleSave = async () => {
    await persistFeatures(Object.keys(dirty));
    if (combinationDirty) {
      try {
        await persistCombinations(combinationRows);
        setCombinationDirty(false);
      } catch (e) {
        setError(e?.response?.data?.detail ?? 'Could not save combination stock');
      }
    }
  };

  useEffect(() => {
    if (saving || Object.keys(dirty).length === 0) return;
    const timer = setTimeout(() => {
      persistFeatures(Object.keys(dirty));
    }, 700);
    return () => clearTimeout(timer);
  }, [dirty, itemFeatures, saving, persistFeatures]);

  useEffect(() => {
    if (saving || !combinationDirty) return;
    const timer = setTimeout(async () => {
      try {
        await persistCombinations(combinationRows);
        setCombinationDirty(false);
        setLastSavedAt(Date.now());
      } catch (e) {
        setError(e?.response?.data?.detail ?? 'Could not save combination stock');
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [combinationDirty, combinationRows, persistCombinations, saving]);

  // ── Add existing global feature to item ──
  const handleAddFeature = async (featureId) => {
    setError(null);
    try {
      await inventoryFeaturesAPI.addFeature(inventoryId, featureId);
      setIsAddExistingOpen(false);
      await reload();
    } catch (e) {
      setError(e?.response?.data?.detail ?? 'Could not add feature');
    }
  };

  const handleDeleteGlobalFeature = async (featureId, featureName) => {
    if (!await showConfirm(`Delete feature '${featureName}' from database?`)) return;
    setError(null);
    try {
      await featuresAPI.delete(featureId);
      await reload();
    } catch (e) {
      const detail = e?.response?.data?.detail;
      setError((detail && typeof detail === 'object' && detail.message) ? detail.message : (detail ?? 'Could not delete feature'));
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
    const qty = Math.max(0, parseInt(newOptionQtyInputs[featureId], 10) || 0);
    if (!name) return;
    setError(null);
    try {
      const createdRes = await featuresAPI.addOption(featureId, { name });
      const created = createdRes?.data ?? createdRes;
      if (created?.id) {
        await inventoryFeaturesAPI.saveOptionData(inventoryId, featureId, [{
          option_id: created.id,
          is_enabled: true,
          quantity: usesCombinationTable ? 0 : qty,
          price: null,
        }]);
      }
      setNewOptionInputs(prev => ({ ...prev, [featureId]: '' }));
      setNewOptionQtyInputs(prev => ({ ...prev, [featureId]: '' }));
      await reload();
    } catch (e) {
      setError(e?.response?.data?.detail ?? 'Could not add option');
    }
  };

  const optionLookup = buildOptionLookup(itemFeatures);
  const usesCombinationTable = itemFeatures.length > 1;

  const updateCombinationQuantity = (combinationKey, quantity) => {
    setCombinationRows(prev => prev.map(row => (
      row.combination_key === combinationKey
        ? { ...row, quantity: Math.max(0, parseInt(quantity, 10) || 0) }
        : row
    )));
    setCombinationDirty(true);
  };

  const removeCombinationRow = (combinationKey) => {
    setCombinationRows(prev => prev.filter(row => row.combination_key !== combinationKey));
    setCombinationDirty(true);
  };

  const handleDraftSelectionChange = (featureId, optionId) => {
    setCombinationDraft(prev => ({
      ...prev,
      selections: {
        ...prev.selections,
        [featureId]: optionId,
      },
    }));
  };

  const handleAddCombination = () => {
    const requiredFeatures = itemFeatures.filter(feature => feature.options.some(option => option.is_enabled));
    const optionIds = requiredFeatures.map(feature => combinationDraft.selections[feature.feature_id]).filter(Boolean);
    if (requiredFeatures.length === 0 || optionIds.length !== requiredFeatures.length) {
      setError('Select one enabled option from each feature before adding a combination.');
      return;
    }

    const quantity = Math.max(0, parseInt(combinationDraft.quantity, 10) || 0);
    const combinationKey = [...optionIds].map(String).sort().join('|');

    setCombinationRows(prev => {
      const existing = prev.find(row => row.combination_key === combinationKey);
      if (existing) {
        return prev.map(row => row.combination_key === combinationKey ? { ...row, quantity } : row);
      }
      return [
        ...prev,
        {
          combination_key: combinationKey,
          option_ids: optionIds,
          quantity,
        },
      ];
    });
    setCombinationDraft({ selections: {}, quantity: '' });
    setCombinationDirty(true);
    setError(null);
  };

  // ── Derived ──
  const affectingFeatureId = itemFeatures.find(f => f.affects_price)?.feature_id ?? null;
  const addableFeatures = globalFeatures.filter(
    gf => !itemFeatures.find(pf => pf.feature_id === gf.id)
       && gf.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const hasDirty = Object.keys(dirty).length > 0 || combinationDirty;

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

      {/* ── Stock guidance ── */}
      {usesCombinationTable ? (
        <div className="alert alert-info py-1 mb-2" style={{ fontSize: '0.8rem' }}>
          Enable options in the checkbox lists above, then assign stock in the combination table below. Option totals are linked automatically from those combination counts.
        </div>
      ) : itemFeatures.length > 1 && (() => {
        const totals = itemFeatures.map(calcFeatureTotal);
        const allEqual = totals.every(t => t === totals[0]);
        if (allEqual) return null;
        return (
          <div className="alert alert-warning py-1 mb-2 d-flex align-items-start gap-2" style={{ fontSize: '0.8rem' }}>
            <span>⚠</span>
            <span>
              <strong>Stock count mismatch.</strong> Feature totals differ — the effective stock is the lowest total ({Math.min(...totals)}).
              {' '}Adjust quantities so all features have the same total:{' '}
              {itemFeatures.map((f, i) => (
                <span key={f.feature_id}>
                  <strong>{f.feature_name}</strong>: {totals[i]}
                  {i < itemFeatures.length - 1 ? ', ' : ''}
                </span>
              ))}
            </span>
          </div>
        );
      })()}

      {/* ── Per-feature accordions ── */}
      {itemFeatures.map(f => {
        const isOpen = openFeatures[f.feature_id] !== false;
        const enabledOptions = f.options.filter(o => o.is_enabled).map(o => o.option_name);
        const optionsPreview = enabledOptions.length > 0 ? enabledOptions.join(', ') : '—';
        const featureTotal = calcFeatureTotal(f);
        const allFeatureTotals = itemFeatures.map(calcFeatureTotal);
        const isMismatched = itemFeatures.length > 1 && allFeatureTotals.some(t => t !== featureTotal);

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
                <span
                  className="ms-1"
                  style={{ fontSize: '0.72rem', fontWeight: 400, color: isMismatched ? '#b45309' : '#6c757d' }}
                >
                  ({featureTotal})
                </span>
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
                  quantityReadOnly={usesCombinationTable}
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
                  {!usesCombinationTable && (
                    <input
                      type="number"
                      min={0}
                      className="form-control form-control-sm"
                      style={{ fontSize: '0.78rem', maxWidth: 80 }}
                      placeholder="Qty"
                      value={newOptionQtyInputs[f.feature_id] ?? ''}
                      onChange={e => setNewOptionQtyInputs(prev => ({ ...prev, [f.feature_id]: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && handleAddOption(f.feature_id)}
                    />
                  )}
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

      {usesCombinationTable && (
        <div className="mt-3 border rounded p-2 bg-light-subtle">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <div>
              <div className="fw-semibold" style={{ fontSize: '0.85rem' }}>Combination Stock</div>
              <div className="text-muted" style={{ fontSize: '0.74rem' }}>
                Add one row for each sellable feature combination and set the available count.
              </div>
            </div>
            <span className="badge bg-secondary-subtle text-secondary-emphasis border border-secondary-subtle">
              Total {calcTotalStock(itemFeatures, combinationRows)}
            </span>
          </div>

          <div className="table-responsive">
            <table className="table table-sm align-middle mb-2">
              <thead>
                <tr>
                  {itemFeatures.map(feature => (
                    <th key={feature.feature_id}>{feature.feature_name}</th>
                  ))}
                  <th style={{ width: 110 }}>Count</th>
                  <th style={{ width: 80 }} />
                </tr>
              </thead>
              <tbody>
                {combinationRows.length === 0 ? (
                  <tr>
                    <td colSpan={itemFeatures.length + 2} className="text-muted" style={{ fontSize: '0.78rem' }}>
                      No combinations saved yet.
                    </td>
                  </tr>
                ) : combinationRows.map(row => (
                  <tr key={row.combination_key}>
                    {itemFeatures.map(feature => {
                      const optionId = row.option_ids?.find(id => optionLookup[id]?.featureId === feature.feature_id);
                      return <td key={`${row.combination_key}-${feature.feature_id}`}>{optionLookup[optionId]?.optionName ?? '—'}</td>;
                    })}
                    <td>
                      <input
                        type="number"
                        min={0}
                        className="form-control form-control-sm"
                        value={row.quantity}
                        onChange={e => updateCombinationQuantity(row.combination_key, e.target.value)}
                      />
                    </td>
                    <td className="text-end">
                      <button
                        type="button"
                        className="btn btn-link btn-sm text-danger p-0"
                        onClick={() => removeCombinationRow(row.combination_key)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                <tr>
                  {itemFeatures.map(feature => {
                    const enabledOptions = feature.options.filter(option => option.is_enabled);
                    return (
                      <td key={`draft-${feature.feature_id}`}>
                        <select
                          className="form-select form-select-sm"
                          value={combinationDraft.selections[feature.feature_id] ?? ''}
                          onChange={e => handleDraftSelectionChange(feature.feature_id, e.target.value)}
                        >
                          <option value="">Select…</option>
                          {enabledOptions.map(option => (
                            <option key={option.option_id} value={option.option_id}>{option.option_name}</option>
                          ))}
                        </select>
                      </td>
                    );
                  })}
                  <td>
                    <input
                      type="number"
                      min={0}
                      className="form-control form-control-sm"
                      placeholder="0"
                      value={combinationDraft.quantity}
                      onChange={e => setCombinationDraft(prev => ({ ...prev, quantity: e.target.value }))}
                    />
                  </td>
                  <td className="text-end">
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm"
                      onClick={handleAddCombination}
                    >
                      Add Row
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

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
            onChange={e => {
              setSearchTerm(e.target.value);
              if (!isAddExistingOpen) setIsAddExistingOpen(true);
            }}
          />
          <div className="position-relative" style={{ minWidth: 190 }}>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm w-100 text-start d-flex justify-content-between align-items-center"
              style={{ fontSize: '0.78rem' }}
              onClick={() => setIsAddExistingOpen(prev => !prev)}
            >
              <span>+ Add existing…</span>
              <span className="text-muted">▾</span>
            </button>
            {isAddExistingOpen && (
              <div
                className="position-absolute bg-white border rounded shadow-sm mt-1 w-100"
                style={{ zIndex: 20, maxHeight: 220, overflowY: 'auto' }}
              >
                {addableFeatures.length === 0 ? (
                  <div className="px-2 py-2 text-muted" style={{ fontSize: '0.75rem' }}>
                    No matching features
                  </div>
                ) : addableFeatures.map(gf => (
                  <div key={gf.id} className="d-flex align-items-center gap-1 px-1 py-1 border-bottom">
                    <button
                      type="button"
                      className="btn btn-link p-0 text-danger d-flex align-items-center"
                      title={`Delete ${gf.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteGlobalFeature(gf.id, gf.name);
                      }}
                    >
                      <TrashIcon style={{ width: 13, height: 13 }} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-link p-0 text-start text-decoration-none text-body flex-grow-1"
                      style={{ fontSize: '0.78rem' }}
                      onClick={() => handleAddFeature(gf.id)}
                      title={`Add ${gf.name}`}
                    >
                      {gf.name}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
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

      {hasDirty && (
        <div className="mt-3">
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={handleSave}
            disabled={saving}
          >
            Save now
          </button>
        </div>
      )}
    </div>
  );
}
