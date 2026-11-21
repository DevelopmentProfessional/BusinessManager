import React from "react";

export default function LoadingSpinner({ label = "Loading", size = "md", className = "" }) {
  return (
    <div className={`app-loading-spinner app-loading-spinner--${size} ${className}`.trim()} role="status" aria-label={label}>
      <span className="spinner-border" aria-hidden="true" />
      <span className="visually-hidden">{label}</span>
    </div>
  );
}
