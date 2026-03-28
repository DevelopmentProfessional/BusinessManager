// FILE: AppButton.jsx
// unified button replacing Button_Toolbar (icon+label+training mode) and Button_Icon (icon-only+variants)
// training mode shows icon+label pill; non-training shows icon-only circle
import React from "react";
import useViewMode from "../../services/useViewMode";

const VARIANT_CLASS = {
  primary: "btn-app-primary",
  danger: "btn-app-danger",
  secondary: "btn-app-secondary",
  cancel: "btn-app-cancel",
  ghost: "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800",
};

function adjustTrainingMargins(className) {
  return (className || "").split(/\s+/).filter(Boolean).map((token) => {
    const match = token.match(/^(m|mx|my|mt|me|mb|ms)-([0-5])$/);
    if (!match) return token;
    return `${match[1]}-${Math.max(Number(match[2]) - 1, 0)}`;
  }).join(" ");
}

function simplifyLabel(label) {
  if (!label) return label;
  const action = label.match(/^(add|update|delete)\b/i);
  if (action) {
    const a = action[1].toLowerCase();
    return a.charAt(0).toUpperCase() + a.slice(1);
  }
  return label.replace(/^filter\s*/i, "").trim();
}

export default function AppButton({
  icon: Icon,
  label,
  onClick,
  variant,
  className = "",
  disabled = false,
  badge,
  compact = false,
  type = "button",
  ...rest
}) {
  const { isTrainingMode } = useViewMode();
  const training = isTrainingMode && !compact;
  const normalizedLabel = typeof label === "string" ? label.trim() : "";
  const displayLabel = training ? simplifyLabel(normalizedLabel) : normalizedLabel;
  const showText = training && displayLabel.length > 0;
  const iconClass = `flex-shrink-0 ${compact ? "h-4 p-0" : "h-5 px-1"} ${showText ? "me-0" : ""}`;
  const variantClass = variant ? (VARIANT_CLASS[variant] || variant) : "";
  const effectiveClass = training ? adjustTrainingMargins(className) : className;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={normalizedLabel || label}
      aria-label={normalizedLabel || label}
      className={`btn flex-shrink-0 d-flex align-items-center justify-content-center
        ${training ? "rounded-pill ps-0 pe-1" : "rounded-circle p-0"}
        ${variantClass} ${effectiveClass}`.trim()}
      style={training
        ? { height: "3rem" }
        : { width: "3rem", height: "3rem", minWidth: "3rem", minHeight: "3rem" }}
      {...rest}
    >
      {Icon && <Icon className={iconClass} />}
      {showText && (
        <span className="text-nowrap" style={{ fontSize: "0.78rem", lineHeight: 1, marginLeft: "-0.125rem" }}>
          {displayLabel}
        </span>
      )}
      {badge}
    </button>
  );
}
