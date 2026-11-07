-- Initial schema for Moota Webhook Testing Lab V1.
-- Applied automatically by scripts/migrate.mjs on Vercel Production deployments.

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique,
  customer_name text,
  description text,
  amount bigint not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'unmatched', 'cancelled')),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  matched_mutation_id text,
  match_method text
);

create table if not exists public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'moota',
  received_at timestamptz not null default now(),
  signature_valid boolean not null default false,
  headers jsonb not null default '{}'::jsonb,
  payload jsonb not null,
  item_count integer not null default 0,
  processed_count integer not null default 0,
  status text not null default 'received',
  error_message text
);

create table if not exists public.moota_mutations (
  id uuid primary key default gen_random_uuid(),
  mutation_id text not null unique,
  bank_id text,
  account_number text,
  bank_type text,
  mutation_date text,
  amount bigint not null,
  type text not null check (type in ('CR', 'DB')),
  balance bigint,
  description text,
  note text,
  payload jsonb not null,
  delivery_id uuid references public.webhook_deliveries(id) on delete set null,
  transaction_id uuid references public.transactions(id) on delete set null,
  match_status text not null default 'unmatched' check (match_status in ('unmatched', 'matched')),
  received_at timestamptz not null default now()
);

create index if not exists transactions_status_amount_idx on public.transactions(status, amount);
create index if not exists transactions_created_at_idx on public.transactions(created_at desc);
create index if not exists webhook_deliveries_received_at_idx on public.webhook_deliveries(received_at desc);
create index if not exists moota_mutations_received_at_idx on public.moota_mutations(received_at desc);
create index if not exists moota_mutations_transaction_id_idx on public.moota_mutations(transaction_id);

alter table public.transactions enable row level security;
alter table public.webhook_deliveries enable row level security;
alter table public.moota_mutations enable row level security;
