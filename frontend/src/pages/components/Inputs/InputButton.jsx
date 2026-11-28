import React from "react";

export default function InputButton({ className = "", children, style, ...props }) {
  return (
    <button {...props} className={`app-input-button ${className}`.trim()} style={style}>
      {children}
    </button>
  );
}
