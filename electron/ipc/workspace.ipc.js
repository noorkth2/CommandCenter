'use strict';

const { safeStorage } = require('electron');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const STORAGE_KEY = 'cc_workspaces';

// ─── Encryption ──────────────────────────────────────────────────────────

function encrypt(plaintext) {
  if (!plaintext) return '';
  if (!safeStorage || !safeStorage.isEncryptionAvailable()) return plaintext;
  try {
    const buf = safeStorage.encryptString(plaintext);
    return buf.toString('base64');
  } catch {
    return plaintext;
  }
}

function decrypt(ciphertext) {
  if (!ciphertext) return '';
  if (!safeStorage || !safeStorage.isEncryptionAvailable()) return ciphertext;
  try {
    const buf = Buffer.from(ciphertext, 'base64');
    return safeStorage.decryptString(buf);
  } catch {
    return ciphertext;
  }
}

// ─── Persistence ─────────────────────────────────────────────────────────

/** @typedef {{ id: string; name: string; url: string; anonKey: string }} Workspace */

function getRaw() {
  try {
    const raw = require('electron').ipcMain ? null : null; // placeholder
    const fs = require('fs');
    const path = require('path');
    const { app } = require('electron');
    const filePath = path.join(app.getPath('userData'), 'workspaces.json');
    if (fs.existsSync(filePath)) {
      const encrypted = fs.readFileSync(filePath, 'utf-8');
      const decrypted = decrypt(encrypted);
      return JSON.parse(decrypted);
    }
  } catch {}
  return { workspaces: [], activeId: null };
}

function saveRaw(data) {
  try {
    const fs = require('fs');
    const path = require('path');
    const { app } = require('electron');
    const filePath = path.join(app.getPath('userData'), 'workspaces.json');
    const encrypted = encrypt(JSON.stringify(data));
    fs.writeFileSync(filePath, encrypted, 'utf-8');
  } catch (err) {
    console.error('[workspace.ipc] Failed to save:', err.message);
  }
}

// ─── Main process Supabase client manager ───────────────────────────────

let _mainClient = null;

function getMainClient() {
  if (_mainClient) return _mainClient;

  const data = getRaw();
  const active = data.workspaces.find((w) => w.id === data.activeId);
  const url = active?.url || process.env.VITE_SUPABASE_URL;
  const key = active?.anonKey || process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('[workspace.ipc] No Supabase credentials configured.');
  }

  _mainClient = createClient(url, key, {
    auth: { persistSession: false },
  });

  return _mainClient;
}

function resetMainClient() {
  _mainClient = null;
}

// ─── IPC Handlers ────────────────────────────────────────────────────────

function listWorkspaces() {
  const data = getRaw();
  // Never send anonKey to renderer
  return {
    workspaces: data.workspaces.map(({ id, name, url }) => ({ id, name, url })),
    activeId: data.activeId,
  };
}

function addWorkspace({ name, url, anonKey }) {
  if (!name || !url || !anonKey) {
    return { error: 'Name, URL, and anon key are required.' };
  }

  const data = getRaw();
  const id = crypto.randomUUID();
  data.workspaces.push({ id, name, url, anonKey });
  saveRaw(data);

  return {
    data: { id, name, url },
    error: null,
  };
}

function removeWorkspace(id) {
  const data = getRaw();
  data.workspaces = data.workspaces.filter((w) => w.id !== id);
  if (data.activeId === id) data.activeId = null;
  saveRaw(data);
  resetMainClient();
  return { success: true };
}

function switchWorkspace(id) {
  const data = getRaw();
  const target = data.workspaces.find((w) => w.id === id);
  if (!target) return { error: 'Workspace not found.' };

  data.activeId = id;
  saveRaw(data);
  resetMainClient();

  return {
    data: { id: target.id, name: target.name, url: target.url, anonKey: target.anonKey },
    error: null,
  };
}

function getActiveCredentials() {
  const data = getRaw();
  const active = data.workspaces.find((w) => w.id === data.activeId);
  if (!active) return null;
  return { url: active.url, anonKey: active.anonKey };
}

module.exports = {
  getMainClient,
  resetMainClient,
  listWorkspaces,
  addWorkspace,
  removeWorkspace,
  switchWorkspace,
  getActiveCredentials,
};
