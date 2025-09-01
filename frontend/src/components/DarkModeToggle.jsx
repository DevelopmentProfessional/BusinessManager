import React from 'react';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import useDarkMode from '../store/useDarkMode';

const DarkModeToggle = () => {
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  return (
    <button
      onClick={toggleDarkMode}
      className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-2"
      title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      style={{ minWidth: 'auto', padding: '0.375rem 0.75rem' }}
    >
      {isDarkMode ? (
        <>
          <SunIcon className="h-4 w-4" />
          <span className="d-none d-sm-inline">Light</span>
        </>
      ) : (
        <>
          <MoonIcon className="h-4 w-4" />
          <span className="d-none d-sm-inline">Dark</span>
        </>
      )}
    </button>
  );
};

export default DarkModeToggle;
