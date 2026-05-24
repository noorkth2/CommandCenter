-- =====================================================================
-- CommandCenter — Initial Schema
-- Run this in Supabase SQL Editor
-- =====================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- =====================
-- PROJECTS
-- =====================
create table public.projects (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  status text not null default 'active'
    check (status in ('active', 'on_hold', 'completed', 'blocked')),
  priority text not null default 'p2'
    check (priority in ('p0', 'p1', 'p2', 'p3')),
  category text
    check (category in ('fyp', 'coursework', 'client', 'personal')),
  tech_stack text[] default '{}',
  deadline date,
  running boolean default true,
  description text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =====================
-- ISSUES (replaces Linear)
-- =====================
create table public.issues (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  status text not null default 'backlog'
    check (status in (
      'backlog', 'todo', 'in_progress', 'testing',
      'uat', 'ready_to_deploy', 'production', 'monitoring', 'done', 'cancelled'
    )),
  priority text not null default 'p2'
    check (priority in ('p0', 'p1', 'p2', 'p3')),
  labels text[] default '{}',
  project_id uuid references public.projects(id) on delete set null,
  sprint_id uuid,  -- FK added after sprints table
  steps_to_reproduce text,
  expected_result text,
  actual_result text,
  environment text check (environment in ('local', 'staging', 'production')),
  assignee text,
  team text check (team in ('backend', 'frontend', 'qa', 'ops')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  completed_at timestamptz
);

-- =====================
-- QA TRACKER
-- =====================
create table public.qa_items (
  id uuid primary key default uuid_generate_v4(),
  test_case text not null,
  project_id uuid references public.projects(id) on delete set null,
  issue_id uuid references public.issues(id) on delete set null,
  module text,
  test_type text check (test_type in ('functional', 'ui', 'integration', 'regression', 'edge_case')),
  severity text not null default 'medium'
    check (severity in ('critical', 'high', 'medium', 'low')),
  status text not null default 'to_test'
    check (status in ('to_test', 'in_progress', 'pass', 'fail', 'blocked')),
  steps_to_reproduce text,
  expected_result text,
  actual_result text,
  environment text check (environment in ('local', 'staging', 'production')),
  notes text,
  tested_on date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =====================
-- DEPLOYMENTS
-- =====================
create table public.deployments (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  project_id uuid references public.projects(id) on delete set null,
  environment text not null
    check (environment in ('dev', 'staging', 'production')),
  status text not null default 'planned'
    check (status in ('planned', 'in_progress', 'success', 'failed', 'rolled_back')),
  services_affected text[] default '{}',
  rollback_plan text,
  expected_downtime text,
  notes text,
  deployed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =====================
-- SPRINTS
-- =====================
create table public.sprints (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  status text not null default 'upcoming'
    check (status in ('upcoming', 'active', 'completed')),
  start_date date,
  end_date date,
  goals text,
  ai_summary text,
  completed_tasks_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Add FK from issues to sprints
alter table public.issues
  add constraint issues_sprint_id_fkey
  foreign key (sprint_id) references public.sprints(id) on delete set null;

-- =====================
-- AI REPORTS
-- =====================
create table public.ai_reports (
  id uuid primary key default uuid_generate_v4(),
  type text not null
    check (type in ('rca', 'sprint_summary', 'deployment_note', 'test_summary')),
  title text not null,
  content text not null,
  related_id uuid,
  related_type text,
  is_draft boolean default true,
  created_at timestamptz default now()
);

-- =====================
-- AUTOMATIONS
-- =====================
create table public.automations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  enabled boolean default true,
  trigger_type text not null
    check (trigger_type in ('issue_created', 'issue_status_changed', 'deployment_completed', 'schedule')),
  trigger_config jsonb default '{}',
  action_type text not null
    check (action_type in ('create_qa_entry', 'send_email', 'generate_ai_report', 'create_notion_page')),
  action_config jsonb default '{}',
  last_triggered_at timestamptz,
  trigger_count integer default 0,
  created_at timestamptz default now()
);

-- Seed built-in automations
insert into public.automations (name, description, enabled, trigger_type, trigger_config, action_type, action_config) values
  (
    'Bug → QA Entry',
    'Automatically creates a QA test entry when an issue is created with the "bug" label',
    true,
    'issue_created',
    '{"labels": ["bug"]}',
    'create_qa_entry',
    '{"severity": "high", "status": "to_test"}'
  ),
  (
    'Deployment → Email Notification',
    'Sends an email when a production deployment is completed',
    true,
    'deployment_completed',
    '{"environment": "production"}',
    'send_email',
    '{"subject_template": "Deployed: {name}"}'
  ),
  (
    'Daily Sprint Summary',
    'Generates an AI sprint summary every night at 11pm',
    true,
    'schedule',
    '{"cron": "0 23 * * *"}',
    'generate_ai_report',
    '{"report_type": "sprint_summary"}'
  ),
  (
    'Critical Issue → RCA Draft',
    'Auto-generates an RCA draft when a critical issue is created',
    true,
    'issue_created',
    '{"labels": ["critical"]}',
    'generate_ai_report',
    '{"report_type": "rca"}'
  );

-- =====================
-- SETTINGS
-- =====================
create table public.settings (
  key text primary key,
  value text,
  updated_at timestamptz default now()
);

insert into public.settings (key, value) values
  ('claude_api_key', ''),
  ('smtp_host', ''),
  ('smtp_port', '587'),
  ('smtp_user', ''),
  ('smtp_pass', ''),
  ('notification_email', ''),
  ('daily_summary_enabled', 'true'),
  ('daily_summary_time', '23:00');

-- =====================
-- UPDATED_AT TRIGGERS
-- =====================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on public.projects
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.issues
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.qa_items
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.deployments
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.sprints
  for each row execute function public.handle_updated_at();

-- =====================
-- ROW LEVEL SECURITY
-- (enabled but allow-all for single-user desktop app)
-- =====================
alter table public.projects enable row level security;
alter table public.issues enable row level security;
alter table public.qa_items enable row level security;
alter table public.deployments enable row level security;
alter table public.sprints enable row level security;
alter table public.ai_reports enable row level security;
alter table public.automations enable row level security;
alter table public.settings enable row level security;

create policy "allow_all" on public.projects for all using (true) with check (true);
create policy "allow_all" on public.issues for all using (true) with check (true);
create policy "allow_all" on public.qa_items for all using (true) with check (true);
create policy "allow_all" on public.deployments for all using (true) with check (true);
create policy "allow_all" on public.sprints for all using (true) with check (true);
create policy "allow_all" on public.ai_reports for all using (true) with check (true);
create policy "allow_all" on public.automations for all using (true) with check (true);
create policy "allow_all" on public.settings for all using (true) with check (true);
