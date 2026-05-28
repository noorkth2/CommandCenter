-- 006_add_time_entries.sql
-- Adds time_entries table for per-issue time tracking (timer + manual logs)

CREATE TABLE IF NOT EXISTS public.time_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_id UUID REFERENCES public.issues(id) ON DELETE CASCADE,
  description TEXT,
  duration_minutes INTEGER,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast queries by issue
CREATE INDEX IF NOT EXISTS idx_time_entries_issue_id ON public.time_entries(issue_id);

-- Index for date-range queries (week view)
CREATE INDEX IF NOT EXISTS idx_time_entries_date ON public.time_entries(date);
