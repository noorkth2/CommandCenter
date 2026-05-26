/**
 * App-wide constants, enums, and JSDoc type definitions.
 * Single source of truth for all domain values.
 */

// ─── Project ──────────────────────────────────────────────────────────────────

export const PROJECT_STATUSES = ['active', 'on_hold', 'completed', 'blocked'];
export const PROJECT_PRIORITIES = ['p0', 'p1', 'p2', 'p3'];
export const PROJECT_CATEGORIES = ['fyp', 'coursework', 'client', 'personal'];

export const PROJECT_STATUS_LABELS = {
  active: 'Active',
  on_hold: 'On Hold',
  completed: 'Completed',
  blocked: 'Blocked',
};

export const PROJECT_PRIORITY_LABELS = {
  p0: 'Critical',
  p1: 'High',
  p2: 'Medium',
  p3: 'Low',
};

export const PROJECT_CATEGORY_LABELS = {
  fyp: 'FYP',
  coursework: 'Coursework',
  client: 'Client',
  personal: 'Personal',
};

// ─── Issue ────────────────────────────────────────────────────────────────────

export const ISSUE_STATUSES = [
  'backlog',
  'todo',
  'in_progress',
  'testing',
  'uat',
  'ready_to_deploy',
  'production',
  'monitoring',
  'done',
  'cancelled',
];

export const ISSUE_STATUS_LABELS = {
  backlog: 'Backlog',
  todo: 'Todo',
  in_progress: 'In Progress',
  testing: 'Testing',
  uat: 'UAT',
  ready_to_deploy: 'Ready to Deploy',
  production: 'Production',
  monitoring: 'Monitoring',
  done: 'Done',
  cancelled: 'Cancelled',
};

export const ISSUE_PRIORITIES = ['p0', 'p1', 'p2', 'p3'];
export const ISSUE_TEAMS = ['backend', 'frontend', 'qa', 'ops', 'app'];
export const ISSUE_ENVIRONMENTS = ['local', 'staging', 'production'];

export const ISSUE_TEAM_LABELS = {
  backend: 'Backend',
  frontend: 'Frontend',
  qa: 'QA',
  ops: 'Ops',
  app: 'App',
};

/** Valid status transitions — maps each status to the statuses it can move to */
export const ISSUE_STATUS_TRANSITIONS = {
  backlog: ['todo', 'cancelled'],
  todo: ['backlog', 'in_progress', 'cancelled'],
  in_progress: ['todo', 'testing', 'cancelled'],
  testing: ['in_progress', 'uat', 'cancelled'],
  uat: ['testing', 'ready_to_deploy', 'cancelled'],
  ready_to_deploy: ['uat', 'production', 'cancelled'],
  production: ['monitoring', 'rolled_back', 'cancelled'],
  monitoring: ['production', 'done', 'cancelled'],
  done: [],
  cancelled: ['backlog'],
};

// ─── QA ───────────────────────────────────────────────────────────────────────

export const QA_STATUSES = ['to_test', 'in_progress', 'pass', 'fail', 'blocked'];
export const QA_SEVERITIES = ['critical', 'high', 'medium', 'low'];
export const QA_TEST_TYPES = ['functional', 'ui', 'integration', 'regression', 'edge_case'];

export const QA_STATUS_LABELS = {
  to_test: 'To Test',
  in_progress: 'In Progress',
  pass: 'Pass',
  fail: 'Fail',
  blocked: 'Blocked',
};

export const QA_TEST_TYPE_LABELS = {
  functional: 'Functional',
  ui: 'UI',
  integration: 'Integration',
  regression: 'Regression',
  edge_case: 'Edge Case',
};

// ─── Deployment ───────────────────────────────────────────────────────────────

export const DEPLOYMENT_STATUSES = ['planned', 'in_progress', 'success', 'failed', 'rolled_back'];
export const DEPLOYMENT_ENVIRONMENTS = ['dev', 'staging', 'production'];
export const DEPLOYMENT_SERVICES = [
  'Backend API',
  'Frontend',
  'Database',
  'Firebase',
  'Environment Variables',
  'Mobile App',
  'Admin Panel',
];

