import React from "react";

const VARIANTS = {
  empty: "app-state-message--empty",
  error: "app-state-message--error",
  success: "app-state-message--success",
  warning: "app-state-message--warning",
  info: "app-state-message--info",
};

export default function StateMessage({ variant = "info", icon: Icon, title, description, action, className = "" }) {
  return (
    <div className={`app-state-message ${VARIANTS[variant] || VARIANTS.info} ${className}`.trim()} role={variant === "error" ? "alert" : "status"}>
      {Icon && <Icon className="app-state-message__icon" aria-hidden="true" />}
      <div className="app-state-message__content">
        {title && <div className="app-state-message__title">{title}</div>}
        {description && <div className="app-state-message__description">{description}</div>}
        {action && <div className="app-state-message__action">{action}</div>}
      </div>
    </div>
  );
}

export function EmptyState(props) {
  return <StateMessage variant="empty" {...props} />;
}

export function ErrorState(props) {
  return <StateMessage variant="error" {...props} />;
}

export function SuccessMessage(props) {
  return <StateMessage variant="success" {...props} />;
}
