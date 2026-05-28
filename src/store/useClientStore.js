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

const CACHE_KEY = 'clients';

export const useClientStore = create((set, get) => ({
  clients: [],
  loading: false,
  error: null,

  // ─── READ ──────────────────────────────────────────────────────────────────

  fetchClients: async () => {
    const cached = cacheGet(CACHE_KEY);
    if (cached) {
      set({ clients: cached, loading: false, error: null });
      return;
    }

    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*, products(id, name)')
        .order('name', { ascending: true });
      if (error) throw error;
      const items = data ?? [];
      cacheSet(CACHE_KEY, items);
      set({ clients: items, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  // ─── CREATE ────────────────────────────────────────────────────────────────

  addClient: async (payload) => {
    const tid = tempId();
    const sortFn = (a, b) => a.name?.localeCompare(b.name ?? '') ?? 0;
    const nextList = optimisticAdd(get().clients, payload, tid).sort(sortFn);
    set({ clients: nextList });

    try {
      const result = await safeMutate(
        { table: 'clients', op: 'upsert', payload: { ...payload, id: tid } },
        () => supabase.from('clients').insert(payload).select('*, products(id, name)').single()
      );

      if (result.offline) {
        toast.info('Saved offline — will sync when connected');
        cacheInvalidate(`${CACHE_KEY}:*`);
        return { data: { ...payload, id: tid } };
      }

      cacheInvalidate(`${CACHE_KEY}:*`);
      set((s) => ({
        clients: s.clients.map((c) => (c.id === tid ? result.data : c)).sort(sortFn),
      }));
      return { data: result.data };
    } catch (err) {
      set((s) => ({ clients: rollbackAdd(s.clients, tid), error: err.message }));
      toast.error(err.message);
      return { error: err.message };
    }
  },

  // ─── UPDATE ────────────────────────────────────────────────────────────────

  updateClient: async (id, patch) => {
    const prev = get().clients.find((c) => c.id === id);
    const sortFn = (a, b) => a.name?.localeCompare(b.name ?? '') ?? 0;
    const nextList = optimisticUpdate(get().clients, id, { ...patch, updated_at: new Date().toISOString() }).sort(sortFn);
    set({ clients: nextList });

    try {
      const result = await safeMutate(
        { table: 'clients', op: 'upsert', payload: { id, ...patch, updated_at: new Date().toISOString() } },
        () => supabase.from('clients').update(patch).eq('id', id).select('*, products(id, name)').single()
      );

      if (result.offline) {
        toast.info('Saved offline — will sync when connected');
        cacheInvalidate(`${CACHE_KEY}:*`);
        return { data: { ...prev, ...patch } };
      }

      cacheInvalidate(`${CACHE_KEY}:*`);
      set((s) => ({
        clients: s.clients.map((c) => (c.id === id ? result.data : c)).sort(sortFn),
      }));
      return { data: result.data };
    } catch (err) {
      set((s) => ({ clients: rollbackUpdate(s.clients, id, prev), error: err.message }));
      toast.error(err.message);
      return { error: err.message };
    }
  },

  // ─── DELETE ────────────────────────────────────────────────────────────────

  deleteClient: async (id) => {
    const prev = get().clients;
    set((s) => ({ clients: optimisticRemove(s.clients, id) }));

    try {
      const result = await safeMutate(
        { table: 'clients', op: 'delete', payload: { id } },
        () => supabase.from('clients').delete().eq('id', id)
      );

      if (result.offline) {
        toast.info('Delete saved offline — will sync when connected');
        cacheInvalidate(`${CACHE_KEY}:*`);
        return { success: true };
      }

      cacheInvalidate(`${CACHE_KEY}:*`);
      return { success: true };
    } catch (err) {
      set({ clients: rollbackRemove(null, prev), error: err.message });
      toast.error(err.message);
      return { error: err.message };
    }
  },

  // ─── HELPERS & ALIASES ─────────────────────────────────────────────────────

  getById: (id) => get().clients.find((c) => c.id === id) ?? null,
  getByProductId: (productId) => get().clients.filter((c) => c.product_id === productId),
  clearError: () => set({ error: null }),

  // Backward Compatibility Aliases
  fetch: () => get().fetchClients(),
  create: (payload) => get().addClient(payload).then((r) => { if (r.error) throw new Error(r.error); return r.data; }),
  update: (id, payload) => get().updateClient(id, payload).then((r) => { if (r.error) throw new Error(r.error); return r.data; }),
  delete: (id) => get().deleteClient(id).then(r => { if (r.error) throw new Error(r.error); return r.success; }),
}));
