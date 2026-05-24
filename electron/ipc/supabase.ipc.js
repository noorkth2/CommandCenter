'use strict';

const { createClient } = require('@supabase/supabase-js');

let _client = null;

/**
 * Returns a singleton Supabase client for the main process.
 * Uses VITE_ env vars (available because we load .env in main.js).
 */
function getSupabaseClient() {
  if (_client) return _client;

  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      '[supabase.ipc] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set. ' +
        'Copy .env.example to .env and fill in your Supabase credentials.'
    );
  }

  _client = createClient(url, key, {
    auth: { persistSession: false },
  });

  return _client;
}

/**
 * Handles Supabase IPC calls from the renderer process.
 * This is a generic proxy used for operations initiated from the main process
 * (e.g., automation engine, cron jobs).
 *
 * @param {string} method - dot-path method name e.g. 'from.projects.select'
 * @param {object} args   - arguments passed to the method
 */
async function handleSupabaseIpc(method, args) {
  try {
    const client = getSupabaseClient();
    // Parse method: 'from.tableName.operation'
    const parts = method.split('.');
    if (parts[0] !== 'from' || parts.length < 3) {
      throw new Error(`[supabase.ipc] Invalid method format: ${method}`);
    }
    const [, tableName, operation, ...rest] = parts;
    let query = client.from(tableName);

    switch (operation) {
      case 'select':
        query = query.select(args?.columns || '*');
        if (args?.filters) {
          for (const [col, val] of Object.entries(args.filters)) {
            query = query.eq(col, val);
          }
        }
        if (args?.order) query = query.order(args.order.column, { ascending: args.order.ascending ?? false });
        if (args?.limit) query = query.limit(args.limit);
        break;
      case 'insert':
        query = query.insert(args?.data).select();
        break;
      case 'update':
        query = query.update(args?.data);
        if (args?.filters) {
          for (const [col, val] of Object.entries(args.filters)) {
            query = query.eq(col, val);
          }
        }
        query = query.select();
        break;
      case 'delete':
        query = query.delete();
        if (args?.filters) {
          for (const [col, val] of Object.entries(args.filters)) {
            query = query.eq(col, val);
          }
        }
        break;
      case 'upsert':
        query = query.upsert(args?.data).select();
        break;
      default:
        throw new Error(`[supabase.ipc] Unknown operation: ${operation}`);
    }

    const { data, error } = await query;
    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err) {
    console.error('[supabase.ipc] Error:', err.message);
    return { data: null, error: err.message };
  }
}

module.exports = { getSupabaseClient, handleSupabaseIpc };
