import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export const useAuthStore = create((set, get) => ({
  session: null,
  user: null,
  loading: false,
  error: null,

  initialize: async () => {
    set({ loading: true, error: null });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      set({
        session,
        user: session?.user ?? null,
        loading: false,
      });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  setSession: (session) => {
    set({
      session,
      user: session?.user ?? null,
    });
  },

  loginWithGoogle: async () => {
    set({ loading: true, error: null });
    try {
      // 1. Ask Supabase for Google OAuth URL, skipping default web redirection
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'http://localhost:54321/callback',
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error('Failed to generate Google OAuth URL.');

      // 2. Delegate to the Electron main process to host the callback server and open default browser
      const ipcResult = await window.electron.auth.startLoginFlow(data.url);

      if (ipcResult.error) {
        throw new Error(ipcResult.error);
      }

      const { accessToken, refreshToken } = ipcResult.data;
      if (!accessToken || !refreshToken) {
        throw new Error('Authentication completed, but tokens were missing.');
      }

      // 3. Complete authentication inside the renderer process using the tokens
      const { data: sessionData, error: sessionErr } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (sessionErr) throw sessionErr;

      set({
        session: sessionData.session,
        user: sessionData.user,
        loading: false,
      });
      return sessionData.session;
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  logout: async () => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      set({ session: null, user: null, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },
}));
