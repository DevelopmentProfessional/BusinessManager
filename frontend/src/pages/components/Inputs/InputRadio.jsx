import React from "react";

export default function InputRadio({ className = "", style, ...props }) {
  return <input {...props} type="radio" className={`form-check-input ${className}`.trim()} style={style} />;
}
