/**
 * storeUtils.js
 * Shared optimistic update helpers for all Zustand stores.
 * Import these into any store — never duplicate the pattern.
 *
 * Also exposes `safeMutate` — a wrapper around Supabase mutations that:
 *   1. Catches network failures and enqueues them for later replay
 *   2. Surfaces user-facing toast errors for non-network failures
 *   3. Returns { ok: boolean } so callers can decide whether to roll back
 */

import { enqueue } from './syncQueue';

// ─── ID utilities ──────────────────────────────────────────────────────────

export const tempId = () => `__temp_${crypto.randomUUID()}`;

// ─── Optimistic state helpers ──────────────────────────────────────────────

export const optimisticAdd = (items, payload, tid) => [
  ...items,
  { ...payload, id: tid, created_at: new Date().toISOString() },
];

export const optimisticUpdate = (items, id, patch) =>
  items.map((i) => (i.id === id ? { ...i, ...patch } : i));

export const optimisticRemove = (items, id) =>
  items.filter((i) => i.id !== id);

export const rollbackAdd = (items, tid) =>
  items.filter((i) => i.id !== tid);

export const rollbackUpdate = (items, id, prev) =>
  items.map((i) => (i.id === id ? prev : i));

export const rollbackRemove = (items, prev) => prev;

// ─── Network-safe mutation wrapper ────────────────────────────────────────

const NETWORK_ERRORS = ['Failed to fetch', 'NetworkError', 'Load failed', 'net::ERR'];

function isNetworkError(err) {
  const msg = err?.message ?? '';
  return NETWORK_ERRORS.some((s) => msg.includes(s));
}

/**
 * Execute a Supabase mutation safely.
 * - Network failures → enqueue for offline replay
 * - Other failures   → re-throw (caller should roll back + toast)
 *
 * @param {{ table: string; op: 'upsert' | 'delete'; payload: object }} meta
 * @param {() => Promise<{ data?: any; error?: any }>} mutationFn
 * @returns {Promise<{ ok: boolean; offline?: boolean; data?: any }>}
 */
export async function safeMutate(meta, mutationFn) {
  try {
    const result = await mutationFn();
    if (result?.error) throw result.error;
    return { ok: true, data: result?.data ?? null };
  } catch (err) {
    if (isNetworkError(err)) {
      enqueue(meta);
      console.warn(`[storeUtils] Offline — queued ${meta.op} on ${meta.table}`);
      return { ok: true, offline: true };
    }
    throw err;
  }
}

/**
 * Check if an error indicates a row-level conflict (e.g. 409 or P0001).
 * @param {any} err
 * @returns {boolean}
 */
export function isConflictError(err) {
  const code = err?.code ?? '';
  const status = err?.status ?? err?.statusCode ?? 0;
  const msg = err?.message ?? '';
  return (
    status === 409 ||
    code === 'P0001' ||
    msg.includes('conflict') ||
    msg.includes('stale') ||
    msg.includes('version')
  );
}
