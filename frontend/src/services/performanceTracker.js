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
  console.log(`[Performance] Session started at ${now}ms`);
};

export const logComponentLoad = (componentName) => {
  const startTime = parseFloat(sessionStorage.getItem(PERFORMANCE_SESSION_KEY));
  
  if (!startTime) {
    console.warn('[Performance] No session start time found');
    return;
  }

  const currentTime = performance.now();
  const loadTime = currentTime - startTime;

  try {
    const componentsLog = JSON.parse(sessionStorage.getItem(PERFORMANCE_COMPONENTS_KEY) || '[]');
    componentsLog.push({
      name: componentName,
      timestamp: currentTime,
      totalElapsedTime: loadTime
    });
    sessionStorage.setItem(PERFORMANCE_COMPONENTS_KEY, JSON.stringify(componentsLog));
    console.log(`[Performance] Component loaded: ${componentName} - Total elapsed: ${loadTime.toFixed(2)}ms`);
  } catch (err) {
    console.error('[Performance] Error logging component:', err);
  }
};

export const finalizePerformanceReport = () => {
  const startTime = parseFloat(sessionStorage.getItem(PERFORMANCE_SESSION_KEY));
  
  if (!startTime) {
    console.warn('[Performance] No session start time found');
    return;
  }

  try {
    const componentsLog = JSON.parse(sessionStorage.getItem(PERFORMANCE_COMPONENTS_KEY) || '[]');
    const endTime = performance.now();
    const totalTime = endTime - startTime;

    console.log('\n' + '='.repeat(80));
    console.log('🎯 LOGIN PERFORMANCE REPORT');
    console.log('='.repeat(80));
    console.log(`📊 Total Time: ${totalTime.toFixed(2)}ms\n`);
    console.log('📋 Component Load Sequence:');
    console.log('-'.repeat(80));

    if (componentsLog.length > 0) {
      componentsLog.forEach((component, index) => {
        const timeSince = component.timestamp - startTime;
        console.log(`${index + 1}. ${component.name.padEnd(30)} | Total: ${component.totalElapsedTime.toFixed(2)}ms | Time since start: ${timeSince.toFixed(2)}ms`);
      });
    } else {
      console.log('No components logged');
    }

    console.log('-'.repeat(80));
    console.log(`✅ Profile page fully loaded in ${totalTime.toFixed(2)}ms`);
    console.log('='.repeat(80) + '\n');

    // Clear session data
    sessionStorage.removeItem(PERFORMANCE_SESSION_KEY);
    sessionStorage.removeItem(PERFORMANCE_COMPONENTS_KEY);
  } catch (err) {
    console.error('[Performance] Error finalizing report:', err);
  }
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
