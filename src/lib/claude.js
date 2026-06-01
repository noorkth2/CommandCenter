/**
 * AI report generation wrapper for the renderer process.
 * ALL calls go through the Electron IPC bridge — the API key
 * is read in the main process from Supabase settings, never in the renderer.
 *
 * If no API key is configured OR the IPC bridge is unavailable,
 * generateReport() automatically falls back to a high-fidelity
 * local template engine so the app is always functional.
 */

/**
 * @typedef {'rca'|'sprint_summary'|'deployment_note'|'test_summary'} ReportType
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(val, fallback = '—') {
  if (val === null || val === undefined || val === '') return fallback;
  return String(val);
}

function fmtDate(val) {
  if (!val) return '—';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return String(val);
  }
}

function fmtPriority(p) {
  const map = { p0: 'Critical', p1: 'High', p2: 'Medium', p3: 'Low' };
  return map[p] ?? fmt(p);
}

function fmtStatus(s) {
  return fmt(s).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function incidentNumber(issue) {
  const team = fmt(issue.team, 'ENG').toUpperCase();
  const shortId = fmt(issue.id, '000').slice(-4).toUpperCase();
  return `GSPL-IR-${team}-${shortId}`;
}

// ─── Local Template Engine ────────────────────────────────────────────────────

/**
 * Generates a high-fidelity local report without any API calls.
 * Conforms to the Genius Systems Pvt. LTD Incident Report format for RCAs.
 *
 * @param {ReportType} type
 * @param {object} data
 * @returns {string}
 */
function generateLocalSummary(type, data) {
  switch (type) {
    case 'rca':
      return generateLocalRCA(data);
    case 'sprint_summary':
      return generateLocalSprintSummary(data);
    case 'deployment_note':
      return generateLocalDeploymentNote(data);
    case 'test_summary':
      return generateLocalTestSummary(data);
    case 'checklist':
      return JSON.stringify([
        `Verify DB connectivity for ${data.name || 'release'}`,
        `Perform sanity checks on environment: ${data.environment || 'production'}`,
        `Monitor error logs for services: ${(data.services_affected || []).join(', ') || 'all'}`,
        `Run post-deployment verification tests`,
      ]);
    case 'triage':
      return JSON.stringify((data || []).map(i => ({
        id: i.id,
        suggested_priority: i.priority || 'p2',
        suggested_team: (['backend', 'frontend', 'qa', 'ops', 'app'].includes(i.team) ? i.team : null) || 'backend',
        confidence: 0.8,
        reasoning: 'Local triage rule fallback'
      })));
    case 'triage_single':
      return JSON.stringify({
        suggested_priority: data.priority || 'p2',
        suggested_team: (['backend', 'frontend', 'qa', 'ops', 'app'].includes(data.team) ? data.team : null) || 'backend',
        confidence: 0.8,
        reasoning: 'Local triage rule fallback'
      });
    case 'general_chat':
      return "I'm currently running in local mode because the AI provider is not fully configured or the connection failed. Please ensure you have selected an AI Provider (Zen or Gemini) and entered a valid API Key in Settings.";
    default:
      return `**Report (Local)**\n\nReport type \`${type}\` is not supported locally.`;
  }
}

// ─── RCA / Incident Report ────────────────────────────────────────────────────

function generateLocalRCA(issue) {
  const irNumber  = incidentNumber(issue);
  const priority  = fmtPriority(issue.priority);
  const team      = fmt(issue.team, 'Engineering');
  const labels    = (issue.labels ?? []).join(', ') || '—';
  const createdAt = fmtDate(issue.created_at);
  const resolvedAt = fmtDate(issue.completed_at);
  const today     = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const impactedService = labels !== '—' ? labels : fmt(issue.title, 'System Services');
  const observation     = fmt(issue.description,
    'Users reported a service disruption. Further details to be filled in by the assigned engineer.');
  const stepsToReproduce = fmt(issue.steps_to_reproduce,
    'Steps to reproduce were not documented at time of incident. Engineer must complete this section.');
  const expectedResult  = fmt(issue.expected_result, 'System should operate normally without any disruptions.');
  const actualResult    = fmt(issue.actual_result, 'Service was unavailable or degraded during the incident window.');

  return `# Incident Report: ${fmt(issue.title, 'Service Disruption')}

**Reported Medium:** Viber (Monitoring Group) / Internal Tracking
**Date(s) of Incident:** ${today}
**Incident Number:** ${irNumber}

---

## Incident Details

| Field | Details |
|---|---|
| **Started on** | ${createdAt} |
| **Resolved on** | ${resolvedAt} |
| **Impacted service** | ${impactedService} |
| **Outage impact** | ${priority} |
| **Observation** | ${observation} |
| **RFO** | The issue was identified as ${priority.toLowerCase()} severity and assigned to the **${team}** team. The root cause is based on the reported description: "${fmt(issue.description, 'No description provided')}". Further analysis is required by the assigned engineer to confirm the exact root cause. |
| **Action taken** | Issue has been logged and assigned. Status: **${fmtStatus(issue.status)}**. Immediate investigation initiated by the ${team} team. |
| **Further action to be Implemented** | A permanent fix is currently being assessed. The team will document resolution steps and implement preventive measures to avoid recurrence. Engineer must complete this section with specifics. |

---

### Steps to Reproduce
${stepsToReproduce}

### Expected Result
${expectedResult}

### Actual Result
${actualResult}

---

*Prepared By: Genius Systems Pvt. LTD*

---
> ⚠️ *This is a locally-generated incident report draft based on available issue data. The assigned engineer must review and complete all placeholder sections before distribution.*`;
}

