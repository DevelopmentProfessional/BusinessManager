import React, { useState, useEffect, useCallback, useMemo } from "react";
import { assetUnitsAPI, employeesAPI, inventoryAPI } from "../../services/api";
import { showConfirm } from "../../services/showConfirm";
import { XMarkIcon } from "@heroicons/react/24/outline";
import useViewMode from "../../services/useViewMode";
import Toggle_MultiSelectIcon from "./Toggle_MultiSelectIcon";

const STATE_LABELS = {
  available: "Available",
  in_use: "In Use",
  maintenance: "Maintenance",
  arriving_soon: "Arriving Soon",
};

const STATE_COLORS = {
  available: "success",
  in_use: "primary",
  maintenance: "warning",
  arriving_soon: "info",
};

/** Small inline editable cell — click to begin editing, blur or Enter to save */
function InlineText({ value, onSave, placeholder = "—" }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

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
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        style={{ minWidth: "80px" }}
      />
    );
  }
  return (
    <span onClick={() => setEditing(true)} title="Click to edit" className="text-muted small" style={{ cursor: "text", userSelect: "none" }}>
      {value || <em>{placeholder}</em>}
    </span>
  );
}

export default function AssetUnitsPanel({ assetId, onCountChange, perPage = 25 }) {
  const [units, setUnits] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [availableLocations, setAvailableLocations] = useState([]);
  const [selectedUnitIds, setSelectedUnitIds] = useState(new Set());
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const { isTrainingMode } = useViewMode();

  const perPageSafe = Number.isFinite(Number(perPage)) ? Math.max(1, Number(perPage)) : 25;

  const employeeLabel = (employee) => {
    return `${employee.first_name || ""} ${employee.last_name || ""}`.trim() || employee.username || "Employee";
  };

  const toLocationList = (payload) => {
    const data = payload?.data ?? payload;
    if (Array.isArray(data)) return data.filter(Boolean);
    if (Array.isArray(data?.locations)) return data.locations.filter(Boolean);
    return [];
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, employeesRes, locationsRes] = await Promise.all([assetUnitsAPI.list(assetId), employeesAPI.getAll(), inventoryAPI.getLocations().catch(() => ({ data: [] }))]);
      const list = res?.data ?? res ?? [];
      const employeesList = employeesRes?.data ?? employeesRes ?? [];
      const locationsList = [...new Set([...toLocationList(locationsRes), ...list.map((u) => u?.location).filter(Boolean)])];
      setUnits(list);
      setEmployees(Array.isArray(employeesList) ? employeesList : []);
      setAvailableLocations(locationsList);
      onCountChange?.(list.length);
    } catch {
      setError("Failed to load asset units.");
    } finally {
      setLoading(false);
    }
  }, [assetId, onCountChange]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [perPageSafe]);

  useEffect(() => {
    setSelectedUnitIds((prev) => {
      const next = new Set([...prev].filter((id) => units.some((u) => u.id === id)));
      return next;
    });
    const totalPages = Math.max(1, Math.ceil(units.length / perPageSafe));
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [units, page, perPageSafe]);

  const handleAddUnit = async () => {
    setSaving(true);
    try {
      await assetUnitsAPI.add(assetId, {
        label: `Unit ${units.length + 1}`,
        location: null,
        employee_id: null,
        state: "available",
        notes: null,
      });
      await load();
    } catch {
      setError("Failed to add unit.");
    } finally {
      setSaving(false);
    }
  };

  const handleStateChange = async (unitId, state) => {
    setUnits((prev) => prev.map((u) => (u.id === unitId ? { ...u, state } : u)));
    try {
      await assetUnitsAPI.update(assetId, unitId, { state });
    } catch {
      setError("Failed to update state.");
      load(); // revert on error
    }
  };

  const handleEmployeeChange = async (unitId, employeeId) => {
    const nextEmployeeId = employeeId === "shared" ? null : employeeId;
    setUnits((prev) => prev.map((u) => (u.id === unitId ? { ...u, employee_id: nextEmployeeId } : u)));
    try {
      await assetUnitsAPI.update(assetId, unitId, { employee_id: nextEmployeeId });
    } catch {
      setError("Failed to update assignment.");
      load();
    }
  };

  const handleLocationChange = async (unitId, location) => {
    const nextLocation = location === "__none__" ? null : location;
    setUnits((prev) => prev.map((u) => (u.id === unitId ? { ...u, location: nextLocation } : u)));
    try {
      await assetUnitsAPI.update(assetId, unitId, { location: nextLocation });
    } catch {
      setError("Failed to update location.");
      load();
    }
  };

  const handleLabelSave = async (unitId, label) => {
    setUnits((prev) => prev.map((u) => (u.id === unitId ? { ...u, label } : u)));
    try {
      await assetUnitsAPI.update(assetId, unitId, { label: label || null });
    } catch {
      setError("Failed to save label.");
      load();
    }
  };

  const handleNotesSave = async (unitId, notes) => {
    setUnits((prev) => prev.map((u) => (u.id === unitId ? { ...u, notes } : u)));
    try {
      await assetUnitsAPI.update(assetId, unitId, { notes: notes || null });
    } catch {
      setError("Failed to save notes.");
      load();
    }
  };

  const handleRemove = async (unitId) => {
    if (!(await showConfirm("Remove this unit? This cannot be undone.", { confirmLabel: "Remove" }))) return;
    try {
      await assetUnitsAPI.remove(assetId, unitId);
      await load(); // load() already calls onCountChange
    } catch {
      setError("Failed to remove unit.");
    }
  };

  const handleToggleSelected = (unitId) => {
    setSelectedUnitIds((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  };

  const pagedUnits = useMemo(() => {
    const start = (page - 1) * perPageSafe;
    return units.slice(start, start + perPageSafe);
  }, [units, page, perPageSafe]);

  const totalPages = Math.max(1, Math.ceil(units.length / perPageSafe));
  const allPageSelected = pagedUnits.length > 0 && pagedUnits.every((u) => selectedUnitIds.has(u.id));
  const selectedCount = selectedUnitIds.size;

  const handleToggleSelectAllPage = () => {
    setSelectedUnitIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        pagedUnits.forEach((u) => next.delete(u.id));
      } else {
        pagedUnits.forEach((u) => next.add(u.id));
      }
      return next;
    });
  };

  const applyBulkUpdate = async (changes) => {
    const ids = [...selectedUnitIds];
    if (!ids.length) return;
    setSaving(true);
    try {
      await Promise.all(ids.map((id) => assetUnitsAPI.update(assetId, id, changes)));
      setSelectedUnitIds(new Set());
      await load();
    } catch {
      setError("Failed to update selected units.");
    } finally {
      setSaving(false);
    }
  };

  const handleBulkRemove = async () => {
    const ids = [...selectedUnitIds];
    if (!ids.length) return;
    if (!(await showConfirm(`Remove ${ids.length} selected unit${ids.length > 1 ? "s" : ""}? This cannot be undone.`, { confirmLabel: "Remove" }))) return;
    setSaving(true);
    try {
      await Promise.all(ids.map((id) => assetUnitsAPI.remove(assetId, id)));
      setSelectedUnitIds(new Set());
      await load();
    } catch {
      setError("Failed to remove selected units.");
    } finally {
      setSaving(false);
    }
  };

  const stateCounts = units.reduce((acc, u) => {
    acc[u.state] = (acc[u.state] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mt-3 mb-2 border rounded p-1">
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

      {selectedCount > 0 && (
        <div className="d-flex flex-wrap align-items-center gap-2 mb-2 p-2 border rounded bg-light-subtle">
          <span className="small fw-semibold">{selectedCount} selected</span>
          <select className="form-select form-select-sm" style={{ width: 140 }} defaultValue="" disabled={saving} onChange={(e) => {
            if (!e.target.value) return;
            applyBulkUpdate({ state: e.target.value });
            e.target.value = "";
          }}>
            <option value="">Set state...</option>
            {Object.entries(STATE_LABELS).map(([s, l]) => (
              <option key={s} value={s}>{l}</option>
            ))}
          </select>
          <select className="form-select form-select-sm" style={{ width: 180 }} defaultValue="" disabled={saving} onChange={(e) => {
            if (!e.target.value) return;
            const nextEmployeeId = e.target.value === "shared" ? null : e.target.value;
            applyBulkUpdate({ employee_id: nextEmployeeId });
            e.target.value = "";
          }}>
            <option value="">Assign...</option>
            <option value="shared">Shared</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>{employeeLabel(employee)}</option>
            ))}
          </select>
          <select className="form-select form-select-sm" style={{ width: 180 }} defaultValue="" disabled={saving} onChange={(e) => {
            if (!e.target.value) return;
            const nextLocation = e.target.value === "__none__" ? null : e.target.value;
            applyBulkUpdate({ location: nextLocation });
            e.target.value = "";
          }}>
            <option value="">Set location...</option>
            <option value="__none__">No location</option>
            {availableLocations.map((location) => (
              <option key={location} value={location}>{location}</option>
            ))}
          </select>
          <button className="btn btn-sm btn-outline-danger" onClick={handleBulkRemove} disabled={saving}>Remove selected</button>
        </div>
      )}

      {/* Units table */}
      {units.length > 0 && (
        <div className="table-responsive mb-2">
          <table className="table table-sm align-middle mb-0" style={{ borderCollapse: "collapse" }}>
            <thead className="">
              <tr>
                <th className="text-center" style={{ width: "3.25rem", borderBottom: "1px solid var(--bs-border-color)", borderTop: "none", borderLeft: "none", borderRight: "none" }}>
                  <Toggle_MultiSelectIcon selected={allPageSelected} onToggle={handleToggleSelectAllPage} title="Select all on this page" />
                </th>
                <th style={{ width: "2rem", borderBottom: "1px solid var(--bs-border-color)", borderTop: "none", borderLeft: "none", borderRight: "none" }}></th>
                <th style={{ borderBottom: "1px solid var(--bs-border-color)", borderTop: "none", borderLeft: "none", borderRight: "none" }}>Label</th>
                <th style={{ borderBottom: "1px solid var(--bs-border-color)", borderTop: "none", borderLeft: "none", borderRight: "none" }}>Location</th>
                <th style={{ borderBottom: "1px solid var(--bs-border-color)", borderTop: "none", borderLeft: "none", borderRight: "none" }}>Assigned</th>
                <th style={{ borderBottom: "1px solid var(--bs-border-color)", borderTop: "none", borderLeft: "none", borderRight: "none" }}>State</th>
              </tr>
            </thead>
            <tbody>
              {pagedUnits.map((unit) => (
                <tr key={unit.id} style={{ borderBottom: "1px solid var(--bs-border-color)" }}>
                  <td className="text-center" style={{ border: "none" }}>
                    <Toggle_MultiSelectIcon selected={selectedUnitIds.has(unit.id)} onToggle={() => handleToggleSelected(unit.id)} title="Select unit" />
                  </td>
                  <td style={{ border: "none" }}>
                    <button className="btn btn-circle btn-outline-danger" onClick={() => handleRemove(unit.id)} title="Remove unit">
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </td>
                  <td style={{ border: "none" }}>
                    <InlineText value={unit.label || ""} onSave={(val) => handleLabelSave(unit.id, val)} placeholder="click to set label" />
                  </td>
                  <td style={{ border: "none" }}>
                    <select className="form-select form-select-sm" value={unit.location || "__none__"} onChange={(e) => handleLocationChange(unit.id, e.target.value)}>
                      <option value="__none__">No location</option>
                      {availableLocations.map((location) => (
                        <option key={location} value={location}>{location}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ border: "none" }}>
                    <select className="form-select form-select-sm" value={unit.employee_id || "shared"} onChange={(e) => handleEmployeeChange(unit.id, e.target.value)}>
                      <option value="shared">Shared</option>
                      {employees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employeeLabel(employee)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ border: "none" }}>
                    <select className={`form-select form-select-sm border-${STATE_COLORS[unit.state]}`} value={unit.state} onChange={(e) => handleStateChange(unit.id, e.target.value)}>
                      {Object.entries(STATE_LABELS).map(([s, l]) => (
                        <option key={s} value={s}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {units.length > 0 && (
        <div className="d-flex align-items-center justify-content-between mb-2">
          <div className="small text-muted">
            Page {page} of {totalPages}
          </div>
          <div className="d-flex align-items-center gap-2">
            <button className="btn btn-sm btn-outline-secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              Prev
            </button>
            <button className="btn btn-sm btn-outline-secondary" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
              Next
            </button>
          </div>
        </div>
      )}

      <button className="btn btn-sm btn-outline-primary" onClick={handleAddUnit} disabled={saving}>
        {isTrainingMode ? (saving ? "Adding..." : "+ Add") : saving ? "..." : "+"}
      </button>

      {error && (
        <div className="text-danger small mt-2">
          {error}{" "}
          <button className="btn btn-link btn-sm p-0 text-danger text-decoration-underline" onClick={() => setError(null)}>
            dismiss
          </button>
        </div>
      )}
    </div>
  );
}
