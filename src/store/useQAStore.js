import { create } from 'zustand';
import { supabase } from '../lib/supabase';

/**
 * @typedef {import('../lib/constants').QAItem} QAItem
 */

export const useQAStore = create((set, get) => ({
  /** @type {QAItem[]} */
  items: [],
  loading: false,
  error: null,
  selected: new Set(), // selected row IDs for bulk actions

  fetch: async (filters = {}) => {
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
      set({ items: data ?? [], loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  /** @param {Omit<QAItem, 'id'|'created_at'|'updated_at'>} payload */
  create: async (payload) => {
    const { data, error } = await supabase
      .from('qa_items')
      .insert(payload)
      .select('*, projects(name), issues(title)')
      .single();
    if (error) throw new Error(error.message);
    set((s) => ({ items: [data, ...s.items] }));
    return data;
  },

  /**
   * @param {string} id
   * @param {Partial<QAItem>} payload
   */
  update: async (id, payload) => {
    const { data, error } = await supabase
      .from('qa_items')
      .update(payload)
      .eq('id', id)
      .select('*, projects(name), issues(title)')
      .single();
    if (error) throw new Error(error.message);
    set((s) => ({ items: s.items.map((i) => (i.id === id ? data : i)) }));
    return data;
  },

  /** @param {string} id */
  delete: async (id) => {
    const { error } = await supabase.from('qa_items').delete().eq('id', id);
    if (error) throw new Error(error.message);
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
  },

  /** Bulk update status for selected items */
  bulkUpdateStatus: async (ids, status) => {
    const { error } = await supabase
      .from('qa_items')
      .update({ status })
      .in('id', ids);
    if (error) throw new Error(error.message);
    set((s) => ({
      items: s.items.map((i) => (ids.includes(i.id) ? { ...i, status } : i)),
      selected: new Set(),
    }));
  },

  /** Bulk update severity for selected items */
  bulkUpdateSeverity: async (ids, severity) => {
    const { error } = await supabase
      .from('qa_items')
      .update({ severity })
      .in('id', ids);
    if (error) throw new Error(error.message);
    set((s) => ({
      items: s.items.map((i) => (ids.includes(i.id) ? { ...i, severity } : i)),
      selected: new Set(),
    }));
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

  /** Computed stats */
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
}));
