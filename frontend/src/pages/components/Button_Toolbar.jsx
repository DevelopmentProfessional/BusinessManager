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
 * ============================================================
 */
import React from 'react';
import useViewMode from '../../services/useViewMode';

// ─── 1 TRAINING MODE HELPERS ───────────────────────────────────────────────────

function withTrainingModeMargin(className, isTrainingMode) {
  if (!isTrainingMode) return className;

  const tokens = (className || '').split(/\s+/).filter(Boolean);
  let hasMarginClass = false;
  const isProfileFooter = tokens.includes('profile-footer-btn');
  const isSettingsAccordion = tokens.includes('settings-accordion-btn');

  const adjusted = tokens.map((token) => {
    const match = token.match(/^(m|mx|my|mt|me|mb|ms)-([0-5])$/);
    if (!match) return token;
    hasMarginClass = true;
    const nextStep = Math.min(Number(match[2]) + 1, 5);
    return `${match[1]}-${nextStep}`;
  });

  if (!hasMarginClass && !isProfileFooter && !isSettingsAccordion) {
    adjusted.push('m-1');
  }

  return adjusted.join(' ');
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

export default function Button_Toolbar({ icon: Icon, label, onClick, className = '', disabled = false, badge, style = {}, ...rest }) {
  const { isTrainingMode } = useViewMode();
  const effectiveClassName = withTrainingModeMargin(className, isTrainingMode);
  const normalizedLabel = typeof label === 'string' ? label.trim() : '';
  const isFilterButton = /^filter\b/i.test(normalizedLabel);
  const isProfileFooter = className.includes('profile-footer-btn');
  const isSettingsAccordion = className.includes('settings-accordion-btn');
  const baseTrainingLabel = isTrainingMode
    ? normalizedLabel.replace(/^filter\s*/i, '').trim()
    : normalizedLabel;
  const displayLabel = simplifyTrainingLabel(baseTrainingLabel, isTrainingMode);
  const showTextLabel = isTrainingMode && displayLabel.length > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={normalizedLabel || label}
      aria-label={normalizedLabel || label}
      className={`btn flex-shrink-0 d-flex align-items-center justify-content-center
        ${isTrainingMode ? (isFilterButton ? 'rounded-pill p-1' : (isProfileFooter || isSettingsAccordion) ? 'rounded-pill' : 'rounded-pill px-3') : 'rounded-circle'}
        ${effectiveClassName}`}
      style={isTrainingMode ? { height: '3rem', minWidth: '6.8rem', ...style } : { width: '3rem', height: '3rem', ...style }}
      {...rest}
    >
      <Icon className={`flex-shrink-0 h-5 w-5${showTextLabel ? ' me-1' : ''}`} />
      {showTextLabel && <span className="text-nowrap" style={{ fontSize: '0.78rem', lineHeight: 1 }}>{displayLabel}</span>}
      {badge}
    </button>
  );
}
