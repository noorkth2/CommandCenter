import { create } from 'zustand';
import { supabase } from '../lib/supabase';

/**
 * @typedef {import('../lib/constants').Deployment} Deployment
 */

export const useDeploymentStore = create((set, get) => ({
  /** @type {Deployment[]} */
  deployments: [],
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('deployments')
        .select('*, projects(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      set({ deployments: data ?? [], loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  /** @param {Omit<Deployment, 'id'|'created_at'|'updated_at'>} payload */
  create: async (payload) => {
    const { data, error } = await supabase
      .from('deployments')
      .insert(payload)
      .select('*, projects(name)')
      .single();
    if (error) throw new Error(error.message);
    set((s) => ({ deployments: [data, ...s.deployments] }));
    return data;
  },

  /**
   * @param {string} id
   * @param {Partial<Deployment>} payload
   */
  update: async (id, payload) => {
    const { data, error } = await supabase
      .from('deployments')
      .update(payload)
      .eq('id', id)
      .select('*, projects(name)')
      .single();
    if (error) throw new Error(error.message);
    set((s) => ({
      deployments: s.deployments.map((d) => (d.id === id ? data : d)),
    }));
    return data;
  },

  /** @param {string} id */
  delete: async (id) => {
    const { error } = await supabase.from('deployments').delete().eq('id', id);
    if (error) throw new Error(error.message);
    set((s) => ({ deployments: s.deployments.filter((d) => d.id !== id) }));
  },

  getById: (id) => get().deployments.find((d) => d.id === id) ?? null,
}));
