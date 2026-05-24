import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Generic Supabase query hook with loading/error state management.
 * For stores with more complex logic, use the Zustand stores directly.
 *
 * @template T
 * @param {() => Promise<{data: T|null, error: any}>} queryFn
 * @param {any[]} deps - dependency array (re-fetches when these change)
 * @returns {{ data: T|null, loading: boolean, error: string|null, refetch: () => void }}
 */
export function useSupabaseQuery(queryFn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const queryFnRef = useRef(queryFn);
  queryFnRef.current = queryFn;

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await queryFnRef.current();
      if (result.error) throw new Error(result.error.message ?? result.error);
      setData(result.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, refetch: fetch };
}

/**
 * Hook for a single row by ID
 * @param {string} table
 * @param {string|null} id
 */
export function useSupabaseRow(table, id) {
  return useSupabaseQuery(
    () =>
      id
        ? supabase.from(table).select('*').eq('id', id).single()
        : Promise.resolve({ data: null, error: null }),
    [table, id]
  );
}