// ─── Sprint Summary ───────────────────────────────────────────────────────────

function generateLocalSprintSummary(issues) {
  if (!Array.isArray(issues) || issues.length === 0) {
    return `**Sprint Summary**\n\nNo completed issues to summarize for this sprint.\n\n*Generated locally — connect a valid API key in Settings to enable Claude AI summaries.*`;
  }

  // Group by team
  const byTeam = issues.reduce((acc, i) => {
    const team = fmt(i.team, 'General').replace(/\b\w/g, c => c.toUpperCase());
    if (!acc[team]) acc[team] = [];
    acc[team].push(i);
    return acc;
  }, {});

  const p0Count = issues.filter(i => i.priority === 'p0').length;
  const p1Count = issues.filter(i => i.priority === 'p1').length;

  let summary = `## Sprint Summary\n\n`;
  summary += `**Total completed:** ${issues.length} issue${issues.length !== 1 ? 's' : ''}\n`;
  if (p0Count > 0) summary += `**Critical (P0):** ${p0Count} resolved\n`;
  if (p1Count > 0) summary += `**High (P1):** ${p1Count} resolved\n`;
  summary += `\n`;

  for (const [team, teamIssues] of Object.entries(byTeam)) {
    summary += `### ${team} Team\n`;
    for (const issue of teamIssues) {
      const labels = (issue.labels ?? []).length > 0 ? ` _(${issue.labels.join(', ')})_` : '';
      summary += `- ✅ **${fmt(issue.title)}**${labels}\n`;
    }
    summary += `\n`;
  }

  summary += `---\n*Generated locally from sprint data. Connect a valid API key in Settings to enable Claude AI summaries.*`;
  return summary;
}

// ─── Deployment Note ──────────────────────────────────────────────────────────

function generateLocalDeploymentNote(deployment) {
  const services = (deployment.services_affected ?? []).join(', ') || 'Not specified';
  const env = fmt(deployment.environment, 'production').toUpperCase();
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return `## Deployment Release Note

**Deployment:** ${fmt(deployment.name)}
**Environment:** ${env}
**Date:** ${today}
**Status:** ${fmtStatus(deployment.status)}

---

### Services Affected
${services}

### Summary
This deployment covers changes to **${fmt(deployment.name)}** in the **${env}** environment.
${deployment.notes ? `\n**Notes:** ${deployment.notes}\n` : ''}
${deployment.rollback_plan ? `\n**Rollback Plan:** ${deployment.rollback_plan}\n` : ''}
${deployment.expected_downtime ? `\n**Expected Downtime:** ${deployment.expected_downtime}\n` : ''}

---

*Engineering Team — Genius Systems Pvt. LTD*

> ⚠️ *Locally-generated deployment note. Connect a valid API key in Settings to enable Claude AI generation.*`;
}

// ─── Test / QA Summary ────────────────────────────────────────────────────────

