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
 * Reload scheduled automations (called from renderer when automations are updated).
 */
async function reloadScheduledAutomations() {
  await loadScheduledAutomations();
}

module.exports = { startCronJobs, reloadScheduledAutomations };
