'use strict';

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Load .env — works in both development and packaged builds.
// Search order:
//   1. Next to the app executable (packaged: user can drop a .env beside the .app)
//   2. Project root relative to __dirname  (development: electron/.. )
//   3. Electron resources dir             (packaged: bundled inside .asar)
(function loadEnv() {
  const candidates = [
    path.join(path.dirname(app.getPath('exe')), '.env'),   // beside .app bundle
    path.join(__dirname, '..', '.env'),                    // dev: project root
    path.join(process.resourcesPath || '', '.env'),        // packaged: resources/
  ];

  for (const envPath of candidates) {
    try {
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
        console.log('[main] Loaded .env from:', envPath);
        break; // stop after first match
      }
    } catch (err) {
      console.error('[main] Failed to load .env from', envPath, ':', err.message);
    }
  }
})();

const isDev = !app.isPackaged;

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
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Required for preload to access Node.js APIs
      webSecurity: false, // Required for file:// protocol to load local assets
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

  // Primary show trigger — fires when first paint is ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Fallback: force show after page finishes loading in case ready-to-show is delayed
  mainWindow.webContents.once('did-finish-load', () => {
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Handle renderer load failures (e.g. file not found, network error)
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`[main] Renderer failed to load: ${errorCode} — ${errorDescription} (${validatedURL})`);
    // Force show the window even on failure so user sees something
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  });

  // Handle renderer process crash
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[main] Renderer process gone:', details.reason, details.exitCode);
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (!mainWindow.isVisible()) mainWindow.show();
      // Reload the app on crash
      mainWindow.reload();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Toggle DevTools with F12 or Cmd+Option+I (macOS) / Ctrl+Shift+I (Windows/Linux) in all builds
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown') {
      const isF12 = input.key === 'F12';
      const isCmdOptI = process.platform === 'darwin' && input.meta && input.alt && input.key.toLowerCase() === 'i';
      const isCtrlShiftI = process.platform !== 'darwin' && input.control && input.shift && input.key.toLowerCase() === 'i';
      if (isF12 || isCmdOptI || isCtrlShiftI) {
        mainWindow.webContents.toggleDevTools();
        event.preventDefault();
      }
    }
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
  if (process.platform !== 'darwin' || !app.isPackaged) {
    app.quit();
  }
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

  // ── AI Generation (OpenCode Zen via Anthropic-compatible endpoint) ──
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
  ipcMain.handle('automation:trigger', async (_event, automationId, data) => {
    const engine = new AutomationEngine();
    return engine.manualTrigger(automationId, data);
  });

  // ── Settings ─────────────────────────────────────────────────────
  const { encrypt, decrypt } = require('./ipc/encrypt');
  const SECRET_KEYS = new Set(['zen_api_key', 'smtp_pass', 'jira_api_token']);
  const MASKED = '••••••••••••';

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

      const rawValue = data?.value ?? null;
      // Return masked value for secrets — never send plaintext to renderer
      if (rawValue && SECRET_KEYS.has(key)) {
        return { data: MASKED, error: null };
      }
      return { data: rawValue, error: null };
    } catch (err) {
      return { data: null, error: err.message };
    }
  });

  ipcMain.handle('settings:set', async (_event, key, value) => {
    const { getSupabaseClient } = require('./ipc/supabase.ipc');
    try {
      // Caller is sending back a placeholder — nothing to update
      if (value === MASKED) {
        return { success: true, error: null };
      }

      let storedValue = value;
      if (SECRET_KEYS.has(key) && value) {
        storedValue = encrypt(value);
      }

      const client = getSupabaseClient();
      const { error } = await client
        .from('settings')
        .upsert({ key, value: storedValue, updated_at: new Date().toISOString() });
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
      const tables = [
        'products', 'clients', 'projects', 'issues', 'qa_items',
        'deployments', 'sprints', 'ai_reports', 'automations', 'time_entries',
      ];

      // Fetch all tables in parallel for performance
      const results = await Promise.all(
        tables.map(async (table) => {
          const { data, error } = await client.from(table).select('*');
          if (error) throw new Error(`Export failed on table "${table}": ${error.message}`);
          return { table, data };
        })
      );

      const exported = {};
      let totalRows = 0;
      for (const { table, data } of results) {
        exported[table] = data;
        totalRows += data?.length ?? 0;
      }

      // Safety warning for very large exports (>50k rows total)
      if (totalRows > 50000) {
        console.warn(`[export:all] Large export: ${totalRows} total rows. Consider archiving old data.`);
      }

      exported._exported_at = new Date().toISOString();
      exported._version = '1.0.0';
      exported._row_count = totalRows;
      return { data: exported, error: null };
    } catch (err) {
      console.error('[export:all] Error:', err.message);
      return { data: null, error: err.message };
    }
  });


  // ── Workspace Management ──────────────────────────────────────────
  const {
    listWorkspaces,
    addWorkspace,
    removeWorkspace,
    switchWorkspace,
  } = require('./ipc/workspace.ipc');

  ipcMain.handle('workspace:list', async () => {
    return listWorkspaces();
  });

  ipcMain.handle('workspace:add', async (_event, payload) => {
    return addWorkspace(payload);
  });

  ipcMain.handle('workspace:remove', async (_event, id) => {
    return removeWorkspace(id);
  });

  ipcMain.handle('workspace:switch', async (_event, id) => {
    return switchWorkspace(id);
  });

  // ── Native Desktop Notifications ──────────────────────────────────
  const { showNotification } = require('./ipc/notification.ipc');
  ipcMain.handle('notification:show', async (_event, opts) => {
    showNotification(opts);
    return { success: true };
  });

  // ── Google OAuth Login ─────────────────────────────────────────────
  const { startAuthServer } = require('./auth');
  ipcMain.handle('auth:start-login-flow', async (_event, authUrl) => {
    try {
      const authPromise = startAuthServer();
      await shell.openExternal(authUrl);
      const tokens = await authPromise;
      return { data: tokens, error: null };
    } catch (err) {
      return { data: null, error: err.message };
    }
  });

  // ── Jira Integration ──────────────────────────────────────────────
  const { syncJira, pushStatus } = require('./ipc/jira.ipc');
  ipcMain.handle('jira:sync', async () => {
    return syncJira();
  });
  ipcMain.handle('jira:push-status', async (_event, jiraId, ccStatus) => {
    return pushStatus(jiraId, ccStatus);
  });

  // ── Bug Report Capture ──────────────────────────────────────────
  ipcMain.handle('bugReport:capture-context', async (event) => {
    const { screen } = require('electron');
    const win = BrowserWindow.fromWebContents(event.sender);
    
    // Capture environment info
    const context = {
      os: process.platform,
      arch: process.arch,
      version: app.getVersion(),
      screen: screen.getPrimaryDisplay().size,
      windowSize: win.getBounds(),
      timestamp: new Date().toISOString(),
      userAgent: event.sender.getUserAgent(),
    };

    // Capture screenshot as base64
    try {
      const image = await win.capturePage();
      const screenshot = image.toDataURL(); // base64 string
      return { data: { context, screenshot }, error: null };
    } catch (err) {
      console.error('[main] Bug report capture failed:', err.message);
      return { data: { context, screenshot: null }, error: err.message };
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
    } else {
      createWindow();
    }
  });
}
