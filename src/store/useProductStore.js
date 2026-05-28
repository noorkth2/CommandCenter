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

const CACHE_KEY = 'products';

export const useProductStore = create((set, get) => ({
  products: [],
  loading: false,
  error: null,

  // ─── READ ──────────────────────────────────────────────────────────────────

  fetchProducts: async () => {
    const cached = cacheGet(CACHE_KEY);
    if (cached) {
      set({ products: cached, loading: false, error: null });
      return;
    }

    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      const items = data ?? [];
      cacheSet(CACHE_KEY, items);
      set({ products: items, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  // ─── CREATE ────────────────────────────────────────────────────────────────

  addProduct: async (payload) => {
    const tid = tempId();
    const sortFn = (a, b) => a.name?.localeCompare(b.name ?? '') ?? 0;
    const nextList = optimisticAdd(get().products, payload, tid).sort(sortFn);
    set({ products: nextList });

    try {
      const result = await safeMutate(
        { table: 'products', op: 'upsert', payload: { ...payload, id: tid } },
        () => supabase.from('products').insert(payload).select().single()
      );

      if (result.offline) {
        toast.info('Saved offline — will sync when connected');
        cacheInvalidate(`${CACHE_KEY}:*`);
        return { data: { ...payload, id: tid } };
      }

      cacheInvalidate(`${CACHE_KEY}:*`);
      set((s) => ({
        products: s.products.map((p) => (p.id === tid ? result.data : p)).sort(sortFn),
      }));
      return { data: result.data };
    } catch (err) {
      set((s) => ({ products: rollbackAdd(s.products, tid), error: err.message }));
      toast.error(err.message);
      return { error: err.message };
    }
  },

  // ─── UPDATE ────────────────────────────────────────────────────────────────

  updateProduct: async (id, patch) => {
    const prev = get().products.find((p) => p.id === id);
    const sortFn = (a, b) => a.name?.localeCompare(b.name ?? '') ?? 0;
    const nextList = optimisticUpdate(get().products, id, { ...patch, updated_at: new Date().toISOString() }).sort(sortFn);
    set({ products: nextList });

    try {
      const result = await safeMutate(
        { table: 'products', op: 'upsert', payload: { id, ...patch, updated_at: new Date().toISOString() } },
        () => supabase.from('products').update(patch).eq('id', id).select().single()
      );

      if (result.offline) {
        toast.info('Saved offline — will sync when connected');
        cacheInvalidate(`${CACHE_KEY}:*`);
        return { data: { ...prev, ...patch } };
      }

      cacheInvalidate(`${CACHE_KEY}:*`);
      set((s) => ({
        products: s.products.map((p) => (p.id === id ? result.data : p)).sort(sortFn),
      }));
      return { data: result.data };
    } catch (err) {
      set((s) => ({ products: rollbackUpdate(s.products, id, prev), error: err.message }));
      toast.error(err.message);
      return { error: err.message };
    }
  },

  // ─── DELETE ────────────────────────────────────────────────────────────────

  deleteProduct: async (id) => {
    const prev = get().products;
    set((s) => ({ products: optimisticRemove(s.products, id) }));

    try {
      const result = await safeMutate(
        { table: 'products', op: 'delete', payload: { id } },
        () => supabase.from('products').delete().eq('id', id)
      );

      if (result.offline) {
        toast.info('Delete saved offline — will sync when connected');
        cacheInvalidate(`${CACHE_KEY}:*`);
        return { success: true };
      }

      cacheInvalidate(`${CACHE_KEY}:*`);
      return { success: true };
    } catch (err) {
      set({ products: rollbackRemove(null, prev), error: err.message });
      toast.error(err.message);
      return { error: err.message };
    }
  },

  // ─── HELPERS & ALIASES ─────────────────────────────────────────────────────

  getById: (id) => get().products.find((p) => p.id === id) ?? null,
  clearError: () => set({ error: null }),

  // Backward Compatibility Aliases
  fetch: () => get().fetchProducts(),
  create: (payload) => get().addProduct(payload).then((r) => { if (r.error) throw new Error(r.error); return r.data; }),
  update: (id, payload) => get().updateProduct(id, payload).then((r) => { if (r.error) throw new Error(r.error); return r.data; }),
  delete: (id) => get().deleteProduct(id).then(r => { if (r.error) throw new Error(r.error); return r.success; }),
}));
