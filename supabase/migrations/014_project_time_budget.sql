-- 014_project_time_budget.sql
-- Adds time_budget_hours column to projects table.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS time_budget_hours NUMERIC(8,2);
