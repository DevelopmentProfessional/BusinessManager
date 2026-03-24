import React, { useState, useEffect, useCallback } from 'react';
import { assetUnitsAPI } from '../../services/api';
import { showConfirm } from '../../services/showConfirm';

const STATE_LABELS = {
  available:     'Available',
  in_use:        'In Use',
  maintenance:   'Maintenance',
  arriving_soon: 'Arriving Soon',
};

const STATE_COLORS = {
  available:     'success',
  in_use:        'primary',
  maintenance:   'warning',
  arriving_soon: 'info',
};

/** Small inline editable cell — click to begin editing, blur or Enter to save */
function InlineText({ value, onSave, placeholder = '—' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => { setDraft(value); }, [value]);

  const commit = () => {
    if (draft !== value) onSave(draft);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        autoFocus
        className="form-control form-control-sm"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
        style={{ minWidth: '80px' }}
      />
    );
  }
  return (
    <span
      onClick={() => setEditing(true)}
      title="Click to edit"
      className="text-muted small"
      style={{ cursor: 'text', userSelect: 'none' }}
    >
      {value || <em>{placeholder}</em>}
    </span>
  );
}

export default function AssetUnitsPanel({ assetId, onCountChange }) {
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);
  const [addingUnit, setAddingUnit] = useState(false);
  const [newLabel, setNewLabel]     = useState('');
  const [newState, setNewState]     = useState('available');
  const [newNotes, setNewNotes]     = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!assetId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await assetUnitsAPI.list(assetId);
      const list = res?.data ?? res ?? [];
      setUnits(list);
      onCountChange?.(list.length);
    } catch {
      setError('Failed to load asset units.');
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => { load(); }, [load]);

  const handleAddUnit = async () => {
    setSaving(true);
    try {
      await assetUnitsAPI.add(assetId, {
        label: newLabel.trim() || null,
        state: newState,
        notes: newNotes.trim() || null,
      });
      setNewLabel('');
      setNewState('available');
      setNewNotes('');
      setAddingUnit(false);
      await load();
    } catch {
      setError('Failed to add unit.');
    } finally {
      setSaving(false);
    }
  };

  const handleStateChange = async (unitId, state) => {
    setUnits(prev => prev.map(u => u.id === unitId ? { ...u, state } : u));
    try {
      await assetUnitsAPI.update(assetId, unitId, { state });
    } catch {
      setError('Failed to update state.');
      load(); // revert on error
    }
  };

  const handleLabelSave = async (unitId, label) => {
    setUnits(prev => prev.map(u => u.id === unitId ? { ...u, label } : u));
    try {
      await assetUnitsAPI.update(assetId, unitId, { label: label || null });
    } catch {
      setError('Failed to save label.');
      load();
    }
  };

  const handleNotesSave = async (unitId, notes) => {
    setUnits(prev => prev.map(u => u.id === unitId ? { ...u, notes } : u));
    try {
      await assetUnitsAPI.update(assetId, unitId, { notes: notes || null });
    } catch {
      setError('Failed to save notes.');
      load();
    }
  };

  const handleRemove = async (unitId) => {
    if (!await showConfirm('Remove this unit? This cannot be undone.', { confirmLabel: 'Remove' })) return;
    try {
      await assetUnitsAPI.remove(assetId, unitId);
      await load();  // load() already calls onCountChange
    } catch {
      setError('Failed to remove unit.');
    }
  };

  const stateCounts = units.reduce((acc, u) => {
    acc[u.state] = (acc[u.state] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mt-3 mb-2 border rounded p-3">
      {/* Header */}
      <div className="d-flex align-items-center gap-2 mb-2">
        <h6 className="mb-0 fw-semibold">Asset Units</h6>
        {loading && <span className="spinner-border spinner-border-sm" role="status" />}
        <span className="text-muted small">({units.length} total)</span>
      </div>

      {/* State summary badges */}
      <div className="d-flex flex-wrap gap-2 mb-3">
        {Object.entries(STATE_LABELS).map(([state, label]) => (
          <span key={state} className={`badge bg-${STATE_COLORS[state]}`}>
            {label}: {stateCounts[state] || 0}
          </span>
        ))}
      </div>

      {/* Units table */}
      {units.length > 0 && (
        <div className="table-responsive mb-2">
          <table className="table table-sm table-bordered align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th style={{ width: '2rem' }}>#</th>
                <th>Label</th>
                <th style={{ width: '9rem' }}>State</th>
                <th>Notes</th>
                <th style={{ width: '2rem' }}></th>
              </tr>
            </thead>
            <tbody>
              {units.map((unit, idx) => (
                <tr key={unit.id}>
                  <td className="text-muted small">{idx + 1}</td>
                  <td>
                    <InlineText
                      value={unit.label || ''}
                      onSave={(val) => handleLabelSave(unit.id, val)}
                      placeholder="click to set label"
                    />
                  </td>
                  <td>
                    <select
                      className={`form-select form-select-sm border-${STATE_COLORS[unit.state]}`}
                      value={unit.state}
                      onChange={(e) => handleStateChange(unit.id, e.target.value)}
                    >
                      {Object.entries(STATE_LABELS).map(([s, l]) => (
                        <option key={s} value={s}>{l}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <InlineText
                      value={unit.notes || ''}
                      onSave={(val) => handleNotesSave(unit.id, val)}
                      placeholder="click to add notes"
                    />
                  </td>
                  <td>
                    <button
                      className="btn btn-sm btn-outline-danger py-0 px-1 lh-1"
                      onClick={() => handleRemove(unit.id)}
                      title="Remove unit"
                    >
                      &times;
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add unit inline form */}
      {addingUnit ? (
        <div className="d-flex gap-2 align-items-center flex-wrap mb-1">
          <input
            type="text"
            className="form-control form-control-sm"
            placeholder="Label (optional)"
            value={newLabel}
            style={{ maxWidth: '150px' }}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddUnit(); }}
          />
          <select
            className="form-select form-select-sm"
            style={{ maxWidth: '140px' }}
            value={newState}
            onChange={(e) => setNewState(e.target.value)}
          >
            {Object.entries(STATE_LABELS).map(([s, l]) => (
              <option key={s} value={s}>{l}</option>
            ))}
          </select>
          <input
            type="text"
            className="form-control form-control-sm"
            placeholder="Notes (optional)"
            value={newNotes}
            style={{ maxWidth: '180px' }}
            onChange={(e) => setNewNotes(e.target.value)}
          />
          <button
            className="btn btn-sm btn-success"
            onClick={handleAddUnit}
            disabled={saving}
          >
            {saving ? '…' : 'Add'}
          </button>
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={() => { setAddingUnit(false); setNewLabel(''); setNewState('available'); setNewNotes(''); }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button className="btn btn-sm btn-outline-primary" onClick={() => setAddingUnit(true)}>
          + Add Unit
        </button>
      )}

      {error && (
        <div className="text-danger small mt-2">
          {error}{' '}
          <button className="btn btn-link btn-sm p-0 text-danger text-decoration-underline" onClick={() => setError(null)}>
            dismiss
          </button>
        </div>
      )}
    </div>
  );
}
