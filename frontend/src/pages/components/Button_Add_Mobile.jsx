/*
 * ============================================================
 * FILE: Button_Add_Mobile.jsx
 *
 * PURPOSE:
 *   A fixed, floating "Add" button rendered at the bottom center of the screen
 *   exclusively on mobile viewports (hidden on md and above). Intended as a
 *   thumb-friendly shortcut for triggering create/add actions on list pages.
 *
 * FUNCTIONAL PARTS:
 *   [1] Button Render — Fixed-position circular button with PlusIcon, aria-label,
 *       and responsive visibility (md:hidden)
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-03-01 | Claude  | Added section comments and top-level documentation
 * ============================================================
 */
import React from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';

// ─── 1 BUTTON RENDER ───────────────────────────────────────────────────────────

export default function Button_Add_Mobile({ onClick, label = "Add", className = "" }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`
        fixed bottom-24 left-1/2 transform -translate-x-1/2 z-30
        bg-blue-600 hover:bg-blue-700 text-white
        p-3 rounded-full shadow-lg hover:shadow-xl
        flex items-center justify-center transition-all
        md:hidden
        ${className}
      `}
    >
      <PlusIcon className="h-6 w-6" />
    </button>
  );
}
