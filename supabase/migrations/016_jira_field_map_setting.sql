-- 016_jira_field_map_setting.sql
-- Seeds the jira_field_map setting key for CSV mapping.

INSERT INTO public.settings (key, value)
VALUES ('jira_field_map', '{}')
ON CONFLICT (key) DO NOTHING;
