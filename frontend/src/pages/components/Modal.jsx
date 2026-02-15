import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

export default function Modal({ isOpen, onClose, children, title, fullScreen = false, noPadding = false, footer = null }) {
  if (!isOpen) return null;

  // Background overlay
  const Overlay = (
    <div
      className="fixed inset-0 bg-gray-500 dark:bg-gray-900 dark:bg-opacity-75 bg-opacity-75 transition-opacity"
      onClick={onClose}
    />
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50">
        {Overlay}
        <div className="fixed inset-0 flex flex-col bg-white dark:bg-gray-900">
          {/* Header if title provided; otherwise show a close button in the corner */}
          {title ? (
            <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 px-1 py-1">
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100">{title}</h3>
              <button type="button" onClick={onClose} title="Close" aria-label="Close" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onClose}
              title="Close"
              aria-label="Close"
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          )}
          <div className={`${noPadding ? '' : 'p-1'} flex-1 overflow-auto text-gray-900 dark:text-gray-100`}>{children}</div>
          {footer && (
            <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-1 py-1 sm:px-1">
              {footer}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Default (non-fullscreen) modal
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen">
        {Overlay}

        <div className="fixed bottom-0 left-0 right-0 w-full bg-white dark:bg-gray-800 rounded-t-lg text-left overflow-hidden shadow-xl transform transition-all border-t border-gray-200 dark:border-gray-700 max-h-[80vh] overflow-y-auto">
          <div className={`bg-white dark:bg-gray-800 ${noPadding ? '' : 'px-2 pt-4 pb-3'}`}>
            <div className="w-full">
              <div className="w-full">
                {title && (
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100">{title}</h3>
                    <button type="button" onClick={onClose} title="Close" aria-label="Close" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>
                )}
                <div className={`${noPadding ? '' : 'mt-2'} text-gray-900 dark:text-gray-100`}>{children}</div>
              </div>
            </div>
          </div>
          {footer && (
            <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
