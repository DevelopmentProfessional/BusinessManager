/*
 * ============================================================
 * FILE: Button_Icon.jsx
 *
 * PURPOSE:
 *   A reusable icon-only button component that renders a Heroicon inside a
 *   consistently sized square button. It exposes a tooltip via title/aria-label
 *   and supports four visual variants (primary, secondary, danger, ghost) as
 *   well as disabled state styling.
 *
 * FUNCTIONAL PARTS:
 *   [1] Variant Styles — Defines base and per-variant Tailwind class strings
 *   [2] Button Render — Applies resolved classes, forwards icon, and spreads
 *       additional HTML button props
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-03-01 | Claude  | Added section comments and top-level documentation
 * ============================================================
 */
import React from 'react';

/**
 * Icon-only button with tooltip on hover and long-press.
 * Use title and aria-label so the button's purpose is shown when hovering or focusing.
 */

// ─── 1 VARIANT STYLES ──────────────────────────────────────────────────────────

export default function Button_Icon({
  icon: Icon,
  label,
  onClick,
  type = 'button',
  className = '',
  disabled = false,
  variant = 'secondary', // 'primary' | 'secondary' | 'danger' | 'ghost'
  ...rest
}) {
  const base = 'inline-flex items-center justify-center rounded-lg w-12 h-12 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-primary-600 hover:bg-primary-700 text-white focus:ring-primary-500',
    secondary: 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 focus:ring-gray-500',
    danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
    'outline-danger': 'text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 focus:ring-red-500',
    ghost: 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 focus:ring-gray-500',
  };
  const v = variants[variant] || variants.secondary;

  // ─── 2 BUTTON RENDER ─────────────────────────────────────────────────────────

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`${base} ${v} ${className}`}
      {...rest}
    >
      {Icon ? <Icon className="h-5 w-5" /> : null}
    </button>
  );
}
