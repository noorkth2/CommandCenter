-- 018_issues_jira_id.sql
-- Adds jira_id column to issues table for syncing.

ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS jira_id TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_issues_jira_id ON public.issues(jira_id);
