-- ============================================================
-- JharJeevan Blood Bank
-- Client Dashboard Foundation
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- CLIENT USERS
-- ============================================================

create table if not exists public.client_users (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    email text not null unique,
    password_hash text not null,
    phone text,
    blood_group text check (
        blood_group is null
        or blood_group in ('A+','A-','B+','B-','AB+','AB-','O+','O-')
    ),
    location text,
    is_active boolean not null default true,
    last_login_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- If an existing client_users table is already present,
-- make sure the columns required by the current API exist.

alter table public.client_users
    add column if not exists name text;

alter table public.client_users
    add column if not exists email text;

alter table public.client_users
    add column if not exists password_hash text;

alter table public.client_users
    add column if not exists phone text;

alter table public.client_users
    add column if not exists blood_group text;

alter table public.client_users
    add column if not exists location text;

alter table public.client_users
    add column if not exists is_active boolean default true;

alter table public.client_users
    add column if not exists last_login_at timestamptz;

alter table public.client_users
    add column if not exists created_at timestamptz default now();

alter table public.client_users
    add column if not exists updated_at timestamptz default now();

create unique index if not exists client_users_email_idx
    on public.client_users (lower(email));

create index if not exists client_users_active_idx
    on public.client_users (is_active);

create index if not exists client_users_created_at_idx
    on public.client_users (created_at desc);

-- ============================================================
-- BLOOD REQUEST OWNERSHIP
-- ============================================================

alter table public.blood_requests
    add column if not exists client_user_id uuid;

create index if not exists blood_requests_client_user_idx
    on public.blood_requests (client_user_id);

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'blood_requests_client_user_id_fkey'
    ) then
        alter table public.blood_requests
            add constraint blood_requests_client_user_id_fkey
            foreign key (client_user_id)
            references public.client_users(id)
            on delete set null;
    end if;
end
$$;

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

create table if not exists public.notifications (
    id uuid primary key default gen_random_uuid(),

    recipient_type text not null
        check (recipient_type in ('client', 'admin')),

    recipient_id uuid not null,

    type text not null,

    title text not null,

    message text not null,

    data jsonb not null default '{}'::jsonb,

    is_read boolean not null default false,

    created_at timestamptz not null default now(),

    read_at timestamptz
);

create index if not exists notifications_recipient_idx
    on public.notifications (recipient_type, recipient_id, created_at desc);

create index if not exists notifications_unread_idx
    on public.notifications (recipient_type, recipient_id, is_read, created_at desc);

-- ============================================================
-- EMAIL SUBSCRIBERS
-- ============================================================

create table if not exists public.email_subscribers (
    id uuid primary key default gen_random_uuid(),

    email text not null unique,

    name text,

    is_active boolean not null default true,

    subscribed_at timestamptz not null default now(),

    unsubscribed_at timestamptz
);

create unique index if not exists email_subscribers_email_idx
    on public.email_subscribers (lower(email));

create index if not exists email_subscribers_active_idx
    on public.email_subscribers (is_active);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists client_users_set_updated_at
on public.client_users;

create trigger client_users_set_updated_at
before update on public.client_users
for each row
execute function public.set_updated_at();

-- ============================================================
-- SECURITY
-- ============================================================

alter table public.client_users enable row level security;
alter table public.notifications enable row level security;
alter table public.email_subscribers enable row level security;

-- The Express API uses the server-side Supabase service-role key.
-- Browser clients must not directly access these tables.

revoke all on table public.client_users from anon, authenticated;
revoke all on table public.notifications from anon, authenticated;
revoke all on table public.email_subscribers from anon, authenticated;

-- Client-owned request data will also remain behind the Express API.
revoke all on table public.blood_requests from anon, authenticated;

-- ============================================================
-- DONE
-- ============================================================
