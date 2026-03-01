/*
 * ============================================================
 * FILE: Modal.jsx
 *
 * PURPOSE:
 *   Base modal wrapper component used throughout the application.
 *   Supports three layout variants — fullscreen, centered bottom-sheet,
 *   and default bottom-sheet — with optional title, footer, and padding.
 *
 * FUNCTIONAL PARTS:
 *   [1] Overlay — Semi-transparent backdrop that closes the modal on click
 *   [2] Fullscreen Variant — Fixed inset panel filling the entire viewport
 *   [3] Centered Variant — Bottom-anchored sheet with rounded top corners (max 90vh)
 *   [4] Default Variant — Standard bottom-sheet that slides up from the bottom
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-03-01 | Claude  | Added section comments and top-level documentation
 * ============================================================
 */
import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

export default function Modal({ isOpen, onClose, children, title, fullScreen = false, centered = false, noPadding = false, footer = null }) {
  if (!isOpen) return null;

  // ─── 1 OVERLAY ─────────────────────────────────────────────────────────────
  const Overlay = (
    <div
      className="fixed inset-0 bg-gray-500 dark:bg-gray-900 dark:bg-opacity-75 bg-opacity-75 transition-opacity"
      onClick={onClose}
    />
  );

  // ─── 2 FULLSCREEN VARIANT ──────────────────────────────────────────────────────
  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50">
        {Overlay}
        <div className="fixed inset-0 flex flex-col bg-white dark:bg-gray-900">
          {title && (
            <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 px-3 py-2 flex-shrink-0 bg-white dark:bg-gray-900">
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100">{title}</h3>
              <button type="button" onClick={onClose} title="Close" aria-label="Close" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
          )}
          <div className={`${noPadding ? '' : 'p-2'} flex-grow-1 overflow-auto d-flex flex-column-reverse bg-white dark:bg-gray-900 no-scrollbar text-gray-900 dark:text-gray-100`}>{children}</div>
          {footer && (
            <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 flex-shrink-0">
              {footer}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── 3 CENTERED VARIANT ────────────────────────────────────────────────────────
  if (centered) {
    return (
      <div className="fixed inset-0 z-50">
        {Overlay}
        <div className="fixed bottom-0 left-0 right-0 w-full bg-white dark:bg-gray-800 rounded-t-lg text-left overflow-hidden shadow-xl transform transition-all border-t border-gray-200 dark:border-gray-700 max-h-[90vh] flex flex-col">
          {title && (
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-800">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{title}</h3>
              <button type="button" onClick={onClose} title="Close" aria-label="Close" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
          )}
          <div className={`flex-grow-1 overflow-auto d-flex flex-column-reverse bg-white dark:bg-gray-800 no-scrollbar ${noPadding ? '' : 'px-4 py-4'}`}>
            <div className="text-gray-900 dark:text-gray-100">{children}</div>
          </div>
          {footer && (
            <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 px-4 py-3">
              {footer}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── 4 DEFAULT VARIANT (BOTTOM SHEET) ──────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen">
        {Overlay}
        <div className="fixed bottom-0 left-0 right-0 w-full bg-white dark:bg-gray-800 rounded-t-lg text-left overflow-hidden shadow-xl transform transition-all border-t border-gray-200 dark:border-gray-700 max-h-screen flex flex-col">
          {title && (
            <div className="flex justify-between items-center px-3 pt-4 pb-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-800">
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100">{title}</h3>
              <button type="button" onClick={onClose} title="Close" aria-label="Close" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
          )}
          <div className={`flex-grow-1 overflow-auto d-flex flex-column-reverse bg-white dark:bg-gray-800 no-scrollbar ${noPadding ? '' : 'px-3 py-3'}`}>
            <div className="text-gray-900 dark:text-gray-100">{children}</div>
          </div>
          {footer && (
            <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 flex-shrink-0">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
