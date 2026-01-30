import React from 'react';

/**
 * Footer section for action buttons. Use with IconButton for icon-only buttons with tooltips.
 */
export default function ActionFooter({ children, className = '' }) {
  return (
    <footer
      className={`flex items-center justify-end gap-2 pt-4 mt-4 border-t border-gray-200 dark:border-gray-700 ${className}`}
      role="group"
      aria-label="Actions"
    >
      {children}
    </footer>
  );
}
