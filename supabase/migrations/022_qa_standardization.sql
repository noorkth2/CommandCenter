-- Epic 2: Standardized QA Templates and Metrics
-- Separates severity (technical impact) from priority (business urgency) in issues and qa_items.

-- 1. Update issues table
ALTER TABLE public.issues
ADD COLUMN IF NOT EXISTS severity text DEFAULT 'medium'
  CHECK (severity IN ('critical', 'high', 'medium', 'low'));

COMMENT ON COLUMN public.issues.severity IS 'Technical impact of the issue: critical, high, medium, low.';
COMMENT ON COLUMN public.issues.priority IS 'Business urgency of the issue: p0 (Highest) to p3 (Lowest).';

-- 2. Update qa_items table
ALTER TABLE public.qa_items
ADD COLUMN IF NOT EXISTS priority text DEFAULT 'p2'
  CHECK (priority IN ('p0', 'p1', 'p2', 'p3'));

COMMENT ON COLUMN public.qa_items.priority IS 'Business urgency of the defect: p0 (Highest) to p3 (Lowest).';
COMMENT ON COLUMN public.qa_items.severity IS 'Technical impact of the defect: critical, high, medium, low.';
