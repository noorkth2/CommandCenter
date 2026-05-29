-- 007_updated_at_coverage.sql
-- Ensures updated_at column + auto-update trigger exists on all entities.
-- Safe to re-run: uses IF NOT EXISTS guards throughout.

-- ─── Shared trigger function (already exists, but create if absent) ─────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── clients ─────────────────────────────────────────────────────────────────
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DROP TRIGGER IF EXISTS set_updated_at ON public.clients;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── products ────────────────────────────────────────────────────────────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DROP TRIGGER IF EXISTS set_updated_at ON public.products;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── time_entries ────────────────────────────────────────────────────────────
-- Column already exists per migration 006, but trigger was never created.
DROP TRIGGER IF EXISTS set_updated_at ON public.time_entries;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── automations ────────────────────────────────────────────────────────────
ALTER TABLE public.automations
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DROP TRIGGER IF EXISTS set_updated_at ON public.automations;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.automations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── ai_reports ─────────────────────────────────────────────────────────────
ALTER TABLE public.ai_reports
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DROP TRIGGER IF EXISTS set_updated_at ON public.ai_reports;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.ai_reports
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
