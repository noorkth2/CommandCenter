-- =====================================================================
-- CommandCenter — Migration 003: Add Products (Dynamic Product Lines)
-- Run this in your Supabase SQL Editor
-- =====================================================================

-- 1. Create the products table
create table if not exists public.products (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Add auto set_updated_at trigger for products
create trigger set_updated_at before update on public.products
  for each row execute function public.handle_updated_at();

-- 3. Enable Row Level Security (RLS) on products
alter table public.products enable row level security;
create policy "allow_all" on public.products for all using (true) with check (true);

-- 4. Seed initial default products (formerly hardcoded product lines)
insert into public.products (name, description) values
  ('VU Gear', 'Virtual Reality and visual gear product line'),
  ('IP GEAR', 'Internet Protocol and networking gear product line'),
  ('EB GEAR', 'Enterprise Broadcast and media transmission gear product line')
on conflict (name) do nothing;

-- 5. Modify clients table to link to products
alter table public.clients 
  add column if not exists product_id uuid references public.products(id) on delete cascade;

-- Link existing clients to their products based on text matching of product_line (if product_line column exists)
do $$
begin
  if exists (
    select 1 
    from information_schema.columns 
    where table_schema = 'public' 
      and table_name = 'clients' 
      and column_name = 'product_line'
  ) then
    update public.clients c
    set product_id = p.id
    from public.products p
    where c.product_line = p.name;
    
    -- Drop check constraint and column
    alter table public.clients drop constraint if exists clients_product_line_check;
    alter table public.clients drop column if exists product_line;
  end if;
end $$;
