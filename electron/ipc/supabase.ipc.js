'use strict';

const { createClient } = require('@supabase/supabase-js');

/**
 * Returns a Supabase client for the main process.
 * Delegates to workspace.ipc which is workspace-aware (switches client
 * when the user changes active workspace). Falls back to VITE_ env vars.
 */
function getSupabaseClient() {
  const { getMainClient } = require('./workspace.ipc');
  return getMainClient();
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
