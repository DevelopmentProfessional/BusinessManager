// FILE: AppButton.jsx
// unified button replacing Button_Toolbar (icon+label+training mode) and Button_Icon (icon-only+variants)
// Dimensions: Profile → TextSize + training/compact (frontend/src/constants/buttonTextSize.js)
import React from "react";
import useViewMode from "../../services/useViewMode";
import compactButtonLabel from "../../utils/compactButtonLabel";

/** Display label for toolbar buttons (short); keep full phrase in title when needed. */
export function buttonDisplayLabel(label) {
  return typeof label === "string" ? compactButtonLabel(label.trim()) : label;
}

const VARIANT_CLASS = {
  primary: "btn-app-primary",
  danger: "btn-app-danger",
  secondary: "btn-app-secondary",
  cancel: "btn-app-cancel",
  ghost: "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800",
};

function adjustTrainingMargins(className) {
  return (className || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      const match = token.match(/^(m|mx|my|mt|me|mb|ms)-([0-5])$/);
      if (!match) return token;
      return `${match[1]}-${Math.max(Number(match[2]) - 1, 0)}`;
    })
    .join(" ");
}

export default function AppButton({ icon: Icon, label, onClick, variant, className = "", disabled = false, badge, compact = false, type = "button", title: titleProp, ...rest }) {
  const { isTrainingMode } = useViewMode();
  const training = isTrainingMode && !compact;
  const normalizedLabel = typeof label === "string" ? label.trim() : "";
  const displayLabel = typeof label === "string" ? buttonDisplayLabel(normalizedLabel) : normalizedLabel;
  const showText = training && displayLabel.length > 0;
  const tooltipLabel = titleProp ?? (normalizedLabel || label);
  const iconClass = `app-icon flex-shrink-0 ${showText ? "me-0" : ""}`;
  const variantClass = variant ? VARIANT_CLASS[variant] || variant : "";
  const effectiveClass = training ? adjustTrainingMargins(className) : className;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={tooltipLabel}
      aria-label={tooltipLabel}
      className={`btn flex-shrink-0 d-flex align-items-center
        ${training ? "rounded-pill ps-0 pe-1 justify-content-start" : "rounded-circle p-0 justify-content-center"}
        ${variantClass} ${effectiveClass}`.trim()}
      {...rest}
    >
      {Icon && <Icon className={iconClass} />}
      {showText && (
        <span className="text-nowrap" style={{ fontSize: "var(--app-btn-label-font-size, 0.78rem)", lineHeight: 1, marginLeft: "-0.125rem" }}>
          {displayLabel}
        </span>
      )}
      {badge}
    </button>
  );
}
