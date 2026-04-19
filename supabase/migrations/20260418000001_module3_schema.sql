create extension if not exists pgcrypto;

create schema if not exists app;

create type app.user_role as enum ('waiter', 'kitchen', 'manager', 'admin');

create table if not exists app.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique not null,
  name text not null,
  role app.user_role not null default 'waiter',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app.menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(10,2) not null check (price > 0),
  category text not null,
  image text,
  estimated_prep_time integer,
  available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app.menu_item_ingredients (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references app.menu_items (id) on delete cascade,
  name text not null,
  allergen boolean not null default false
);

create table if not exists app.restaurant_settings (
  id uuid primary key default gen_random_uuid(),
  restaurant_name text not null,
  currency varchar(3) not null default 'USD',
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app.operating_hours (
  id uuid primary key default gen_random_uuid(),
  day text not null check (day in ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
  open_time time not null,
  close_time time not null,
  is_closed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app.restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  number integer not null unique,
  name text not null,
  capacity integer not null check (capacity > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references app.user_profiles (id),
  event_type text not null,
  resource_type text not null,
  resource_id text not null,
  changes jsonb not null default '{}'::jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists app.two_factor_challenges (
  id uuid primary key default gen_random_uuid(),
  challenge_id text not null unique,
  user_id uuid not null references app.user_profiles (id) on delete cascade,
  action text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function app.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_user_profiles_updated
before update on app.user_profiles
for each row
execute function app.set_updated_at();

create trigger trg_menu_items_updated
before update on app.menu_items
for each row
execute function app.set_updated_at();

create trigger trg_restaurant_settings_updated
before update on app.restaurant_settings
for each row
execute function app.set_updated_at();

create trigger trg_operating_hours_updated
before update on app.operating_hours
for each row
execute function app.set_updated_at();

create trigger trg_restaurant_tables_updated
before update on app.restaurant_tables
for each row
execute function app.set_updated_at();

create or replace function app.current_user_role()
returns app.user_role
language sql
stable
security definer
set search_path = app, public
as $$
  select role from app.user_profiles where id = auth.uid();
$$;

create or replace function app.is_admin()
returns boolean
language sql
stable
security definer
set search_path = app, public
as $$
  select coalesce(app.current_user_role() = 'admin', false);
$$;

grant usage on schema app to authenticated, service_role;
grant all on all tables in schema app to authenticated, service_role;
grant all on all sequences in schema app to authenticated, service_role;
grant execute on all functions in schema app to authenticated, service_role;

alter default privileges in schema app
grant all on tables to authenticated, service_role;

alter default privileges in schema app
grant all on sequences to authenticated, service_role;

alter default privileges in schema app
grant execute on functions to authenticated, service_role;

alter table app.user_profiles enable row level security;
alter table app.menu_items enable row level security;
alter table app.menu_item_ingredients enable row level security;
alter table app.restaurant_settings enable row level security;
alter table app.operating_hours enable row level security;
alter table app.restaurant_tables enable row level security;
alter table app.audit_logs enable row level security;
alter table app.two_factor_challenges enable row level security;

create policy "admin manage user_profiles"
on app.user_profiles
for all
to authenticated
using (app.is_admin())
with check (app.is_admin());

create policy "admin manage menu_items"
on app.menu_items
for all
to authenticated
using (app.is_admin())
with check (app.is_admin());

create policy "admin manage menu_item_ingredients"
on app.menu_item_ingredients
for all
to authenticated
using (app.is_admin())
with check (app.is_admin());

create policy "admin manage restaurant_settings"
on app.restaurant_settings
for all
to authenticated
using (app.is_admin())
with check (app.is_admin());

create policy "admin manage operating_hours"
on app.operating_hours
for all
to authenticated
using (app.is_admin())
with check (app.is_admin());

create policy "admin manage restaurant_tables"
on app.restaurant_tables
for all
to authenticated
using (app.is_admin())
with check (app.is_admin());

create policy "admin manage audit_logs"
on app.audit_logs
for all
to authenticated
using (app.is_admin())
with check (app.is_admin());

create policy "admin manage 2fa challenges"
on app.two_factor_challenges
for all
to authenticated
using (app.is_admin())
with check (app.is_admin());

insert into app.restaurant_settings (restaurant_name, currency, timezone)
select 'Admin Restaurant', 'USD', 'UTC'
where not exists (
  select 1 from app.restaurant_settings
);
