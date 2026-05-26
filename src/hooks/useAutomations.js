import { useCallback } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Hook for triggering automations from the renderer process.
 * The renderer evaluates trigger events after mutations and emits them
 * to the automation engine via IPC.
 */
export function useAutomations() {
  /**
   * Notify the automation engine of an event.
   * The engine (running in Electron main process) evaluates matching rules.
   * For now this calls the Supabase-side evaluation directly since the
   * automation engine also runs in the main process.
   *
   * @param {'issue_created'|'issue_status_changed'|'deployment_completed'|'schedule'} triggerType
   * @param {object} triggerData - The entity that triggered
   */
  const trigger = useCallback(async (triggerType, triggerData) => {
    try {
      // Fetch matching automations directly from Supabase (renderer-side evaluation)
      const { data: automations, error } = await supabase
        .from('automations')
        .select('*')
        .eq('trigger_type', triggerType)
        .eq('enabled', true);

      if (error || !automations?.length) return;

      // For each matching automation, call IPC to execute the action
      // (the actual execution happens in the main process)
      for (const automation of automations) {
        const conditionsMet = evaluateConditions(automation, triggerData);
        if (!conditionsMet) continue;

        if (window.electron?.automation?.trigger) {
          // Pass the trigger data through IPC for execution
          await window.electron.automation.trigger(automation.id, triggerData);
        }
      }
    } catch (err) {
      console.error('[useAutomations] Trigger error:', err.message);
    }
  }, []);

  return { trigger };
}

/**
 * Client-side condition evaluator (mirrors the main process logic).
 * Determines if an automation should fire for given trigger data.
 *
 * @param {import('../lib/constants').Automation} automation
 * @param {object} data
 * @returns {boolean}
 */
function evaluateConditions(automation, data) {
  const config = automation.trigger_config ?? {};

  if (config.labels && Array.isArray(config.labels)) {
    const dataLabels = data.labels ?? [];
    if (!config.labels.some((l) => dataLabels.includes(l))) return false;
  }

  if (config.status !== undefined && data.status !== config.status) return false;
  if (config.environment !== undefined && data.environment !== config.environment) return false;
  if (config.priority !== undefined && data.priority !== config.priority) return false;
  if (config.project_id !== undefined && data.project_id !== config.project_id) return false;

  return true;
}