export const DEPLOYMENT_STATUS_LABELS = {
  planned: 'Planned',
  in_progress: 'In Progress',
  success: 'Success',
  failed: 'Failed',
  rolled_back: 'Rolled Back',
};

// ─── Sprint ───────────────────────────────────────────────────────────────────

export const SPRINT_STATUSES = ['upcoming', 'active', 'completed'];

export const SPRINT_STATUS_LABELS = {
  upcoming: 'Upcoming',
  active: 'Active',
  completed: 'Completed',
};

// ─── AI Reports ───────────────────────────────────────────────────────────────

export const AI_REPORT_TYPES = ['rca', 'sprint_summary', 'deployment_note', 'test_summary'];

export const AI_REPORT_TYPE_LABELS = {
  rca: 'Root Cause Analysis',
  sprint_summary: 'Sprint Summary',
  deployment_note: 'Deployment Note',
  test_summary: 'Test Summary',
};

// ─── Automations ─────────────────────────────────────────────────────────────

export const AUTOMATION_TRIGGER_TYPES = [
  'issue_created',
  'issue_status_changed',
  'deployment_completed',
  'schedule',
];

export const AUTOMATION_ACTION_TYPES = [
  'create_qa_entry',
  'send_email',
  'generate_ai_report',
  'create_notion_page',
];

export const AUTOMATION_TRIGGER_LABELS = {
  issue_created: 'Issue Created',
  issue_status_changed: 'Issue Status Changed',
  deployment_completed: 'Deployment Completed',
  schedule: 'Scheduled',
};

export const AUTOMATION_ACTION_LABELS = {
  create_qa_entry: 'Create QA Entry',
  send_email: 'Send Email',
  generate_ai_report: 'Generate AI Report',
  create_notion_page: 'Create Notion Page',
};

// ─── Color maps ───────────────────────────────────────────────────────────────

/** Tailwind class maps for status/priority badges */
export const STATUS_COLORS = {
  // Project
  active: 'bg-brand-blue/15 text-brand-blue border-brand-blue/30',
  on_hold: 'bg-brand-amber/15 text-brand-amber border-brand-amber/30',
  completed: 'bg-brand-green/15 text-brand-green border-brand-green/30',
  blocked: 'bg-brand-red/15 text-brand-red border-brand-red/30',
  // Issue
  backlog: 'bg-text-muted/15 text-text-secondary border-text-muted/30',
  todo: 'bg-brand-blue/10 text-brand-blue border-brand-blue/20',
  in_progress: 'bg-brand-purple/15 text-brand-purple border-brand-purple/30',
  testing: 'bg-brand-amber/15 text-brand-amber border-brand-amber/30',
  uat: 'bg-brand-amber/20 text-brand-amber border-brand-amber/40',
  ready_to_deploy: 'bg-brand-green/10 text-brand-green border-brand-green/20',
  production: 'bg-brand-green/15 text-brand-green border-brand-green/30',
  monitoring: 'bg-brand-blue/15 text-brand-blue border-brand-blue/30',
  done: 'bg-brand-green/20 text-brand-green border-brand-green/40',
  cancelled: 'bg-text-muted/10 text-text-muted border-text-muted/20',
  // QA
  to_test: 'bg-brand-blue/15 text-brand-blue border-brand-blue/30',
  pass: 'bg-brand-green/15 text-brand-green border-brand-green/30',
  fail: 'bg-brand-red/15 text-brand-red border-brand-red/30',
  // Deployment
  planned: 'bg-text-muted/15 text-text-secondary border-text-muted/30',
  success: 'bg-brand-green/15 text-brand-green border-brand-green/30',
  failed: 'bg-brand-red/15 text-brand-red border-brand-red/30',
  rolled_back: 'bg-brand-amber/15 text-brand-amber border-brand-amber/30',
  // Sprint
  upcoming: 'bg-text-muted/15 text-text-secondary border-text-muted/30',
};

