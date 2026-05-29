/**
 * useIssueStore.js
 * Full rewrite with optimistic updates.
 * Apply the same add/update/remove pattern to ALL other stores.
 */

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

const CACHE_KEY = 'issues';

// Valid next statuses per current status
const STATUS_TRANSITIONS = {
  backlog:          ['todo', 'cancelled'],
  todo:             ['in_progress', 'cancelled'],
  in_progress:      ['testing', 'cancelled'],
  testing:          ['uat', 'in_progress', 'cancelled'],
  uat:              ['ready_to_deploy', 'testing', 'cancelled'],
  ready_to_deploy:  ['production', 'uat', 'cancelled'],
  production:       ['monitoring', 'rolled_back'],
  monitoring:       ['done', 'rolled_back'],
  done:             [],
  rolled_back:      ['backlog'],
  cancelled:        ['backlog'],
};

export const canTransition = (from, to) =>
  STATUS_TRANSITIONS[from]?.includes(to) ?? false;

export const useIssueStore = create((set, get) => ({
  issues: [],
  loading: false,
  error: null,

  // ─── READ ──────────────────────────────────────────────────────────────────

  fetchIssues: async (filters = {}) => {
    const cacheKey = `${CACHE_KEY}:${JSON.stringify(filters)}`;
    const cached = cacheGet(cacheKey);
    if (cached) {
      set({ issues: cached, loading: false, error: null });
      return;
    }

    set({ loading: true, error: null });

    let query = supabase
      .from('issues')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters.project_id) query = query.eq('project_id', filters.project_id);
    if (filters.sprint_id)  query = query.eq('sprint_id', filters.sprint_id);
    if (filters.status)     query = query.eq('status', filters.status);
    if (filters.assignee)   query = query.eq('assignee', filters.assignee);

    const { data, error } = await query;
    const items = data ?? [];
    cacheSet(cacheKey, items);
    set({ issues: items, error: error?.message ?? null, loading: false });
  },

  // ─── CREATE ────────────────────────────────────────────────────────────────

  addIssue: async (payload) => {
    const tid = tempId();
    set((s) => ({ issues: optimisticAdd(s.issues, { ...payload, status: payload.status ?? 'backlog' }, tid) }));

    try {
      const result = await safeMutate(
        { table: 'issues', op: 'upsert', payload: { ...payload, status: payload.status ?? 'backlog', id: tid } },
        () => supabase.from('issues').insert(payload).select().single()
      );

      if (result.offline) {
        toast.info('Saved offline — will sync when connected');
        cacheInvalidate(`${CACHE_KEY}:*`);
        return { data: { ...payload, id: tid } };
      }

      cacheInvalidate(`${CACHE_KEY}:*`);
      set((s) => ({ issues: s.issues.map((i) => (i.id === tid ? result.data : i)) }));
      return { data: result.data };
    } catch (err) {
      set((s) => ({ issues: rollbackAdd(s.issues, tid), error: err.message }));
      toast.error(err.message);
      return { error: err.message };
    }
  },

  // ─── UPDATE ────────────────────────────────────────────────────────────────

  updateIssue: async (id, patch) => {
    const prev = get().issues.find((i) => i.id === id);
    set((s) => ({ issues: optimisticUpdate(s.issues, id, { ...patch, updated_at: new Date().toISOString() }) }));

    try {
      const result = await safeMutate(
        { table: 'issues', op: 'upsert', payload: { id, ...patch, updated_at: new Date().toISOString() } },
        () => supabase.from('issues').update(patch).eq('id', id).select().single()
      );

      if (result.offline) {
        toast.info('Saved offline — will sync when connected');
        cacheInvalidate(`${CACHE_KEY}:*`);
        return { data: { ...prev, ...patch } };
      }

      cacheInvalidate(`${CACHE_KEY}:*`);
      set((s) => ({ issues: s.issues.map((i) => (i.id === id ? result.data : i)) }));

      // Non-blocking background Jira push status sync
      if (window.electron?.jira?.pushStatus && result.data?.jira_id && patch.status) {
        (async () => {
          try {
            const pushRes = await window.electron.settings.get('jira_push_status_enabled');
            if (pushRes?.data === 'true' || pushRes?.data === true) {
              await window.electron.jira.pushStatus(result.data.jira_id, patch.status);
            }
          } catch (e) {
            console.warn('[useIssueStore] Failed to push status to Jira:', e.message);
          }
        })();
      }

      return { data: result.data };
    } catch (err) {
      set((s) => ({ issues: rollbackUpdate(s.issues, id, prev), error: err.message }));
      toast.error(err.message);
      return { error: err.message };
    }
  },

  // ─── STATUS TRANSITION ─────────────────────────────────────────────────────

  transitionStatus: async (id, newStatus) => {
    const issue = get().issues.find((i) => i.id === id);
    if (!issue) return { error: 'Issue not found' };
    if (!canTransition(issue.status, newStatus)) {
      return { error: `Cannot move from "${issue.status}" to "${newStatus}"` };
    }

    const patch = {
      status: newStatus,
      ...(newStatus === 'done' && { completed_at: new Date().toISOString() }),
      ...(newStatus !== 'done' && issue.status === 'done' && { completed_at: null }),
    };

    return get().updateIssue(id, patch);
  },

  // ─── DELETE ────────────────────────────────────────────────────────────────

  deleteIssue: async (id) => {
    const prev = get().issues;
    set((s) => ({ issues: optimisticRemove(s.issues, id) }));

    try {
      const result = await safeMutate(
        { table: 'issues', op: 'delete', payload: { id } },
        () => supabase.from('issues').delete().eq('id', id)
      );

      if (result.offline) {
        toast.info('Delete saved offline — will sync when connected');
        cacheInvalidate(`${CACHE_KEY}:*`);
        return { success: true };
      }

      cacheInvalidate(`${CACHE_KEY}:*`);
      return { success: true };
    } catch (err) {
      set({ issues: rollbackRemove(null, prev), error: err.message });
      toast.error(err.message);
      return { error: err.message };
    }
  },

  // ─── HELPERS ───────────────────────────────────────────────────────────────

  clearError: () => set({ error: null }),

  getByProject: (projectId) =>
    get().issues.filter((i) => i.project_id === projectId),

  getBySprint: (sprintId) =>
    get().issues.filter((i) => i.sprint_id === sprintId),

  getByStatus: (status) =>
    get().issues.filter((i) => i.status === status),

  // ─── BACKWARD COMPATIBILITY ALIASES ───────────────────────────────────────
  fetch: (filters) => get().fetchIssues(filters),
  create: (payload) => get().addIssue(payload).then(r => { if (r.error) throw new Error(r.error); return r.data; }),
  update: (id, payload) => get().updateIssue(id, payload).then(r => { if (r.error) throw new Error(r.error); return r.data; }),
  delete: (id) => get().deleteIssue(id).then(r => { if (r.error) throw new Error(r.error); return r.success; }),
  updateStatusOptimistic: (id, newStatus) => get().transitionStatus(id, newStatus),
}));

/**
 * ─────────────────────────────────────────────────────────────────
 * APPLY THIS SAME PATTERN TO ALL OTHER STORES:
 *
 * useProjectStore    → fetchProjects, addProject, updateProject, deleteProject
 * useProductStore    → fetchProducts, addProduct, updateProduct, deleteProduct
 * useClientStore     → fetchClients, addClient, updateClient, deleteClient
 * useQAStore         → fetchQAItems, addQAItem, updateQAItem, deleteQAItem
 * useDeploymentStore → fetchDeployments, addDeployment, updateDeployment, deleteDeployment
 * useSprintStore     → fetchSprints, addSprint, updateSprint, deleteSprint
 * useAutomationStore → fetchAutomations, addAutomation, updateAutomation, deleteAutomation
 *
 * Import { tempId, optimisticAdd, optimisticUpdate, optimisticRemove,
 *          rollbackAdd, rollbackUpdate, rollbackRemove } from '../lib/storeUtils'
 * ─────────────────────────────────────────────────────────────────
 */
