-- Esquema inicial. Revise e aplique no SQL Editor do projeto Supabase.
-- IMPORTANTE: este projeto ainda não tem autenticação. Não publique dados reais
-- nem habilite acesso anônimo irrestrito. Configure login/PIN e políticas RLS antes
-- de inserir CPF ou outros dados pessoais.

create extension if not exists btree_gist;

create type public.rental_order_status as enum ('rascunho', 'confirmado', 'cancelado');
create type public.fitting_status as enum ('pendente', 'agendada', 'realizada');

create table public.rental_orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_cpf text not null,
  dress_description text not null,
  dress_code text not null,
  rental_confirmed_at date not null default current_date,
  event_date date not null,
  attendant text not null,
  total_amount numeric(10,2) not null check (total_amount >= 0),
  status public.rental_order_status not null default 'confirmado',
  fitting_status public.fitting_status not null default 'pendente',
  fitting_date date generated always as (event_date - 25) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_date_after_confirmation check (event_date >= rental_confirmed_at)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.rental_orders(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  paid_at date not null default current_date,
  method text not null default 'não informado',
  notes text,
  created_at timestamptz not null default now()
);

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.rental_orders(id) on delete cascade,
  template_version text not null default 'draft-1',
  generated_at timestamptz,
  storage_path text,
  status text not null default 'rascunho' check (status in ('rascunho', 'revisado', 'assinado')),
  created_at timestamptz not null default now()
);

create table public.notification_log (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.rental_orders(id) on delete cascade,
  notification_type text not null,
  sent_for_date date not null default current_date,
  sent_at timestamptz not null default now(),
  unique (order_id, notification_type, sent_for_date)
);

create index rental_orders_event_date_idx on public.rental_orders(event_date);
create index rental_orders_dress_code_idx on public.rental_orders(dress_code);
create index rental_orders_fitting_idx on public.rental_orders(fitting_status, fitting_date);
create index payments_order_id_idx on public.payments(order_id);

-- Bloqueio de disponibilidade: confirmado bloqueia do evento - 10 dias até + 10 dias,
-- inclusive. A exclusão por intervalo impede sobreposição para a mesma peça.
-- A constraint usa daterange com limite superior exclusivo (+11 dias) para incluir
-- o décimo dia posterior ao evento.
alter table public.rental_orders
  add constraint no_overlapping_confirmed_rentals
  exclude using gist (
    dress_code with =,
    daterange(event_date - 10, event_date + 11, '[)') with &&
  )
  where (status = 'confirmado');

-- Atualiza updated_at em mudanças.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger rental_orders_updated_at
before update on public.rental_orders
for each row execute function public.set_updated_at();

-- RLS é ativado por padrão, sem policies abertas.
-- Isso significa que a aplicação não conseguirá ler/gravar até a configuração
-- segura de autenticação e policies ser feita.
alter table public.rental_orders enable row level security;
alter table public.payments enable row level security;
alter table public.contracts enable row level security;
alter table public.notification_log enable row level security;

-- NÃO crie policy "using (true)" para anon em produção: os pedidos contêm CPF.
-- Próxima etapa: decidir acesso (login por usuário ou PIN/backend controlado),
-- depois criar policies mínimas de leitura/gravação.
