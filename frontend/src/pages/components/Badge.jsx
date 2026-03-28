// FILE: Badge.jsx
// renders a colored badge using app-badge CSS modifier classes
import React from "react";

export default function Badge({ variant = "gray", pill = false, label, className = "" }) {
  return (
    <span className={`app-badge app-badge--${variant}${pill ? " app-badge--pill" : ""}${className ? ` ${className}` : ""}`}>
      {label}
    </span>
  );
}
