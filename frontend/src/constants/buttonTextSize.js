/** Button width/height (rem) by text size and view mode. Applied via CSS variables on :root. */
export const BUTTON_TEXT_SIZES = ["small", "medium", "large"];

export const BUTTON_SIZE_CONFIG = {
  small: {
    training: { width: 3, height: 1.5 },
    compact: { width: 1.5, height: 1.5 },
  },
  medium: {
    training: { width: 4, height: 2 },
    compact: { width: 2, height: 2 },
  },
  large: {
    training: { width: 5, height: 3 },
    compact: { width: 3, height: 3 },
  },
};

export function getButtonDimensions(textSize, isTrainingMode) {
  const size = BUTTON_SIZE_CONFIG[textSize] ? textSize : "medium";
  const mode = isTrainingMode ? "training" : "compact";
  return BUTTON_SIZE_CONFIG[size][mode];
}

/** Icon and label scale with button height / text size. */
export function getButtonTypography(textSize, isTrainingMode) {
  const { height } = getButtonDimensions(textSize, isTrainingMode);
  const iconSize = Math.round(height * 0.5625 * 1000) / 1000;
  const labelBySize = { small: 0.7, medium: 0.78, large: 0.9 };
  const labelFontSize = labelBySize[textSize] ?? labelBySize.medium;
  return {
    iconSize,
    iconSizeActive: Math.round(iconSize * 1.1 * 1000) / 1000,
    labelFontSize,
  };
}

/** Nav toggle uses compact-mode width; same height as other buttons. */
export function applyButtonDimensions(textSize, isTrainingMode) {
  if (typeof document === "undefined") return;
  const { width, height } = getButtonDimensions(textSize, isTrainingMode);
  const { iconSize, iconSizeActive, labelFontSize } = getButtonTypography(textSize, isTrainingMode);
  const compact = BUTTON_SIZE_CONFIG[textSize]?.compact ?? BUTTON_SIZE_CONFIG.medium.compact;
  const root = document.documentElement;
  root.style.setProperty("--app-btn-width", `${width}rem`);
  root.style.setProperty("--app-btn-height", `${height}rem`);
  root.style.setProperty("--app-btn-nav-width", `${compact.width}rem`);
  root.style.setProperty("--app-icon-size", `${iconSize}rem`);
  root.style.setProperty("--app-icon-size-active", `${iconSizeActive}rem`);
  /* Legacy aliases */
  root.style.setProperty("--app-btn-icon-size", `${iconSize}rem`);
  root.style.setProperty("--app-btn-icon-size-active", `${iconSizeActive}rem`);
  root.style.setProperty("--app-btn-label-font-size", `${labelFontSize}rem`);
  const footerGapBySize = { small: 0.25, medium: 0.25, large: 0.375 };
  root.style.setProperty("--app-footer-btn-gap", `${footerGapBySize[textSize] ?? footerGapBySize.medium}rem`);
  /* Match bottom-right +Nav inset (Bootstrap p-2 = 0.5rem) on all text sizes */
  const footerPaddingBySize = { small: 0.5, medium: 0.5, large: 0.5 };
  root.style.setProperty("--app-footer-padding-y", `${footerPaddingBySize[textSize] ?? footerPaddingBySize.medium}rem`);
  const navBtnWidth = isTrainingMode ? width : compact.width;
  root.style.setProperty("--app-footer-nav-reserve", `calc(${navBtnWidth}rem + var(--app-footer-padding-x))`);
  root.style.setProperty("--app-input-height", `${height}rem`);
  root.style.setProperty("--app-input-font-size", `${labelFontSize}rem`);
}

export const BUTTON_SIZE_TABLE_ROWS = BUTTON_TEXT_SIZES.flatMap((size) => [
  { size, mode: "Training", ...BUTTON_SIZE_CONFIG[size].training },
  { size, mode: "Compact", ...BUTTON_SIZE_CONFIG[size].compact },
]);
