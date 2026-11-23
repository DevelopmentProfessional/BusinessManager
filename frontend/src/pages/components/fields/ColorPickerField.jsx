import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import InputText from "../Inputs/InputText";

export const COLOR_PRESETS = [
  "#FFFFFF", "#F8FAFC", "#E2E8F0", "#94A3B8", "#475569", "#0F172A",
  "#FCA5A5", "#EF4444", "#B91C1C",
  "#FDBA74", "#F97316", "#C2410C",
  "#FDE047", "#EAB308", "#A16207",
  "#BEF264", "#84CC16", "#4D7C0F",
  "#86EFAC", "#22C55E", "#15803D",
  "#5EEAD4", "#14B8A6", "#0F766E",
  "#67E8F9", "#06B6D4", "#0E7490",
  "#7DD3FC", "#0EA5E9", "#0369A1",
  "#A5B4FC", "#6366F1", "#4338CA",
  "#C4B5FD", "#8B5CF6", "#6D28D9",
  "#F9A8D4", "#EC4899", "#9D174D",
];

function isHexColor(value) {
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(value || "").trim());
}

function normalizeHex(value) {
  const trimmed = String(value || "").trim();
  if (!isHexColor(trimmed)) return null;
  const expanded = trimmed.length === 4 ? trimmed.slice(1).split("").map((char) => char + char).join("") : trimmed.slice(1);
  return `#${expanded.toUpperCase()}`;
}

export function ColorPresetGrid({ value, onChange, disabled = false }) {
  const normalizedValue = normalizeHex(value)?.toUpperCase();

  return (
    <div className="app-color-picker-grid" role="listbox" aria-label="Color presets">
      {COLOR_PRESETS.map((color) => (
        <button
          key={color}
          type="button"
          className="app-color-picker-swatch"
          style={{ backgroundColor: color }}
          onClick={() => onChange(color)}
          disabled={disabled}
          aria-label={`Select ${color}`}
          aria-selected={normalizedValue === color}
          title={color}
        />
      ))}
    </div>
  );
}

export default function ColorPickerField({ value = "#3B82F6", onChange, disabled = false, className = "" }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const popoverRef = useRef(null);
  const normalizedValue = normalizeHex(value) || "#3B82F6";

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target) && !popoverRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const handleTextChange = (event) => onChange(event.target.value);
  const handleTextBlur = (event) => {
    const normalized = normalizeHex(event.target.value);
    if (normalized) onChange(normalized);
  };

  return (
    <div ref={rootRef} className={`app-color-picker-field ${className}`.trim()}>
      <InputText
        value={value || ""}
        onChange={handleTextChange}
        onBlur={handleTextBlur}
        className="font-monospace pe-5 mb-0"
        placeholder="#3B82F6"
        aria-label="Hex color"
        disabled={disabled}
      />
      <button
        type="button"
        className="app-color-picker-trigger"
        style={{ backgroundColor: normalizedValue }}
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
        aria-label="Open color picker"
        aria-expanded={open}
        title="Choose color"
      />
      {open && createPortal(
        <div ref={popoverRef} className="app-color-picker-popover">
          <ColorPresetGrid
            value={value}
            onChange={(color) => { onChange(color); setOpen(false); }}
            disabled={disabled}
          />
        </div>,
        document.body,
      )}
    </div>
  );
}
