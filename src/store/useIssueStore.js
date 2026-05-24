import { create } from 'zustand';
import { supabase } from '../lib/supabase';

/**
 * @typedef {import('../lib/constants').Issue} Issue
 */

export const useIssueStore = create((set, get) => ({
  /** @type {Issue[]} */
  issues: [],
  loading: false,
  error: null,
  /** Active filter — null means all */
  filter: {
    project_id: null,
    sprint_id: null,
    status: null,
    priority: null,
    assignee: null,
  },

  fetch: async (extraFilters = {}) => {
    set({ loading: true, error: null });
    try {
      let query = supabase
        .from('issues')
        .select('*, projects(name)')
        .order('created_at', { ascending: false });

      // Apply persistent filter
      const f = { ...get().filter, ...extraFilters };
      if (f.project_id) query = query.eq('project_id', f.project_id);
      if (f.sprint_id) query = query.eq('sprint_id', f.sprint_id);
      if (f.status) query = query.eq('status', f.status);
      if (f.priority) query = query.eq('priority', f.priority);
      if (f.assignee) query = query.eq('assignee', f.assignee);

      const { data, error } = await query;
      if (error) throw error;
      set({ issues: data ?? [], loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  /** @param {Omit<Issue, 'id'|'created_at'|'updated_at'>} payload */
  create: async (payload) => {
    const { data, error } = await supabase
      .from('issues')
      .insert(payload)
      .select('*, projects(name)')
      .single();
    if (error) throw new Error(error.message);
    set((s) => ({ issues: [data, ...s.issues] }));
    return data;
  },

  /**
   * @param {string} id
   * @param {Partial<Issue>} payload
   */
  update: async (id, payload) => {
    // If marking as done, set completed_at
    if (payload.status === 'done') {
      payload.completed_at = new Date().toISOString();
    }
    const { data, error } = await supabase
      .from('issues')
      .update(payload)
      .eq('id', id)
      .select('*, projects(name)')
      .single();
    if (error) throw new Error(error.message);
    set((s) => ({
      issues: s.issues.map((i) => (i.id === id ? data : i)),
    }));
    return data;
  },

  /** Optimistic status update for Kanban drag-and-drop */
  updateStatusOptimistic: async (id, newStatus) => {
    const prev = get().issues.find((i) => i.id === id);
    // Optimistic update
    set((s) => ({
      issues: s.issues.map((i) =>
        i.id === id ? { ...i, status: newStatus } : i
      ),
    }));
    try {
      const updates = { status: newStatus };
      if (newStatus === 'done') updates.completed_at = new Date().toISOString();
      const { error } = await supabase
        .from('issues')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    } catch (err) {
      // Rollback on failure
      if (prev) {
        set((s) => ({
          issues: s.issues.map((i) => (i.id === id ? prev : i)),
        }));
      }
      throw err;
    }
  },

  /** @param {string} id */
  delete: async (id) => {
    const { error } = await supabase.from('issues').delete().eq('id', id);
    if (error) throw new Error(error.message);
    set((s) => ({ issues: s.issues.filter((i) => i.id !== id) }));
  },

  setFilter: (newFilter) =>
    set((s) => ({ filter: { ...s.filter, ...newFilter } })),

  clearFilters: () =>
    set({
      filter: { project_id: null, sprint_id: null, status: null, priority: null, assignee: null },
    }),

  getById: (id) => get().issues.find((i) => i.id === id) ?? null,

  /** Returns issues grouped by status for kanban board */
  getByStatus: () => {
    const issues = get().issues;
    return issues.reduce((acc, issue) => {
      if (!acc[issue.status]) acc[issue.status] = [];
      acc[issue.status].push(issue);
      return acc;
    }, {});
  },
}));
