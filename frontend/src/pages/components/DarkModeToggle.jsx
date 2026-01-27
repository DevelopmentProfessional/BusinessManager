import React from 'react';
import useDarkMode from '../services/useDarkMode';

const DarkModeToggle = () => {
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  return (
    <button
      onClick={toggleDarkMode}
      className="btn btn-outline-secondary btn-sm"
      title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle dark mode"
    >
      {isDarkMode ? '🌚' : '🌞'}
    </button>
  );
};

export default DarkModeToggle;
