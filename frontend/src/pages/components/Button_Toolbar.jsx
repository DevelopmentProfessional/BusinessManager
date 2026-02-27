import React from 'react';
import useViewMode from '../../services/useViewMode';

function withTrainingModeMargin(className, isTrainingMode) {
  if (!isTrainingMode) return className;

  const tokens = (className || '').split(/\s+/).filter(Boolean);
  let hasMarginClass = false;

  const adjusted = tokens.map((token) => {
    const match = token.match(/^(m|mx|my|mt|me|mb|ms)-([0-5])$/);
    if (!match) return token;
    hasMarginClass = true;
    const nextStep = Math.min(Number(match[2]) + 1, 5);
    return `${match[1]}-${nextStep}`;
  });

  if (!hasMarginClass) {
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

export default function Button_Toolbar({ icon: Icon, label, onClick, className = '', disabled = false, badge, style = {}, ...rest }) {
  const { isTrainingMode } = useViewMode();
  const effectiveClassName = withTrainingModeMargin(className, isTrainingMode);
  const normalizedLabel = typeof label === 'string' ? label.trim() : '';
  const isFilterButton = /^filter\b/i.test(normalizedLabel);
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
        ${isTrainingMode ? (isFilterButton ? 'rounded-pill p-1' : 'rounded-pill px-3') : 'rounded-circle'}
        ${effectiveClassName}`}
      style={isTrainingMode ? { height: '2.25rem', ...style } : { width: '3rem', height: '3rem', ...style }}
      {...rest}
    >
      <Icon className={`flex-shrink-0 h-5 w-5${showTextLabel ? ' me-1' : ''}`} />
      {showTextLabel && <span className="text-nowrap" style={{ fontSize: '0.78rem', lineHeight: 1 }}>{displayLabel}</span>}
      {badge}
    </button>
  );
}
