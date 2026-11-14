import React from "react";

export default function InputButton({ className = "", children, ...props }) {
  return (
    <button className={`app-input-button ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}
