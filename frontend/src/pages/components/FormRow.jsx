// FILE: FormRow.jsx
// wraps form-floating mb-2 layout for consistent form field spacing
import React from "react";

export default function FormRow({ label, children, className = "" }) {
  return (
    <div className={`form-floating mb-2 ${className}`}>
      {children}
      <label>{label}</label>
    </div>
  );
}
