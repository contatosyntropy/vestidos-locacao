-- Execute no SQL Editor do Supabase antes de usar os novos campos no sistema.
alter table public.rental_orders
  add column if not exists adjustments text not null default '',
  add column if not exists adjustment_status text not null default 'pendente';

alter table public.rental_orders
  drop constraint if exists rental_orders_adjustment_status_check;

alter table public.rental_orders
  add constraint rental_orders_adjustment_status_check
  check (adjustment_status in ('pendente', 'feito'));
