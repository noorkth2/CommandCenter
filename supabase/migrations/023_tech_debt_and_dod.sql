-- Epic 5: Technical Debt Management & "Definition of Done"
-- Adds columns for DoD checklist and technical debt flagging.

ALTER TABLE public.issues 
ADD COLUMN IF NOT EXISTS definition_of_done jsonb DEFAULT '[]',
ADD COLUMN IF NOT EXISTS is_tech_debt boolean DEFAULT false;

COMMENT ON COLUMN public.issues.definition_of_done IS 'Checklist of items that must be completed before an issue is marked as Done.';
COMMENT ON COLUMN public.issues.is_tech_debt IS 'Flag indicating if the issue is considered technical debt or refactoring.';
