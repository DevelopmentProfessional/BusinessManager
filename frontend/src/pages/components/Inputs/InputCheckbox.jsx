import React from "react";

export default function InputCheckbox({ className = "", ...props }) {
  return <input type="checkbox" className={`form-check-input ${className}`.trim()} {...props} />;
}
