// FILE: colorMapping.js
// maps entity type/status/tier values to app-badge CSS modifier variants

export function itemTypeVariant(type) {
  const t = (type || "").toUpperCase();
  if (t === "RESOURCE") return "blue";
  if (t === "ASSET") return "purple";
  if (t === "LOCATION") return "teal";
  if (t === "BUNDLE") return "orange";
  if (t === "MIX") return "pink";
  if (t === "ITEM") return "orange";
  return "gray"; // PRODUCT
}

export function tierVariant(tier) {
  const t = (tier || "").toUpperCase();
  if (t === "PLATINUM") return "purple";
  if (t === "GOLD") return "gold";
  if (t === "SILVER") return "gray";
  if (t === "BRONZE") return "orange";
  return "gray";
}

export function statusVariant(status) {
  const s = (status || "").toLowerCase();
  if (s === "active" || s === "approved" || s === "completed" || s === "paid") return "green";
  if (s === "inactive" || s === "cancelled" || s === "rejected") return "gray";
  if (s === "pending") return "blue";
  if (s === "overdue" || s === "low") return "red";
  return "gray";
}

export function stockVariant(item) {
  const isLocationOrAsset = ["LOCATION", "ASSET"].includes((item.type || "").toUpperCase());
  if (isLocationOrAsset) return "green";
  return item.quantity <= item.min_stock_level ? "red" : "green";
}
