import React, { useMemo } from "react";
import Modal_Bulk_Import_Sheet from "./Modal_ImportSheet";

const FIELD_OPTIONS = [
  { value: "name", label: "Name (required)" },
  { value: "sku", label: "SKU" },
  { value: "price", label: "Price" },
  { value: "quantity", label: "Stock Quantity" },
  { value: "min_stock_level", label: "Min Stock Level" },
  { value: "type", label: "Type" },
  { value: "category", label: "Category" },
  { value: "description", label: "Description" },
  { value: "location", label: "Location" },
  { value: "cost", label: "Cost" },
  { value: "asset_unit_count", label: "Asset Unit Count" },
  { value: "features", label: "Features" },
];

const DEFAULT_FIELD_SEQUENCE = ["name", "sku", "price", "quantity", "type", "category", "description", "min_stock_level"];

function parseFeatureString(raw) {
  if (!raw || !raw.trim()) return [];
  const results = [];
  const parts = String(raw)
    .split(/[;|]/)
    .map((p) => p.trim())
    .filter(Boolean);

  for (const part of parts) {
    const parenMatch = part.match(/^([^(]+)\(([^)]+)\)/);
    if (parenMatch) {
      const name = parenMatch[1].trim();
      const options = parenMatch[2]
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);
      if (name) results.push({ name, options });
      continue;
    }

    const colonMatch = part.match(/^([^:]+):(.+)/);
    if (colonMatch) {
      const name = colonMatch[1].trim();
      const options = colonMatch[2]
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);
      if (name) results.push({ name, options });
      continue;
    }

    const name = part.trim();
    if (name) results.push({ name, options: [] });
  }

  return results;
}

function normalizeType(typeValue) {
  const normalized = String(typeValue || "")
    .trim()
    .toUpperCase();
  if (!normalized) return "product";
  const valid = new Set(["PRODUCT", "RESOURCE", "ASSET", "LOCATION", "ITEM", "BUNDLE", "MIX"]);
  return valid.has(normalized) ? normalized.toLowerCase() : "product";
}

function parseNumber(value, fieldLabel) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return { ok: true, value: null };
  }

  const numeric = Number(String(value).replace(/,/g, "").trim());
  if (!Number.isFinite(numeric)) {
    return { ok: false, error: `${fieldLabel} must be a number.` };
  }

  return { ok: true, value: numeric };
}

export default function Modal_Bulk_Import_Items({ isOpen, onClose, onImport, existingSkus = [] }) {
  const existingSkuSet = useMemo(
    () =>
      new Set(
        existingSkus
          .map((sku) =>
            String(sku || "")
              .trim()
              .toLowerCase()
          )
          .filter(Boolean)
      ),
    [existingSkus]
  );

  const seenSku = new Set();

  return (
    <Modal_Bulk_Import_Sheet
      isOpen={isOpen}
      onClose={onClose}
      onImport={onImport}
      title="Bulk Add Items"
      entityLabel="item"
      hint="For features use: size(s,m,l); color(red,blue)."
      fieldOptions={FIELD_OPTIONS}
      defaultFieldSequence={DEFAULT_FIELD_SEQUENCE}
      buildRecord={(data) => {
        const errors = [];

        if (!data.name?.trim()) {
          errors.push("Name is required.");
        }

        const parsedPrice = parseNumber(data.price, "Price");
        if (!parsedPrice.ok) errors.push(parsedPrice.error);

        const parsedQty = parseNumber(data.quantity, "Stock Quantity");
        if (!parsedQty.ok) errors.push(parsedQty.error);

        const parsedMin = parseNumber(data.min_stock_level, "Min Stock Level");
        if (!parsedMin.ok) errors.push(parsedMin.error);

        const parsedCost = parseNumber(data.cost, "Cost");
        if (!parsedCost.ok) errors.push(parsedCost.error);

        if (parsedQty.value != null && parsedQty.value < 0) errors.push("Stock Quantity cannot be negative.");
        if (parsedMin.value != null && parsedMin.value < 0) errors.push("Min Stock Level cannot be negative.");
        if (parsedPrice.value != null && parsedPrice.value < 0) errors.push("Price cannot be negative.");

        const normalizedSku = String(data.sku || "")
          .trim()
          .toLowerCase();

        if (normalizedSku) {
          if (seenSku.has(normalizedSku)) {
            errors.push(`Duplicate SKU in import (${data.sku}).`);
          }
          if (existingSkuSet.has(normalizedSku)) {
            errors.push(`SKU already exists (${data.sku}).`);
          }
          seenSku.add(normalizedSku);
        }

        if (errors.length) {
          return { record: null, errors };
        }

        return {
          record: {
            name: String(data.name || "").trim(),
            sku: data.sku ? String(data.sku).trim() : null,
            price: parsedPrice.value ?? 0,
            quantity: parsedQty.value == null ? 0 : Math.round(parsedQty.value),
            min_stock_level: parsedMin.value == null ? 10 : Math.round(parsedMin.value),
            type: normalizeType(data.type),
            category: data.category ? String(data.category).trim() : null,
            description: data.description ? String(data.description).trim() : null,
            location: data.location ? String(data.location).trim() : null,
            cost: parsedCost.value,
            asset_unit_count: data.asset_unit_count ? parseInt(String(data.asset_unit_count).trim(), 10) || null : null,
            features: data.features ? parseFeatureString(data.features) : null,
          },
          errors: [],
        };
      }}
    />
  );
}
