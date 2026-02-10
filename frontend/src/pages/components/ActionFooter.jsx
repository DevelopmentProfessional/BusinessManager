import React from 'react';

/**
 * Footer section for action buttons. Use with IconButton for icon-only buttons with tooltips.
 */
export default function ActionFooter({ children, className = '' }) {
  return (
    <footer
      className={`flex items-center justify-end gap-1 pt-1 mt-1 border-t border-gray-200 dark:border-gray-700 ${className}`}
      role="group"
      aria-label="Actions"
    >
      {children}
    </footer>
  );
}
