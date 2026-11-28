import React, { useState } from "react";

export default function ImagePreview({ src, alt = "", fallback = null, className = "", imageClassName = "", style, objectFit = "cover", onError }) {
  const [failed, setFailed] = useState(false);
  const showFallback = !src || failed;

  const handleError = (event) => {
    setFailed(true);
    onError?.(event);
  };

  return (
    <div className={`app-image-preview ${className}`.trim()} style={style}>
      {!showFallback ? <img src={src} alt={alt} className={imageClassName} style={{ width: "100%", height: "100%", objectFit, display: "block" }} onError={handleError} /> : <div className="app-image-preview__fallback">{fallback}</div>}
    </div>
  );
}
