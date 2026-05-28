// ─── CSV Parser ──────────────────────────────────────────────────────────

function parseCSV(text) {
  const lines = [];
  let current = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        current.push(field.trim());
        field = '';
      } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        current.push(field.trim());
        if (current.length > 0 && current.some((c) => c !== '')) lines.push(current);
        current = [];
        field = '';
        if (ch === '\r') i++;
      } else if (ch === '\r') {
        current.push(field.trim());
        if (current.length > 0 && current.some((c) => c !== '')) lines.push(current);
        current = [];
        field = '';
      } else {
        field += ch;
      }
    }
  }

  if (field || current.length > 0) {
    current.push(field.trim());
    if (current.length > 0 && current.some((c) => c !== '')) lines.push(current);
  }

  if (lines.length < 2) return [];
  const headers = lines[0].map((h) => h.toLowerCase().replace(/[^a-z0-9_]/g, ''));
  return lines.slice(1).map((row) => {
    const obj = {};
    headers.forEach((h, i) => {
      if (i < row.length) obj[h] = row[i];
    });
    return obj;
  });
}

// ─── Jira CSV Mapper ──────────────────────────────────────────────────────

const JIRA_STATUS_MAP = {
  'to do': 'backlog',
  backlog: 'backlog',
  open: 'backlog',
  'in progress': 'in_progress',
  'in review': 'testing',
  review: 'testing',
  'ready for review': 'testing',
  'ready to deploy': 'ready_to_deploy',
  done: 'done',
  closed: 'done',
  resolved: 'done',
  cancelled: 'cancelled',
  canceled: 'cancelled',
  blocked: 'backlog',
};

const JIRA_PRIORITY_MAP = {
  highest: 'p0',
  high: 'p1',
  medium: 'p2',
  low: 'p3',
  lowest: 'p3',
};

