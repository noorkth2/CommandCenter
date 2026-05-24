import { create } from 'zustand';
import { supabase } from '../lib/supabase';

/**
 * @typedef {import('../lib/constants').Automation} Automation
 */

export const useAutomationStore = create((set, get) => ({
  /** @type {Automation[]} */
  automations: [],
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('automations')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      set({ automations: data ?? [], loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  /** @param {Omit<Automation, 'id'|'created_at'>} payload */
  create: async (payload) => {
    const { data, error } = await supabase
      .from('automations')
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    set((s) => ({ automations: [...s.automations, data] }));
    return data;
  },

  /**
   * @param {string} id
   * @param {Partial<Automation>} payload
   */
  update: async (id, payload) => {
    const { data, error } = await supabase
      .from('automations')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    set((s) => ({
      automations: s.automations.map((a) => (a.id === id ? data : a)),
    }));
    return data;
  },

  /** Toggle enabled/disabled */
  toggle: async (id) => {
    const current = get().automations.find((a) => a.id === id);
    if (!current) return;
    return get().update(id, { enabled: !current.enabled });
  },

  /** @param {string} id */
  delete: async (id) => {
    const { error } = await supabase.from('automations').delete().eq('id', id);
    if (error) throw new Error(error.message);
    set((s) => ({ automations: s.automations.filter((a) => a.id !== id) }));
  },

  /**
   * Manually trigger an automation via Electron IPC
   * @param {string} id
   */
  manualTrigger: async (id) => {
    if (!window.electron?.automation?.trigger) {
      throw new Error('Electron IPC not available');
    }
    const result = await window.electron.automation.trigger(id);
    if (!result.success) throw new Error(result.error);
    // Refresh to get updated last_triggered_at
    await get().fetch();
    return result;
  },
}));
