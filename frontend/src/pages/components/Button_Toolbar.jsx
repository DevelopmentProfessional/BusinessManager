import React from 'react';
import useViewMode from '../../services/useViewMode';

export default function Button_Toolbar({ icon: Icon, label, onClick, className = '', disabled = false, badge, style = {}, ...rest }) {
  const { isTrainingMode } = useViewMode();

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`btn flex-shrink-0 d-flex align-items-center justify-content-center
        ${isTrainingMode ? 'rounded-pill px-3' : 'rounded-circle'}
        ${className}`}
      style={isTrainingMode ? { height: '2.25rem', ...style } : { width: '3rem', height: '3rem', ...style }}
      {...rest}
    >
      <Icon className={`flex-shrink-0 h-5 w-5${isTrainingMode ? ' me-1' : ''}`} />
      {isTrainingMode && <span className="text-nowrap" style={{ fontSize: '0.78rem', lineHeight: 1 }}>{label}</span>}
      {badge}
    </button>
  );
}
