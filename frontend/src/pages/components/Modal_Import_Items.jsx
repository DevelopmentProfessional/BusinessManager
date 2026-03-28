import React, { useEffect, useMemo, useRef, useState } from "react";
import Modal from "./Modal";
import { ArrowPathIcon, ArrowUpIcon, Bars3Icon, TrashIcon } from "@heroicons/react/24/outline";
import { showConfirm } from "../../services/showConfirm";
import useViewMode from "../../services/useViewMode";

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
];

const DEFAULT_COLUMN_COUNT = 8;
const DEFAULT_ROW_COUNT = 100;
const DEFAULT_ADD_ROW_COUNT = 100;
const DEFAULT_FIELD_SEQUENCE = ["name", "sku", "price", "quantity", "type", "category", "description", "min_stock_level"];

function makeColumns(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: `col_${i}_${Date.now()}`,
    label: `Column ${i + 1}`,
  }));
}

function makeRows(rowCount, colCount) {
  return Array.from({ length: rowCount }, () => Array.from({ length: colCount }, () => ""));
}

function getDefaultMappingForIndex(index) {
  return DEFAULT_FIELD_SEQUENCE[index] || "name";
}

function createDefaultMappings(count) {
  return Array.from({ length: count }, (_, index) => getDefaultMappingForIndex(index));
}

function parseCsvLine(line) {
  const out = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      out.push(value);
      value = "";
      continue;
    }

    value += ch;
  }

  out.push(value);
  return out;
}

