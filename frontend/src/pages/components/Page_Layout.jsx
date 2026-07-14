import React from "react";

export default function PageLayout({ title, error, children, headerRight = null, contentGravity = "top" }) {
  const gravityClass = contentGravity === "bottom" ? "justify-content-end" : "justify-content-start";

  return (
    <div className="bg-body d-flex flex-column flex-grow-1 h-100 min-h-0 overflow-hidden">
      <div className="align-items-center bg-body border-bottom d-flex flex-shrink-0 justify-content-between p-1" style={{ zIndex: 5 }}>
        <h1 className="fw-bold h4 mb-0 text-body-emphasis">{title}</h1>
        {headerRight ? <div className="ui-flex-center-gap-2">{headerRight}</div> : null}
      </div>
      {error && <div className="alert alert-danger border-0 flex-shrink-0 m-0 py-0 rounded-0">{error}</div>}
      <div className={`flex-grow-1 min-h-0 d-flex flex-column overflow-hidden ${gravityClass}`}>{children}</div>
    </div>
  );
}
