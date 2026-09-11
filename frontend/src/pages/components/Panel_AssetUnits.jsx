import React, { useState, useEffect, useCallback, useMemo } from "react";
import { assetUnitsAPI, employeesAPI, inventoryAPI } from "../../services/api";
import { showConfirm } from "../../services/showConfirm";
import { XMarkIcon } from "@heroicons/react/24/outline";
import useViewMode from "../../services/useViewMode";
import Toggle_MultiSelectIcon from "./Toggle_MultiSelectIcon";
import Dropdown_Custom from "./Dropdown_Custom";

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
        className="form-control ui-control-sm"
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
    <span onClick={() => setEditing(true)} title="Click to edit" className="ui-small-muted" style={{ cursor: "text", userSelect: "none" }}>
      {value || <em>{placeholder}</em>}
    </span>
  );
}

export default function AssetUnitsPanel({ assetId, onCountChange, perPage = 25 }) {
  const [units, setUnits] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [availableLocations, setAvailableLocations] = useState([]);
  const [unitSearchTerm, setUnitSearchTerm] = useState("");
  const [selectedUnitIds, setSelectedUnitIds] = useState(new Set());
  const [bulkStateSelection, setBulkStateSelection] = useState("");
  const [bulkAssigneeSelection, setBulkAssigneeSelection] = useState("");
  const [bulkLocationSelection, setBulkLocationSelection] = useState("");
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

  const employeeNameById = useMemo(() => {
    const map = new Map();
    employees.forEach((employee) => {
      map.set(employee.id, employeeLabel(employee));
    });
    return map;
  }, [employees]);

  const filteredUnits = useMemo(() => {
    const needle = unitSearchTerm.trim().toLowerCase();
    if (!needle) return units;
    return units.filter((unit) => {
      const assignedLabel = unit.employee_id ? employeeNameById.get(unit.employee_id) || "" : "shared";
      const stateLabel = STATE_LABELS[unit.state] || unit.state || "";
      const haystack = [unit.label || "", unit.location || "", assignedLabel, stateLabel].join(" ").toLowerCase();
      return haystack.includes(needle);
    });
  }, [employeeNameById, unitSearchTerm, units]);

  const pagedUnits = useMemo(() => {
    const start = (page - 1) * perPageSafe;
    return filteredUnits.slice(start, start + perPageSafe);
  }, [filteredUnits, page, perPageSafe]);

  const totalPages = Math.max(1, Math.ceil(filteredUnits.length / perPageSafe));
  const allPageSelected = pagedUnits.length > 0 && pagedUnits.every((u) => selectedUnitIds.has(u.id));
  const selectedCount = selectedUnitIds.size;

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [unitSearchTerm]);

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
    <div className="border mb-2 mt-3 p-1 rounded">
      {/* Header */}
      <div className="align-items-center d-flex gap-2 mb-2">
        <h6 className="fw-semibold mb-0">Asset Units</h6>
        {loading && <span className="spinner-border spinner-border-sm" role="status" />}
        <span className="ui-small-muted">({units.length} total)</span>
        {unitSearchTerm.trim() && <span className="ui-small-muted">({filteredUnits.length} shown)</span>}
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
        <div className="align-items-center bg-light-subtle border d-flex flex-wrap gap-2 mb-2 p-0 rounded">
          <span className="fw-semibold ui-text-sm">{selectedCount} selected</span>
          <Dropdown_Custom
            className="form-select ui-control-sm"
            style={{ width: 140 }}
            value={bulkStateSelection}
            disabled={saving}
            onChange={(e) => {
              const nextValue = e.target.value;
              if (!nextValue) return;
              setBulkStateSelection(nextValue);
              void applyBulkUpdate({ state: nextValue }).finally(() => setBulkStateSelection(""));
            }}
            options={[
              { value: "", label: "Set state..." },
              ...Object.entries(STATE_LABELS).map(([s, l]) => ({ value: s, label: l })),
            ]}
          />
          <Dropdown_Custom
            className="form-select ui-control-sm"
            style={{ width: 180 }}
            value={bulkAssigneeSelection}
            disabled={saving}
            onChange={(e) => {
              const nextValue = e.target.value;
              if (!nextValue) return;
              setBulkAssigneeSelection(nextValue);
              const nextEmployeeId = nextValue === "shared" ? null : nextValue;
              void applyBulkUpdate({ employee_id: nextEmployeeId }).finally(() => setBulkAssigneeSelection(""));
            }}
            options={[
              { value: "", label: "Assign..." },
              { value: "shared", label: "Shared" },
              ...employees.map((employee) => ({ value: String(employee.id), label: employeeLabel(employee) })),
            ]}
          />
          <Dropdown_Custom
            className="form-select ui-control-sm"
            style={{ width: 180 }}
            value={bulkLocationSelection}
            disabled={saving}
            onChange={(e) => {
              const nextValue = e.target.value;
              if (!nextValue) return;
              setBulkLocationSelection(nextValue);
              const nextLocation = nextValue === "__none__" ? null : nextValue;
              void applyBulkUpdate({ location: nextLocation }).finally(() => setBulkLocationSelection(""));
            }}
            options={[
              { value: "", label: "Set location..." },
              { value: "__none__", label: "No location" },
              ...availableLocations.map((location) => ({ value: location, label: location })),
            ]}
          />
          <button className="btn btn-outline-danger btn-sm" onClick={handleBulkRemove} disabled={saving}>
            Remove selected
          </button>
        </div>
      )}

      {/* Units table */}
      {units.length > 0 && (
        <div className="mb-2 table-responsive">
          <table className="align-middle mb-0 table table-sm" style={{ borderCollapse: "collapse" }}>
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
              {pagedUnits.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-1 small text-muted">
                    No asset units match the current search.
                  </td>
                </tr>
              ) : (
                pagedUnits.map((unit) => (
                  <tr key={unit.id} style={{ borderBottom: "1px solid var(--bs-border-color)" }}>
                    <td className="text-center" style={{ border: "none" }}>
                      <Toggle_MultiSelectIcon selected={selectedUnitIds.has(unit.id)} onToggle={() => handleToggleSelected(unit.id)} title="Select unit" />
                    </td>
                    <td style={{ border: "none" }}>
                      <button className="btn btn-circle btn-outline-danger" onClick={() => handleRemove(unit.id)} title="Remove unit">
                        <XMarkIcon className="ui-icon-4" />
                      </button>
                    </td>
                    <td style={{ border: "none" }}>
                      <InlineText value={unit.label || ""} onSave={(val) => handleLabelSave(unit.id, val)} placeholder="click to set label" />
                    </td>
                    <td style={{ border: "none" }}>
                      <Dropdown_Custom
                        className="form-select ui-control-sm"
                        value={unit.location || "__none__"}
                        onChange={(e) => handleLocationChange(unit.id, e.target.value)}
                        options={[
                          { value: "__none__", label: "No location" },
                          ...availableLocations.map((location) => ({ value: location, label: location })),
                        ]}
                      />
                    </td>
                    <td style={{ border: "none" }}>
                      <Dropdown_Custom
                        className="form-select ui-control-sm"
                        value={unit.employee_id ? String(unit.employee_id) : "shared"}
                        onChange={(e) => handleEmployeeChange(unit.id, e.target.value)}
                        options={[
                          { value: "shared", label: "Shared" },
                          ...employees.map((employee) => ({ value: String(employee.id), label: employeeLabel(employee) })),
                        ]}
                      />
                    </td>
                    <td style={{ border: "none" }}>
                      <Dropdown_Custom
                        className={`form-select form-select-sm border-${STATE_COLORS[unit.state]}`}
                        value={unit.state}
                        onChange={(e) => handleStateChange(unit.id, e.target.value)}
                        options={Object.entries(STATE_LABELS).map(([s, l]) => ({ value: s, label: l }))}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {units.length > 0 && (
        <div className="align-items-center d-flex justify-content-between mb-2">
          <div className="ui-small-muted">
            Page {page} of {totalPages}
          </div>
          <div className="ui-flex-center-gap-2">
            <button className="btn ui-btn-outline-secondary-sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              Prev
            </button>
            <button className="btn ui-btn-outline-secondary-sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
              Next
            </button>
          </div>
        </div>
      )}

      <div className="align-items-center d-flex flex-wrap gap-2 justify-content-between mb-1">
        <button className="btn btn-outline-primary btn-sm" onClick={handleAddUnit} disabled={saving}>
          {isTrainingMode ? (saving ? "Adding..." : "+ Add") : saving ? "..." : "+"}
        </button>
        <input type="text" className="form-control ui-control-sm" style={{ width: "320px", maxWidth: "100%" }} placeholder="Search label, location, assigned, state..." value={unitSearchTerm} onChange={(e) => setUnitSearchTerm(e.target.value)} />
      </div>

      {error && (
        <div className="mt-2 small text-danger">
          {error}{" "}
          <button className="btn btn-link btn-sm p-0 text-danger text-decoration-underline" onClick={() => setError(null)}>
            dismiss
          </button>
        </div>
      )}
    </div>
  );
}
