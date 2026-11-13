// FILE: Button_App.jsx
// unified button replacing Button_Toolbar (icon+label+training mode) and Button_Icon (icon-only+variants)
// Dimensions: Profile → TextSize + training/compact (frontend/src/constants/buttonTextSize.js)
import React from "react";
import { TrashIcon, XMarkIcon } from "@heroicons/react/24/outline";
import useViewMode from "../../services/useViewMode";
import compactButtonLabel from "../../utils/compactButtonLabel";

/** Display label for toolbar buttons (short); keep full phrase in title when needed. */
// eslint-disable-next-line react-refresh/only-export-components -- Utility export is intentionally shared by button components.
export function buttonDisplayLabel(label) {
  return typeof label === "string" ? compactButtonLabel(label.trim()) : label;
}

const VARIANT_CLASS = {
  primary: "btn-app-primary",
  danger: "btn-app-danger btn-outline-danger",
  delete: "btn-app-danger btn-outline-danger",
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

export default function Button_App({ icon: Icon, label, onClick, variant, className = "", disabled = false, badge, compact = false, type = "button", title: titleProp, ...rest }) {
  const { isTrainingMode } = useViewMode();
  const normalizedLabel = typeof label === "string" ? label.trim() : "";
  const normalizedTitle = typeof titleProp === "string" ? titleProp.trim().toLowerCase() : "";
  const isCancel =
    normalizedLabel.toLowerCase() === "cancel" ||
    normalizedTitle === "cancel" ||
    variant === "cancel" ||
    normalizedLabel.toLowerCase() === "close" ||
    normalizedTitle === "close" ||
    normalizedTitle.startsWith("close ");

  const isDelete =
    normalizedLabel.toLowerCase() === "delete" ||
    normalizedTitle === "delete" ||
    normalizedTitle.startsWith("delete ") ||
    normalizedTitle.includes("delete") ||
    variant === "danger" ||
    variant === "delete";

  const isAlwaysCircle = isCancel || isDelete;
  const training = isTrainingMode && !compact && !isAlwaysCircle;
  const displayLabel = typeof label === "string" ? buttonDisplayLabel(normalizedLabel) : normalizedLabel;
  const showText = training && displayLabel.length > 0 && !isAlwaysCircle;
  const isIconOnly = !showText;
  const tooltipLabel = titleProp ?? (normalizedLabel || label);
  const iconClass = "app-icon flex-shrink-0";
  const variantClass = variant ? VARIANT_CLASS[variant] || variant : isDelete ? VARIANT_CLASS.danger : isCancel ? VARIANT_CLASS.cancel : "";
  const effectiveClass = training ? adjustTrainingMargins(className) : className;

  const EffectiveIcon = isDelete ? TrashIcon : isCancel ? XMarkIcon : Icon;

  const iconOnlyStyle = isIconOnly
    ? {
        width: "var(--app-btn-height, 2rem)",
        height: "var(--app-btn-height, 2rem)",
        minWidth: "var(--app-btn-height, 2rem)",
        maxWidth: "var(--app-btn-height, 2rem)",
        minHeight: "var(--app-btn-height, 2rem)",
        maxHeight: "var(--app-btn-height, 2rem)",
        flex: "0 0 var(--app-btn-height, 2rem)",
        borderRadius: "50%",
        aspectRatio: "1 / 1",
        padding: 0,
      }
    : undefined;

  const mergedStyle = iconOnlyStyle ? { ...iconOnlyStyle, ...(rest.style || {}) } : rest.style;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={tooltipLabel}
      aria-label={tooltipLabel}
      style={mergedStyle}
      className={`btn flex-shrink-0 d-flex align-items-center
        app-btn app-action-btn
        ${isIconOnly ? "btn-circle app-action-btn--icon-only rounded-circle p-0 justify-content-center" : "rounded-pill ps-2 pe-2 gap-1 justify-content-start"}
        ${variantClass} ${effectiveClass}
        ${badge ? "overflow-visible" : ""}`.trim()}
      {...rest}
    >
      {EffectiveIcon && <EffectiveIcon className={iconClass} />}
      {showText && (
        <span className="text-nowrap" style={{ fontSize: "var(--app-btn-label-font-size, 0.78rem)", lineHeight: 1, minWidth: 0 }}>
          {displayLabel}
        </span>
      )}
      {badge}
    </button>
  );
}
