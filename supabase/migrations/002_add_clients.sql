-- =====================================================================
-- CommandCenter — Migration 002: Add Clients & Product Lines
-- Run this in your Supabase SQL Editor
-- =====================================================================

-- 1. Create the clients table
create table if not exists public.clients (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  product_line text not null check (product_line in ('VU Gear', 'IP GEAR', 'EB GEAR')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Add auto set_updated_at trigger
create trigger set_updated_at before update on public.clients
  for each row execute function public.handle_updated_at();

-- 3. Add client reference column to projects
alter table public.projects 
  add column if not exists client_id uuid references public.clients(id) on delete set null;

-- 4. Enable Row Level Security (RLS) on clients
alter table public.clients enable row level security;

-- 5. Create RLS allow_all policy for clients (single-user desktop app model)
create policy "allow_all" on public.clients for all using (true) with check (true);

-- 6. Seed initial template clients (optional, provides rich immediate layout context)
insert into public.clients (name, product_line) values
  ('Apex Retail Solutions', 'VU Gear'),
  ('Horizon Communications', 'VU Gear'),
  ('Centric Financials', 'IP GEAR'),
  ('Vector Healthcare Systems', 'IP GEAR'),
  ('Summit Logistics', 'EB GEAR'),
  ('Nova Energy Grid', 'EB GEAR')
on conflict do nothing;
