import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export const useClientStore = create((set, get) => ({
  clients: [],
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*, products(id, name)')
        .order('name', { ascending: true });
      if (error) throw error;
      set({ clients: data ?? [], loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  create: async (payload) => {
    const { data, error } = await supabase
      .from('clients')
      .insert(payload)
      .select('*, products(id, name)')
      .single();
    if (error) throw new Error(error.message);
    set((s) => ({ clients: [...s.clients, data].sort((a, b) => a.name.localeCompare(b.name)) }));
    return data;
  },

  update: async (id, payload) => {
    const { data, error } = await supabase
      .from('clients')
      .update(payload)
      .eq('id', id)
      .select('*, products(id, name)')
      .single();
    if (error) throw new Error(error.message);
    set((s) => ({
      clients: s.clients.map((c) => (c.id === id ? data : c)).sort((a, b) => a.name.localeCompare(b.name)),
    }));
    return data;
  },

  delete: async (id) => {
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) throw new Error(error.message);
    set((s) => ({ clients: s.clients.filter((c) => c.id !== id) }));
  },

  getById: (id) => get().clients.find((c) => c.id === id) ?? null,
  getByProductId: (productId) => get().clients.filter((c) => c.product_id === productId),
}));
