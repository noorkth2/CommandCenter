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


/**
 * Supabase client for the renderer process.
 * Used directly for all CRUD operations from React components.
 * Auth is disabled — this is a single-user desktop app.
 */
export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
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
    })
  : null;

export default supabase;

