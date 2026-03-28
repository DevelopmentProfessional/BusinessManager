// FILE: Inventory_RowDetail.jsx
// renders the name column cell for an inventory table row (category badge, price, feature tags)
import React from "react";

export default function Inventory_RowDetail({ item, priceDisplay, featureNames = [] }) {
  return (
    <td className="main-page-table-data">
      <div className="fw-medium text-wrap-word">{item.name}</div>
      {item.category && (
        <span className="badge bg-secondary-subtle text-secondary rounded-pill text-xxs" style={{ width: "fit-content" }}>
          {item.category}
        </span>
      )}
      {priceDisplay && <div className="small text-primary fw-semibold">{priceDisplay}</div>}
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
