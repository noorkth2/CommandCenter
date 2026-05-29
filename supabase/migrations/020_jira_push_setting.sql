-- 020_jira_push_setting.sql
-- Seeds default two-way push sync setting.

INSERT INTO public.settings (key, value)
VALUES ('jira_push_status_enabled', 'false')
ON CONFLICT (key) DO NOTHING;
