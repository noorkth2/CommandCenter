import { create } from 'zustand';
import { recreateClient, checkIsConfigured } from '../lib/supabase';
import { cacheFlush } from '../lib/cache';
import { clearQueue } from '../lib/syncQueue';
import { useAuthStore } from './useAuthStore';

const isConfigured = checkIsConfigured();

export const useWorkspaceStore = create((set, get) => ({
  workspaces: [],
  activeId: null,
  activeWorkspace: null,
  loading: false,
  error: null,

  loadWorkspaces: async () => {
    if (!window.electron?.workspace?.list) {
      if (!isConfigured) {
        set({ workspaces: [], activeId: null, activeWorkspace: null });
      }
      return;
    }

    set({ loading: true, error: null });
    try {
      const res = await window.electron.workspace.list();
      set({
        workspaces: res.workspaces,
        activeId: res.activeId,
        activeWorkspace: res.workspaces.find((w) => w.id === res.activeId) || null,
        loading: false,
      });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  addWorkspace: async ({ name, url, anonKey }) => {
    if (!window.electron?.workspace?.add) return { error: 'IPC not available' };

    set({ loading: true, error: null });
    try {
      const res = await window.electron.workspace.add({ name, url, anonKey });
      if (res.error) throw new Error(res.error);
      await get().loadWorkspaces();
      return { data: res.data, error: null };
    } catch (err) {
      set({ error: err.message, loading: false });
      return { error: err.message };
    }
  },

  removeWorkspace: async (id) => {
    if (!window.electron?.workspace?.remove) return;

    set({ loading: true, error: null });
    try {
      await window.electron.workspace.remove(id);
      await get().loadWorkspaces();
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  switchWorkspace: async (id) => {
    if (!window.electron?.workspace?.switch) return;

    set({ loading: true, error: null });
    try {
      const res = await window.electron.workspace.switch(id);
      if (res.error) throw new Error(res.error);

      const { url, anonKey } = res.data;

      // Swap the renderer-side Supabase client
      recreateClient(url, anonKey);

      // Purge local cache and offline queue — data may differ across workspaces
      cacheFlush();
      clearQueue();

      // Reload workspace list to reflect active state
      await get().loadWorkspaces();

      // Reinitialize auth with the new workspace's Supabase client
      await useAuthStore.getState().initialize();
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },
}));
