import React from 'react';

/**
 * Wraps content so it scrolls internally instead of making the page scroll.
 * Use inside a flex container (parent should have flex flex-col and a height or flex-1 min-h-0).
 * The component takes remaining space and scrolls when content overflows.
 */
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
