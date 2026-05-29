-- 009_wip_limits_setting.sql
-- Adds configurable Kanban WIP limits to the settings table.
-- Board.jsx will read this at runtime; hardcoded defaults remain as fallback.

INSERT INTO public.settings (key, value)
VALUES (
  'wip_limits',
  '{"in_progress": 5, "testing": 4, "uat": 3}'
)
ON CONFLICT (key) DO NOTHING;
