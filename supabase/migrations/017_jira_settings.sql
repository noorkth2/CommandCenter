-- 017_jira_settings.sql
-- Seeds default Jira credentials and API keys in the settings table.

INSERT INTO public.settings (key, value) VALUES
  ('jira_base_url', ''),
  ('jira_email', ''),
  ('jira_api_token', ''),
  ('jira_project_key', ''),
  ('jira_sync_enabled', 'false')
ON CONFLICT (key) DO NOTHING;
