'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/**
 * CommandCenter Preload Script
 * Exposes a secure, minimal API surface to the renderer process.
 * NO direct Node.js or Electron APIs are exposed — everything is
 * channelled through typed IPC invoke calls.
 */
contextBridge.exposeInMainWorld('electron', {
  /**
   * Supabase proxy — routes Supabase calls through the main process
   * for operations that need elevated access (e.g., settings read).
   * Most reads/writes happen directly from the renderer via @supabase/supabase-js.
   */
  supabase: (method, args) => ipcRenderer.invoke('supabase:query', method, args),

  /**
   * AI report generation — all API calls go through main process.
   * Uses OpenCode Zen (Anthropic-compatible endpoint).
   * The API key is retrieved from the settings table, never logged.
   * @param {string} prompt - The prompt text
   * @param {string} type - Report type: 'rca' | 'sprint_summary' | 'deployment_note' | 'test_summary'
   */
  ai: {
    generate: (prompt, type) => ipcRenderer.invoke('ai:generate', prompt, type),
  },

  /**
   * Email — sends via Nodemailer from main process.
   * SMTP credentials are read from settings table inside main process.
   */
  email: {
    send: (options) => ipcRenderer.invoke('email:send', options),
  },

  /**
   * Automation — manually trigger an automation by ID (for testing in UI)
   */
  automation: {
    trigger: (id, data) => ipcRenderer.invoke('automation:trigger', id, data),
  },

  /**
   * Settings — thin wrapper over Supabase settings table.
   * Credentials are read/written here but never surfaced in renderer console.
   */
  settings: {
    get: (key) => ipcRenderer.invoke('settings:get', key),
    set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
  },

  /**
   * Export — exports all tables as a single JSON payload.
   * The renderer handles triggering the file save dialog.
   */
  export: {
    all: () => ipcRenderer.invoke('export:all'),
  },

  /**
   * Google OAuth login helper
   */
  auth: {
    startLoginFlow: (authUrl) => ipcRenderer.invoke('auth:start-login-flow', authUrl),
  },

  /**
   * Platform info — for UI adjustments
   */
  platform: process.platform,

  /**
   * Native desktop notifications.
   */
  notification: {
    show: (opts) => ipcRenderer.invoke('notification:show', opts),
  },

  /**
   * Workspace management — list, add, switch, remove workspaces.
   */
  workspace: {
    list: () => ipcRenderer.invoke('workspace:list'),
    add: (payload) => ipcRenderer.invoke('workspace:add', payload),
    remove: (id) => ipcRenderer.invoke('workspace:remove', id),
    switch: (id) => ipcRenderer.invoke('workspace:switch', id),
  },

  /**
   * Jira integration
   */
  jira: {
    sync: () => ipcRenderer.invoke('jira:sync'),
    pushStatus: (jiraId, status) => ipcRenderer.invoke('jira:push-status', jiraId, status),
  },
});
