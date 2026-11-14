import React from "react";

/**
 * Footer section for action buttons. Use with Button_Icon for icon-only buttons with tooltips.
 * Buttons are positioned bottom-left with auto width based on text content (no col spacing).
 */
export default function Footer_Action({ children, className="" }) {
  return (
    <footer className={`app-footer-shell app-footer-toolbar d-flex align-items-center flex-wrap pt-1 mt-1 border-t border-gray-200 dark:border-gray-700 ${className}`} role="group" aria-label="Actions">
      {children}
    </footer>
  );
}
