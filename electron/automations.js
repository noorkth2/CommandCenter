'use strict';

const { getSupabaseClient } = require('./ipc/supabase.ipc');
const { handleAiGenerate } = require('./ipc/ai.ipc');
const { sendEmail } = require('./mailer');

/**
 * CommandCenter Automation Engine
 *
 * Evaluates automation rules against trigger events and executes actions.
 * Called from:
 *   - cron.js (scheduled triggers)
 *   - main.js IPC (manual trigger from UI)
 *   - Renderer hooks emit events via IPC after mutations (issue_created, deployment_completed, etc.)
 */
class AutomationEngine {
  constructor() {
    this.client = getSupabaseClient();
  }

  /**
   * Main entry point. Evaluates all enabled automations for a given trigger.
   *
   * @param {'issue_created'|'issue_status_changed'|'deployment_completed'|'schedule'} triggerType
   * @param {object} triggerData - The entity that triggered (issue, deployment, etc.)
   */
  async evaluate(triggerType, triggerData) {
    try {
      const { data: automations, error } = await this.client
        .from('automations')
        .select('*')
        .eq('trigger_type', triggerType)
        .eq('enabled', true);

      if (error) {
        console.error('[automations] Failed to fetch automations:', error.message);
        return;
      }

      for (const automation of automations ?? []) {
        const conditionsMet = this.evaluateConditions(automation, triggerData);
        if (!conditionsMet) continue;

        console.log(`[automations] Executing: "${automation.name}"`);
        await this.executeAction(automation, triggerData);
        await this.recordTrigger(automation.id);
      }
    } catch (err) {
      console.error('[automations] Evaluation error:', err.message);
    }
  }

  /**
   * Evaluates conditions from trigger_config against the trigger data.
   * All specified conditions must pass (AND logic).
   */
  evaluateConditions(automation, data) {
    const config = automation.trigger_config ?? {};

    // Label condition
    if (config.labels && Array.isArray(config.labels)) {
      const dataLabels = data.labels ?? [];
      const hasMatchingLabel = config.labels.some((label) => dataLabels.includes(label));
      if (!hasMatchingLabel) return false;
    }

    // Status condition
    if (config.status !== undefined) {
      if (data.status !== config.status) return false;
    }

    // Environment condition (for deployments)
    if (config.environment !== undefined) {
      if (data.environment !== config.environment) return false;
    }

    // Priority condition
    if (config.priority !== undefined) {
      if (data.priority !== config.priority) return false;
    }

    // Project condition
    if (config.project_id !== undefined) {
      if (data.project_id !== config.project_id) return false;
    }

    return true;
  }

  /**
   * Executes the automation action. Errors are caught and logged — never crash the app.
   */
  async executeAction(automation, triggerData) {
    const config = automation.action_config ?? {};

    try {
      switch (automation.action_type) {
        case 'create_qa_entry':
          await this._createQaEntry(triggerData, config);
          break;

        case 'send_email':
          await this._sendEmailAction(triggerData, config);
          break;

        case 'generate_ai_report':
          await this._generateAiReport(triggerData, config);
          break;

        default:
          console.warn('[automations] Unknown action_type:', automation.action_type);
      }
    } catch (err) {
      console.error(`[automations] Action "${automation.action_type}" failed:`, err.message);
    }
  }

  async _createQaEntry(issue, config) {
    const qaItem = {
      test_case: `[Auto] Test: ${issue.title}`,
      project_id: issue.project_id ?? null,
      issue_id: issue.id ?? null,
      module: issue.labels?.[0] ?? null,
      test_type: 'functional',
      severity: config.severity ?? 'medium',
      status: config.status ?? 'to_test',
      steps_to_reproduce: issue.steps_to_reproduce ?? null,
      expected_result: issue.expected_result ?? null,
      environment: issue.environment ?? 'local',
    };

    const { error } = await this.client.from('qa_items').insert(qaItem);
    if (error) throw new Error(`QA entry creation failed: ${error.message}`);
    console.log('[automations] QA entry created for issue:', issue.id);
  }

