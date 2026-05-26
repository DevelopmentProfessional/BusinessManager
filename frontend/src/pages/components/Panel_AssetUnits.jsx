import React, { useState, useEffect, useCallback } from "react";
import { assetUnitsAPI, employeesAPI } from "../../services/api";
import { showConfirm } from "../../services/showConfirm";
import { TrashIcon } from "@heroicons/react/24/outline";
import useViewMode from "../../services/useViewMode";

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

export default function AssetUnitsPanel({ assetId, onCountChange }) {
  const [units, setUnits] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [addingUnit, setAddingUnit] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newEmployeeId, setNewEmployeeId] = useState("shared");
  const [newState, setNewState] = useState("available");
  const [saving, setSaving] = useState(false);
  const { isTrainingMode } = useViewMode();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, employeesRes] = await Promise.all([assetUnitsAPI.list(assetId), employeesAPI.getAll()]);
      const list = res?.data ?? res ?? [];
      const employeesList = employeesRes?.data ?? employeesRes ?? [];
      setUnits(list);
      setEmployees(Array.isArray(employeesList) ? employeesList : []);
      onCountChange?.(list.length);
    } catch {
      setError("Failed to load asset units.");
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAddUnit = async () => {
    setSaving(true);
    try {
      await assetUnitsAPI.add(assetId, {
        label: newLabel.trim() || null,
        employee_id: newEmployeeId === "shared" ? null : newEmployeeId,
        state: newState,
        notes: null,
      });
      setNewLabel("");
      setNewEmployeeId("shared");
      setNewState("available");
      setAddingUnit(false);
      await load();
    } catch {
      setError("Failed to add unit.");
    } finally {setSaving(false);}
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

      {/* Units table */}
      {units.length > 0 && (
        <div className="table-responsive mb-2">
          <table className="table table-sm align-middle mb-0" style={{ borderCollapse: "collapse" }}>
            <thead className="">
              <tr>                
                <th style={{ width: "2rem", borderBottom: "1px solid var(--bs-border-color)", borderTop: "none", borderLeft: "none", borderRight: "none" }}></th>
                <th style={{ borderBottom: "1px solid var(--bs-border-color)", borderTop: "none", borderLeft: "none", borderRight: "none" }}>Label</th>
                <th style={{ borderBottom: "1px solid var(--bs-border-color)", borderTop: "none", borderLeft: "none", borderRight: "none" }}>Assigned</th>
                <th style={{ borderBottom: "1px solid var(--bs-border-color)", borderTop: "none", borderLeft: "none", borderRight: "none" }}>State</th>
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => (
                <tr key={unit.id} style={{ borderBottom: "1px solid var(--bs-border-color)" }}>
                  <td style={{ border: "none" }}>
                    <button className="btn btn-circle btn-outline-danger" onClick={() => handleRemove(unit.id)} title="Remove unit">
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </td>
                  <td style={{ border: "none" }}>
                    <InlineText value={unit.label || ""} onSave={(val) => handleLabelSave(unit.id, val)} placeholder="click to set label" />
                  </td>
                  <td style={{ border: "none" }}>
                    <select className="form-select form-select-sm" value={unit.employee_id || "shared"} onChange={(e) => handleEmployeeChange(unit.id, e.target.value)}>
                      <option value="shared">Shared</option>
                      {employees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {`${employee.first_name || ""} ${employee.last_name || ""}`.trim() || employee.username || "Employee"}
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

      {/* Add unit inline form */}
      {addingUnit ? (
        <div className="d-flex gap-2 align-items-center flex-wrap mb-1">
          <input
            type="text"
            className="form-control form-control-sm"
            placeholder="Label (optional)"
            value={newLabel}
            style={{ maxWidth: "150px" }}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddUnit();
            }}
          />
          <select className="form-select form-select-sm" style={{ maxWidth: "180px" }} value={newEmployeeId} onChange={(e) => setNewEmployeeId(e.target.value)}>
            <option value="shared">Shared</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {`${employee.first_name || ""} ${employee.last_name || ""}`.trim() || employee.username || "Employee"}
              </option>
            ))}
          </select>
          <select className="form-select form-select-sm" style={{ maxWidth: "140px" }} value={newState} onChange={(e) => setNewState(e.target.value)}>
            {Object.entries(STATE_LABELS).map(([s, l]) => (
              <option key={s} value={s}>
                {l}
              </option>
            ))}
          </select>
          <button className="btn btn-sm btn-success" onClick={handleAddUnit} disabled={saving}>
            {saving ? "…" : "Add"}
          </button>
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={() => {
              setAddingUnit(false);
              setNewLabel("");
              setNewEmployeeId("shared");
              setNewState("available");
            }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button className="btn btn-sm btn-outline-primary" onClick={() => setAddingUnit(true)}>
          {isTrainingMode ? "+ Add" : "+"}
        </button>
      )}

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
