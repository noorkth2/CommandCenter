import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { cacheGet, cacheSet } from '../lib/cache';

/**
 * Generic Supabase query hook with loading/error state management and TTL caching.
 * For stores with more complex logic, use the Zustand stores directly.
 *
 * @template T
 * @param {() => Promise<{data: T|null, error: any}>} queryFn
 * @param {any[]} deps - dependency array (re-fetches when these change)
 * @param {{ cacheKey?: string; ttlMs?: number; skip?: boolean }} [options]
 * @returns {{ data: T|null, loading: boolean, error: string|null, refetch: () => void }}
 */
export function useSupabaseQuery(queryFn, deps = [], options = {}) {
  const { cacheKey, ttlMs, skip = false } = options;

  const [data, setData] = useState(() => {
    if (cacheKey) {
      const hit = cacheGet(cacheKey);
      if (hit !== undefined) return hit;
    }
    return null;
  });

  const [loading, setLoading] = useState(() => {
    if (cacheKey && cacheGet(cacheKey) !== undefined) return false;
    return !skip;
  });

  const [error, setError] = useState(null);
  const queryFnRef = useRef(queryFn);
  queryFnRef.current = queryFn;

  const fetch = useCallback(async (force = false) => {
    if (skip) return;

    // Serve from cache unless forced
    if (!force && cacheKey) {
      const hit = cacheGet(cacheKey);
      if (hit !== undefined) {
        setData(hit);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      const result = await queryFnRef.current();
      if (result.error) throw new Error(result.error.message ?? result.error);
      setData(result.data);
      if (cacheKey) cacheSet(cacheKey, result.data, ttlMs);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, ttlMs, skip]);

  useEffect(() => {
    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  /** Force a fresh fetch, bypassing cache */
  const refetch = useCallback(() => fetch(true), [fetch]);

  return { data, loading, error, refetch };
}

/**
 * Hook for a single row by ID.
 * @param {string} table
 * @param {string|null} id
 */
export function useSupabaseRow(table, id) {
  return useSupabaseQuery(
    () =>
      id
        ? supabase.from(table).select('*').eq('id', id).single()
        : Promise.resolve({ data: null, error: null }),
    [table, id],
    { cacheKey: id ? `${table}:${id}` : undefined, ttlMs: 30_000 }
  );
}
