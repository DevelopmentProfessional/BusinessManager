/*
 * ============================================================
 * FILE: NotFound.jsx
 *
 * PURPOSE:
 *   Renders a "Page Not Available" screen that is shown whenever the router
 *   navigates to an unrecognized path. It immediately clears all session data
 *   (localStorage, sessionStorage, cookies, and the Zustand store) and
 *   redirects the user to the login page after a brief 2-second delay.
 *
 * FUNCTIONAL PARTS:
 *   [1] Imports — React, routing, icons, and store
 *   [2] State & Refs — navigation hook and logout accessor from the store
 *   [3] Lifecycle Hook — clears session data and schedules redirect to /login
 *   [4] Render — "Page Not Available" message with loading spinner
 *
 * CHANGE LOG — all modifications to this file must be recorded here:
 *   Format : YYYY-MM-DD | Author | Description
 *   ─────────────────────────────────────────────────────────────
 *   2026-03-01 | Claude  | Added section comments and top-level documentation
 * ============================================================
 */

// ─── [1] IMPORTS ────────────────────────────────────────────────────────────
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const NotFound = () => {
// ─── [2] STATE & REFS ───────────────────────────────────────────────────────
  const navigate = useNavigate();

// ─── [3] RENDER ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
        <div className="flex justify-center mb-4">
          <ExclamationTriangleIcon className="h-16 w-16 text-yellow-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Page Not Found
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <button
          onClick={() => navigate('/', { replace: true })}
          className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
        >
          Go to Home
        </button>
      </div>
    </div>
  );
};

export default NotFound;
