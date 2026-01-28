import React, { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import useDarkMode from '../../services/useDarkMode';

export default function CustomDropdown({
  value,
  onChange,
  options = [],
  placeholder = '',
  required = false,
  className = '',
  disabled = false,
  name = '',
  id = '',
  searchable = false
}) {
  const { isDarkMode } = useDarkMode();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const handleSelect = (option) => {
    onChange({ target: { name, value: option.value } });
    setIsOpen(false);
    setSearchTerm('');
  };

  const selectedOption = options.find(option => option.value === value);
  const displayValue = selectedOption ? selectedOption.label : placeholder;

  // Filter options based on search term
  const filteredOptions = searchable && searchTerm 
    ? options.filter(option => 
        option.label.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options;

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {searchable ? (
        <div className="relative">
          <input
            type="text"
            value={isOpen ? searchTerm : displayValue}
            onChange={(e) => {
              if (isOpen) {
                setSearchTerm(e.target.value);
              }
            }}
            onFocus={() => {
              setIsOpen(true);
              setSearchTerm('');
            }}
            placeholder={placeholder}
            className={`
              w-full px-3 py-2 border rounded-lg 
              focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
              ${isDarkMode 
                ? `border-gray-600 ${disabled ? 'bg-gray-800 cursor-not-allowed text-gray-400' : 'bg-gray-700 text-white hover:border-gray-500'}` 
                : `border-gray-300 ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white hover:border-gray-400'}`
              }
              ${required && !value ? 'border-red-300 focus:ring-red-500' : ''}
            `}
            disabled={disabled}
          />
          <button
            type="button"
            onClick={() => !disabled && setIsOpen(!isOpen)}
            className="absolute right-2 top-1/2 transform -translate-y-1/2"
          >
            <ChevronDownIcon 
              className="h-4 w-4 text-gray-400 transition-transform" 
              style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={`
            w-full px-3 py-2 border rounded-lg 
            focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
            flex items-center justify-between
            ${isDarkMode 
              ? `border-gray-600 ${disabled ? 'bg-gray-800 text-gray-400 cursor-not-allowed' : 'bg-gray-700 text-white cursor-pointer hover:border-gray-500'}` 
              : `border-gray-300 ${disabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white text-gray-900 cursor-pointer hover:border-gray-400'}`
            }
            ${required && !value ? 'border-red-300 focus:ring-red-500' : ''}
          `}
          disabled={disabled}
        >
          <span className={`${!selectedOption ? (isDarkMode ? 'text-gray-400' : 'text-gray-500') : ''}`}>
            {displayValue}
          </span>
          <ChevronDownIcon 
            className="h-4 w-4 transition-transform" 
            style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </button>
      )}

      {isOpen && (
        <div className={`absolute z-50 w-full mt-1 border rounded-lg shadow-lg max-h-60 overflow-y-auto ${
          isDarkMode 
            ? 'bg-gray-700 border-gray-600' 
            : 'bg-white border-gray-300'
        }`}>
          {filteredOptions.length === 0 ? (
            <div className={`px-3 py-2 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>No options available</div>
          ) : (
            filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option)}
                className={`
                  w-full px-3 py-2 text-left focus:outline-none
                  ${isDarkMode 
                    ? `hover:bg-gray-600 focus:bg-gray-600 ${option.value === value ? 'bg-blue-900 text-blue-300' : 'text-gray-200'}` 
                    : `hover:bg-gray-100 focus:bg-gray-100 ${option.value === value ? 'bg-blue-50 text-blue-700' : 'text-gray-900'}`
                  }
                `}
              >
                {option.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
