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

const CACHE_KEY = 'sprints';

/**
 * @typedef {import('../lib/constants').Sprint} Sprint
 */

export const useSprintStore = create((set, get) => ({
  /** @type {Sprint[]} */
  sprints: [],
  loading: false,
  error: null,

  // ─── READ ──────────────────────────────────────────────────────────────────

  fetchSprints: async () => {
    const cached = cacheGet(CACHE_KEY);
    if (cached) {
      set({ sprints: cached, loading: false, error: null });
      return;
    }

    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('sprints')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const items = data ?? [];
      cacheSet(CACHE_KEY, items);
      set({ sprints: items, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  // ─── CREATE ────────────────────────────────────────────────────────────────

  addSprint: async (payload) => {
    const tid = tempId();
    set((s) => ({ sprints: optimisticAdd(s.sprints, payload, tid) }));

    try {
      const result = await safeMutate(
        { table: 'sprints', op: 'upsert', payload: { ...payload, id: tid } },
        () => supabase.from('sprints').insert(payload).select().single()
      );

      if (result.offline) {
        toast.info('Saved offline — will sync when connected');
        cacheInvalidate(`${CACHE_KEY}:*`);
        return { data: { ...payload, id: tid } };
      }

      cacheInvalidate(`${CACHE_KEY}:*`);
      set((s) => ({ sprints: s.sprints.map((sp) => (sp.id === tid ? result.data : sp)) }));
      return { data: result.data };
    } catch (err) {
      set((s) => ({ sprints: rollbackAdd(s.sprints, tid), error: err.message }));
      toast.error(err.message);
      return { error: err.message };
    }
  },

  // ─── UPDATE ────────────────────────────────────────────────────────────────

  updateSprint: async (id, patch) => {
    const prev = get().sprints.find((sp) => sp.id === id);
    set((s) => ({ sprints: optimisticUpdate(s.sprints, id, { ...patch, updated_at: new Date().toISOString() }) }));

    try {
      const result = await safeMutate(
        { table: 'sprints', op: 'upsert', payload: { id, ...patch, updated_at: new Date().toISOString() } },
        () => supabase.from('sprints').update(patch).eq('id', id).select().single()
      );

      if (result.offline) {
        toast.info('Saved offline — will sync when connected');
        cacheInvalidate(`${CACHE_KEY}:*`);
        return { data: { ...prev, ...patch } };
      }

      cacheInvalidate(`${CACHE_KEY}:*`);
      set((s) => ({ sprints: s.sprints.map((sp) => (sp.id === id ? result.data : sp)) }));
      return { data: result.data };
    } catch (err) {
      set((s) => ({ sprints: rollbackUpdate(s.sprints, id, prev), error: err.message }));
      toast.error(err.message);
      return { error: err.message };
    }
  },

  // ─── DELETE ────────────────────────────────────────────────────────────────

  deleteSprint: async (id) => {
    const prev = get().sprints;
    set((s) => ({ sprints: optimisticRemove(s.sprints, id) }));

    try {
      const result = await safeMutate(
        { table: 'sprints', op: 'delete', payload: { id } },
        () => supabase.from('sprints').delete().eq('id', id)
      );

      if (result.offline) {
        toast.info('Delete saved offline — will sync when connected');
        cacheInvalidate(`${CACHE_KEY}:*`);
        return { success: true };
      }

      cacheInvalidate(`${CACHE_KEY}:*`);
      return { success: true };
    } catch (err) {
      set({ sprints: rollbackRemove(null, prev), error: err.message });
      toast.error(err.message);
      return { error: err.message };
    }
  },

  // ─── CUSTOM ACTIONS ────────────────────────────────────────────────────────

  /** Start a sprint — sets status to active and start_date to today */
  start: async (id) => {
    return get().updateSprint(id, {
      status: 'active',
      start_date: new Date().toISOString().split('T')[0],
    });
  },

  /**
   * Complete a sprint — sets status to completed and end_date to today.
   * Caller is responsible for moving unfinished issues.
   * @param {string} id
   */
  complete: async (id, sprintIssues = [], plannedPoints = 0) => {
    const completedCount = sprintIssues.filter(i => i.status === 'done').length;
    const planned = plannedPoints || sprintIssues.length;
    const velocity = planned > 0 ? Number((completedCount / planned).toFixed(2)) : completedCount;
    
    return get().updateSprint(id, {
      status: 'completed',
      end_date: new Date().toISOString().split('T')[0],
      planned_points: planned,
      completed_points: completedCount,
      velocity,
      velocity_snapshot_at: new Date().toISOString(),
    });
  },

  // ─── HELPERS & ALIASES ─────────────────────────────────────────────────────

  getById: (id) => get().sprints.find((s) => s.id === id) ?? null,
  getActive: () => get().sprints.find((s) => s.status === 'active') ?? null,
  clearError: () => set({ error: null }),

  // Backward Compatibility Aliases
  fetch: () => get().fetchSprints(),
  create: (payload) => get().addSprint(payload).then((r) => { if (r.error) throw new Error(r.error); return r.data; }),
  update: (id, payload) => get().updateSprint(id, payload).then((r) => { if (r.error) throw new Error(r.error); return r.data; }),
  delete: (id) => get().deleteSprint(id).then(r => { if (r.error) throw new Error(r.error); return r.success; }),
}));
