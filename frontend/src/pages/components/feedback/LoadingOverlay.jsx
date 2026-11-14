import React from "react";
import LoadingSpinner from "./LoadingSpinner";

export default function LoadingOverlay({ label = "Loading", className = "" }) {
  return (
    <div className={`app-loading-overlay ${className}`.trim()} role="status" aria-busy="true">
      <LoadingSpinner label={label} />
    </div>
  );
}
