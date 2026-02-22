import React, { useState } from 'react';
import api from '../../services/api.js';

/**
 * API Debug Info component to display API configuration and test connectivity
 * Can be used in Settings page or other pages that need API debugging info
 */
export default function ApiDebugInfo() {
  const [apiStatus, setApiStatus] = useState('unknown');
  const [testResult, setTestResult] = useState(null);

  const testApiConnection = async () => {
    setApiStatus('testing');
    try {
      // Try to hit the health endpoint or a simple endpoint
      const response = await api.get('/health').catch(() => {
        // If /health doesn't exist, try /auth/me as a test
        return api.get('/auth/me').catch(() => null);
      });
      
      if (response) {
        setApiStatus('connected');
        setTestResult({ success: true, status: response.status });
      } else {
        setApiStatus('error');
        setTestResult({ success: false, error: 'No response received' });
      }
    } catch (error) {
      setApiStatus('error');
      setTestResult({
        success: false,
        error: error.message,
        details: error.response?.status || 'Network error',
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <svg className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-blue-800 dark:text-blue-300">
            This section displays API configuration and connection status. 
            Use this to troubleshoot connectivity issues.
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Base URL</p>
            <p className="text-sm font-mono text-gray-900 dark:text-white break-all">
              {api.defaults.baseURL}
            </p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Hostname</p>
            <p className="text-sm font-mono text-gray-900 dark:text-white">
              {window.location.hostname}
            </p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Protocol</p>
            <p className="text-sm font-mono text-gray-900 dark:text-white">
              {window.location.protocol}
            </p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Port</p>
            <p className="text-sm font-mono text-gray-900 dark:text-white">
              {window.location.port || 'default'}
            </p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg col-span-2">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">VITE_API_URL</p>
            <p className="text-sm font-mono text-gray-900 dark:text-white">
              {import.meta.env.VITE_API_URL || 'not set'}
            </p>
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">
            Connection Test
          </h3>
          <button
            onClick={testApiConnection}
            disabled={apiStatus === 'testing'}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg transition-colors disabled:cursor-not-allowed"
          >
            {apiStatus === 'testing' ? 'Testing Connection...' : 'Test API Connection'}
          </button>
          
          {testResult && (
            <div className={`mt-4 p-4 rounded-lg ${
              testResult.success 
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
                : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
            }`}>
              {testResult.success ? (
                <div className="text-green-800 dark:text-green-300">
                  <p className="font-medium">✓ Connection Successful</p>
                  <p className="text-sm mt-1">Status Code: {testResult.status}</p>
                </div>
              ) : (
                <div className="text-red-800 dark:text-red-300">
                  <p className="font-medium">✗ Connection Failed</p>
                  <p className="text-sm mt-1">Error: {testResult.error}</p>
                  <p className="text-sm">Details: {testResult.details}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
