-- Epic 1: Visual Bug Reporting
-- Adds columns to issues table for environment context and attachments.

ALTER TABLE public.issues 
ADD COLUMN IF NOT EXISTS environment_context jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS attachments jsonb[] DEFAULT '{}';

COMMENT ON COLUMN public.issues.environment_context IS 'Automatically captured OS, browser, and screen context for bug reports.';
COMMENT ON COLUMN public.issues.attachments IS 'Array of screenshot/image attachment metadata (URL, label, etc.)';
