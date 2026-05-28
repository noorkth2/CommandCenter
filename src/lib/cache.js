/**
 * cache.js — Lightweight in-memory TTL cache for Supabase queries.
 *
 * Design goals:
 *   - Zero dependencies (no SWR, no React Query)
 *   - Key-based invalidation for manual refresh triggers
 *   - Per-entry TTL with lazy expiry (no background timers)
 *   - Safe to use in a Zustand or hook context
 */

const DEFAULT_TTL_MS = 60_000; // 1 minute

/** @type {Map<string, { value: any; expiresAt: number }>} */
const _store = new Map();

/**
 * Read a cached value. Returns `undefined` if missing or expired.
 * @param {string} key
 * @returns {any | undefined}
 */
export function cacheGet(key) {
  const entry = _store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    _store.delete(key);
    return undefined;
  }
  return entry.value;
}

/**
 * Write a value to the cache with an optional TTL.
 * @param {string} key
 * @param {any} value
 * @param {number} [ttlMs]
 */
export function cacheSet(key, value, ttlMs = DEFAULT_TTL_MS) {
  _store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/**
 * Invalidate one or more cache entries by exact key or key prefix.
 * Pass a string to remove a single key, or pass a prefix ending with `:*`.
 *
 * @param {string} keyOrPrefix  e.g. "issues" or "issues:*"
 */
export function cacheInvalidate(keyOrPrefix) {
  if (keyOrPrefix.endsWith(':*')) {
    const prefix = keyOrPrefix.slice(0, -2);
    for (const k of _store.keys()) {
      if (k.startsWith(prefix)) _store.delete(k);
    }
  } else {
    _store.delete(keyOrPrefix);
  }
}

/**
 * Flush everything — useful on logout / auth change.
 */
export function cacheFlush() {
  _store.clear();
}

/**
 * Returns the number of currently live (non-expired) cache entries.
 * Useful for debugging.
 */
export function cacheSize() {
  const now = Date.now();
  let live = 0;
  for (const entry of _store.values()) {
    if (entry.expiresAt > now) live++;
  }
  return live;
}
