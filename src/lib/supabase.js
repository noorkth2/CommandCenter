import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Check if credentials are set and are not placeholder/default templates
export function checkIsConfigured() {
  const url = import.meta.env.VITE_SUPABASE_URL || '';
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  return (
    !!url &&
    !!key &&
    url !== 'https://your-project.supabase.co' &&
    key !== 'your-anon-key' &&
    url.trim() !== '' &&
    key.trim() !== ''
  );
}

const isConfigured = checkIsConfigured();

function buildClient(url, key) {
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });
}

let _client = isConfigured ? buildClient(supabaseUrl, supabaseAnonKey) : null;

/**
 * Supabase client for the renderer process.
 * Uses a Proxy so that swapping the internal client (via recreateClient)
 * is transparent to all stores that import `supabase`.
 */
export const supabase = new Proxy({}, {
  get(_, prop) {
    return _client?.[prop];
  },
  set(_, prop, value) {
    if (_client) _client[prop] = value;
    return true;
  },
});

/**
 * Replace the renderer-side Supabase client at runtime.
 * Called when the user switches workspaces.
 */
export function recreateClient(url, anonKey) {
  _client = buildClient(url, anonKey);
}

export default supabase;

