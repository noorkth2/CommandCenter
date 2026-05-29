-- 013_sprint_velocity.sql
-- Adds velocity tracking columns to sprints table.

ALTER TABLE public.sprints
  ADD COLUMN IF NOT EXISTS planned_points INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_points INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS velocity NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS velocity_snapshot_at TIMESTAMPTZ;
