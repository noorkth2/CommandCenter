import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { toast } from '../components/ui/Toast';
import {
  tempId,
  optimisticAdd,
  optimisticRemove,
  rollbackAdd,
  rollbackRemove,
  safeMutate,
} from '../lib/storeUtils';

export const useTimeTrackingStore = create((set, get) => ({
  entries: [],
  activeTimer: null,
  loading: false,
  error: null,

  fetchEntries: async (filters = {}) => {
    set({ loading: true, error: null });
    try {
      let query = supabase
        .from('time_entries')
        .select('*, issues(title)')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (filters.issue_id) query = query.eq('issue_id', filters.issue_id);
      if (filters.start_date) query = query.gte('date', filters.start_date);
      if (filters.end_date) query = query.lte('date', filters.end_date);

      const { data, error } = await query;
      if (error) throw error;

      const entries = data ?? [];

      // Detect active timer
      const active = entries.find((e) => e.started_at && !e.ended_at) || null;

      set({ entries, activeTimer: active, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  fetchByIssue: async (issueId) => {
    const { data, error } = await supabase
      .from('time_entries')
      .select('*, issues(title)')
      .eq('issue_id', issueId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  // ─── START TIMER ──────────────────────────────────────────────────────────
  // Timer operations are NOT offline-queued — replaying a start_timer offline
  // would produce incorrect timestamps. They fail loudly so the user knows.

  startTimer: async (issueId) => {
    set({ loading: true, error: null });
    try {
      // Stop any existing running timer first
      const active = get().activeTimer;
      if (active) {
        await get().stopTimer();
      }

      const now = new Date().toISOString();
      const today = now.slice(0, 10);

      const { data, error } = await supabase
        .from('time_entries')
        .insert({
          issue_id: issueId,
          started_at: now,
          date: today,
        })
        .select('*, issues(title)')
        .single();

      if (error) throw error;

      set({
        activeTimer: { ...data, _elapsed: 0 },
        loading: false,
      });

      return data;
    } catch (err) {
      set({ error: err.message, loading: false });
      toast.error(`Timer failed to start: ${err.message}`);
      throw err;
    }
  },

  stopTimer: async () => {
    const active = get().activeTimer;
    if (!active) return;

    const now = new Date().toISOString();
    const startedAt = new Date(active.started_at).getTime();
    const durationMinutes = Math.round((Date.now() - startedAt) / 60000);

    // Optimistically clear the active timer
    set({ activeTimer: null });

    try {
      const { data, error } = await supabase
        .from('time_entries')
        .update({
          ended_at: now,
          duration_minutes: Math.max(1, durationMinutes),
        })
        .eq('id', active.id)
        .select()
        .single();

      if (error) throw error;

      set((s) => ({
        entries: s.entries.map((e) => (e.id === active.id ? { ...e, ...data } : e)),
      }));

      return data;
    } catch (err) {
      // Rollback — restore the active timer so user can retry
      set({ activeTimer: active, error: err.message });
      toast.error(`Failed to stop timer: ${err.message}`);
      throw err;
    }
  },

  // ─── LOG MANUAL ENTRY (with optimistic update + safeMutate) ───────────────

  logManual: async ({ issue_id, duration_minutes, date, description }) => {
    const tid = tempId();
    const now = new Date().toISOString();
    const optimisticEntry = {
      issue_id,
      duration_minutes,
      date: date || now.slice(0, 10),
      description: description || null,
      started_at: now,
      ended_at: now,
    };

    set((s) => ({ entries: optimisticAdd(s.entries, optimisticEntry, tid) }));

    try {
      const result = await safeMutate(
        {
          table: 'time_entries',
          op: 'upsert',
          payload: {
            ...optimisticEntry,
            id: tid,
          },
        },
        () =>
          supabase
            .from('time_entries')
            .insert(optimisticEntry)
            .select('*, issues(title)')
            .single()
      );

      if (result.offline) {
        toast.info('Time entry saved offline — will sync when connected');
        return { data: { ...optimisticEntry, id: tid } };
      }

      set((s) => ({
        entries: s.entries.map((e) => (e.id === tid ? result.data : e)),
        loading: false,
      }));

      return result.data;
    } catch (err) {
      set((s) => ({ entries: rollbackAdd(s.entries, tid), error: err.message }));
      toast.error(err.message);
      throw err;
    }
  },

  // ─── DELETE ENTRY (with optimistic remove + safeMutate) ───────────────────

  deleteEntry: async (id) => {
    const prev = get().entries;
    set((s) => ({
      entries: optimisticRemove(s.entries, id),
      activeTimer: s.activeTimer?.id === id ? null : s.activeTimer,
    }));

    try {
      const result = await safeMutate(
        { table: 'time_entries', op: 'delete', payload: { id } },
        () => supabase.from('time_entries').delete().eq('id', id)
      );

      if (result.offline) {
        toast.info('Delete saved offline — will sync when connected');
        return;
      }
    } catch (err) {
      set({ entries: rollbackRemove(null, prev), error: err.message });
      toast.error(err.message);
    }
  },

  // ─── HELPERS ───────────────────────────────────────────────────────────────

  getTotalForDateRange: (startDate, endDate) => {
    const entries = get().entries.filter((e) => {
      if (!e.date) return false;
      return e.date >= startDate && e.date <= endDate;
    });
    const totalMinutes = entries.reduce((s, e) => s + (e.duration_minutes || 0), 0);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return { totalMinutes, hours, minutes, entries };
  },
}));