export const PRIORITY_COLORS = {
  p0: 'bg-brand-red/15 text-brand-red border-brand-red/30',
  p1: 'bg-brand-amber/15 text-brand-amber border-brand-amber/30',
  p2: 'bg-brand-blue/15 text-brand-blue border-brand-blue/30',
  p3: 'bg-text-muted/15 text-text-secondary border-text-muted/30',
};

// ─── JSDoc Types ─────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Project
 * @property {string} id
 * @property {string} name
 * @property {'active'|'on_hold'|'completed'|'blocked'} status
 * @property {'p0'|'p1'|'p2'|'p3'} priority
 * @property {'fyp'|'coursework'|'client'|'personal'|null} category
 * @property {string[]} tech_stack
 * @property {string|null} deadline
 * @property {string|null} description
 * @property {string|null} notes
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} Issue
 * @property {string} id
 * @property {string} title
 * @property {string|null} description
 * @property {'backlog'|'todo'|'in_progress'|'testing'|'uat'|'ready_to_deploy'|'production'|'monitoring'|'done'|'cancelled'} status
 * @property {'p0'|'p1'|'p2'|'p3'} priority
 * @property {string[]} labels
 * @property {string|null} project_id
 * @property {string|null} sprint_id
 * @property {string|null} steps_to_reproduce
 * @property {string|null} expected_result
 * @property {string|null} actual_result
 * @property {'local'|'staging'|'production'|null} environment
 * @property {string|null} assignee
 * @property {'backend'|'frontend'|'qa'|'ops'|'app'|null} team
 * @property {string} created_at
 * @property {string} updated_at
 * @property {string|null} completed_at
 */

/**
 * @typedef {Object} QAItem
 * @property {string} id
 * @property {string} test_case
 * @property {string|null} project_id
 * @property {string|null} issue_id
 * @property {string|null} module
 * @property {'functional'|'ui'|'integration'|'regression'|'edge_case'|null} test_type
 * @property {'critical'|'high'|'medium'|'low'} severity
 * @property {'to_test'|'in_progress'|'pass'|'fail'|'blocked'} status
 * @property {string|null} steps_to_reproduce
 * @property {string|null} expected_result
 * @property {string|null} actual_result
 * @property {'local'|'staging'|'production'|null} environment
 * @property {string|null} notes
 * @property {string|null} tested_on
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} Deployment
 * @property {string} id
 * @property {string} name
 * @property {string|null} project_id
 * @property {'dev'|'staging'|'production'} environment
 * @property {'planned'|'in_progress'|'success'|'failed'|'rolled_back'} status
 * @property {string[]} services_affected
 * @property {string|null} rollback_plan
 * @property {string|null} expected_downtime
 * @property {string|null} notes
 * @property {string|null} deployed_at
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} Sprint
 * @property {string} id
 * @property {string} name
 * @property {'upcoming'|'active'|'completed'} status
 * @property {string|null} start_date
 * @property {string|null} end_date
 * @property {string|null} goals
 * @property {string|null} ai_summary
 * @property {number} completed_tasks_count
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} AIReport
 * @property {string} id
 * @property {'rca'|'sprint_summary'|'deployment_note'|'test_summary'} type
 * @property {string} title
 * @property {string} content
 * @property {string|null} related_id
 * @property {string|null} related_type
 * @property {boolean} is_draft
 * @property {string} created_at
 */

/**
 * @typedef {Object} Automation
 * @property {string} id
 * @property {string} name
 * @property {string|null} description
 * @property {boolean} enabled
 * @property {'issue_created'|'issue_status_changed'|'deployment_completed'|'schedule'} trigger_type
 * @property {object} trigger_config
 * @property {'create_qa_entry'|'send_email'|'generate_ai_report'|'create_notion_page'} action_type
 * @property {object} action_config
 * @property {string|null} last_triggered_at
 * @property {number} trigger_count
 * @property {string} created_at
 */
