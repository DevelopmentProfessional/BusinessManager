import React from "react";
import Dropdown_Custom from "./Dropdown_Custom";

/** Default catalog visibility for Sales POS and history filters. */
// eslint-disable-next-line react-refresh/only-export-components -- Shared default filter constant is imported by non-component modules.
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
 * Dropup filter for Services / Products / Subs with multi-select and search — shared by Sales page and Sales History.
 */
export default function Filter_CatalogCheckboxes({ value = {}, onChange, legend = "Catalog", categories, selected, className="" }) {
  const isArrayMode = Array.isArray(selected);
  const options = isArrayMode && Array.isArray(categories)
    ? categories.map((cat) => ({ value: cat, label: cat }))
    : CATALOG_ITEMS.map(({ key, label }) => ({ value: key, label }));

  const selectedValues = isArrayMode
    ? selected
    : CATALOG_ITEMS.filter(({ key }) => Boolean(value[key])).map(({ key }) => key);

  const handleChange = (e) => {
    const nextArr = Array.isArray(e.target.value) ? e.target.value : [];
    if (isArrayMode) {
      onChange?.(nextArr);
      return;
    }
    CATALOG_ITEMS.forEach(({ key }) => {
      const wasChecked = Boolean(value[key]);
      const nowChecked = nextArr.includes(key);
      if (wasChecked !== nowChecked) {
        onChange?.(key, nowChecked);
      }
    });
  };

  return (
    <div className={`app-filter-dropup-shell ${className}`.trim()} style={{ minWidth: "9.5rem" }}>
      <Dropdown_Custom
        className="ui-control-sm"
        options={options}
        value={selectedValues}
        onChange={handleChange}
        placeholder={legend || "Catalog"}
        floatingLabel={legend || "Catalog"}
        multiSelect={true}
        searchable={true}
        openUpward={true}
        closeOnSelect={false}
      />
    </div>
  );
}
