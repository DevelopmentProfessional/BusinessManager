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
 *   2026-05-26 | GitHub Copilot | Applied shared sticky footer classes for modal footer consistency
 * ============================================================
 */
import React from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";

// ─── NAMED SUB-COMPONENTS ───────────────────────────────────────────────────

/**
 * ModalHeader
 *
 * Renders the title bar shared by all three modal variants.
 * Consumers can also use this directly inside noPadding/fullScreen modals
 * when they need a custom header with a close button.
 *
 * Props:
 *   title: string | ReactNode
 *   onClose: () => void
 *   showClose?: boolean — header X button (default true)
 *   className?: string  — extra classes for the wrapper div
 */
export function ModalHeader({ title, onClose, showClose = true, className="" }) {
  return (
    <div className={`d-flex justify-content-between align-items-center border-bottom flex-shrink-0 bg-body p-1 ${className}`}>
      <h3 className="align-items-center d-flex h5 mb-0 text-body">{title}</h3>
      {showClose && onClose ? (
        <button type="button" onClick={onClose} title="Close" aria-label="Close" className="align-items-center btn btn-outline-secondary d-flex dark:hover:text-gray-300 flex-shrink-0 hover:text-gray-600 justify-content-center p-0 text-gray-400">
          <XMarkIcon className="h-6 w-6" />
        </button>
      ) : null}
    </div>
  );
}

/**
 * ModalFooter
 *
 * Renders the action bar pinned to the bottom of a modal.
 * Consumers can also use this directly to place buttons inside any modal.
 *
 * Props:
 *   children: ReactNode
 *   className?: string  — extra classes for the wrapper div
 */
export function ModalFooter({ children, className="" }) {
  return <div className={`app-modal-footer app-form-footer app-standard-footer border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0 ${className}`}>{children}</div>;
}

// ─── DEFAULT EXPORT ─────────────────────────────────────────────────────────

/** Same layer as bottom +Nav menu (1100); above page footers (1050); below dedicated overlays (1990+). */
const MODAL_Z_INDEX = 1100;

export default function Modal({ isOpen, onClose, children, title, fullScreen = false, centered = false, noPadding = false, footer = null, showHeaderClose = true, contentGravity = "top" }) {
  if (!isOpen) return null;

  const modalLayerStyle = { zIndex: MODAL_Z_INDEX };
  const gravityClass = "overflow-scroll-content overflow-scroll-content--bottom";

  // ─── 1 OVERLAY ─────────────────────────────────────────────────────────────
  const Overlay = <div className="bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 fixed inset-0 transition-opacity" onClick={onClose} />;

  // ─── 2 FULLSCREEN VARIANT ──────────────────────────────────────────────────────
  if (fullScreen) {
    return (
      <div className="fixed inset-0" style={modalLayerStyle}>
        {Overlay}
        <div className="bg-white dark:bg-gray-900 fixed flex flex-col inset-0">
          {title && <ModalHeader title={title} onClose={onClose} showClose={showHeaderClose} className="bg-white dark:bg-gray-900" />}
          <div className={`${noPadding ? "" : "p-1"} flex-grow-1 min-h-0 overflow-auto bg-white dark:bg-gray-900 no-scrollbar text-gray-900 dark:text-gray-100`}>
            {contentGravity === "bottom" ? <div className={gravityClass}>{children}</div> : children}
          </div>
          {footer && <ModalFooter>{footer}</ModalFooter>}
        </div>
      </div>
    );
  }

  // ─── 3 CENTERED VARIANT ────────────────────────────────────────────────────────
  if (centered) {
    return (
      <div className="fixed inset-0" style={modalLayerStyle}>
        {Overlay}
        <div className="bg-white border-gray-200 border-t bottom-0 dark:bg-gray-800 dark:border-gray-700 fixed flex flex-col left-0 max-h-[90vh] overflow-hidden right-0 rounded-t-lg shadow-xl text-left transform transition-all w-full">
          {title && <ModalHeader title={title} onClose={onClose} showClose={showHeaderClose} />}
          <div className={`flex-grow-1 min-h-0 overflow-auto bg-white dark:bg-gray-800 no-scrollbar ${noPadding ? "" : "p-1"}`}>
            {contentGravity === "bottom" ? <div className={`${gravityClass} text-gray-900 dark:text-gray-100`}>{children}</div> : <div className="dark:text-gray-100 text-gray-900">{children}</div>}
          </div>
          {footer && <ModalFooter className="border-gray-200 border-t dark:border-gray-700 flex-shrink-0">{footer}</ModalFooter>}
        </div>
      </div>
    );
  }

  // ─── 4 DEFAULT VARIANT (BOTTOM SHEET) ──────────────────────────────────────────
  return (
    <div className="fixed inset-0 overflow-y-auto" style={modalLayerStyle}>
      <div className="flex items-end justify-center min-h-screen">
        {Overlay}
        <div className="bg-white border-gray-200 border-t bottom-0 dark:bg-gray-800 dark:border-gray-700 fixed flex flex-col left-0 max-h-screen overflow-hidden right-0 rounded-t-lg shadow-xl text-left transform transition-all w-full">
          {title && <ModalHeader title={title} onClose={onClose} showClose={showHeaderClose} />}
          <div className={`flex-grow-1 min-h-0 overflow-auto bg-white dark:bg-gray-800 no-scrollbar ${noPadding ? "" : "p-1"}`}>
            {contentGravity === "bottom" ? <div className={`${gravityClass} text-gray-900 dark:text-gray-100`}>{children}</div> : <div className="dark:text-gray-100 text-gray-900">{children}</div>}
          </div>
          {footer && <ModalFooter>{footer}</ModalFooter>}
        </div>
      </div>
    </div>
  );
}
