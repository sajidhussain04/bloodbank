-- ============================================================
-- JHARJEEVAN CLIENT PASSWORD RESET
-- ============================================================

create table if not exists public.client_password_resets (
    id uuid primary key default gen_random_uuid(),

    client_id text not null,

    token_hash text not null unique,

    expires_at timestamptz not null,

    used_at timestamptz,

    created_at timestamptz not null default now()
);

create index if not exists idx_client_password_resets_client
    on public.client_password_resets(client_id);

create index if not exists idx_client_password_resets_expires
    on public.client_password_resets(expires_at);

create index if not exists idx_client_password_resets_active
    on public.client_password_resets(client_id, expires_at)
    where used_at is null;

alter table public.client_password_resets enable row level security;

revoke all on public.client_password_resets from anon;
revoke all on public.client_password_resets from authenticated;

grant all on public.client_password_resets to service_role;

comment on table public.client_password_resets is
    'Secure single-use password reset tokens for JharJeevan client accounts.';
