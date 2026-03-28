// FILE: Button_Icon.jsx
// re-exports AppButton configured as icon-only; use AppButton for new code
import React from "react";
import AppButton from "./AppButton";

const ICON_VARIANT_CLASS = {
  primary: "bg-primary-600 hover:bg-primary-700 text-white focus:ring-2 focus:ring-primary-500",
  secondary: "bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200",
  danger: "bg-red-600 hover:bg-red-700 text-white",
  "outline-danger": "text-red-600 hover:text-red-700 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20",
  ghost: "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800",
};

export default function Button_Icon({ icon, label, onClick, type = "button", className = "", disabled = false, variant = "secondary", ...rest }) {
  const variantClass = ICON_VARIANT_CLASS[variant] || ICON_VARIANT_CLASS.secondary;
  return (
    <AppButton
      icon={icon}
      label={label}
      onClick={onClick}
      type={type}
      className={`${variantClass} ${className}`.trim()}
      disabled={disabled}
      compact
      {...rest}
    />
  );
}
