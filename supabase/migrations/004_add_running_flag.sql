-- 004_add_running_flag.sql
-- Adds the running boolean column to projects table if it doesn't exist
-- This migration can be run safely on existing databases

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='projects' AND column_name='running'
  ) THEN
    ALTER TABLE public.projects ADD COLUMN running boolean DEFAULT true;
  END IF;
END $$;
