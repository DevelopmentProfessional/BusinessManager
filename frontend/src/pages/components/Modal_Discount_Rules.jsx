/*
 * ============================================================
 * FILE: Modal_Discount_Rules.jsx
 *
 * PURPOSE:
 *   Full-screen modal for managing scheduled discount rules on
 *   inventory items. Users select products, set discount type
 *   and value, and configure date/time/recurrence parameters.
 *
 * LAYOUT:
 *   Header  — title + close
 *   Body    — left: existing rules list  |  right: product selector
 *   Footer  — discount value + schedule params + Save / Cancel
 * ============================================================
 */
import React, { useState, useEffect, useCallback } from 'react';
import { XMarkIcon, PlusIcon, TrashIcon, TagIcon, CheckIcon, PencilIcon } from '@heroicons/react/24/outline';
import { discountRulesAPI, inventoryAPI } from '../../services/api';
import { showConfirm } from '../../services/showConfirm';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const EMPTY_FORM = {
  name: '',
  applies_to: 'all',
  item_ids: [],           // array of UUIDs in UI; serialised to JSON on save
  discount_type: 'percentage',
  discount_value: '',
  start_date: '',
  end_date: '',
  is_recurring: false,
  recur_frequency: 'weekly',
  recur_days: [],         // array of day strings
  recur_count: '',
  times_per_day: '',
  day_start_time: '',
  day_end_time: '',
  is_active: true,
};

