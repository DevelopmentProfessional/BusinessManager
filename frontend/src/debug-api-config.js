// Debug: Log the API URL being used
console.log('VITE_API_URL from env:', import.meta.env.VITE_API_URL);
console.log('Window hostname:', window.location.hostname);

// Sanitize base URL: trim whitespace and trailing slashes to avoid `%20` or double-slash issues  
// Default to relative path for dev (Vite proxy), direct backend URL for production
const RAW_API_BASE_URL = import.meta.env.VITE_API_URL || 
  (window.location.hostname === 'localhost' ? '/api/v1' : 'https://businessmanager-reference-api.onrender.com/api/v1');
const API_BASE_URL = RAW_API_BASE_URL.trim().replace(/\/+$/, '');

console.log('Final API_BASE_URL:', API_BASE_URL);

export { API_BASE_URL };