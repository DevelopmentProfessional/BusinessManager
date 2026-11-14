import React from "react";

/**
 * Shared native form control used by entity forms.
 * The `as` prop supports input, textarea, and select while preserving native
 * form behavior and allowing callers to pass through control-specific props.
 */
export default function FormControl({ as = "input", className = "", ...props }) {
  const Control = as;
  return <Control className={className} {...props} />;
}
