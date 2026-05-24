import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export const useProductStore = create((set, get) => ({
  products: [],
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      set({ products: data ?? [], loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  create: async (payload) => {
    const { data, error } = await supabase
      .from('products')
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    set((s) => ({ products: [...s.products, data].sort((a, b) => a.name.localeCompare(b.name)) }));
    return data;
  },

  update: async (id, payload) => {
    const { data, error } = await supabase
      .from('products')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    set((s) => ({
      products: s.products.map((p) => (p.id === id ? data : p)).sort((a, b) => a.name.localeCompare(b.name)),
    }));
    return data;
  },

  delete: async (id) => {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw new Error(error.message);
    set((s) => ({ products: s.products.filter((p) => p.id !== id) }));
  },

  getById: (id) => get().products.find((p) => p.id === id) ?? null,
}));