export default function Modal_Discount_Rules({ isOpen, onClose }) {
  const [rules, setRules]           = useState([]);
  const [inventory, setInventory]   = useState([]);
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [editingId, setEditingId]   = useState(null);   // null = new rule
  const [form, setForm]             = useState(EMPTY_FORM);
  const [productSearch, setProductSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, iRes] = await Promise.all([
        discountRulesAPI.getAll(),
        inventoryAPI.getAll(),
      ]);
      setRules(Array.isArray(rRes?.data) ? rRes.data : []);
      // Only sellable types make sense for discounts
      const inv = Array.isArray(iRes?.data) ? iRes.data : [];
      setInventory(inv.filter(i => !['RESOURCE','ASSET','LOCATION'].includes((i.type||'').toUpperCase())));
    } catch { setError('Failed to load discount rules.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (isOpen) load(); }, [isOpen, load]);

  const resetForm = () => { setForm(EMPTY_FORM); setEditingId(null); setError(''); };

  const startEdit = (rule) => {
    setEditingId(rule.id);
    setForm({
      name: rule.name || '',
      applies_to: rule.applies_to || 'all',
      item_ids: (() => { try { return JSON.parse(rule.item_ids || '[]'); } catch { return []; } })(),
      discount_type: rule.discount_type || 'percentage',
      discount_value: rule.discount_value ?? '',
      start_date: rule.start_date ? rule.start_date.slice(0, 16) : '',
      end_date: rule.end_date ? rule.end_date.slice(0, 16) : '',
      is_recurring: rule.is_recurring || false,
      recur_frequency: rule.recur_frequency || 'weekly',
      recur_days: (() => { try { return JSON.parse(rule.recur_days || '[]'); } catch { return []; } })(),
      recur_count: rule.recur_count ?? '',
      times_per_day: rule.times_per_day ?? '',
      day_start_time: rule.day_start_time || '',
      day_end_time: rule.day_end_time || '',
      is_active: rule.is_active !== false,
    });
    setError('');
  };

  const handleDelete = async (id) => {
    if (!await showConfirm('Delete this discount rule?')) return;
    try {
      await discountRulesAPI.delete(id);
      if (editingId === id) resetForm();
      load();
    } catch { setError('Failed to delete.'); }
  };

  const toggleProduct = (id) => {
    setForm(prev => ({
      ...prev,
      item_ids: prev.item_ids.includes(id)
        ? prev.item_ids.filter(x => x !== id)
        : [...prev.item_ids, id],
    }));
  };

  const toggleDay = (day) => {
    setForm(prev => ({
      ...prev,
      recur_days: prev.recur_days.includes(day)
        ? prev.recur_days.filter(d => d !== day)
        : [...prev.recur_days, day],
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Rule name is required.'); return; }
    if (!form.discount_value || parseFloat(form.discount_value) <= 0) { setError('Discount value must be greater than 0.'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        name: form.name.trim(),
        applies_to: form.applies_to,
        item_ids: form.applies_to === 'selected' ? JSON.stringify(form.item_ids) : null,
        discount_type: form.discount_type,
        discount_value: parseFloat(form.discount_value) || 0,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        is_recurring: form.is_recurring,
        recur_frequency: form.is_recurring ? form.recur_frequency : null,
        recur_days: form.is_recurring && form.recur_frequency === 'weekly' ? JSON.stringify(form.recur_days) : null,
        recur_count: form.recur_count !== '' ? parseInt(form.recur_count) : null,
        times_per_day: form.times_per_day !== '' ? parseInt(form.times_per_day) : null,
        day_start_time: form.day_start_time || null,
        day_end_time: form.day_end_time || null,
        is_active: form.is_active,
      };
      if (editingId) {
        await discountRulesAPI.update(editingId, payload);
      } else {
        await discountRulesAPI.create(payload);
      }
      resetForm();
      load();
    } catch { setError('Failed to save rule.'); }
    finally { setSaving(false); }
  };

  const filteredInventory = inventory.filter(i =>
    !productSearch || (i.name || '').toLowerCase().includes(productSearch.toLowerCase())
  );

  if (!isOpen) return null;

  // ── Styles ──────────────────────────────────────────────────────────────────
  const inp = {
    fontSize: '0.82rem', padding: '5px 8px',
    border: '1px solid var(--bs-border-color)',
    borderRadius: 6, background: 'var(--bs-body-bg)',
    color: 'var(--bs-body-color)', width: '100%',
  };
  const label = { fontSize: '0.75rem', fontWeight: 600, color: 'var(--bs-secondary-color)', marginBottom: 2, display: 'block' };
  const chip = (active) => ({
    padding: '2px 8px', borderRadius: 12, fontSize: '0.72rem', cursor: 'pointer',
    border: `1px solid ${active ? '#6366f1' : '#d1d5db'}`,
    background: active ? '#6366f1' : 'transparent',
    color: active ? '#fff' : 'var(--bs-body-color)',
  });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--bs-body-bg)', borderRadius: 12, width: '100%', maxWidth: 900, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.35)' }}>

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--bs-border-color)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <TagIcon style={{ width: 20, height: 20, color: '#6366f1' }} />
          <span style={{ fontWeight: 700, fontSize: '1rem' }}>Discount Rules</span>
          <span style={{ fontSize: '0.78rem', color: '#9ca3af', marginLeft: 4 }}>Schedule price reductions on inventory items</span>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
            <XMarkIcon style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* ── Body ─────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', minHeight: 0 }}>

          {/* Left — existing rules list */}
          <div style={{ width: 220, borderRight: '1px solid var(--bs-border-color)', overflowY: 'auto', padding: '10px 0' }}>
            <div style={{ padding: '0 12px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rules</span>
              <button onClick={resetForm} title="New rule" style={{ background: '#6366f1', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', padding: '2px 6px', fontSize: '0.75rem' }}>
                + New
              </button>
            </div>
            {loading && <div style={{ padding: '8px 12px', fontSize: '0.8rem', color: '#9ca3af' }}>Loading…</div>}
            {!loading && rules.length === 0 && (
              <div style={{ padding: '8px 12px', fontSize: '0.78rem', color: '#9ca3af' }}>No rules yet.</div>
            )}
            {rules.map(rule => (
              <div key={rule.id}
                onClick={() => startEdit(rule)}
                style={{
                  padding: '7px 12px', cursor: 'pointer', borderLeft: editingId === rule.id ? '3px solid #6366f1' : '3px solid transparent',
                  background: editingId === rule.id ? 'rgba(99,102,241,0.07)' : 'transparent',
                  display: 'flex', alignItems: 'flex-start', gap: 6,
                }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rule.name}</div>
                  <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                    {rule.discount_type === 'percentage' ? `${rule.discount_value}% off` : `$${rule.discount_value} off`}
                    {' · '}{rule.applies_to === 'all' ? 'All items' : 'Selected'}
                    {!rule.is_active && ' · ⏸ inactive'}
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(rule.id); }}
                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
                  <TrashIcon style={{ width: 13, height: 13 }} />
                </button>
              </div>
            ))}
          </div>

          {/* Right — product selector */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px 6px', borderBottom: '1px solid var(--bs-border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ ...label, margin: 0 }}>Apply to</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', cursor: 'pointer' }}>
                  <input type="radio" name="applies_to" value="all"
                    checked={form.applies_to === 'all'}
                    onChange={() => setForm(p => ({ ...p, applies_to: 'all', item_ids: [] }))} />
                  All products
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', cursor: 'pointer' }}>
                  <input type="radio" name="applies_to" value="selected"
                    checked={form.applies_to === 'selected'}
                    onChange={() => setForm(p => ({ ...p, applies_to: 'selected' }))} />
                  Selected only
                </label>
                {form.applies_to === 'selected' && (
                  <button onClick={() => setForm(p => ({ ...p, item_ids: inventory.map(i => i.id) }))}
                    style={{ marginLeft: 'auto', fontSize: '0.72rem', padding: '2px 8px', borderRadius: 4, background: 'none', border: '1px solid #6366f1', color: '#6366f1', cursor: 'pointer' }}>
                    Select All
                  </button>
                )}
                {form.applies_to === 'selected' && form.item_ids.length > 0 && (
                  <button onClick={() => setForm(p => ({ ...p, item_ids: [] }))}
                    style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 4, background: 'none', border: '1px solid #d1d5db', color: '#6b7280', cursor: 'pointer' }}>
                    Clear
                  </button>
                )}
              </div>
              {form.applies_to === 'selected' && (
                <input
                  type="text" placeholder="Search products…" value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  style={{ ...inp, fontSize: '0.78rem' }}
                />
              )}
            </div>

            {/* Product list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px 14px' }}>
              {form.applies_to === 'all' ? (
                <div style={{ padding: '24px 0', textAlign: 'center', color: '#9ca3af', fontSize: '0.85rem' }}>
                  This rule will apply to all sellable inventory items.
                </div>
              ) : (
                filteredInventory.map(item => {
                  const checked = form.item_ids.includes(item.id);
                  return (
                    <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 2px', cursor: 'pointer', borderBottom: '1px solid var(--bs-border-color)', fontSize: '0.82rem' }}>
                      <input type="checkbox" checked={checked} onChange={() => toggleProduct(item.id)} />
                      <span style={{ flex: 1 }}>{item.name}</span>
                      <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>${item.price?.toFixed(2)}</span>
                      <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: 8, background: '#f3f4f6', color: '#6b7280' }}>{item.type}</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ── Footer — discount + schedule params ──────────────────────── */}
        <div style={{ borderTop: '2px solid var(--bs-border-color)', padding: '12px 18px', background: 'var(--bs-tertiary-bg, #f9fafb)' }}>
          {error && <div style={{ fontSize: '0.78rem', color: '#ef4444', marginBottom: 8 }}>{error}</div>}

          {/* Row 1: name + discount type/value + active toggle */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', marginBottom: 10 }}>
            <div style={{ flex: '2 1 160px' }}>
              <span style={label}>Rule name</span>
              <input style={inp} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Summer Sale" />
            </div>
            <div style={{ flex: '1 1 110px' }}>
              <span style={label}>Discount type</span>
              <select style={inp} value={form.discount_type} onChange={e => setForm(p => ({ ...p, discount_type: e.target.value }))}>
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed amount ($)</option>
              </select>
            </div>
            <div style={{ flex: '0 1 90px' }}>
              <span style={label}>{form.discount_type === 'percentage' ? 'Discount %' : 'Discount $'}</span>
              <input type="number" min="0" step="0.01" style={inp} value={form.discount_value}
                onChange={e => setForm(p => ({ ...p, discount_value: e.target.value }))}
                placeholder={form.discount_type === 'percentage' ? '15' : '5.00'} />
            </div>
            <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 4 }}>
              <input type="checkbox" id="dr-active" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />
              <label htmlFor="dr-active" style={{ fontSize: '0.8rem', cursor: 'pointer' }}>Active</label>
            </div>
          </div>

          {/* Row 2: date window */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', marginBottom: 10 }}>
            <div style={{ flex: '1 1 160px' }}>
              <span style={label}>Start date</span>
              <input type="datetime-local" style={inp} value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} />
            </div>
            <div style={{ flex: '1 1 160px' }}>
              <span style={label}>End date</span>
              <input type="datetime-local" style={inp} value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} />
            </div>
            <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 4 }}>
              <input type="checkbox" id="dr-recur" checked={form.is_recurring} onChange={e => setForm(p => ({ ...p, is_recurring: e.target.checked }))} />
              <label htmlFor="dr-recur" style={{ fontSize: '0.8rem', cursor: 'pointer' }}>Recurring</label>
            </div>
          </div>

          {/* Row 3: recurring options (conditional) */}
          {form.is_recurring && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', marginBottom: 10, padding: '8px 10px', background: 'rgba(99,102,241,0.06)', borderRadius: 6, border: '1px solid rgba(99,102,241,0.15)' }}>
              <div style={{ flex: '0 1 120px' }}>
                <span style={label}>Frequency</span>
                <select style={inp} value={form.recur_frequency} onChange={e => setForm(p => ({ ...p, recur_frequency: e.target.value }))}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              {form.recur_frequency === 'weekly' && (
                <div>
                  <span style={label}>Days of week</span>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {DAYS.map(d => (
                      <button key={d} onClick={() => toggleDay(d)} style={chip(form.recur_days.includes(d))}>{d}</button>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ flex: '0 1 80px' }}>
                <span style={label}>Times/day</span>
                <input type="number" min="1" style={inp} value={form.times_per_day} onChange={e => setForm(p => ({ ...p, times_per_day: e.target.value }))} placeholder="e.g. 2" />
              </div>
              <div style={{ flex: '0 1 90px' }}>
                <span style={label}>Day start</span>
                <input type="time" style={inp} value={form.day_start_time} onChange={e => setForm(p => ({ ...p, day_start_time: e.target.value }))} />
              </div>
              <div style={{ flex: '0 1 90px' }}>
                <span style={label}>Day end</span>
                <input type="time" style={inp} value={form.day_end_time} onChange={e => setForm(p => ({ ...p, day_end_time: e.target.value }))} />
              </div>
              <div style={{ flex: '0 1 90px' }}>
                <span style={label}>Repeat count</span>
                <input type="number" min="1" style={inp} value={form.recur_count} onChange={e => setForm(p => ({ ...p, recur_count: e.target.value }))} placeholder="∞" />
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={resetForm} style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid var(--bs-border-color)', background: 'none', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--bs-body-color)' }}>
              {editingId ? 'New Rule' : 'Clear'}
            </button>
            <button onClick={handleSave} disabled={saving}
              style={{ padding: '6px 18px', borderRadius: 6, border: 'none', background: '#6366f1', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}>
              {saving ? 'Saving…' : editingId ? <><PencilIcon style={{ width: 14, height: 14 }} /> Update Rule</> : <><CheckIcon style={{ width: 14, height: 14 }} /> Save Rule</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
