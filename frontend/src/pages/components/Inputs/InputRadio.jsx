import React from "react";

export default function InputRadio({ className = "", ...props }) {
  return <input type="radio" className={`form-check-input ${className}`.trim()} {...props} />;
}
