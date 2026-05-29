-- 012_deployment_checklist.sql
-- Adds checklist column to deployments table for tracking deployment task lists.

ALTER TABLE public.deployments
  ADD COLUMN IF NOT EXISTS checklist JSONB DEFAULT '[]';
