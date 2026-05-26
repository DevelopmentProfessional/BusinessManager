import React from "react";

export default function PortalFooter({ children, className = "" }) {
  if (!children) return null;

  return <footer className={`portal-footer ${className}`.trim()}>{children}</footer>;
}
