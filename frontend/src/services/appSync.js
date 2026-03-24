export async function runAppSync() {
  // 1. Clear all bm_cache_* entries from localStorage
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('bm_cache_')) keysToRemove.push(k);
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch { /* storage may be unavailable */ }

  // 2. Clear any browser / service-worker caches left from previous builds
  if ('caches' in window) {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch { /* best effort */ }
  }

  // 3. Hard reload — bypasses browser cache so index.html and assets are
  //    fetched fresh from the server, which triggers a full API re-fetch.
  const url = new URL(window.location.href);
  url.searchParams.set('_r', String(Date.now()));
  window.location.replace(url.toString());
}