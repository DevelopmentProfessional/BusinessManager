import { preloadMajorTables, settingsAPI } from './api';

export async function runAppSync() {
  if (typeof window !== 'undefined' && typeof window.clearApiCache === 'function') {
    window.clearApiCache();
  }

  await preloadMajorTables();

  try {
    await settingsAPI.getScheduleSettings();
  } catch {
    // Best-effort ping only.
  }

  if (typeof window !== 'undefined' && typeof window.forceServiceWorkerRefresh === 'function') {
    await window.forceServiceWorkerRefresh();
    return;
  }

  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set('__sync', String(Date.now()));
  window.location.replace(nextUrl.toString());
}