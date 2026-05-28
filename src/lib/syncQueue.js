/**
 * syncQueue.js — Offline-first action queue for optimistic mutations.
 *
 * Architecture:
 *   - Mutations that fail due to network issues are enqueued here
 *   - On reconnect (online event), the queue is drained in FIFO order
 *   - Persisted to localStorage so it survives renderer refreshes
 *   - Uses exponential backoff with a max of MAX_RETRIES attempts per entry
 *   - Conflict detection: before upserting, fetches the current row to check
 *     for `updated_at` divergence; if found, emits a conflict event
 *
 * Usage:
 *   import { enqueue, drainQueue, clearQueue } from './syncQueue';
 *
 *   // Enqueue a failed mutation:
 *   enqueue({ table: 'issues', op: 'upsert', payload: { id, ...data } });
 *
 *   // Drain (called automatically on 'online' event):
 *   drainQueue(supabaseClient);
 */

const STORAGE_KEY = 'cc_sync_queue';
const MAX_RETRIES = 5;
const BACKOFF_BASE_MS = 2_000;

/** @typedef {{ id: string; table: string; op: 'upsert'|'delete'; payload: object; retries: number; nextAttempt: number }} QueueEntry */

// ─── Event system ─────────────────────────────────────────────────────────

/** @type {Set<(event: object) => void>} */
const _listeners = new Set();

/**
 * Subscribe to sync events (queue changes, conflicts, drain results).
 * Returns an unsubscribe function.
 * @param {(event: SyncEvent) => void} fn
 * @returns {() => void}
 */
