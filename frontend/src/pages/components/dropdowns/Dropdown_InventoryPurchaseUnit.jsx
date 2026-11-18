import React, { useEffect, useMemo, useState } from "react";
import Dropdown_Custom from "./Dropdown_Custom";
import { inventoryPurchaseUnitsAPI } from "../../../services/api";

const BUILT_IN_UNITS = [
  { value: "container", label: "Container" },
  { value: "pallet", label: "Pallet" },
  { value: "crate", label: "Crate" },
  { value: "carton", label: "Carton" },
  { value: "case", label: "Case" },
  { value: "box", label: "Box" },
  { value: "pack", label: "Pack" },
  { value: "pair", label: "Pair" },
  { value: "unit", label: "Unit" },
];

export default function Dropdown_InventoryPurchaseUnit({
  id,
  name = "purchase_unit",
  value,
  onChange,
  disabled = false,
}) {
  const [customUnits, setCustomUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    inventoryPurchaseUnitsAPI.getAll()
      .then((response) => {
        const rows = response?.data ?? response;
        if (!Array.isArray(rows)) throw new Error("Invalid purchase-unit data received.");
        if (active) setCustomUnits(rows);
      })
      .catch((loadError) => {
        if (active) {
          setError(String(loadError?.response?.data?.detail || loadError?.message || "Failed to load custom purchase units."));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const options = useMemo(() => {
    const seen = new Set(BUILT_IN_UNITS.map((unit) => unit.value.toLocaleLowerCase()));
    const customOptions = customUnits
      .filter((unit) => unit?.name && !seen.has(String(unit.name).toLocaleLowerCase()))
      .map((unit) => {
        seen.add(String(unit.name).toLocaleLowerCase());
        return { value: unit.name, label: unit.name };
      });
    const currentValue = String(value || "").trim();
    if (currentValue && !seen.has(currentValue.toLocaleLowerCase())) {
      customOptions.push({ value: currentValue, label: currentValue });
    }
    return [...BUILT_IN_UNITS, ...customOptions];
  }, [customUnits, value]);

  const handleCreateFromSearch = async (searchTerm) => {
    const unitName = String(searchTerm || "").trim();
    if (!unitName) return;
    const builtIn = BUILT_IN_UNITS.find((unit) => unit.value.toLocaleLowerCase() === unitName.toLocaleLowerCase());
    if (builtIn) {
      onChange?.({ target: { name, value: builtIn.value } });
      return;
    }

    setCreating(true);
    setError("");
    try {
      const response = await inventoryPurchaseUnitsAPI.create(unitName);
      const unit = response?.data ?? response;
      if (!unit?.name) throw new Error("Purchase unit was saved without a name.");
      setCustomUnits((previous) => (
        previous.some((entry) => entry.name.toLocaleLowerCase() === unit.name.toLocaleLowerCase())
          ? previous
          : [...previous, unit]
      ));
      onChange?.({ target: { name, value: unit.name } });
    } catch (createError) {
      setError(String(createError?.response?.data?.detail || createError?.message || "Failed to create custom purchase unit."));
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <Dropdown_Custom
        id={id}
        name={name}
        floatingLabel="unit"
        value={value}
        onChange={onChange}
        disabled={disabled}
        loading={loading || creating}
        options={options}
        preserveOptionOrder
        onCreateFromSearch={handleCreateFromSearch}
        createButtonTitle="Add company purchase unit"
        placeholder="Select purchase unit"
        closeOnSelect
      />
      <div className="form-text">Set the package size on this item. Custom units are shared within your company.</div>
      {error && <div className="small text-danger" role="alert">{error}</div>}
    </>
  );
}
