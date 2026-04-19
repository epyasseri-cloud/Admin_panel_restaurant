create type app.order_status as enum ('pendiente', 'en_preparacion', 'listo', 'servido', 'cancelado');

create table if not exists app.orders (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  waiter_id uuid not null references app.user_profiles (id),
  table_id text,
  customer_name text,
  status app.order_status not null default 'pendiente',
  total_amount numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references app.orders (id) on delete cascade,
  menu_item_id uuid references app.menu_items (id) on delete set null,
  name text not null,
  price numeric(10,2) not null check (price >= 0),
  qty integer not null check (qty > 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_orders_waiter_id on app.orders(waiter_id);
create index if not exists idx_orders_status on app.orders(status);
create index if not exists idx_orders_created_at on app.orders(created_at desc);
create index if not exists idx_order_items_order_id on app.order_items(order_id);

create trigger trg_orders_updated
before update on app.orders
for each row
execute function app.set_updated_at();

grant all on all tables in schema app to authenticated, service_role;
grant all on all sequences in schema app to authenticated, service_role;

alter default privileges in schema app
grant all on tables to authenticated, service_role;

alter default privileges in schema app
grant all on sequences to authenticated, service_role;

alter table app.orders enable row level security;
alter table app.order_items enable row level security;

drop policy if exists "admin manage orders" on app.orders;
create policy "admin manage orders"
on app.orders
for all
to authenticated
using (app.is_admin())
with check (app.is_admin());

drop policy if exists "admin manage order_items" on app.order_items;
create policy "admin manage order_items"
on app.order_items
for all
to authenticated
using (app.is_admin())
with check (app.is_admin());

drop policy if exists "waiter own orders read" on app.orders;
create policy "waiter own orders read"
on app.orders
for select
to authenticated
using (waiter_id = auth.uid());

drop policy if exists "waiter own orders create" on app.orders;
create policy "waiter own orders create"
on app.orders
for insert
to authenticated
with check (waiter_id = auth.uid());

drop policy if exists "waiter own order_items read" on app.order_items;
create policy "waiter own order_items read"
on app.order_items
for select
to authenticated
using (
  exists (
    select 1
    from app.orders o
    where o.id = order_id and o.waiter_id = auth.uid()
  )
);
