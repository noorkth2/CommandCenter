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

const CACHE_KEY = 'projects';

export const useProjectStore = create((set, get) => ({
  projects: [],
  loading: false,
  error: null,

  // ─── READ ──────────────────────────────────────────────────────────────────

  fetchProjects: async () => {
    const cached = cacheGet(CACHE_KEY);
    if (cached) {
      set({ projects: cached, loading: false, error: null });
      return;
    }

    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*, clients(id, name, product_id, products(id, name))')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const items = data ?? [];
      cacheSet(CACHE_KEY, items);
      set({ projects: items, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  // ─── CREATE ────────────────────────────────────────────────────────────────

  addProject: async (payload) => {
    const tid = tempId();
    set((s) => ({ projects: optimisticAdd(s.projects, payload, tid) }));

    try {
      const result = await safeMutate(
        { table: 'projects', op: 'upsert', payload: { ...payload, id: tid } },
        () => supabase.from('projects').insert(payload).select('*, clients(id, name, product_id, products(id, name))').single()
      );

      if (result.offline) {
        toast.info('Saved offline — will sync when connected');
        cacheInvalidate(`${CACHE_KEY}:*`);
        return { data: { ...payload, id: tid } };
      }

      cacheInvalidate(`${CACHE_KEY}:*`);
      set((s) => ({ projects: s.projects.map((p) => (p.id === tid ? result.data : p)) }));
      return { data: result.data };
    } catch (err) {
      set((s) => ({ projects: rollbackAdd(s.projects, tid), error: err.message }));
      toast.error(err.message);
      return { error: err.message };
    }
  },

  // ─── UPDATE ────────────────────────────────────────────────────────────────

  updateProject: async (id, patch) => {
    const prev = get().projects.find((p) => p.id === id);
    set((s) => ({ projects: optimisticUpdate(s.projects, id, { ...patch, updated_at: new Date().toISOString() }) }));

    try {
      const result = await safeMutate(
        { table: 'projects', op: 'upsert', payload: { id, ...patch, updated_at: new Date().toISOString() } },
        () => supabase.from('projects').update(patch).eq('id', id).select('*, clients(id, name, product_id, products(id, name))').single()
      );

      if (result.offline) {
        toast.info('Saved offline — will sync when connected');
        cacheInvalidate(`${CACHE_KEY}:*`);
        return { data: { ...prev, ...patch } };
      }

      cacheInvalidate(`${CACHE_KEY}:*`);
      set((s) => ({ projects: s.projects.map((p) => (p.id === id ? result.data : p)) }));
      return { data: result.data };
    } catch (err) {
      set((s) => ({ projects: rollbackUpdate(s.projects, id, prev), error: err.message }));
      toast.error(err.message);
      return { error: err.message };
    }
  },

  // ─── DELETE ────────────────────────────────────────────────────────────────

  deleteProject: async (id) => {
    const prev = get().projects;
    set((s) => ({ projects: optimisticRemove(s.projects, id) }));

    try {
      const result = await safeMutate(
        { table: 'projects', op: 'delete', payload: { id } },
        () => supabase.from('projects').delete().eq('id', id)
      );

      if (result.offline) {
        toast.info('Delete saved offline — will sync when connected');
        cacheInvalidate(`${CACHE_KEY}:*`);
        return { success: true };
      }

      cacheInvalidate(`${CACHE_KEY}:*`);
      return { success: true };
    } catch (err) {
      set({ projects: rollbackRemove(null, prev), error: err.message });
      toast.error(err.message);
      return { error: err.message };
    }
  },

  // ─── HELPERS & ALIASES ─────────────────────────────────────────────────────

  getById: (id) => get().projects.find((p) => p.id === id) ?? null,
  clearError: () => set({ error: null }),

  // Backward Compatibility Aliases
  fetch: () => get().fetchProjects(),
  create: (payload) => get().addProject(payload).then((r) => { if (r.error) throw new Error(r.error); return r.data; }),
  update: (id, payload) => get().updateProject(id, payload).then((r) => { if (r.error) throw new Error(r.error); return r.data; }),
  delete: (id) => get().deleteProject(id).then(r => { if (r.error) throw new Error(r.error); return r.success; }),
}));