function generateLocalTestSummary(qaItems) {
  if (!Array.isArray(qaItems) || qaItems.length === 0) {
    return `**QA Test Summary**\n\nNo QA test items provided.\n\n*Generated locally — connect a valid API key in Settings to enable Claude AI summaries.*`;
  }

  const total   = qaItems.length;
  const passed  = qaItems.filter(i => i.status === 'pass').length;
  const failed  = qaItems.filter(i => i.status === 'fail').length;
  const blocked = qaItems.filter(i => i.status === 'blocked').length;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

  const criticalFails = qaItems.filter(i => i.status === 'fail' && i.severity === 'critical');
  const byModule = qaItems.reduce((acc, i) => {
    const mod = fmt(i.module, 'General');
    if (!acc[mod]) acc[mod] = { pass: 0, fail: 0, total: 0 };
    acc[mod].total += 1;
    if (i.status === 'pass') acc[mod].pass += 1;
    if (i.status === 'fail') acc[mod].fail += 1;
    return acc;
  }, {});

  const readyToDeploy = failed === 0 && blocked === 0;

  let summary = `## QA Test Run Summary\n\n`;
  summary += `| Metric | Value |\n|---|---|\n`;
  summary += `| **Total Tests** | ${total} |\n`;
  summary += `| **Passed** | ${passed} |\n`;
  summary += `| **Failed** | ${failed} |\n`;
  summary += `| **Blocked** | ${blocked} |\n`;
  summary += `| **Pass Rate** | ${passRate}% |\n\n`;

  if (criticalFails.length > 0) {
    summary += `### ⛔ Critical Failures\n`;
    for (const item of criticalFails) {
      summary += `- **${fmt(item.test_case)}** _(${fmt(item.module, 'Unknown Module')})_\n`;
      if (item.actual_result) summary += `  > Actual: ${item.actual_result}\n`;
    }
    summary += `\n`;
  }

  summary += `### Module Breakdown\n`;
  for (const [mod, stats] of Object.entries(byModule)) {
    const rate = Math.round((stats.pass / stats.total) * 100);
    const icon = stats.fail > 0 ? '❌' : '✅';
    summary += `- ${icon} **${mod}**: ${stats.pass}/${stats.total} passed (${rate}%)\n`;
  }

  summary += `\n### Deployment Recommendation\n`;
  summary += readyToDeploy
    ? `✅ **Ready to deploy.** All tests passed with no failures or blockers.`
    : `🚫 **Not ready to deploy.** ${failed} failure(s) and ${blocked} blocker(s) must be resolved first.`;

  summary += `\n\n---\n*Generated locally from QA data. Connect a valid API key in Settings to enable Claude AI summaries.*`;
  return summary;
}

// ─── AI Prompts (Claude via OpenCode Zen IPC) ─────────────────────────────────