function parseJiraLabels(raw) {
  if (!raw) return [];
  return raw
    .split(/[\s,;]+/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function mapJiraToIssue(row) {
  const status = JIRA_STATUS_MAP[row.status?.toLowerCase()] || 'backlog';
  const priority = JIRA_PRIORITY_MAP[row.priority?.toLowerCase()] || 'p2';
  const labels = [];

  if (row.issuetype) labels.push(row.issuetype.toLowerCase());
  const parsedLabels = parseJiraLabels(row.labels);
  labels.push(...parsedLabels);

  const issue = {
    title: row.summary || row['issue key'] || 'Untitled',
    description: row.description || null,
    status,
    priority,
    labels: labels.filter(Boolean),
    assignee: row.assignee || null,
    created_at: row.created || null,
    // Preserve project name for lookup
    _project: row.project || null,
    _sprint: row.sprint || row.fixversion || null,
  };

  return Object.fromEntries(Object.entries(issue).filter(([_, v]) => v !== undefined));
}

// ─── Conflict Detection ──────────────────────────────────────────────────

/**
 * Check imported items against existing data.
 * Returns items annotated with: status ('new' | 'conflict'), conflictWith (existing item if conflict).
 */
function detectConflicts(imported, existing, keyField = 'title') {
  const existingKeys = new Set(
    existing.map((e) => (e[keyField] || '').toLowerCase().trim())
  );

  return imported.map((item) => {
    const itemKey = (item[keyField] || '').toLowerCase().trim();
    if (itemKey && existingKeys.has(itemKey)) {
      const conflict = existing.find(
        (e) => (e[keyField] || '').toLowerCase().trim() === itemKey
      );
      return { ...item, _status: 'conflict', _conflict: conflict };
    }
    return { ...item, _status: 'new', _conflict: null };
  });
}

// ─── Import Executor ──────────────────────────────────────────────────────

const DEPENDENCY_ORDER = [
  'products', 'clients', 'projects', 'sprints',
  'issues', 'qa_items', 'deployments', 'ai_reports', 'automations',
];

/**
 * Execute a JSON backup import.
 * Returns a results object: { created, skipped, failed, errors }
 */
async function executeJsonImport(data, stores) {
  const results = {};

  for (const table of DEPENDENCY_ORDER) {
    const items = data[table];
    if (!items?.length) continue;

    const store = stores[table];
    if (!store) continue;

    const tableResults = { created: 0, skipped: 0, failed: 0, errors: [] };

    for (const item of items) {
      try {
        // Skip items marked by user
        if (item._skip) {
          tableResults.skipped++;
          continue;
        }

        const payload = sanitizePayload(table, item);
        await store.create(payload);
        tableResults.created++;
      } catch (err) {
        tableResults.failed++;
        tableResults.errors.push(`${item.name || item.title || 'unknown'}: ${err.message}`);
      }
    }

    results[table] = tableResults;
  }

  return results;
}

/**
 * Import a list of items (from CSV) into a specific store.
 */
async function executeCsvImport(items, store, table = 'issues') {
  let created = 0;
  let skipped = 0;
  let failed = 0;
  const errors = [];

  for (const item of items) {
    if (item._skip) {
      skipped++;
      continue;
    }
    try {
      const payload = sanitizePayload(table, item);
      await store.create(payload);
      created++;
    } catch (err) {
      failed++;
      errors.push(`${item.title || 'unknown'}: ${err.message}`);
    }
  }

  return { created, skipped, failed, errors };
}

function sanitizePayload(table, item) {
  const clean = {};
  for (const [k, v] of Object.entries(item)) {
    // Strip all internal/metadata keys (prefixed with _) and timestamp fields
    if (k.startsWith('_') || k === 'id' || k === 'created_at' || k === 'updated_at') continue;
    clean[k] = v;
  }
  // Convert empty string FK fields to null to avoid FK constraint violations
  const fkFields = ['project_id', 'sprint_id', 'client_id', 'product_id', 'issue_id'];
  for (const fk of fkFields) {
    if (fk in clean && (clean[fk] === '' || clean[fk] === undefined)) {
      clean[fk] = null;
    }
  }
  return clean;
}

// ─── Jira CSV Import ──────────────────────────────────────────────────────

function parseJiraCSV(text) {
  const rows = parseCSV(text);
  return rows.map((row) => {
    const issue = mapJiraToIssue(row);
    // Add _jira_key for reference
    issue._jira_key = row['issue key'] || null;
    return issue;
  });
}

// ─── CSV parse for issues ─────────────────────────────────────────────────

function parseIssuesCSV(text) {
  const rows = parseCSV(text);
  return rows.map((row) => {
    const item = {
      title: row.title || row.summary || row.name || 'Untitled',
      description: row.description || null,
      status: row.status || 'backlog',
      priority: row.priority || 'p2',
      labels: row.labels ? row.labels.split(/[,;]+/).map((l) => l.trim()).filter(Boolean) : [],
      assignee: row.assignee || null,
      project_id: row.project_id || null,
      sprint_id: row.sprint_id || null,
      team: row.team || null,
      environment: row.environment || null,
    };
    // Convert empty string FK to null for clean display
    return sanitizePayload('issues', item);
  });
}

function parseQACSV(text) {
  const rows = parseCSV(text);
  return rows.map((row) => {
    const item = {
      test_case: row.test_case || row.title || row.name || 'Untitled',
      project_id: row.project_id || null,
      module: row.module || null,
      test_type: row.test_type || null,
      severity: row.severity || 'medium',
      status: row.status || 'to_test',
      steps_to_reproduce: row.steps_to_reproduce || null,
      expected_result: row.expected_result || null,
      actual_result: row.actual_result || null,
      environment: row.environment || null,
      notes: row.notes || null,
    };
    return sanitizePayload('qa_items', item);
  });
}

export {
  parseCSV,
  parseJiraCSV,
  parseIssuesCSV,
  parseQACSV,
  mapJiraToIssue,
  detectConflicts,
  executeJsonImport,
  executeCsvImport,
  sanitizePayload,
  DEPENDENCY_ORDER,
};
