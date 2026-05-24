import { create } from 'zustand';
import { supabase } from '../lib/supabase';

/**
 * @typedef {import('../lib/constants').Project} Project
 */

export const useProjectStore = create((set, get) => ({
  /** @type {Project[]} */
  projects: [],
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      set({ projects: data ?? [], loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  /**
   * @param {Omit<Project, 'id'|'created_at'|'updated_at'>} payload
   */
  create: async (payload) => {
    const { data, error } = await supabase
      .from('projects')
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    set((s) => ({ projects: [data, ...s.projects] }));
    return data;
  },

  /**
   * @param {string} id
   * @param {Partial<Project>} payload
   */
  update: async (id, payload) => {
    const { data, error } = await supabase
      .from('projects')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? data : p)),
    }));
    return data;
  },

  /** @param {string} id */
  delete: async (id) => {
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) throw new Error(error.message);
    set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }));
  },

  /** Returns a project by id from local state */
  getById: (id) => get().projects.find((p) => p.id === id) ?? null,
}));