const PROMPTS = {
  /**
   * @param {object} issue
   */
  rca: (issue) => `
You are a senior engineer at Genius Systems Pvt. LTD writing an official Incident Report.

Issue Details:
- Title: ${issue.title}
- Description: ${issue.description ?? 'No description provided'}
- Team: ${issue.team ?? 'Unknown'}
- Priority: ${fmtPriority(issue.priority)}
- Labels: ${(issue.labels ?? []).join(', ') || 'None'}
- Steps to Reproduce: ${issue.steps_to_reproduce ?? 'Not provided'}
- Expected Result: ${issue.expected_result ?? 'Not provided'}
- Actual Result: ${issue.actual_result ?? 'Not provided'}
- Created At: ${fmtDate(issue.created_at)}
- Resolved At: ${fmtDate(issue.completed_at)}

Write an incident report in this exact format:

# Incident Report: [Incident Title]

**Reported Medium:** Viber (NETTV Monitoring Group)
**Date(s) of Incident:** [Date]
**Incident Number:** ${incidentNumber(issue)}

## Incident Details

| Field | Details |
|---|---|
| **Started on** | [Fill from created_at] |
| **Resolved on** | [Fill from completed_at or "Under investigation"] |
| **Impacted service** | [Derive from labels/title/description] |
| **Outage impact** | [Critical/High/Medium/Low based on priority] |
| **Observation** | [2-3 paragraphs of what users observed, what was investigated] |
| **RFO** | [2 paragraphs: what change/event triggered this, technical explanation] |
| **Action taken** | [Immediate remediation step taken] |
| **Further action to be Implemented** | [Preventive measure to avoid recurrence] |

---

*Prepared By: Genius Systems Pvt. LTD*

Keep language professional, technical but clear. Do NOT add any sections beyond what is listed above.
`.trim(),

  /**
   * @param {object[]} issues
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
   * @param {object} deployment
   */
  deployment_note: (deployment) => `
Write a professional deployment notification email body.
Deployment: ${deployment.name}
Environment: ${deployment.environment}
Services: ${(deployment.services_affected ?? []).join(', ')}
Notes: ${deployment.notes ?? 'No notes'}

Max 120 words. Include: what was deployed, affected services, expected impact.
Sign off as: "Engineering Team — Genius Systems Pvt. LTD"
`.trim(),

  /**
   * @param {object[]} qaItems
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

  checklist: (data) => `
Generate a deployment checklist of critical tasks for this release:
Release Name: ${data.name}
Services Affected: ${(data.services_affected || []).join(', ') || 'General'}
Environment: ${data.environment}

Format your response as a JSON array of strings ONLY.
Example:
["Verify DB connectivity", "Run health checks"]
`.trim(),

  triage: (issues) => `
You are an expert product manager. Triage the following backlog issues:
${JSON.stringify((issues || []).map(i => ({ id: i.id, title: i.title, description: i.description ?? '', team: i.team ?? 'unassigned', priority: i.priority })), null, 2)}

For each issue, suggest:
1. Suggested Priority (p0, p1, p2, p3)
2. Suggested Team — you MUST choose one of EXACTLY these values: backend, frontend, qa, ops, app
3. Confidence (0.0 to 1.0)
4. Reasoning (max 15 words)

Format your response as a JSON array of objects ONLY. Do not write markdown fences or other text.
Example:
[
  {
    "id": "uuid-here",
    "suggested_priority": "p1",
    "suggested_team": "backend",
    "confidence": 0.9,
    "reasoning": "Critical payment bug affecting users"
  }
]
`.trim(),

  triage_single: (issue) => `
You are an expert product manager. Triage the following bug report:
Title: ${issue.title}
Description: ${issue.description ?? 'No description provided'}

Suggest:
1. Suggested Priority (p0, p1, p2, p3)
2. Suggested Team — you MUST choose one of EXACTLY these values: backend, frontend, qa, ops, app
3. Confidence (0.0 to 1.0)
4. Reasoning (max 15 words)

Format your response as a JSON object ONLY. Do not write markdown fences or other text.
Example:
{
  "suggested_priority": "p1",
  "suggested_team": "backend",
  "confidence": 0.9,
  "reasoning": "Database connection error affecting all users"
}
`.trim(),

  general_chat: (data) => data.customPrompt || "Hello! How can I help you today?",
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Attempts to load a custom prompt template from settings.
 * Returns null if not configured or IPC is unavailable.
 * The template string is returned as-is — callers apply data substitution.
 *
 * @param {'rca'|'sprint_summary'|'deployment_note'|'test_summary'} type
 * @returns {Promise<string|null>}
 */
async function getCustomPrompt(type) {
  const key = `prompt_${type}`;
  try {
    if (!window.electron?.settings?.get) return null;
    const res = await window.electron.settings.get(key);
    const val = res?.data;
    return (typeof val === 'string' && val.trim().length > 0) ? val.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Generates an AI report.
 * - If the Electron IPC bridge is available and a key is configured, uses Claude via OpenCode Zen.
 * - If no key is configured (mock flag) or IPC is unavailable, automatically falls back to
 *   the local high-fidelity template engine.
 *
 * @param {ReportType} type
 * @param {object} data - The entity (issue, sprint issues array, deployment, qa items)
 * @returns {Promise<{ content: string|null, error: string|null }>}
 */
/**
 * Generates an AI report.
 * - Loads custom prompt from settings first; falls back to hardcoded PROMPTS.
 * - If the Electron IPC bridge is available and a key is configured, uses Claude via OpenCode Zen.
 * - If no key is configured (mock flag) or IPC is unavailable, automatically falls back to
 *   the local high-fidelity template engine.
 *
 * @param {ReportType} type
 * @param {object} data - The entity (issue, sprint issues array, deployment, qa items)
 * @returns {Promise<{ content: string|null, error: string|null }>}
 */
export async function generateReport(type, data) {
  const hardcodedPromptFn = PROMPTS[type];
  if (!hardcodedPromptFn) {
    return { content: null, error: `Unknown report type: ${type}` };
  }

  // Try the Electron IPC/AI bridge first
  if (window.electron?.ai?.generate) {
    try {
      // Try custom prompt from settings; fall back to hardcoded builder
      const customTemplate = await getCustomPrompt(type);
      const prompt = customTemplate ?? hardcodedPromptFn(data);

      const result = await window.electron.ai.generate(prompt, type);

      // If the IPC returned real content, use it
      if (result?.content && !result.mock) {
        return { content: result.content, error: null };
      }

      // If no key was configured (mock flag), silently fall through to local templates
      if (result?.mock || !result?.content) {
        const content = generateLocalSummary(type, data);
        return { content, error: null };
      }

      // IPC returned an error — fall through to local templates
      if (result?.error) {
        console.warn('[claude.js] IPC error, falling back to local templates:', result.error);
        const content = generateLocalSummary(type, data);
        return { content, error: null };
      }
    } catch (err) {
      console.warn('[claude.js] IPC threw, falling back to local templates:', err.message);
    }
  }

  // Fallback: local template engine (IPC not available or errored)
  const content = generateLocalSummary(type, data);
  return { content, error: null };
}

export async function generateTriage(issues) {
  const { content, error } = await generateReport('triage', issues);
  if (error) return { data: null, error };
  try {
    let cleanContent = content.trim();
    if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```(json)?/, '').replace(/```$/, '').trim();
    }
    const data = JSON.parse(cleanContent);
    return { data, error: null };
  } catch (err) {
    return { data: null, error: 'Failed to parse AI triage response: ' + err.message };
  }
}

export { PROMPTS, generateLocalSummary };
