-- 019_jira_sync_trigger.sql
-- Adds jira_issue_synced to automations.trigger_type constraint list.

ALTER TABLE public.automations
  DROP CONSTRAINT IF EXISTS automations_trigger_type_check;

ALTER TABLE public.automations
  ADD CONSTRAINT automations_trigger_type_check
  CHECK (trigger_type IN ('issue_created', 'issue_status_changed', 'deployment_completed', 'schedule', 'jira_issue_synced'));
