const { getSupabaseClient } = require('./supabase.ipc');
const { getSettingsMap } = require('./settings.ipc');

// Mapping from Jira status to CommandCenter status
const JIRA_STATUS_MAP = {
  'to do': 'backlog',
  'backlog': 'backlog',
  'open': 'backlog',
  'in progress': 'in_progress',
  'in review': 'testing',
  'review': 'testing',
  'ready for review': 'testing',
  'ready to deploy': 'ready_to_deploy',
  'done': 'done',
  'closed': 'done',
  'resolved': 'done',
  'cancelled': 'cancelled',
  'canceled': 'cancelled',
  'blocked': 'backlog',
};

// Mapping from Jira priority to CommandCenter priority
const JIRA_PRIORITY_MAP = {
  'highest': 'p0',
  'high': 'p1',
  'medium': 'p2',
  'low': 'p3',
  'lowest': 'p3',
};

// Mapping from CommandCenter status to Jira status (for push sync)
const CC_TO_JIRA_STATUS = {
  backlog: 'To Do',
  todo: 'To Do',
  in_progress: 'In Progress',
  testing: 'In Review',
  uat: 'In Review',
  ready_to_deploy: 'Done',
  production: 'Done',
  monitoring: 'Done',
  done: 'Done',
};

/**
 * Converts Jira Document Format (ADF) description to plain text
 */
function adfToText(adf) {
  if (!adf) return '';
  if (typeof adf === 'string') return adf;
  if (adf.type === 'text') return adf.text || '';
  if (Array.isArray(adf.content)) return adf.content.map(adfToText).join('');
  if (adf.content) return adfToText(adf.content);
  return '';
}

/**
 * Get Jira headers for auth
 */
function getJiraHeaders(email, apiToken) {
  const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
  return {
    'Authorization': `Basic ${auth}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };
}

/**
 * Sync issues from Jira
 */
async function syncJira() {
  const supabase = getSupabaseClient();
  const settings = await getSettingsMap();

  const baseUrl = settings.jira_base_url;
  const email = settings.jira_email;
  const apiToken = settings.jira_api_token;
  const projectKey = settings.jira_project_key;
  const syncEnabled = settings.jira_sync_enabled === 'true';

  if (!syncEnabled || !baseUrl || !email || !apiToken || !projectKey) {
    return { success: false, error: 'Jira integration is not fully configured or enabled.' };
  }

  try {
    const url = `${baseUrl.replace(/\/+$/, '')}/rest/api/3/search?jql=project=${projectKey}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: getJiraHeaders(email, apiToken),
    });

    if (!response.ok) {
      throw new Error(`Jira API request failed with status: ${response.status}`);
    }

    const resData = await response.json();
    const jiraIssues = resData.issues || [];
    let syncedCount = 0;

    for (const issue of jiraIssues) {
      const fields = issue.fields || {};
      const jiraId = issue.key;

      const title = fields.summary || jiraId;
      const description = adfToText(fields.description) || null;
      const status = JIRA_STATUS_MAP[fields.status?.name?.toLowerCase()] || 'backlog';
      const priority = JIRA_PRIORITY_MAP[fields.priority?.name?.toLowerCase()] || 'p2';
      
      const labels = [];
      if (fields.issuetype?.name) labels.push(fields.issuetype.name.toLowerCase());
      if (Array.isArray(fields.labels)) labels.push(...fields.labels.map(l => l.toLowerCase()));

      const assignee = fields.assignee?.displayName || fields.assignee?.emailAddress || null;

      // Check if issue already exists in CommandCenter by jira_id
      const { data: existingIssue } = await supabase
        .from('issues')
        .select('*')
        .eq('jira_id', jiraId)
        .maybeSingle();

      const payload = {
        title,
        description,
        status,
        priority,
        labels,
        assignee,
        jira_id: jiraId,
        updated_at: new Date().toISOString(),
      };

      let savedIssue;
      if (existingIssue) {
        const { data, error } = await supabase
          .from('issues')
          .update(payload)
          .eq('id', existingIssue.id)
          .select()
          .single();

        if (error) throw error;
        savedIssue = data;
      } else {
        // Fallback: match by title to link existing issue if needed
        const { data: titleMatched } = await supabase
          .from('issues')
          .select('*')
          .eq('title', title)
          .maybeSingle();

        if (titleMatched) {
          const { data, error } = await supabase
            .from('issues')
            .update({ jira_id: jiraId, ...payload })
            .eq('id', titleMatched.id)
            .select()
            .single();

          if (error) throw error;
          savedIssue = data;
        } else {
          const { data, error } = await supabase
            .from('issues')
            .insert({ ...payload, created_at: new Date().toISOString() })
            .select()
            .single();

          if (error) throw error;
          savedIssue = data;
        }
      }

      syncedCount++;

      // Trigger automation rules for jira_issue_synced
      try {
        const { AutomationEngine } = require('../automations');
        const engine = new AutomationEngine();
        await engine.evaluate('jira_issue_synced', savedIssue);
      } catch (e) {
        console.warn('[Jira IPC] Failed to execute automations for issue:', jiraId, e.message);
      }
    }

    return { success: true, syncedCount };
  } catch (err) {
    console.error('[Jira IPC] Sync failed:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Push status update to Jira
 */
async function pushStatus(jiraId, ccStatus) {
  const settings = await getSettingsMap();
  const baseUrl = settings.jira_base_url;
  const email = settings.jira_email;
  const apiToken = settings.jira_api_token;
  const pushEnabled = settings.jira_push_status_enabled === 'true';

  if (!pushEnabled || !baseUrl || !email || !apiToken || !jiraId) {
    return { success: false, error: 'Jira push sync is not enabled or configured.' };
  }

  const targetJiraStatusName = CC_TO_JIRA_STATUS[ccStatus];
  if (!targetJiraStatusName) {
    return { success: false, error: `No Jira status mapping for CommandCenter status: ${ccStatus}` };
  }

  try {
    const headers = getJiraHeaders(email, apiToken);
    
    // 1. Get available transitions for this issue
    const transUrl = `${baseUrl.replace(/\/+$/, '')}/rest/api/3/issue/${jiraId}/transitions`;
    const transRes = await fetch(transUrl, { method: 'GET', headers });
    
    if (!transRes.ok) {
      throw new Error(`Failed to fetch transitions. Status: ${transRes.status}`);
    }

    const transData = await transRes.json();
    const transitions = transData.transitions || [];
    
    // 2. Find transition matching the target status name
    const match = transitions.find(t => 
      t.to?.name?.toLowerCase() === targetJiraStatusName.toLowerCase() ||
      t.name?.toLowerCase() === targetJiraStatusName.toLowerCase()
    );

    if (!match) {
      throw new Error(`Jira status transition "${targetJiraStatusName}" not found in available transitions for issue ${jiraId}.`);
    }

    // 3. Post the transition
    const postRes = await fetch(transUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        transition: { id: match.id }
      })
    });

    if (!postRes.ok) {
      throw new Error(`Jira status transition update failed. Status: ${postRes.status}`);
    }

    return { success: true };
  } catch (err) {
    console.error(`[Jira IPC] Push status failed for ${jiraId}:`, err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  syncJira,
  pushStatus,
};
