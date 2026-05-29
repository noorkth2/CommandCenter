-- 015_remove_notion_constraint.sql
-- Removes create_notion_page from the automations.action_type constraint.
-- The Notion integration was never implemented; removing dead DB-level enum entry.

ALTER TABLE public.automations
  DROP CONSTRAINT IF EXISTS automations_action_type_check;

ALTER TABLE public.automations
  ADD CONSTRAINT automations_action_type_check
  CHECK (action_type IN ('create_qa_entry', 'send_email', 'generate_ai_report'));

-- Remove any existing automations that used the notion action type
-- (soft fail: wrap in DO block so it doesn't break if table is empty)
DO $$
BEGIN
  DELETE FROM public.automations WHERE action_type = 'create_notion_page';
END $$;
