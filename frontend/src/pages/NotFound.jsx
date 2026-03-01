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
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import useStore from '../services/useStore';

const NotFound = () => {
// ─── [2] STATE & REFS ───────────────────────────────────────────────────────
  const navigate = useNavigate();
  const { logout } = useStore();

// ─── [3] LIFECYCLE HOOK ─────────────────────────────────────────────────────
  useEffect(() => {
    // Clear all session variables
    const clearAllSessionData = () => {
      // Clear specific localStorage items
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('permissions');
      localStorage.removeItem('userFilters');
      
      // Clear sessionStorage
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      sessionStorage.removeItem('permissions');
      
      // Clear all cookies
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
      
      // Clear the store state
      logout();
      
      // Clear API cache if it exists
      if (typeof window !== 'undefined' && window.clearApiCache) {
        window.clearApiCache();
      }
    };

    // Clear everything immediately
    clearAllSessionData();

    // Show message briefly, then redirect
    const timer = setTimeout(() => {
      navigate('/login', { replace: true });
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigate, logout]);

// ─── [4] RENDER ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
        <div className="flex justify-center mb-4">
          <ExclamationTriangleIcon className="h-16 w-16 text-yellow-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Page Not Available
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          The page you're looking for doesn't exist or is no longer available.
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
          Clearing session data and redirecting to login...
        </p>
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
