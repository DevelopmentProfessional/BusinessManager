import React from 'react';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import useDarkMode from '../store/useDarkMode';

const DarkModeToggle = () => {
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  return (
    <button
      onClick={toggleDarkMode}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
        isDarkMode 
          ? 'bg-blue-600' 
          : 'bg-gray-200 border border-gray-300'
      }`}
      aria-label="Toggle dark mode"
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out ${
          isDarkMode ? 'translate-x-6' : 'translate-x-1'
        }`}
      >
        {isDarkMode ? (
          <MoonIcon className="h-3 w-3 text-blue-600" />
        ) : (
          <SunIcon className="h-3 w-3 text-gray-500" />
        )}
      </span>
    </button>
  );
};

export default DarkModeToggle;
