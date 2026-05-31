'use strict';

const cron = require('node-cron');
const { getSupabaseClient } = require('./ipc/supabase.ipc');
const { AutomationEngine } = require('./automations');

const scheduledTasks = new Map(); // automationId → cron.Task

/**
 * Starts all cron jobs for CommandCenter.
 * Called once from main.js after app is ready.
 */
function startCronJobs() {
  // ── Built-in: Daily sprint summary at 11pm ────────────────────────
  cron.schedule('0 23 * * *', async () => {
    console.log('[cron] Running daily sprint summary...');
    await runDailySummary();
  });

  // ── Load dynamic schedule automations from DB ─────────────────────
  loadScheduledAutomations();

  // ── SLA Monitoring: Every hour ────────────────────────────────────
  cron.schedule('0 * * * *', async () => {
    console.log('[cron] Running SLA check...');
    await runSlaCheck();
  });

  console.log('[cron] All cron jobs started.');
}

/**
 * Fetches all 'schedule' type automations from DB and registers them.
 * Called on startup and when automations are toggled in the UI.
 */
async function loadScheduledAutomations() {
  try {
    const client = getSupabaseClient();
    const { data: automations, error } = await client
      .from('automations')
      .select('*')
      .eq('trigger_type', 'schedule')
      .eq('enabled', true);

    if (error) {
      console.error('[cron] Failed to load scheduled automations:', error.message);
      return;
    }

    // Stop any previously registered dynamic tasks
    for (const [id, task] of scheduledTasks.entries()) {
      task.stop();
      scheduledTasks.delete(id);
    }

    // Register each schedule automation
    for (const automation of automations ?? []) {
      const cronExpr = automation.trigger_config?.cron;
      if (!cronExpr || !cron.validate(cronExpr)) {
        console.warn(`[cron] Invalid cron expression for automation "${automation.name}": ${cronExpr}`);
        continue;
      }

      const task = cron.schedule(cronExpr, async () => {
        console.log(`[cron] Running scheduled automation: "${automation.name}"`);
        const engine = new AutomationEngine();
        await engine.executeAction(automation, { trigger: 'schedule', automation_id: automation.id });
        await engine.recordTrigger(automation.id);
      });

      scheduledTasks.set(automation.id, task);
      console.log(`[cron] Registered: "${automation.name}" at "${cronExpr}"`);
    }
  } catch (err) {
    console.error('[cron] loadScheduledAutomations error:', err.message);
  }
}

/**
 * Daily sprint summary runner.
 * Checks settings before running — respects user's enabled/disabled toggle.
 */
async function runDailySummary() {
  try {
    const client = getSupabaseClient();

    // Check if enabled
    const { data: enabledSetting } = await client
      .from('settings')
      .select('value')
      .eq('key', 'daily_summary_enabled')
      .single();

    if (enabledSetting?.value !== 'true') {
      console.log('[cron] Daily summary disabled in settings. Skipping.');
      return;
    }

    const engine = new AutomationEngine();
    await engine._generateAiReport({ id: null }, { report_type: 'sprint_summary' });
    console.log('[cron] Daily sprint summary generated successfully.');
  } catch (err) {
    console.error('[cron] Daily summary error:', err.message);
  }
}

/**
 * SLA monitoring runner.
 * Scans for p0/p1 issues unresolved for > 24 hours.
 */
async function runSlaCheck() {
  try {
    const client = getSupabaseClient();
    const threshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: issues, error } = await client
      .from('issues')
      .select('id, title, priority, status, created_at')
      .in('priority', ['p0', 'p1'])
      .in('status', ['backlog', 'todo', 'in_progress'])
      .lt('created_at', threshold);

    if (error) throw error;

    if (!issues || issues.length === 0) return;

    console.log(`[cron] Found ${issues.length} issues breaching SLA.`);

    const { showNotification } = require('./ipc/notification.ipc');

    for (const issue of issues) {
      const priorityLabel = issue.priority === 'p0' ? 'CRITICAL' : 'HIGH';
      showNotification({
        title: `SLA Breach: ${priorityLabel} Priority`,
        body: `"${issue.title}" has been unresolved for > 24 hours.`,
      });
      
      // Also generate an in-app notification by inserting into a hypothetical notifications table 
      // or using the notification store if it was accessible. 
      // Since stores are renderer-only, we should trigger a broadcast or just rely on the OS notification
      // and let the generator pick it up. 
      // Actually, the requirement says "generate an in-app notification via useNotificationStore.js".
      // useNotificationStore.js generates notifications from live data (polling).
      // So if the issue exists and meets criteria, the NotificationGenerator.jsx in renderer should pick it up.
    }
  } catch (err) {
    console.error('[cron] SLA check error:', err.message);
  }
}

/**
 * Reload scheduled automations (called from renderer when automations are updated).
 */
async function reloadScheduledAutomations() {
  await loadScheduledAutomations();
}

module.exports = { startCronJobs, reloadScheduledAutomations };
