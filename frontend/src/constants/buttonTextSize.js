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

/** Nav toggle uses compact-mode width; same height as other buttons. */
export function applyButtonDimensions(textSize, isTrainingMode) {
  if (typeof document === "undefined") return;
  const { width, height } = getButtonDimensions(textSize, isTrainingMode);
  const compact = BUTTON_SIZE_CONFIG[textSize]?.compact ?? BUTTON_SIZE_CONFIG.medium.compact;
  const root = document.documentElement;
  root.style.setProperty("--app-btn-width", `${width}rem`);
  root.style.setProperty("--app-btn-height", `${height}rem`);
  root.style.setProperty("--app-btn-nav-width", `${compact.width}rem`);
}

export const BUTTON_SIZE_TABLE_ROWS = BUTTON_TEXT_SIZES.flatMap((size) => [
  { size, mode: "Training", ...BUTTON_SIZE_CONFIG[size].training },
  { size, mode: "Compact", ...BUTTON_SIZE_CONFIG[size].compact },
]);
