'use strict';

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Load .env file for development
if (process.env.NODE_ENV !== 'production') {
  try {
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      envContent.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key && valueParts.length > 0) {
            process.env[key.trim()] = valueParts.join('=').trim();
          }
        }
      });
    }
  } catch (err) {
    console.error('[main] Failed to load .env:', err.message);
  }
}

const isDev = process.env.NODE_ENV !== 'production';

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0e0e10',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: process.platform !== 'darwin',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Required for preload to access Node.js APIs
      webSecurity: true,
    },
    show: false, // Show after ready-to-show to prevent blank flash
  });

  // Load app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// =====================
// APP LIFECYCLE
// =====================
app.whenReady().then(async () => {
  createWindow();

  // Register all IPC handlers
  registerIpcHandlers();

  // Start cron jobs
  try {
    const { startCronJobs } = require('./cron');
    startCronJobs();
  } catch (err) {
    console.error('[main] Cron startup error:', err.message);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// =====================
// IPC HANDLER REGISTRATION
// =====================
function registerIpcHandlers() {
  // ── Supabase proxy ──────────────────────────────────────────────
  const { handleSupabaseIpc } = require('./ipc/supabase.ipc');
  ipcMain.handle('supabase:query', async (_event, method, args) => {
    return handleSupabaseIpc(method, args);
  });

  // ── Claude AI ───────────────────────────────────────────────────
  const { handleAiGenerate } = require('./ipc/ai.ipc');
  ipcMain.handle('ai:generate', async (_event, prompt, type) => {
    return handleAiGenerate(prompt, type);
  });

  // ── Email ────────────────────────────────────────────────────────
  const { sendEmail } = require('./mailer');
  ipcMain.handle('email:send', async (_event, options) => {
    return sendEmail(options);
  });

  // ── Automation manual trigger ────────────────────────────────────
  const { AutomationEngine } = require('./automations');
  ipcMain.handle('automation:trigger', async (_event, automationId) => {
    const engine = new AutomationEngine();
    return engine.manualTrigger(automationId);
  });

  // ── Settings ─────────────────────────────────────────────────────
  ipcMain.handle('settings:get', async (_event, key) => {
    const { getSupabaseClient } = require('./ipc/supabase.ipc');
    try {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('settings')
        .select('value')
        .eq('key', key)
        .single();
      if (error) throw error;
      return { data: data?.value ?? null, error: null };
    } catch (err) {
      return { data: null, error: err.message };
    }
  });

  ipcMain.handle('settings:set', async (_event, key, value) => {
    const { getSupabaseClient } = require('./ipc/supabase.ipc');
    try {
      const client = getSupabaseClient();
      const { error } = await client
        .from('settings')
        .upsert({ key, value, updated_at: new Date().toISOString() });
      if (error) throw error;
      return { success: true, error: null };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ── Export all data ───────────────────────────────────────────────
  ipcMain.handle('export:all', async (_event) => {
    const { getSupabaseClient } = require('./ipc/supabase.ipc');
    try {
      const client = getSupabaseClient();
      const tables = ['products', 'clients', 'projects', 'issues', 'qa_items', 'deployments', 'sprints', 'ai_reports', 'automations'];
      const exported = {};
      for (const table of tables) {
        const { data, error } = await client.from(table).select('*');
        if (error) throw error;
        exported[table] = data;
      }
      exported._exported_at = new Date().toISOString();
      exported._version = '1.0.0';
      return { data: exported, error: null };
    } catch (err) {
      return { data: null, error: err.message };
    }
  });
}

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}
