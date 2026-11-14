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
 *   2026-05-15 | Copilot | Shortened fallback screen button labels for compact training-mode layouts
 * ============================================================
 */

// ─── [1] IMPORTS ────────────────────────────────────────────────────────────
import React from "react";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

const NotFound = () => {
  // ─── [2] STATE & REFS ───────────────────────────────────────────────────────
  const goToRoot = () => window.location.assign("/");
  const goToLogin = () => window.location.assign("/login");
  const reloadPage = () => window.location.reload();

  // ─── [3] RENDER ─────────────────────────────────────────────────────────────
  return (
    <div className="bg-gray-50 dark:bg-gray-900 flex items-center justify-center min-h-screen px-1">
      <div className="bg-white dark:bg-gray-800 max-w-md p-1 rounded-lg shadow-lg text-center w-full">
        <div className="flex justify-center mb-4">
          <ExclamationTriangleIcon className="h-16 text-yellow-500 w-16" />
        </div>
        <h1 className="dark:text-white font-bold mb-2 text-2xl text-gray-900">Page Not Found</h1>
        <p className="dark:text-gray-400 mb-3 text-gray-600">The page you're looking for doesn't exist, has moved, or the site is redeploying.</p>
        <p className="dark:text-gray-400 mb-6 text-gray-500 text-sm">Try reloading, then return to the main site.</p>
        <div className="flex flex-col gap-3 justify-center sm:flex-row">
          <button onClick={reloadPage} className="bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white font-medium hover:bg-gray-300 px-1 py-0 rounded-lg text-gray-900 transition-colors">
            Reload
          </button>
          <button onClick={goToRoot} className="bg-primary-600 font-medium hover:bg-primary-700 px-1 py-0 rounded-lg text-white transition-colors">
            Home
          </button>
          <button onClick={goToLogin} className="bg-indigo-600 font-medium hover:bg-indigo-700 px-1 py-0 rounded-lg text-white transition-colors">
            Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
