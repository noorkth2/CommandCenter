-- 005_add_app_team.sql
-- Updates the check constraint on the issues.team column to allow 'app' as a valid team

ALTER TABLE public.issues DROP CONSTRAINT IF EXISTS issues_team_check;

ALTER TABLE public.issues ADD CONSTRAINT issues_team_check CHECK (team IN ('backend', 'frontend', 'qa', 'ops', 'app'));
