-- Run once in the Supabase SQL editor (or with `supabase db push`).
-- All reads and writes go through the Next.js server with the service role key,
-- so RLS is on with no policies: the public anon key can't touch any table.

create table restaurants (
  id text primary key,                 -- slug used in the QR link: /r/<id>
  name text not null,
  source_url text,                     -- the site it was scraped from, null for the seed
  menu jsonb not null,                 -- the shared menu format, see src/lib/menu.ts
  scraped_at timestamptz,              -- last successful scrape, for the #3 fallback
  created_at timestamptz not null default now()
);

-- One per diner. Starts anonymous (id stored on the phone); #5 links a phone number.
create table diner_profiles (
  id uuid primary key default gen_random_uuid(),
  phone text unique,                   -- unverified, set when the diner opts in
  display_name text,
  preferences jsonb not null default '[]'::jsonb,  -- shape decided in #5
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id text not null references restaurants (id) on delete cascade,
  diner_id uuid references diner_profiles (id) on delete set null,
  mode text not null check (mode in ('table', 'pickup', 'delivery')),
  table_number text,
  items jsonb not null,                -- [{ item_id, name, quantity, price, notes? }]
  notes text,
  created_at timestamptz not null default now()
);

create index orders_restaurant_created_idx on orders (restaurant_id, created_at desc);
create index orders_diner_idx on orders (diner_id);

alter table restaurants enable row level security;
alter table diner_profiles enable row level security;
alter table orders enable row level security;
