-- 008_allowed_emails_setting.sql
-- Seeds the allowed_emails access control list in the settings table.
-- Values match the existing hardcoded allowlist in the application.
-- Renderer falls back to the hardcoded list if this setting is absent.

INSERT INTO public.settings (key, value)
VALUES (
  'allowed_emails',
  '["kayastha.noor1100@gmail.com","niroj.mahrjan@gmail.com"]'
)
ON CONFLICT (key) DO NOTHING;
