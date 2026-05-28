/**
 * AI report generation wrapper for the renderer process.
 * ALL calls go through the Electron IPC bridge — the API key
 * is read in the main process from Supabase settings, never in the renderer.
 */

/**
 * @typedef {'rca'|'sprint_summary'|'deployment_note'|'test_summary'} ReportType
 */

const PROMPTS = {
  /**
   * @param {import('../lib/constants').Issue} issue
   */
  rca: (issue) => `
You are a senior engineer writing a Root Cause Analysis.
Issue: ${issue.title}
Description: ${issue.description ?? 'No description provided'}
Team: ${issue.team ?? 'Unknown'}
Labels: ${(issue.labels ?? []).join(', ')}

Generate a structured RCA with these exact sections:
## Incident Summary
## Timeline (placeholder — engineer to fill)
## Root Cause (draft based on description)
## Impact Assessment
## Immediate Actions Taken (placeholder)
## Permanent Fix (draft recommendation)
## Prevention Measures (2-3 specific suggestions)

Note at bottom: "AI-generated draft. Engineer must review and complete all placeholder sections."
`.trim(),

  /**
   * @param {import('../lib/constants').Issue[]} issues
   */
  sprint_summary: (issues) => `
You are writing a daily engineering sprint summary.
Completed issues today:
${JSON.stringify(issues, null, 2)}

Write 4-6 bullet points summarizing:
• What was completed (by team/area)
• Any blockers resolved
• Items moved to production
• What's in progress

Format: bullet points only. No headers. No filler phrases like "The team worked on..."
Professional, factual, concise.
`.trim(),

  /**
   * @param {import('../lib/constants').Deployment} deployment
   */
  deployment_note: (deployment) => `
Write a professional deployment notification email body.
Deployment: ${deployment.name}
Environment: ${deployment.environment}
Services: ${(deployment.services_affected ?? []).join(', ')}
Notes: ${deployment.notes ?? 'No notes'}

Max 120 words. Include: what was deployed, affected services, expected impact.
Sign off as: "Engineering Team"
`.trim(),

  /**
   * @param {import('../lib/constants').QAItem[]} qaItems
   */
  test_summary: (qaItems) => `
Summarize this QA test run:
${JSON.stringify(qaItems, null, 2)}

Provide:
• Overall pass rate
• Critical failures (if any)
• Modules with most issues
• Recommendation: ready to deploy? Yes/No with reason

Max 100 words.
`.trim(),
};

/**
 * Generates an AI report by calling the AI provider (OpenCode Zen) through the IPC bridge.
 *
 * @param {ReportType} type
 * @param {object} data - The entity (issue, sprint issues array, deployment, qa items)
 * @returns {Promise<{ content: string|null, error: string|null }>}
 */
export async function generateReport(type, data) {
  if (!window.electron?.ai?.generate) {
    return { content: null, error: 'Electron IPC not available. Are you running in Electron?' };
  }

  const promptFn = PROMPTS[type];
  if (!promptFn) {
    return { content: null, error: `Unknown report type: ${type}` };
  }

  const prompt = promptFn(data);
  return window.electron.ai.generate(prompt, type);
}

export { PROMPTS };
