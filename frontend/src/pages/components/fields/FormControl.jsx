import React, { forwardRef } from "react";

/**
 * Shared native form control used by entity forms.
 * The `as` prop supports input, textarea, and select while preserving native
 * form behavior and allowing callers to pass through control-specific props.
 */
const FormControl = forwardRef(function FormControl({ as = "input", className = "", ...props }, ref) {
  const Control = as;
  return <Control ref={ref} className={className} {...props} />;
});

export default FormControl;
