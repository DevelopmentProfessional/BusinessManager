import React, { useRef } from "react";
import { InputColor } from "../Inputs";

export function EditorToolbarButton({ active, onClick, title, children, disabled, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`px-1.5 py-1 text-sm rounded transition-colors ${active ? "bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300" : "text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"} ${disabled ? "opacity-40 cursor-not-allowed" : ""} ${className}`}
    >
      {children}
    </button>
  );
}

export function EditorToolbarDivider() {
  return <div className="bg-gray-300 dark:bg-gray-600 flex-shrink-0 h-6 mx-0.5 w-px" />;
}

export function EditorToolbarColorButton({ value, onChange, title, label }) {
  const inputRef = useRef(null);

  return (
    <button type="button" title={title} onClick={() => inputRef.current?.click()} className="dark:hover:bg-gray-700 dark:text-gray-400 flex flex-col hover:bg-gray-200 items-center px-1.5 py-0.5 relative rounded text-gray-600 text-sm">
      <span className="font-bold text-xs">{label}</span>
      <span className="h-1 mt-0.5 rounded-sm w-5" style={{ backgroundColor: value || "#000000" }} />
      <InputColor ref={inputRef} value={value || "#000000"} onChange={(e) => onChange(e.target.value)} className="absolute cursor-pointer h-full inset-0 opacity-0 w-full" tabIndex={-1} />
    </button>
  );
}
