-- Migration: order item customizations support
-- Date: 2026-04-19
-- Adds extras, exclusions, allergy_notes, kitchen_notes, notes, updated_at
-- to app.order_items, and enables item-level editing with RLS policies.

begin;

-- 1) Extend app.order_items with customization columns
alter table app.order_items
  add column if not exists extras       jsonb       not null default '[]'::jsonb,
  add column if not exists exclusions   jsonb       not null default '[]'::jsonb,
  add column if not exists allergy_notes text       null,
  add column if not exists kitchen_notes text       null,
  add column if not exists notes         text       null,
  add column if not exists updated_at   timestamptz not null default now();

-- 2) updated_at auto-trigger for order_items (reuses existing app.set_updated_at)
drop trigger if exists trg_order_items_updated on app.order_items;
create trigger trg_order_items_updated
before update on app.order_items
for each row
execute function app.set_updated_at();

-- 3) updated_by on orders (tracks who last edited items)
alter table app.orders
  add column if not exists updated_by uuid null references app.user_profiles(id) on delete set null;

-- 4) Backfill: seed kitchen_notes from notes where unset
update app.order_items
set kitchen_notes = notes
where kitchen_notes is null
  and notes is not null
  and length(trim(notes)) > 0;

-- 5) RLS: waiter can update own order items only when order is in an editable state
drop policy if exists "waiter own order_items update" on app.order_items;
create policy "waiter own order_items update"
on app.order_items
for update
to authenticated
using (
  exists (
    select 1
    from app.orders o
    where o.id = order_id
      and o.waiter_id = auth.uid()
      and o.status in ('pendiente', 'en_preparacion')
  )
);

-- 6) RLS: waiter can delete own order items (needed for replace-all-items pattern)
drop policy if exists "waiter own order_items delete" on app.order_items;
create policy "waiter own order_items delete"
on app.order_items
for delete
to authenticated
using (
  exists (
    select 1
    from app.orders o
    where o.id = order_id
      and o.waiter_id = auth.uid()
      and o.status in ('pendiente', 'en_preparacion')
  )
);

-- 7) RLS: waiter can insert order items for own orders (needed for replace-all-items)
drop policy if exists "waiter own order_items insert" on app.order_items;
create policy "waiter own order_items insert"
on app.order_items
for insert
to authenticated
with check (
  exists (
    select 1
    from app.orders o
    where o.id = order_id
      and o.waiter_id = auth.uid()
  )
);

commit;
