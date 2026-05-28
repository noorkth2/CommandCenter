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

const CACHE_KEY = 'qa_items';

export const useQAStore = create((set, get) => ({
  items: [],
  loading: false,
  error: null,
  selected: new Set(), // selected row IDs for bulk actions

  // ─── READ ──────────────────────────────────────────────────────────────────

  fetchQAItems: async (filters = {}) => {
    const cacheKey = `${CACHE_KEY}:${JSON.stringify(filters)}`;
    const cached = cacheGet(cacheKey);
    if (cached) {
      set({ items: cached, loading: false, error: null });
      return;
    }

    set({ loading: true, error: null });
    try {
      let query = supabase
        .from('qa_items')
        .select('*, projects(name), issues(title)')
        .order('created_at', { ascending: false });

      if (filters.project_id) query = query.eq('project_id', filters.project_id);
      if (filters.status) {
        if (Array.isArray(filters.status)) query = query.in('status', filters.status);
        else query = query.eq('status', filters.status);
      }
      if (filters.severity) {
        if (Array.isArray(filters.severity)) query = query.in('severity', filters.severity);
        else query = query.eq('severity', filters.severity);
      }
      if (filters.module) query = query.ilike('module', `%${filters.module}%`);

      const { data, error } = await query;
      if (error) throw error;
      const items = data ?? [];
      cacheSet(cacheKey, items);
      set({ items, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  // ─── CREATE ────────────────────────────────────────────────────────────────

  addQAItem: async (payload) => {
    const tid = tempId();
    set((s) => ({ items: optimisticAdd(s.items, payload, tid) }));

    try {
      const result = await safeMutate(
        { table: 'qa_items', op: 'upsert', payload: { ...payload, id: tid } },
        () => supabase.from('qa_items').insert(payload).select('*, projects(name), issues(title)').single()
      );

      if (result.offline) {
        toast.info('Saved offline — will sync when connected');
        cacheInvalidate(`${CACHE_KEY}:*`);
        return { data: { ...payload, id: tid } };
      }

      cacheInvalidate(`${CACHE_KEY}:*`);
      set((s) => ({ items: s.items.map((i) => (i.id === tid ? result.data : i)) }));
      return { data: result.data };
    } catch (err) {
      set((s) => ({ items: rollbackAdd(s.items, tid), error: err.message }));
      toast.error(err.message);
      return { error: err.message };
    }
  },

  // ─── UPDATE ────────────────────────────────────────────────────────────────

  updateQAItem: async (id, patch) => {
    const prev = get().items.find((i) => i.id === id);
    set((s) => ({ items: optimisticUpdate(s.items, id, { ...patch, updated_at: new Date().toISOString() }) }));

    try {
      const result = await safeMutate(
        { table: 'qa_items', op: 'upsert', payload: { id, ...patch, updated_at: new Date().toISOString() } },
        () => supabase.from('qa_items').update(patch).eq('id', id).select('*, projects(name), issues(title)').single()
      );

      if (result.offline) {
        toast.info('Saved offline — will sync when connected');
        cacheInvalidate(`${CACHE_KEY}:*`);
        return { data: { ...prev, ...patch } };
      }

      cacheInvalidate(`${CACHE_KEY}:*`);
      set((s) => ({ items: s.items.map((i) => (i.id === id ? result.data : i)) }));
      return { data: result.data };
    } catch (err) {
      set((s) => ({ items: rollbackUpdate(s.items, id, prev), error: err.message }));
      toast.error(err.message);
      return { error: err.message };
    }
  },

  // ─── DELETE ────────────────────────────────────────────────────────────────

  deleteQAItem: async (id) => {
    const prev = get().items;
    set((s) => ({ items: optimisticRemove(s.items, id) }));

    try {
      const result = await safeMutate(
        { table: 'qa_items', op: 'delete', payload: { id } },
        () => supabase.from('qa_items').delete().eq('id', id)
      );

      if (result.offline) {
        toast.info('Delete saved offline — will sync when connected');
        cacheInvalidate(`${CACHE_KEY}:*`);
        return { success: true };
      }

      cacheInvalidate(`${CACHE_KEY}:*`);
      return { success: true };
    } catch (err) {
      set({ items: rollbackRemove(null, prev), error: err.message });
      toast.error(err.message);
      return { error: err.message };
    }
  },

  // ─── BULK & SELECTION ACTIONS ──────────────────────────────────────────────

  bulkUpdateStatus: async (ids, status) => {
    const prevItems = get().items;
    set((s) => ({
      items: s.items.map((i) => (ids.includes(i.id) ? { ...i, status } : i)),
      selected: new Set(),
    }));

    try {
      const result = await safeMutate(
        { table: 'qa_items', op: 'upsert', payload: { ids, status } },
        () => supabase.from('qa_items').update({ status }).in('id', ids)
      );

      if (result.offline) {
        toast.info('Bulk update saved offline — will sync when connected');
        cacheInvalidate(`${CACHE_KEY}:*`);
        return;
      }

      cacheInvalidate(`${CACHE_KEY}:*`);
    } catch (err) {
      set({ items: prevItems, error: err.message });
      toast.error(err.message);
      return { error: err.message };
    }
  },

  bulkUpdateSeverity: async (ids, severity) => {
    const prevItems = get().items;
    set((s) => ({
      items: s.items.map((i) => (ids.includes(i.id) ? { ...i, severity } : i)),
      selected: new Set(),
    }));

    try {
      const result = await safeMutate(
        { table: 'qa_items', op: 'upsert', payload: { ids, severity } },
        () => supabase.from('qa_items').update({ severity }).in('id', ids)
      );

      if (result.offline) {
        toast.info('Bulk update saved offline — will sync when connected');
        cacheInvalidate(`${CACHE_KEY}:*`);
        return;
      }

      cacheInvalidate(`${CACHE_KEY}:*`);
    } catch (err) {
      set({ items: prevItems, error: err.message });
      toast.error(err.message);
      return { error: err.message };
    }
  },

  toggleSelected: (id) =>
    set((s) => {
      const next = new Set(s.selected);
      next.has(id) ? next.delete(id) : next.add(id);
      return { selected: next };
    }),

  selectAll: () =>
    set((s) => ({ selected: new Set(s.items.map((i) => i.id)) })),

  clearSelection: () => set({ selected: new Set() }),

  // ─── STATS & HELPERS ───────────────────────────────────────────────────────

  clearError: () => set({ error: null }),

  getStats: () => {
    const items = get().items;
    return {
      total: items.length,
      pass: items.filter((i) => i.status === 'pass').length,
      fail: items.filter((i) => i.status === 'fail').length,
      blocked: items.filter((i) => i.status === 'blocked').length,
      to_test: items.filter((i) => i.status === 'to_test').length,
      in_progress: items.filter((i) => i.status === 'in_progress').length,
    };
  },

  // Backward Compatibility Aliases
  fetch: (filters) => get().fetchQAItems(filters),
  create: (payload) => get().addQAItem(payload).then((r) => { if (r.error) throw new Error(r.error); return r.data; }),
  update: (id, payload) => get().updateQAItem(id, payload).then((r) => { if (r.error) throw new Error(r.error); return r.data; }),
  delete: (id) => get().deleteQAItem(id).then(r => { if (r.error) throw new Error(r.error); return r.success; }),
}));
