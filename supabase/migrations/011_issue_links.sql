-- 011_issue_links.sql
-- Table for linking issues to create relationships (blocks, blocked_by, duplicate, related)

CREATE TABLE IF NOT EXISTS public.issue_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  linked_issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL CHECK (link_type IN ('blocks', 'blocked_by', 'duplicate', 'related')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(issue_id, linked_issue_id, link_type)
);

CREATE INDEX IF NOT EXISTS idx_issue_links_issue_id ON public.issue_links(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_links_linked_issue_id ON public.issue_links(linked_issue_id);

-- Enable updated_at trigger
DROP TRIGGER IF EXISTS set_updated_at ON public.issue_links;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.issue_links
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Enable Row Level Security (allow all policy for simple single-user apps)
ALTER TABLE public.issue_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS allow_all ON public.issue_links;
CREATE POLICY "allow_all" ON public.issue_links FOR ALL USING (true) WITH CHECK (true);
