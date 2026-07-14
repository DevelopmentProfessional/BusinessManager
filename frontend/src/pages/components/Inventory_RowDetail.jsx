// FILE: Inventory_RowDetail.jsx
// renders the name column cell for an inventory table row (category badge, price, feature tags)
import React from "react";

const hasMoneyValue = (value) => {
  if (value === undefined || value === null || value === "") return false;
  const n = Number(value);
  return !Number.isNaN(n) && n > 0;
};

export default function Inventory_RowDetail({ item, priceDisplay, featureNames = [] }) {
  const isAsset = (item.type || "").toUpperCase() === "ASSET";
  const formatMoney = (value) => {
    if (!hasMoneyValue(value)) return null;
    return Number(value).toLocaleString(undefined, { style: "currency", currency: "USD", minimumFractionDigits: 2 });
  };

  const effectivePriceDisplay = priceDisplay ?? (hasMoneyValue(item.price) ? formatMoney(item.price) : null);
  const costDisplay = hasMoneyValue(item.cost) ? formatMoney(item.cost) : null;

  return (
    <td className="main-page-table-data">
      <div className="fw-medium text-wrap-word">{item.name}</div>
      {item.category && (
        <span className="badge bg-secondary-subtle rounded-pill text-secondary text-xxs" style={{ width: "fit-content" }}>
          {item.category}
        </span>
      )}
      {(effectivePriceDisplay || costDisplay) && (
        <div className="d-flex flex-wrap gap-2 mt-1">
          {effectivePriceDisplay && <span className="fw-semibold small text-primary">Price: {effectivePriceDisplay}</span>}
          {costDisplay && <span className="fw-semibold small text-info">Cost: {costDisplay}</span>}
        </div>
      )}
      {featureNames.length > 0 && (
        <div className="d-flex flex-wrap gap-1 mt-1">
          {featureNames.map((name) => (
            <span key={name} className="badge bg-secondary-subtle text-secondary-emphasis text-xxs">
              {name}
            </span>
          ))}
        </div>
      )}
    </td>
  );
}