  async _sendEmailAction(triggerData, config) {
    // Render subject template
    const subject = (config.subject_template ?? 'CommandCenter: {name}').replace(
      /\{(\w+)\}/g,
      (_, key) => triggerData[key] ?? key
    );

    const html = `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #5b6af8; margin: 0 0 16px;">${subject}</h2>
        <pre style="background: #f4f4f8; padding: 16px; border-radius: 8px; font-size: 13px; white-space: pre-wrap;">
${JSON.stringify(triggerData, null, 2)}
        </pre>
        <p style="color: #666; margin-top: 16px; font-size: 12px;">Sent by CommandCenter Automation Engine</p>
      </div>
    `;

    const result = await sendEmail({
      to: config.email_to ?? undefined,
      subject,
      html,
    });

    if (!result.success) throw new Error(result.error);
  }

  async _generateAiReport(triggerData, config) {
    const reportType = config.report_type ?? 'rca';

    // Build prompt based on report type
    let prompt = '';
    let title = '';

    if (reportType === 'rca') {
      title = `RCA: ${triggerData.title ?? 'Untitled Issue'}`;
      prompt = `
You are a senior engineer writing a Root Cause Analysis.
Issue: ${triggerData.title}
Description: ${triggerData.description ?? 'No description provided'}
Team: ${triggerData.team ?? 'Unknown'}
Labels: ${(triggerData.labels ?? []).join(', ')}

Generate a structured RCA with these exact sections:
## Incident Summary
## Timeline (placeholder — engineer to fill)
## Root Cause (draft based on description)
## Impact Assessment
## Immediate Actions Taken (placeholder)
## Permanent Fix (draft recommendation)
## Prevention Measures (2-3 specific suggestions)

Note at bottom: "AI-generated draft. Engineer must review and complete all placeholder sections."
      `.trim();
    } else if (reportType === 'sprint_summary') {
      title = `Sprint Summary: ${new Date().toLocaleDateString()}`;
      // Fetch today's completed issues
      const { data: issues } = await this.client
        .from('issues')
        .select('*')
        .eq('status', 'done')
        .gte('completed_at', new Date(Date.now() - 86400000).toISOString());

      prompt = `
You are writing a daily engineering sprint summary.
Completed issues today:
${JSON.stringify(issues ?? [], null, 2)}

Write 4-6 bullet points summarizing:
• What was completed (by team/area)
• Any blockers resolved
• Items moved to production
• What's in progress

Format: bullet points only. No headers. No filler phrases like "The team worked on..."
Professional, factual, concise.
      `.trim();
    } else if (reportType === 'deployment_note') {
      title = `Deployment Note: ${triggerData.name ?? 'Deployment'}`;
      prompt = `
Write a professional deployment notification email body.
Deployment: ${triggerData.name}
Environment: ${triggerData.environment}
Services: ${(triggerData.services_affected ?? []).join(', ')}
Notes: ${triggerData.notes ?? 'No notes'}

Max 120 words. Include: what was deployed, affected services, expected impact.
Sign off as: "Engineering Team"
      `.trim();
    }

    const { content, error } = await handleAiGenerate(prompt, reportType);
    if (error) throw new Error(error);

    const { error: insertError } = await this.client.from('ai_reports').insert({
      type: reportType,
      title,
      content,
      related_id: triggerData.id ?? null,
      related_type:
        reportType === 'rca'
          ? 'issue'
          : reportType === 'deployment_note'
          ? 'deployment'
          : 'sprint',
      is_draft: true,
    });

    if (insertError) throw new Error(`Failed to save AI report: ${insertError.message}`);
    console.log(`[automations] AI report generated: ${title}`);
  }

  /**
   * Updates last_triggered_at and increments trigger_count for an automation.
   */
  async recordTrigger(automationId) {
    try {
      // First fetch current count
      const { data } = await this.client
        .from('automations')
        .select('trigger_count')
        .eq('id', automationId)
        .single();

      await this.client
        .from('automations')
        .update({
          last_triggered_at: new Date().toISOString(),
          trigger_count: (data?.trigger_count ?? 0) + 1,
        })
        .eq('id', automationId);
    } catch (err) {
      console.error('[automations] Failed to record trigger:', err.message);
    }
  }

  /**
   * Manually triggers an automation by ID (used from the UI for testing).
   */
  async manualTrigger(automationId, data = {}) {
    try {
      const { data: automation, error } = await this.client
        .from('automations')
        .select('*')
        .eq('id', automationId)
        .single();

      if (error || !automation) {
        return { success: false, error: 'Automation not found' };
      }

      await this.executeAction(automation, data);
      await this.recordTrigger(automationId);
      return { success: true, error: null };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

module.exports = { AutomationEngine };
