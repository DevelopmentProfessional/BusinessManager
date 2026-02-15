/**
 * Client-side persistent cache using localStorage.
 *
 * Data is stored per table/key.  Each entry has the shape:
 *   { rows: [...], count: N, maxCreatedAt: "ISO-string", cachedAt: "ISO-string" }
 *
 * On first site load the full dataset is fetched and cached.
 * On subsequent visits the cached data is served immediately while
 * a lightweight sync check runs in the background.  If the backend
 * reports a higher count or newer max_created_at the cache fetches
 * only the delta (rows created after maxCreatedAt) and appends them.
 *
 * On logout the entire cache is cleared.
 */

const CACHE_PREFIX = 'bm_cache_';

const cacheService = {
  // ── Core get / set ──────────────────────────────────────────────

  /** Return the cached entry for `key`, or null. */
  get(key) {
    try {
      const raw = localStorage.getItem(`${CACHE_PREFIX}${key}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  /** Overwrite the cache for `key` with the given rows array. */
  set(key, rows) {
    if (!Array.isArray(rows)) return;
    try {
      const maxCreatedAt = rows.reduce((max, row) => {
        const ca = row.created_at || row.createdAt || '';
        return ca > max ? ca : max;
      }, '');
      localStorage.setItem(
        `${CACHE_PREFIX}${key}`,
        JSON.stringify({
          rows,
          count: rows.length,
          maxCreatedAt,
          cachedAt: new Date().toISOString(),
        }),
      );
    } catch (e) {
      // localStorage full or unavailable — silently degrade
      console.warn('Cache write failed:', e);
    }
  },

  // ── Incremental helpers ─────────────────────────────────────────

  /** Append `newRows` to the cached data, deduplicating by `id`. */
  append(key, newRows) {
    if (!Array.isArray(newRows) || newRows.length === 0) return;
    const cached = this.get(key);
    if (!cached) {
      this.set(key, newRows);
      return;
    }
    const existingIds = new Set(cached.rows.map((r) => r.id));
    const unique = newRows.filter((r) => !existingIds.has(r.id));
    if (unique.length === 0) return;
    this.set(key, [...cached.rows, ...unique]);
  },

  /** Update a single row in the cache (matched by `id`). */
  updateRow(key, updatedRow) {
    const cached = this.get(key);
    if (!cached) return;
    const idx = cached.rows.findIndex((r) => r.id === updatedRow.id);
    if (idx !== -1) {
      cached.rows[idx] = { ...cached.rows[idx], ...updatedRow };
    } else {
      cached.rows.push(updatedRow);
    }
    this.set(key, cached.rows);
  },

  /** Remove a row from the cache by `id`. */
  removeRow(key, rowId) {
    const cached = this.get(key);
    if (!cached) return;
    this.set(
      key,
      cached.rows.filter((r) => r.id !== rowId),
    );
  },

  // ── Accessors ───────────────────────────────────────────────────

  /** Shorthand — return cached rows or empty array. */
  getRows(key) {
    return this.get(key)?.rows || [];
  },

  getCount(key) {
    return this.get(key)?.count || 0;
  },

  getMaxCreatedAt(key) {
    return this.get(key)?.maxCreatedAt || null;
  },

  // ── Derived data ────────────────────────────────────────────────

  /**
   * Extract distinct non-empty location strings from the cached
   * inventory table, sorted alphabetically.
   */
  getLocations() {
    const rows = this.getRows('inventory');
    const set = new Set();
    for (const row of rows) {
      const loc = (row.location || '').trim();
      if (loc) set.add(loc);
    }
    return [...set].sort();
  },

  // ── Cleanup ─────────────────────────────────────────────────────

  /** Remove a single table's cache. */
  clearTable(key) {
    localStorage.removeItem(`${CACHE_PREFIX}${key}`);
  },

  /** Wipe every bm_cache_* entry — called on logout. */
  clearAll() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  },
};

export default cacheService;