export function onSyncEvent(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

/** @param {object} event */
function emitEvent(event) {
  _listeners.forEach((fn) => {
    try { fn(event); } catch (e) { console.warn('[syncQueue] listener error:', e); }
  });
}

/** @typedef {{ type: 'enqueued' | 'drained' | 'conflict' | 'dropped' | 'cleared' | 'retrying'; queueDepth: number; entry?: QueueEntry; conflict?: ConflictInfo }} SyncEvent */
/** @typedef {{ table: string; localPayload: object; serverRow: object; entryId: string }} ConflictInfo */

// ─── Persistence ───────────────────────────────────────────────────────────

/** @returns {QueueEntry[]} */
function readQueue() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

/** @param {QueueEntry[]} entries */
function writeQueue(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (err) {
    console.warn('[syncQueue] localStorage write failed:', err.message);
  }
}

/** @returns {QueueEntry[]} */
export function getPendingEntries() {
  return readQueue();
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Add a failed mutation to the queue.
 * @param {{ table: string; op: 'upsert'|'delete'; payload: object }} item
 */
export function enqueue(item) {
  const queue = readQueue();
  const entry = {
    id: crypto.randomUUID(),
    ...item,
    retries: 0,
    nextAttempt: Date.now(),
  };
  queue.push(entry);
  writeQueue(queue);
  console.info(`[syncQueue] Enqueued ${item.op} on ${item.table}. Queue depth: ${queue.length}`);
  emitEvent({ type: 'enqueued', queueDepth: queue.length, entry });
}

/**
 * Attempt to drain the queue against Supabase.
 * Call this on 'online' events or after successful auth.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @returns {Promise<{ conflicts: ConflictInfo[] }>}
 */
export async function drainQueue(client) {
  let queue = readQueue();
  if (queue.length === 0) return { conflicts: [] };

  console.info(`[syncQueue] Draining ${queue.length} pending operation(s)…`);

  const now = Date.now();
  const remaining = [];
  /** @type {ConflictInfo[]} */
  const conflicts = [];

  for (const entry of queue) {
    if (entry.nextAttempt > now) {
      remaining.push(entry);
      continue;
    }

    try {
      // ── Conflict detection for upserts ──
      if (entry.op === 'upsert' && entry.payload.id) {
        // Fetch the current server row
        const { data: serverRow, error: fetchErr } = await client
          .from(entry.table)
          .select('*')
          .eq('id', entry.payload.id)
          .maybeSingle();

        if (!fetchErr && serverRow && entry.payload.updated_at) {
          const serverUpdated = new Date(serverRow.updated_at).getTime();
          const localUpdated = new Date(entry.payload.updated_at).getTime();

          // If the server row was updated after the local snapshot, flag conflict
          if (serverUpdated > localUpdated) {
            console.warn(
              `[syncQueue] ⚠ Conflict on ${entry.table} ${entry.payload.id}:`,
              `server=${serverRow.updated_at}, local=${entry.payload.updated_at}`
            );
            conflicts.push({
              table: entry.table,
              localPayload: entry.payload,
              serverRow,
              entryId: entry.id,
            });
            // Keep in queue — wait for user resolution
            remaining.push(entry);
            continue;
          }
        }
      }

      // ── Execute mutation ──
      let result;
      if (entry.op === 'upsert') {
        result = await client.from(entry.table).upsert(entry.payload);
      } else if (entry.op === 'delete') {
        result = await client.from(entry.table).delete().eq('id', entry.payload.id);
      }

      if (result?.error) throw new Error(result.error.message);

      console.info(`[syncQueue] ✓ Replayed ${entry.op} on ${entry.table} (${entry.id})`);
    } catch (err) {
      const newRetries = entry.retries + 1;
      if (newRetries >= MAX_RETRIES) {
        console.error(
          `[syncQueue] ✗ Dropping entry ${entry.id} after ${MAX_RETRIES} failures:`,
          err.message
        );
        emitEvent({ type: 'dropped', queueDepth: remaining.length, entry });
      } else {
        const backoff = BACKOFF_BASE_MS * Math.pow(2, newRetries);
        console.warn(
          `[syncQueue] Retry ${newRetries}/${MAX_RETRIES} for ${entry.id} in ${backoff}ms`
        );
        remaining.push({ ...entry, retries: newRetries, nextAttempt: Date.now() + backoff });
        emitEvent({ type: 'retrying', queueDepth: remaining.length, entry });
      }
    }
  }

  // Emit conflict events
  for (const c of conflicts) {
    emitEvent({ type: 'conflict', queueDepth: remaining.length, conflict: c });
  }

  writeQueue(remaining);

  if (conflicts.length === 0) {
    emitEvent({ type: 'drained', queueDepth: remaining.length });
  }

  return { conflicts };
}

/**
 * Remove a specific entry from the queue (e.g. after conflict resolution).
 * @param {string} entryId
 */
export function removeEntry(entryId) {
  const queue = readQueue();
  const next = queue.filter((e) => e.id !== entryId);
  writeQueue(next);
  emitEvent({ type: 'drained', queueDepth: next.length });
}

/**
 * Update a specific entry's payload in the queue (e.g. user chose "Overwrite Server").
 * @param {string} entryId
 * @param {object} newPayload
 */
export function updateEntry(entryId, newPayload) {
  const queue = readQueue();
  const idx = queue.findIndex((e) => e.id === entryId);
  if (idx !== -1) {
    queue[idx] = { ...queue[idx], payload: { ...queue[idx].payload, ...newPayload }, retries: 0, nextAttempt: Date.now() };
    writeQueue(queue);
    emitEvent({ type: 'enqueued', queueDepth: queue.length });
  }
}

/**
 * Returns the current queue depth (for diagnostics / UI badge).
 * @returns {number}
 */
export function queueDepth() {
  return readQueue().length;
}

/**
 * Wipe the entire queue — call on logout to avoid replaying stale data.
 */
export function clearQueue() {
  writeQueue([]);
  emitEvent({ type: 'cleared', queueDepth: 0 });
}

// ─── Auto-drain on reconnect ────────────────────────────────────────────────

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.info('[syncQueue] Network restored — scheduling drain…');
    // Lazy import to avoid circular dep — caller must initialise supabase first
    import('../lib/supabase').then(({ supabase }) => drainQueue(supabase));
  });
}
