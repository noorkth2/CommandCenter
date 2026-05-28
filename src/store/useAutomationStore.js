import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { toast } from '../components/ui/Toast';
import {
  tempId,
  optimisticAdd,
  optimisticUpdate,
  optimisticRemove,
  rollbackAdd,
  rollbackUpdate,
  rollbackRemove,
  safeMutate,
} from '../lib/storeUtils';
import { cacheGet, cacheSet, cacheInvalidate } from '../lib/cache';

const CACHE_KEY = 'automations';

/**
 * @typedef {import('../lib/constants').Automation} Automation
 */

export const useAutomationStore = create((set, get) => ({
  /** @type {Automation[]} */
  automations: [],
  loading: false,
  error: null,

  // ─── READ ──────────────────────────────────────────────────────────────────

  fetchAutomations: async () => {
    const cached = cacheGet(CACHE_KEY);
    if (cached) {
      set({ automations: cached, loading: false, error: null });
      return;
    }

    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('automations')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      const items = data ?? [];
      cacheSet(CACHE_KEY, items);
      set({ automations: items, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  // ─── CREATE ────────────────────────────────────────────────────────────────

  addAutomation: async (payload) => {
    const tid = tempId();
    set((s) => ({ automations: optimisticAdd(s.automations, payload, tid) }));

    try {
      const result = await safeMutate(
        { table: 'automations', op: 'upsert', payload: { ...payload, id: tid } },
        () => supabase.from('automations').insert(payload).select().single()
      );

      if (result.offline) {
        toast.info('Saved offline — will sync when connected');
        cacheInvalidate(`${CACHE_KEY}:*`);
        return { data: { ...payload, id: tid } };
      }

      cacheInvalidate(`${CACHE_KEY}:*`);
      set((s) => ({ automations: s.automations.map((a) => (a.id === tid ? result.data : a)) }));
      return { data: result.data };
    } catch (err) {
      set((s) => ({ automations: rollbackAdd(s.automations, tid), error: err.message }));
      toast.error(err.message);
      return { error: err.message };
    }
  },

  // ─── UPDATE ────────────────────────────────────────────────────────────────

  updateAutomation: async (id, patch) => {
    const prev = get().automations.find((a) => a.id === id);
    set((s) => ({ automations: optimisticUpdate(s.automations, id, { ...patch, updated_at: new Date().toISOString() }) }));

    try {
      const result = await safeMutate(
        { table: 'automations', op: 'upsert', payload: { id, ...patch, updated_at: new Date().toISOString() } },
        () => supabase.from('automations').update(patch).eq('id', id).select().single()
      );

      if (result.offline) {
        toast.info('Saved offline — will sync when connected');
        cacheInvalidate(`${CACHE_KEY}:*`);
        return { data: { ...prev, ...patch } };
      }

      cacheInvalidate(`${CACHE_KEY}:*`);
      set((s) => ({ automations: s.automations.map((a) => (a.id === id ? result.data : a)) }));
      return { data: result.data };
    } catch (err) {
      set((s) => ({ automations: rollbackUpdate(s.automations, id, prev), error: err.message }));
      toast.error(err.message);
      return { error: err.message };
    }
  },

  // ─── DELETE ────────────────────────────────────────────────────────────────

  deleteAutomation: async (id) => {
    const prev = get().automations;
    set((s) => ({ automations: optimisticRemove(s.automations, id) }));

    try {
      const result = await safeMutate(
        { table: 'automations', op: 'delete', payload: { id } },
        () => supabase.from('automations').delete().eq('id', id)
      );

      if (result.offline) {
        toast.info('Delete saved offline — will sync when connected');
        cacheInvalidate(`${CACHE_KEY}:*`);
        return { success: true };
      }

      cacheInvalidate(`${CACHE_KEY}:*`);
      return { success: true };
    } catch (err) {
      set({ automations: rollbackRemove(null, prev), error: err.message });
      toast.error(err.message);
      return { error: err.message };
    }
  },

  // ─── CUSTOM ACTIONS ────────────────────────────────────────────────────────

  /** Toggle enabled/disabled with optimistic update */
  toggle: async (id) => {
    const current = get().automations.find((a) => a.id === id);
    if (!current) return;
    return get().updateAutomation(id, { enabled: !current.enabled });
  },

  /**
   * Manually trigger an automation via Electron IPC.
   * Refreshes after to get updated trigger_count and last_triggered_at.
   * @param {string} id
   */
  manualTrigger: async (id) => {
    if (!window.electron?.automation?.trigger) {
      throw new Error('Electron IPC not available');
    }
    const result = await window.electron.automation.trigger(id);
    if (!result.success) throw new Error(result.error);
    await get().fetchAutomations();
    return result;
  },

  // ─── HELPERS & ALIASES ─────────────────────────────────────────────────────

  clearError: () => set({ error: null }),

  // Backward Compatibility Aliases
  fetch: () => get().fetchAutomations(),
  create: (payload) => get().addAutomation(payload).then((r) => { if (r.error) throw new Error(r.error); return r.data; }),
  update: (id, payload) => get().updateAutomation(id, payload).then((r) => { if (r.error) throw new Error(r.error); return r.data; }),
  delete: (id) => get().deleteAutomation(id).then(r => { if (r.error) throw new Error(r.error); return r.success; }),
}));
