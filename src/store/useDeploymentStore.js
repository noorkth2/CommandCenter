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

const CACHE_KEY = 'deployments';

export const useDeploymentStore = create((set, get) => ({
  deployments: [],
  loading: false,
  error: null,

  // ─── READ ──────────────────────────────────────────────────────────────────

  fetchDeployments: async () => {
    const cached = cacheGet(CACHE_KEY);
    if (cached) {
      set({ deployments: cached, loading: false, error: null });
      return;
    }

    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('deployments')
        .select('*, projects(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const items = data ?? [];
      cacheSet(CACHE_KEY, items);
      set({ deployments: items, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  // ─── CREATE ────────────────────────────────────────────────────────────────

  addDeployment: async (payload) => {
    const tid = tempId();
    set((s) => ({ deployments: optimisticAdd(s.deployments, payload, tid) }));

    try {
      const result = await safeMutate(
        { table: 'deployments', op: 'upsert', payload: { ...payload, id: tid } },
        () => supabase.from('deployments').insert(payload).select('*, projects(name)').single()
      );

      if (result.offline) {
        toast.info('Saved offline — will sync when connected');
        cacheInvalidate(`${CACHE_KEY}:*`);
        return { data: { ...payload, id: tid } };
      }

      cacheInvalidate(`${CACHE_KEY}:*`);
      set((s) => ({ deployments: s.deployments.map((d) => (d.id === tid ? result.data : d)) }));
      return { data: result.data };
    } catch (err) {
      set((s) => ({ deployments: rollbackAdd(s.deployments, tid), error: err.message }));
      toast.error(err.message);
      return { error: err.message };
    }
  },

  // ─── UPDATE ────────────────────────────────────────────────────────────────

  updateDeployment: async (id, patch) => {
    const prev = get().deployments.find((d) => d.id === id);
    set((s) => ({ deployments: optimisticUpdate(s.deployments, id, { ...patch, updated_at: new Date().toISOString() }) }));

    try {
      const result = await safeMutate(
        { table: 'deployments', op: 'upsert', payload: { id, ...patch, updated_at: new Date().toISOString() } },
        () => supabase.from('deployments').update(patch).eq('id', id).select('*, projects(name)').single()
      );

      if (result.offline) {
        toast.info('Saved offline — will sync when connected');
        cacheInvalidate(`${CACHE_KEY}:*`);
        return { data: { ...prev, ...patch } };
      }

      cacheInvalidate(`${CACHE_KEY}:*`);
      set((s) => ({ deployments: s.deployments.map((d) => (d.id === id ? result.data : d)) }));
      return { data: result.data };
    } catch (err) {
      set((s) => ({ deployments: rollbackUpdate(s.deployments, id, prev), error: err.message }));
      toast.error(err.message);
      return { error: err.message };
    }
  },

  // ─── DELETE ────────────────────────────────────────────────────────────────

  deleteDeployment: async (id) => {
    const prev = get().deployments;
    set((s) => ({ deployments: optimisticRemove(s.deployments, id) }));

    try {
      const result = await safeMutate(
        { table: 'deployments', op: 'delete', payload: { id } },
        () => supabase.from('deployments').delete().eq('id', id)
      );

      if (result.offline) {
        toast.info('Delete saved offline — will sync when connected');
        cacheInvalidate(`${CACHE_KEY}:*`);
        return { success: true };
      }

      cacheInvalidate(`${CACHE_KEY}:*`);
      return { success: true };
    } catch (err) {
      set({ deployments: rollbackRemove(null, prev), error: err.message });
      toast.error(err.message);
      return { error: err.message };
    }
  },

  // ─── HELPERS & ALIASES ─────────────────────────────────────────────────────

  getById: (id) => get().deployments.find((d) => d.id === id) ?? null,
  clearError: () => set({ error: null }),

  // Backward Compatibility Aliases
  fetch: () => get().fetchDeployments(),
  create: (payload) => get().addDeployment(payload).then((r) => { if (r.error) throw new Error(r.error); return r.data; }),
  update: (id, payload) => get().updateDeployment(id, payload).then((r) => { if (r.error) throw new Error(r.error); return r.data; }),
  delete: (id) => get().deleteDeployment(id).then(r => { if (r.error) throw new Error(r.error); return r.success; }),
}));
