-- Ledger agent schema. The app talks to these tables with the service-role key from the server only;
-- row level security is on with no policies, so the public anon key cannot read anything.

create table if not exists public.app_state (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.ledger_entries (
  id text primary key,
  date text not null,
  vendor text not null,
  description text not null default '',
  amount numeric(14, 2) not null,
  po_number text,
  reference text,
  created_at timestamptz not null default now()
);

create table if not exists public.runs (
  id text primary key,
  title text not null,
  instruction text not null,
  status text not null,
  provider text not null,
  model text not null,
  usage jsonb not null default '{}'::jsonb,
  plan jsonb not null default '[]'::jsonb,
  events jsonb not null default '[]'::jsonb,
  browser jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id text primary key,
  run_id text,
  type text not null,
  vendor text not null,
  number text not null,
  date text,
  due_date text,
  amount numeric(14, 2),
  currency text not null default 'USD',
  po_number text,
  reference text,
  line_items jsonb not null default '[]'::jsonb,
  source_url text,
  file_name text,
  sail_path text,
  status text not null,
  ledger_id text,
  match_confidence text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.issues (
  id text primary key,
  run_id text,
  kind text not null,
  severity text not null,
  title text not null,
  detail text not null default '',
  ledger_id text,
  document_ids text[] not null default '{}',
  status text not null default 'open',
  created_at timestamptz not null default now()
);

-- Passwords are encrypted by the app (AES-256-GCM) before they reach this table.
create table if not exists public.vault_entries (
  id text primary key,
  name text not null,
  url text not null default '',
  username text not null default '',
  password_ciphertext text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists documents_ledger_id_idx on public.documents (ledger_id);
create index if not exists documents_run_id_idx on public.documents (run_id);
create index if not exists issues_status_idx on public.issues (status);
create index if not exists runs_created_at_idx on public.runs (created_at desc);

alter table public.app_state enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.runs enable row level security;
alter table public.documents enable row level security;
alter table public.issues enable row level security;
alter table public.vault_entries enable row level security;

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
