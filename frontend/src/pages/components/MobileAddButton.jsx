import React from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';

export default function MobileAddButton({ onClick, label = "Add", className = "" }) {
  return (
    <button
      onClick={onClick}
      className={`
        fixed bottom-24 left-1/2 transform -translate-x-1/2 z-30
        bg-blue-600 hover:bg-blue-700 text-white
        px-6 py-3 rounded-full shadow-lg hover:shadow-xl
        flex items-center gap-2 transition-all
        font-medium text-sm
        md:hidden
        ${className}
      `}
    >
      <PlusIcon className="h-5 w-5" />
      {label}
    </button>
  );
}
