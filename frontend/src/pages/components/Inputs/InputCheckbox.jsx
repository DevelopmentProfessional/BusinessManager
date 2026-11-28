import React from "react";

export default function InputCheckbox({ className = "", style, ...props }) {
  return <input {...props} type="checkbox" className={`form-check-input ${className}`.trim()} style={style} />;
}
