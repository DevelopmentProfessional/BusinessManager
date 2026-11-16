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
 *   2026-11-16 | GitHub Copilot | Moved the default modal close action from the header to the footer
 *   2026-11-16 | GitHub Copilot | Removed the shared modal header close control
 * ============================================================
 */
import React, { createContext, useContext } from "react";
import { createPortal } from "react-dom";
import { XMarkIcon } from "../../../icons";
import Footer_Actions from "../footers/Footer_Actions";
import Button_Toolbar from "../buttons/Button_Toolbar";

export const ModalStackContext = createContext(0);
export const ModalContainerContext = createContext(null);

// ─── NAMED SUB-COMPONENTS ───────────────────────────────────────────────────

/**
 * ModalHeader
 *
 * Renders the title bar shared by all three modal variants.
 *
 * Props:
 *   title: string | ReactNode
 *   actions?: ReactNode — optional action buttons
 *   className?: string  — extra classes for the wrapper div
 */
export function ModalHeader({ title, actions = null, className = "" }) {
  return (
    <div className={`app-modal-header d-flex justify-content-between align-items-center border-bottom flex-shrink-0 bg-body p-1 ${className}`.trim()}>
      <h3 className="app-modal-title">{title}</h3>
      {actions && <div className="d-flex align-items-center gap-2">{actions}</div>}
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
export function ModalFooter({ children, className = "" }) {
  return <div className={`app-modal-footer app-form-footer app-standard-footer border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0 ${className}`.trim()}>{children}</div>;
}

// ─── DEFAULT EXPORT ─────────────────────────────────────────────────────────

export default function Modal({ isOpen, onClose, children, title, fullScreen = false, centered = false, noPadding = false, footer = null, showFooterClose = true, headerActions = null, contentGravity = "top", container = null, contentWidth = false, bodyClassName = "", bodyStyle }) {
  const currentDepth = useContext(ModalStackContext);
  const nextDepth = currentDepth + 1;
  const containerContext = useContext(ModalContainerContext);
  const effectiveContainer = container || containerContext;
  const resolvedFooter =
    footer ??
    (showFooterClose && title && onClose ? (
      <Footer_Actions
        center={
          <Button_Toolbar
            icon={XMarkIcon}
            label="Close"
            onClick={onClose}
            className="btn-outline-secondary"
            title="Close"
          />
        }
      />
    ) : null);

  if (!isOpen) return null;

  const gravityClass = "overflow-scroll-content overflow-scroll-content--bottom";

  // When container is set to "inline", render self-contained without portaling or full-screen overlays
  if (effectiveContainer === "inline") {
    return (
      <div className="app-modal-inline-container position-relative overflow-hidden w-100 h-100 d-flex flex-column border rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm" style={{ minHeight: "360px" }}>
        <ModalStackContext.Provider value={nextDepth}>
          {title && <ModalHeader title={title} actions={headerActions} />}
          <div className={`flex-grow-1 min-h-0 overflow-auto ${noPadding ? "pt-2" : "p-2"} no-scrollbar ${bodyClassName}`.trim()} style={bodyStyle}>
            {contentGravity === "bottom" ? <div className={gravityClass}>{children}</div> : children}
          </div>
          {resolvedFooter && <ModalFooter>{resolvedFooter}</ModalFooter>}
        </ModalStackContext.Provider>
      </div>
    );
  }

  // Stacking z-index: each nested modal renders on top of its parent modal and any page elements
  const layerZIndex = 1200 + currentDepth * 100;
  const modalContentZIndex = layerZIndex + 10;

  // ─── 1 OVERLAY ─────────────────────────────────────────────────────────────
  const Overlay = <div className="app-modal-overlay bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 fixed inset-0 transition-opacity" style={{ zIndex: layerZIndex }} onClick={onClose} />;

  // ─── 2 BOTTOM-ANCHORED MODAL SHEET (Global standard: all modals float to bottom and grow upwards) ─────
  const modalElement = (
    <div className="app-modal-layer fixed inset-0 overflow-hidden" style={{ zIndex: layerZIndex, "--app-modal-content-z-index": modalContentZIndex }}>
      {Overlay}
      <div
        className={`app-modal-dialog app-modal-sheet bg-white border-gray-200 border-t bottom-0 dark:bg-gray-800 dark:border-gray-700 fixed flex flex-col left-0 overflow-hidden right-0 shadow-xl text-left transform transition-all w-full rounded-t-lg ${
          contentWidth ? "app-modal-dialog--content-width" : ""
        } ${
          fullScreen ? "max-h-screen max-h-[95vh] app-modal-dialog--fullscreen app-modal-sheet--fullscreen" : "max-h-[90vh]"
        }`}
        style={{ zIndex: modalContentZIndex }}
      >
        {title && <ModalHeader title={title} actions={headerActions} />}
        <div
          className={`app-modal-body app-modal-content app-modal-scroll-surface flex-grow-1 min-h-0 bg-white dark:bg-gray-800 no-scrollbar overflow-y-auto ${bodyClassName} ${
            noPadding ? "p-0" : "p-1 pt-2"
          }`.trim()}
          style={bodyStyle}
        >
          {children}
        </div>
        {resolvedFooter && <ModalFooter>{resolvedFooter}</ModalFooter>}
      </div>
    </div>
  );

  const stackContent = (
    <ModalStackContext.Provider value={nextDepth}>
      {modalElement}
    </ModalStackContext.Provider>
  );

  return typeof document !== "undefined" ? createPortal(stackContent, document.body) : stackContent;
}