function parseClipboardTable(text) {
  const normalized = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
  if (!normalized) return [];

  const lines = normalized.split("\n").filter((line) => line.length > 0);
  const hasTabs = lines.some((line) => line.includes("\t"));

  if (hasTabs) {
    return lines.map((line) => line.split("\t").map((cell) => cell.trim()));
  }

  return lines.map((line) => parseCsvLine(line).map((cell) => cell.trim()));
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
  const { footerAlign } = useViewMode();
  const alignClass = footerAlign === "center" ? "justify-content-center" : footerAlign === "right" ? "justify-content-end" : "justify-content-start";

  const [columns, setColumns] = useState(() => makeColumns(DEFAULT_COLUMN_COUNT));
  const [rows, setRows] = useState(() => makeRows(DEFAULT_ROW_COUNT, DEFAULT_COLUMN_COUNT));
  const [mappings, setMappings] = useState(() => createDefaultMappings(DEFAULT_COLUMN_COUNT));
  const [addRowCount, setAddRowCount] = useState(DEFAULT_ADD_ROW_COUNT);
  const [dragOverCol, setDragOverCol] = useState(null);
  const dragColRef = useRef(null);
  const [status, setStatus] = useState({ type: null, message: "" });
  const [isSaving, setIsSaving] = useState(false);
  const scrollContainerRef = useRef(null);
  const dragPanRef = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });

  useEffect(() => {
    if (!isOpen) return;
    setColumns(makeColumns(DEFAULT_COLUMN_COUNT));
    setRows(makeRows(DEFAULT_ROW_COUNT, DEFAULT_COLUMN_COUNT));
    setMappings(createDefaultMappings(DEFAULT_COLUMN_COUNT));
    setDragOverCol(null);
    setStatus({ type: null, message: "" });
    setIsSaving(false);
  }, [isOpen]);

  useEffect(() => {
    const handleWindowMouseUp = () => {
      if (!dragPanRef.current.isDragging) return;
      dragPanRef.current.isDragging = false;
      document.body.style.userSelect = "";
      const el = scrollContainerRef.current;
      if (el) el.style.cursor = "grab";
    };

    window.addEventListener("mouseup", handleWindowMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleWindowMouseUp);
    };
  }, []);

  const handlePanMouseDown = (event) => {
    if (event.button !== 0) return;
    const target = event.target;
    if (target.closest("input, textarea, select, button, a, label")) return;

    const el = scrollContainerRef.current;
    if (!el) return;

    dragPanRef.current = {
      isDragging: true,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
    };
    el.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
  };

  const handlePanMouseMove = (event) => {
    const el = scrollContainerRef.current;
    if (!el || !dragPanRef.current.isDragging) return;

    const dx = event.clientX - dragPanRef.current.startX;
    const dy = event.clientY - dragPanRef.current.startY;
    el.scrollLeft = dragPanRef.current.scrollLeft - dx;
    el.scrollTop = dragPanRef.current.scrollTop - dy;
  };

  const ensureGridSize = (requiredRows, requiredCols) => {
    setColumns((prevCols) => {
      const colCount = Math.max(prevCols.length, requiredCols);
      if (colCount === prevCols.length) return prevCols;
      const extra = Array.from({ length: colCount - prevCols.length }, (_, i) => ({
        id: `col_${prevCols.length + i}_${Date.now()}`,
        label: `Column ${prevCols.length + i + 1}`,
      }));
      return [...prevCols, ...extra];
    });

    setMappings((prev) => {
      const next = [...prev];
      while (next.length < requiredCols) {
        next.push(getDefaultMappingForIndex(next.length));
      }
      return next;
    });

    setRows((prevRows) => {
      const nextRows = prevRows.map((row) => {
        const next = [...row];
        while (next.length < requiredCols) next.push("");
        return next;
      });
      while (nextRows.length < requiredRows) {
        nextRows.push(Array.from({ length: requiredCols }, () => ""));
      }
      return nextRows;
    });
  };

  const applyPastedMatrix = (matrix, startRow, startCol) => {
    if (!matrix.length) return;

    const pastedRows = matrix.length;
    const pastedCols = Math.max(...matrix.map((r) => r.length), 0);
    const requiredRows = Math.max(rows.length, startRow + pastedRows);
    const requiredCols = Math.max(columns.length, startCol + pastedCols);

    ensureGridSize(requiredRows, requiredCols);

    setRows((prevRows) => {
      const nextRows = prevRows.map((r) => [...r]);
      while (nextRows.length < requiredRows) {
        nextRows.push(Array.from({ length: requiredCols }, () => ""));
      }
      for (let r = 0; r < nextRows.length; r += 1) {
        while (nextRows[r].length < requiredCols) nextRows[r].push("");
      }

      matrix.forEach((rowCells, rOffset) => {
        rowCells.forEach((cellValue, cOffset) => {
          const targetRow = startRow + rOffset;
          const targetCol = startCol + cOffset;
          nextRows[targetRow][targetCol] = cellValue;
        });
      });

      return nextRows;
    });

    setStatus({
      type: "info",
      message: `Pasted ${pastedRows} row${pastedRows === 1 ? "" : "s"} x ${pastedCols} column${pastedCols === 1 ? "" : "s"}.`,
    });
  };

  const handleGlobalPaste = (event) => {
    const text = event.clipboardData?.getData("text/plain");
    if (!text) return;

    event.preventDefault();
    const matrix = parseClipboardTable(text);
    if (!matrix.length) return;

    applyPastedMatrix(matrix, 0, 0);
  };

  const handleCellChange = (rowIdx, colIdx, value) => {
    setRows((prev) => {
      const next = prev.map((r) => [...r]);
      next[rowIdx][colIdx] = value;
      return next;
    });
  };

  const handleAddRows = () => {
    const count = Math.max(1, Math.min(10000, Number(addRowCount) || 1));
    setRows((prev) => [...prev, ...Array.from({ length: count }, () => Array.from({ length: columns.length }, () => ""))]);
  };

  const handleDeleteRow = (rowIndex) => {
    setRows((prev) => {
      if (prev.length <= 1) {
        return [Array.from({ length: columns.length }, () => "")];
      }
      return prev.filter((_, idx) => idx !== rowIndex);
    });
  };

  const handleClearColumn = (colIndex) => {
    setRows((prevRows) =>
      prevRows.map((row) => {
        const next = [...row];
        next[colIndex] = "";
        return next;
      })
    );
    setStatus({ type: "info", message: `Cleared column ${colIndex + 1}.` });
  };

  const handleClearGrid = () => {
    setRows(makeRows(DEFAULT_ROW_COUNT, columns.length));
    setStatus({ type: null, message: "" });
  };

  const handleColDragStart = (colIndex) => {
    dragColRef.current = colIndex;
  };

  const handleColDragOver = (e, colIndex) => {
    e.preventDefault();
    setDragOverCol(colIndex);
  };

  const handleColDrop = (colIndex) => {
    const from = dragColRef.current;
    setDragOverCol(null);
    dragColRef.current = null;
    if (from === null || from === colIndex) return;

    const reorder = (arr) => {
      const next = [...arr];
      const [item] = next.splice(from, 1);
      next.splice(colIndex, 0, item);
      return next;
    };

    setColumns((prev) => reorder(prev));
    setMappings((prev) => reorder(prev));
    setStatus({ type: "info", message: `Moved column header ${from + 1} to position ${colIndex + 1}.` });
  };

  const handleColDragEnd = () => {
    setDragOverCol(null);
    dragColRef.current = null;
  };

  const setMapping = (colIndex, field) => {
    setMappings((prev) => {
      const next = [...prev];
      next[colIndex] = field;
      return next;
    });
  };

  const handleResetMappings = () => {
    setMappings(createDefaultMappings(columns.length));
    setStatus({ type: "info", message: "Column mappings reset to defaults." });
  };

  const buildPayload = () => {
    const errors = [];
    const products = [];
    const seenSku = new Set();
    const existingSkuSet = new Set(
      existingSkus
        .map((sku) =>
          String(sku || "")
            .trim()
            .toLowerCase()
        )
        .filter(Boolean)
    );

    const mappedName = mappings.includes("name");
    if (!mappedName) {
      errors.push("Map at least one column to Name (required).");
      return { errors, products };
    }

    rows.forEach((row, rowIndex) => {
      const data = {};
      let hasAnyMappedValue = false;

      for (let c = 0; c < columns.length; c += 1) {
        const field = mappings[c] || "__ignore__";
        if (field === "__ignore__") continue;
        const raw = String(row[c] || "").trim();
        if (raw !== "") hasAnyMappedValue = true;
        if (raw === "") continue;
        data[field] = raw;
      }

      if (!hasAnyMappedValue) return;

      if (!data.name || !String(data.name).trim()) {
        errors.push(`Row ${rowIndex + 1}: Name is required.`);
      }

      const parsedPrice = parseNumber(data.price, "Price");
      if (!parsedPrice.ok) errors.push(`Row ${rowIndex + 1}: ${parsedPrice.error}`);
      const parsedQty = parseNumber(data.quantity, "Stock Quantity");
      if (!parsedQty.ok) errors.push(`Row ${rowIndex + 1}: ${parsedQty.error}`);
      const parsedMin = parseNumber(data.min_stock_level, "Min Stock Level");
      if (!parsedMin.ok) errors.push(`Row ${rowIndex + 1}: ${parsedMin.error}`);
      const parsedCost = parseNumber(data.cost, "Cost");
      if (!parsedCost.ok) errors.push(`Row ${rowIndex + 1}: ${parsedCost.error}`);

      if (parsedQty.value != null && parsedQty.value < 0) {
        errors.push(`Row ${rowIndex + 1}: Stock Quantity cannot be negative.`);
      }
      if (parsedMin.value != null && parsedMin.value < 0) {
        errors.push(`Row ${rowIndex + 1}: Min Stock Level cannot be negative.`);
      }
      if (parsedPrice.value != null && parsedPrice.value < 0) {
        errors.push(`Row ${rowIndex + 1}: Price cannot be negative.`);
      }

      const normalizedSku = String(data.sku || "")
        .trim()
        .toLowerCase();
      if (normalizedSku) {
        if (seenSku.has(normalizedSku)) {
          errors.push(`Row ${rowIndex + 1}: Duplicate SKU in import (${data.sku}).`);
        }
        if (existingSkuSet.has(normalizedSku)) {
          errors.push(`Row ${rowIndex + 1}: SKU already exists (${data.sku}).`);
        }
        seenSku.add(normalizedSku);
      }

      products.push({
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
      });
    });

    if (products.length === 0) {
      errors.push("No mapped rows found. Paste data or type at least one row.");
    }

    return { errors, products };
  };

  const handleImport = async () => {
    const { errors, products } = buildPayload();
    if (errors.length) {
      setStatus({ type: "error", message: errors.slice(0, 6).join(" ") });
      return;
    }

    if (products.length > 1000) {
      const proceed = await showConfirm("You are importing more than 1000 rows. Continue?", { confirmLabel: "Continue", danger: false });
      if (!proceed) return;
    }

    setIsSaving(true);
    setStatus({ type: "info", message: `Importing ${products.length} item(s)...` });
    try {
      const result = await onImport(products);
      const importedCount = result?.imported_count ?? result?.created_count ?? products.length;
      setStatus({ type: "success", message: `${importedCount} product(s) imported successfully.` });
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || "Bulk import failed.";
      setStatus({ type: "error", message: String(detail) });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} fullScreen noPadding>
      <div className="d-flex flex-column h-100" onPaste={handleGlobalPaste}>
        <div className="border-bottom border-gray-200 dark:border-gray-700 px-3 py-2 d-flex justify-content-between align-items-center">
          <div>
            <div className="fw-semibold">Bulk Add Items</div>
          </div>
        </div>

        <div ref={scrollContainerRef} className="flex-grow-1 overflow-auto bulk-import-grid-scroll" style={{ WebkitOverflowScrolling: "touch", position: "relative", cursor: "grab" }} onMouseDown={handlePanMouseDown} onMouseMove={handlePanMouseMove}>
          <table className="table table-sm table-bordered align-middle mb-0" style={{ minWidth: Math.max(900, columns.length * 150) }}>
            <colgroup>
              <col style={{ width: 56 }} />
              {columns.map((col) => (
                <col key={col.id} style={{ minWidth: 170 }} />
              ))}
            </colgroup>
            <thead className="table-light" style={{ position: "sticky", top: 0, zIndex: 3 }}>
              <tr>
                <th style={{ width: 56 }}>
                  <button type="button" className="btn btn-sm btn-outline-secondary p-1" title="Reset column mappings to defaults" onClick={handleResetMappings}>
                    <ArrowPathIcon style={{ width: 14, height: 14 }} />
                  </button>
                </th>
                {columns.map((col, colIndex) => (
                  <th
                    key={col.id}
                    style={{
                      minWidth: 170,
                      background: dragOverCol === colIndex ? "var(--bs-primary-bg-subtle, #cfe2ff)" : undefined,
                      transition: "background 0.15s",
                    }}
                    onDragOver={(e) => handleColDragOver(e, colIndex)}
                    onDrop={() => handleColDrop(colIndex)}
                  >
                    <div className="d-flex align-items-center gap-1">
                      <button type="button" className="btn btn-sm btn-outline-secondary p-1" title="Clear this column" onClick={() => handleClearColumn(colIndex)}>
                        <TrashIcon style={{ width: 12, height: 12 }} />
                      </button>

                      <select className="form-select form-select-sm border-0 shadow-none" style={{ backgroundColor: "transparent" }} value={mappings[colIndex] || "name"} onChange={(e) => setMapping(colIndex, e.target.value)}>
                        {FIELD_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>

                      <span draggable onDragStart={() => handleColDragStart(colIndex)} onDragEnd={handleColDragEnd} title="Drag to reorder this column" style={{ cursor: "grab", display: "flex", alignItems: "center", color: "var(--bs-secondary-color, #6c757d)" }}>
                        <Bars3Icon style={{ width: 14, height: 14 }} />
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`r_${rowIndex}`}>
                  <td className="text-muted small text-center align-middle">
                    <div className="d-flex align-items-center justify-content-center gap-1">
                      <button type="button" className="btn btn-sm btn-link text-danger p-0" title="Delete this row" onClick={() => handleDeleteRow(rowIndex)}>
                        <TrashIcon style={{ width: 12, height: 12 }} />
                      </button>
                      <span>{rowIndex + 1}</span>
                    </div>
                  </td>
                  {columns.map((col, colIndex) => (
                    <td key={`${col.id}_${rowIndex}`}>
                      <input
                        className="form-control form-control-sm border-0 shadow-none"
                        style={{ backgroundColor: "transparent" }}
                        value={row[colIndex] || ""}
                        onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                        onPaste={(e) => {
                          const text = e.clipboardData?.getData("text/plain");
                          if (!text) return;
                          e.preventDefault();
                          applyPastedMatrix(parseClipboardTable(text), 0, 0);
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex-shrink-0 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          {status.message && <div className={`px-4 pt-2 small ${status.type === "error" ? "text-danger" : status.type === "success" ? "text-success" : "text-muted"}`}>{status.message}</div>}

          <div className="row g-0 align-items-center">
            <div className="col-auto px-3">
              <button type="button" className="btn btn-outline-secondary btn-sm" title="Scroll to top" onClick={() => scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" })}>
                <ArrowUpIcon style={{ width: 16, height: 16 }} />
              </button>
            </div>
            <div className={`col d-flex align-items-center gap-2 px-1 flex-wrap ${alignClass}`}>
              <div className="d-flex align-items-center gap-1">
                <input type="number" className="form-control form-control-sm" style={{ width: 72 }} min={1} max={10000} value={addRowCount} onChange={(e) => setAddRowCount(Math.max(1, Math.min(10000, Number(e.target.value) || 1)))} disabled={isSaving} />
                <button type="button" className="btn btn-outline-secondary" onClick={handleAddRows} disabled={isSaving}>
                  Add Rows
                </button>
              </div>
              <button type="button" className="btn btn-outline-secondary" onClick={handleClearGrid} disabled={isSaving}>
                Clear Grid
              </button>
              <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={isSaving}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleImport} disabled={isSaving}>
                {isSaving ? "Importing..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
