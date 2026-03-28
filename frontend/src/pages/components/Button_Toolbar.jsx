/*
 * ============================================================
 * FILE: Button_Toolbar.jsx
 *
 * PURPOSE:
 *   A toolbar button component that renders an icon (and optionally a text label)
 *   inside a pill or circle shape. It adapts its appearance and layout when
 *   Training Mode is active — expanding to show a simplified action label
 *   alongside the icon and increasing margins to give extra breathing room.
 *
 * FUNCTIONAL PARTS:
 *   [1] Training Mode Helpers — withTrainingModeMargin adjusts margin Tailwind
 *       classes; simplifyTrainingLabel strips filler words from the button label
 *   [2] Button Component — Reads Training Mode state, computes effective classes
 *       and display label, and renders the Bootstrap btn element with icon and
 *       optional text span
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-03-01 | Claude  | Added section comments and top-level documentation
 *   2026-03-07 | Claude  | Reduced icon-label spacing for Profile footer buttons
 *   2026-03-07 | Claude  | Tightened Profile footer icon-label spacing again
 *   2026-03-07 | Copilot | Standardized footer/modal button sizing and icon-label spacing
 *   2026-03-07 | Copilot | Reduced training-mode margin inflation to keep footer buttons tighter
 * ============================================================
 */
import React from "react";
import useViewMode from "../../services/useViewMode";

// ─── 1 TRAINING MODE HELPERS ───────────────────────────────────────────────────

function withTrainingModeMargin(className, isTrainingMode) {
  if (!isTrainingMode) return className;

  const tokens = (className || "").split(/\s+/).filter(Boolean);

  return tokens
    .map((token) => {
      const match = token.match(/^(m|mx|my|mt|me|mb|ms)-([0-5])$/);
      if (!match) return token;
      const nextStep = Math.max(Number(match[2]) - 1, 0);
      return `${match[1]}-${nextStep}`;
    })
    .join(" ");
}

function simplifyTrainingLabel(normalizedLabel, isTrainingMode) {
  if (!isTrainingMode || !normalizedLabel) return normalizedLabel;

  const actionMatch = normalizedLabel.match(/^(add|update|delete)\b/i);
  if (actionMatch) {
    const action = actionMatch[1].toLowerCase();
    return action.charAt(0).toUpperCase() + action.slice(1);
  }

  return normalizedLabel;
}

// ─── 2 BUTTON COMPONENT ────────────────────────────────────────────────────────

export default function Button_Toolbar({ icon: Icon, label, onClick, className = "", disabled = false, badge, style = {}, compact = false, ...rest }) {
  const { isTrainingMode } = useViewMode();
  const training = isTrainingMode && !compact;
  const effectiveClassName = withTrainingModeMargin(className, training);
  const normalizedLabel = typeof label === "string" ? label.trim() : "";
  const baseTrainingLabel = training ? normalizedLabel.replace(/^filter\s*/i, "").trim() : normalizedLabel;
  const displayLabel = simplifyTrainingLabel(baseTrainingLabel, training);
  const showTextLabel = training && displayLabel.length > 0;
  const iconClassName = `flex-shrink-0 ${compact ? "h-4 p-0" : "h-5 px-1"} ${showTextLabel ? " me-0" : ""}`;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={normalizedLabel || label}
      aria-label={normalizedLabel || label}
      className={`btn flex-shrink-0 d-flex align-items-center justify-content-center
        ${training ? "rounded-pill ps-0 pe-1" : "rounded-circle p-0"}
        ${effectiveClassName}`}
      style={training ? { height: "3rem", ...style } : { width: "3rem", height: "3rem", minWidth: "3rem", minHeight: "3rem", ...style }}
      {...rest}
    >
      <Icon className={iconClassName} />
      {showTextLabel && (
        <span className="text-nowrap" style={{ fontSize: "0.78rem", lineHeight: 1, marginLeft: "-0.125rem" }}>
          {displayLabel}
        </span>
      )}
      {badge}
    </button>
  );
}
