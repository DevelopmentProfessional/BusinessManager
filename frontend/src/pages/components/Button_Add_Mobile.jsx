import React from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';

export default function Button_Add_Mobile({ onClick, label = "Add", className = "" }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`
        fixed bottom-24 left-1/2 transform -translate-x-1/2 z-30
        bg-blue-600 hover:bg-blue-700 text-white
        p-3 rounded-full shadow-lg hover:shadow-xl
        flex items-center justify-center transition-all
        md:hidden
        ${className}
      `}
    >
      <PlusIcon className="h-6 w-6" />
    </button>
  );
}
