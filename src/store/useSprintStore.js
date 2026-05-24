import { create } from 'zustand';
import { supabase } from '../lib/supabase';

/**
 * @typedef {import('../lib/constants').Sprint} Sprint
 */

export const useSprintStore = create((set, get) => ({
  /** @type {Sprint[]} */
  sprints: [],
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('sprints')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      set({ sprints: data ?? [], loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  /** @param {Omit<Sprint, 'id'|'created_at'|'updated_at'>} payload */
  create: async (payload) => {
    const { data, error } = await supabase
      .from('sprints')
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    set((s) => ({ sprints: [data, ...s.sprints] }));
    return data;
  },

  /**
   * @param {string} id
   * @param {Partial<Sprint>} payload
   */
  update: async (id, payload) => {
    const { data, error } = await supabase
      .from('sprints')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    set((s) => ({
      sprints: s.sprints.map((sp) => (sp.id === id ? data : sp)),
    }));
    return data;
  },

  /** @param {string} id */
  delete: async (id) => {
    const { error } = await supabase.from('sprints').delete().eq('id', id);
    if (error) throw new Error(error.message);
    set((s) => ({ sprints: s.sprints.filter((sp) => sp.id !== id) }));
  },

  /** Start a sprint — sets status to active and start_date to today */
  start: async (id) => {
    return get().update(id, {
      status: 'active',
      start_date: new Date().toISOString().split('T')[0],
    });
  },

  /**
   * Complete a sprint — sets status to completed and end_date to today.
   * Caller is responsible for moving unfinished issues.
   * @param {string} id
   */
  complete: async (id) => {
    return get().update(id, {
      status: 'completed',
      end_date: new Date().toISOString().split('T')[0],
    });
  },

  getById: (id) => get().sprints.find((s) => s.id === id) ?? null,

  getActive: () => get().sprints.find((s) => s.status === 'active') ?? null,
}));
