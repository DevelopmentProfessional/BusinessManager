import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

export default function Modal({ isOpen, onClose, children, title, fullScreen = false, noPadding = false, footer = null }) {
  if (!isOpen) return null;

  // Background overlay
  const Overlay = (
    <div
      className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
      onClick={onClose}
    />
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50">
        {Overlay}
        <div className="fixed inset-0 flex flex-col bg-white">
          {/* Header if title provided; otherwise show a close button in the corner */}
          {title ? (
            <div className="flex justify-between items-center border-b px-4 py-3">
              <h3 className="text-lg leading-6 font-medium text-gray-900">{title}</h3>
              <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          )}
          <div className={`${noPadding ? '' : 'p-6'} flex-1 overflow-auto`}>{children}</div>
          {footer && (
            <div className="border-t bg-white px-4 py-3 sm:px-6">
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
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {Overlay}

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className={`bg-white ${noPadding ? '' : 'px-4 pt-5 pb-4 sm:p-6 sm:pb-4'}`}>
            <div className="sm:flex sm:items-start">
              <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                {title && (
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">{title}</h3>
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>
                )}
                <div className={`${noPadding ? '' : 'mt-2'}`}>{children}</div>
              </div>
            </div>
          </div>
          {footer && (
            <div className="border-t bg-white px-4 py-3 sm:px-6">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
