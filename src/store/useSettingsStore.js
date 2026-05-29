/**
 * useSettingsStore.js
 * Lightweight Zustand store for runtime app settings (WIP limits, AI prompts, etc.)
 * Settings are read from Electron IPC → main process → Supabase settings table.
 * Values are cached in-memory to avoid redundant IPC round-trips.
 */

import { create } from 'zustand';

/**
 * Hardcoded defaults — used when a setting key is absent, empty, or IPC is unavailable.
 */
export const SETTING_DEFAULTS = {
  wip_limits: { in_progress: 5, testing: 4, uat: 3 },
  allowed_emails: ['kayastha.noor1100@gmail.com', 'niroj.mahrjan@gmail.com'],
  prompt_rca: '',
  prompt_sprint_summary: '',
  prompt_deployment_note: '',
  prompt_test_summary: '',
};

export const useSettingsStore = create((set, get) => ({
  /** In-memory cache: { [key]: parsedValue } */
  cache: {},
  loading: {},

  /**
   * Fetch a single setting by key.
   * Returns the cached value immediately if already fetched.
   * Falls back to SETTING_DEFAULTS[key] if the IPC is unavailable or value is empty.
   *
   * @param {string} key
   * @returns {Promise<any>} Parsed value (object/array for JSON settings, string otherwise)
   */
  getSetting: async (key) => {
    const cached = get().cache[key];
    if (cached !== undefined) return cached;

    // Prevent concurrent fetches for the same key
    if (get().loading[key]) return SETTING_DEFAULTS[key] ?? null;
    set((s) => ({ loading: { ...s.loading, [key]: true } }));

    try {
      if (!window.electron?.settings?.get) {
        const fallback = SETTING_DEFAULTS[key] ?? null;
        set((s) => ({
          cache: { ...s.cache, [key]: fallback },
          loading: { ...s.loading, [key]: false },
        }));
        return fallback;
      }

      const res = await window.electron.settings.get(key);
      let value = res?.data ?? null;

      // Try to parse JSON values (wip_limits, allowed_emails, etc.)
      if (typeof value === 'string' && value.trim().startsWith('{') || 
          typeof value === 'string' && value.trim().startsWith('[')) {
        try { value = JSON.parse(value); } catch { /* keep as string */ }
      }

      // Fall back to default if the value is null, empty string, or empty array/object
      if (value === null || value === '' || 
          (Array.isArray(value) && value.length === 0) ||
          (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0)) {
        value = SETTING_DEFAULTS[key] ?? null;
      }

      set((s) => ({
        cache: { ...s.cache, [key]: value },
        loading: { ...s.loading, [key]: false },
      }));

      return value;
    } catch (err) {
      console.warn(`[useSettingsStore] Failed to load setting "${key}":`, err.message);
      const fallback = SETTING_DEFAULTS[key] ?? null;
      set((s) => ({
        cache: { ...s.cache, [key]: fallback },
        loading: { ...s.loading, [key]: false },
      }));
      return fallback;
    }
  },

  /**
   * Save a setting and update the local cache.
   *
   * @param {string} key
   * @param {any} value - Will be JSON-serialized if object/array
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  setSetting: async (key, value) => {
    const serialized = typeof value === 'object' ? JSON.stringify(value) : String(value);

    if (!window.electron?.settings?.set) {
      return { success: false, error: 'Electron settings API not available' };
    }

    const res = await window.electron.settings.set(key, serialized);
    if (!res?.error) {
      // Update local cache immediately
      set((s) => ({ cache: { ...s.cache, [key]: value } }));
    }
    return res ?? { success: false, error: 'Unknown error' };
  },

  /**
   * Invalidate the in-memory cache for a key (forces re-fetch on next getSetting call).
   * @param {string} key
   */
  invalidate: (key) => {
    set((s) => {
      const next = { ...s.cache };
      delete next[key];
      return { cache: next };
    });
  },

  /**
   * Convenience accessor — returns cached value synchronously (undefined if not yet loaded).
   * Use getSetting() to guarantee a value.
   */
  getCached: (key) => get().cache[key],
}));
