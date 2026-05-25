import React from "react";

/** Default catalog visibility for Sales POS and history filters. */
export const DEFAULT_CATALOG_FILTER = {
  showServices: true,
  showProducts: true,
  showSubscriptions: true,
};

const CATALOG_ITEMS = [
  { key: "showServices", label: "Services" },
  { key: "showProducts", label: "Products" },
  { key: "showSubscriptions", label: "Subs" },
];

/**
 * Checkbox group for Services / Products / Subs — shared by Sales page and Sales History.
 */
export default function Filter_CatalogCheckboxes({ value = {}, onChange, legend = "Catalog", className = "" }) {
  const setChecked = (key, checked) => {
    if (typeof onChange === "function") {
      onChange(key, checked);
    }
  };

  return (
    <div className={className}>
      {legend ? <span className="small text-muted d-block mb-1">{legend}</span> : null}
      <div className="app-filter-checkgroup d-flex flex-wrap gap-3" role="group" aria-label={legend || "Catalog types"}>
        {CATALOG_ITEMS.map(({ key, label }) => (
          <label key={key} className="app-filter-check mb-0">
            <input type="checkbox" className="form-check-input" checked={!!value[key]} onChange={(e) => setChecked(key, e.target.checked)} />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
