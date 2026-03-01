/*
 * ============================================================
 * FILE: Container_Scrollable.jsx
 *
 * PURPOSE:
 *   A thin layout wrapper that makes its content area scroll independently
 *   rather than expanding the page. It applies the `overflow-scroll-container`
 *   CSS class (which enforces overflow:auto and flex:1 min-h-0) and accepts an
 *   optional `as` prop to change the rendered HTML element.
 *
 * FUNCTIONAL PARTS:
 *   [1] Scrollable Container Render — Renders a configurable tag with the
 *       overflow-scroll-container class, forwarding children and extra props
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-03-01 | Claude  | Added section comments and top-level documentation
 * ============================================================
 */
import React from 'react';

/**
 * Wraps content so it scrolls internally instead of making the page scroll.
 * Use inside a flex container (parent should have flex flex-col and a height or flex-1 min-h-0).
 * The component takes remaining space and scrolls when content overflows.
 */

// ─── 1 SCROLLABLE CONTAINER RENDER ────────────────────────────────────────────

export default function Container_Scrollable({ children, className = '', as: Tag = 'div', ...rest }) {
  return (
    <Tag
      className={`overflow-scroll-container ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}
