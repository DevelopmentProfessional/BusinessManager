// FILE: Inventory_RowDetail.jsx
// renders the name column cell for an inventory table row (category badge, price, feature tags)
import React from "react";

export default function Inventory_RowDetail({ item, priceDisplay, featureNames = [] }) {
  const isLocation = (item.type || "").toUpperCase() === "LOCATION";
  const isAsset = (item.type || "").toUpperCase() === "ASSET";
  const formatMoney = (value) => {
    if (value === undefined || value === null || value === "") return null;
    return Number(value).toLocaleString(undefined, { style: "currency", currency: "USD", minimumFractionDigits: 2 });
  };
  return (
    <td className="main-page-table-data">
      <div className="fw-medium text-wrap-word">{item.name}</div>
      {item.category && (
        <span className="badge bg-secondary-subtle text-secondary rounded-pill text-xxs" style={{ width: "fit-content" }}>
          {item.category}
        </span>
      )}
      {!isLocation && !isAsset && priceDisplay && <div className="small text-primary fw-semibold">{priceDisplay}</div>}
      {isAsset && (
        <div className="d-flex flex-wrap gap-2 mt-1">
          {item.price != null && item.price !== "" && (
            <span className="small text-primary fw-semibold">Price: {formatMoney(item.price)}</span>
          )}
          {item.cost != null && item.cost !== "" && (
            <span className="small text-info fw-semibold">Cost: {formatMoney(item.cost)}</span>
          )}
        </div>
      )}
      {isLocation && item.cost != null && item.cost !== "" && (
        <div className="small text-info fw-semibold">{formatMoney(item.cost)}</div>
      )}
      {isAsset && (item.date_of_purchase || item.date_of_sale) && (
        <div className="d-flex flex-wrap gap-2 mt-1">
          {item.date_of_purchase && (
            <span className="text-xxs text-muted">Purchased: {item.date_of_purchase.slice(0, 10)}</span>
          )}
          {item.date_of_sale && (
            <span className="text-xxs text-muted">Sold: {item.date_of_sale.slice(0, 10)}</span>
          )}
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
