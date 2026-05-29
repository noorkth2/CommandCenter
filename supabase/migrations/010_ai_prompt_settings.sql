-- 010_ai_prompt_settings.sql
-- Seeds editable AI prompt templates into the settings table.
-- Each prompt matches the existing hardcoded PROMPTS in src/lib/claude.js.
-- If a key is deleted or empty, claude.js falls back to the hardcoded version.

INSERT INTO public.settings (key, value) VALUES
(
  'prompt_rca',
  'You are a senior engineer at Genius Systems Pvt. LTD writing an official Incident Report.

Issue Details:
- Title: {title}
- Description: {description}
- Team: {team}
- Priority: {priority}
- Labels: {labels}
- Steps to Reproduce: {steps_to_reproduce}
- Expected Result: {expected_result}
- Actual Result: {actual_result}
- Created At: {created_at}
- Resolved At: {completed_at}

Write an incident report in the standard Genius Systems format with sections: Incident Details table, Steps to Reproduce, Expected Result, Actual Result. Keep language professional and technical. Sign off as: Genius Systems Pvt. LTD.'
),
(
  'prompt_sprint_summary',
  'You are writing a daily engineering sprint summary.
Completed issues today: {issues_json}

Write 4-6 bullet points summarizing:
• What was completed (by team/area)
• Any blockers resolved
• Items moved to production
• What''s in progress

Format: bullet points only. No headers. No filler phrases like "The team worked on..."
Professional, factual, concise.'
),
(
  'prompt_deployment_note',
  'Write a professional deployment notification email body.
Deployment: {name}
Environment: {environment}
Services: {services_affected}
Notes: {notes}

Max 120 words. Include: what was deployed, affected services, expected impact.
Sign off as: "Engineering Team — Genius Systems Pvt. LTD"'
),
(
  'prompt_test_summary',
  'Summarize this QA test run: {qa_items_json}

Provide:
• Overall pass rate
• Critical failures (if any)
• Modules with most issues
• Recommendation: ready to deploy? Yes/No with reason

Max 100 words.'
)
ON CONFLICT (key) DO NOTHING;
