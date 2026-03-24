/**
 * Performance Tracking Service
 * Tracks component load times and logs to console
 */

const PERFORMANCE_SESSION_KEY = 'perf_session_start';
const PERFORMANCE_COMPONENTS_KEY = 'perf_components_log';

export const startPerformanceSession = () => {
  const now = performance.now();
  sessionStorage.setItem(PERFORMANCE_SESSION_KEY, now);
  sessionStorage.setItem(PERFORMANCE_COMPONENTS_KEY, JSON.stringify([]));
};

export const logComponentLoad = (componentName) => {
  const startTime = parseFloat(sessionStorage.getItem(PERFORMANCE_SESSION_KEY));
  if (!startTime) return;

  const currentTime = performance.now();
  const loadTime = currentTime - startTime;

  try {
    const componentsLog = JSON.parse(sessionStorage.getItem(PERFORMANCE_COMPONENTS_KEY) || '[]');
    componentsLog.push({ name: componentName, timestamp: currentTime, totalElapsedTime: loadTime });
    sessionStorage.setItem(PERFORMANCE_COMPONENTS_KEY, JSON.stringify(componentsLog));
  } catch { /* silent */ }
};

export const finalizePerformanceReport = () => {
  try {
    sessionStorage.removeItem(PERFORMANCE_SESSION_KEY);
    sessionStorage.removeItem(PERFORMANCE_COMPONENTS_KEY);
  } catch { /* silent */ }
};

export const clearPerformanceSession = () => {
  sessionStorage.removeItem(PERFORMANCE_SESSION_KEY);
  sessionStorage.removeItem(PERFORMANCE_COMPONENTS_KEY);
};

export const getPerformanceSessionActive = () => {
  return sessionStorage.getItem(PERFORMANCE_SESSION_KEY) !== null;
};

export default {
  startPerformanceSession,
  logComponentLoad,
  finalizePerformanceReport,
  clearPerformanceSession,
  getPerformanceSessionActive
};
