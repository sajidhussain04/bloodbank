-- Jhar Jeevan Blood Bank - Supabase PostgreSQL schema
-- Jhar Jeevan Blood Bank database schema for Supabase PostgreSQL.

create extension if not exists pgcrypto;

create table if not exists public.admins (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  name text not null default 'Administrator',
  phone text,
  reset_token_hash text,
  reset_token_expires timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.donors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  age integer not null check (age between 18 and 65),
  blood_group text not null check (blood_group in ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  phone text not null unique,
  email text,
  location text not null,
  last_donation_date timestamptz,
  is_available boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.blood_requests (
  id uuid primary key default gen_random_uuid(),
  patient_name text not null,
  blood_group text not null check (blood_group in ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  units_required integer not null check (units_required between 1 and 10),
  hospital_name text not null,
  hospital_address text not null,
  city text not null,
  required_date timestamptz not null,
  requester_name text not null,
  requester_phone text not null,
  requester_email text,
  status text not null default 'Pending' check (status in ('Pending','Approved','Completed','Rejected')),
  priority text not null default 'Normal' check (priority in ('Normal','Urgent')),
  priority_rank integer not null default 1 check (priority_rank in (0,1)),
  notes text,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists donors_blood_group_idx on public.donors (blood_group);
create index if not exists donors_available_idx on public.donors (is_available);
create index if not exists donors_created_at_idx on public.donors (created_at desc);
create index if not exists blood_requests_blood_group_idx on public.blood_requests (blood_group);
create index if not exists blood_requests_status_idx on public.blood_requests (status);
create index if not exists blood_requests_priority_idx on public.blood_requests (priority_rank, created_at desc);
create index if not exists blood_requests_created_at_idx on public.blood_requests (created_at desc);

-- Keep the tables protected from direct browser access. The Express API uses
-- the Supabase service-role key server-side and therefore bypasses these policies.
alter table public.admins enable row level security;
alter table public.donors enable row level security;
alter table public.blood_requests enable row level security;

-- Explicitly revoke direct table access from public API roles. This makes the
-- Express API the only application data access path for this project.
revoke all on table public.admins from anon, authenticated;
revoke all on table public.donors from anon, authenticated;
revoke all on table public.blood_requests from anon, authenticated;

-- Useful read-only view for future reporting. It is intentionally not exposed
-- to anon/authenticated roles.
create or replace view public.blood_group_summary
with (security_invoker = true) as
select
  bg.blood_group,
  coalesce(d.donor_count, 0)::bigint as donor_count,
  coalesce(r.pending_units, 0)::bigint as pending_units,
  coalesce(r.approved_units, 0)::bigint as approved_units
from (values ('A+'),('A-'),('B+'),('B-'),('AB+'),('AB-'),('O+'),('O-')) as bg(blood_group)
left join (
  select blood_group, count(*) as donor_count
  from public.donors
  group by blood_group
) d on d.blood_group = bg.blood_group
left join (
  select
    blood_group,
    sum(case when status = 'Pending' then units_required else 0 end) as pending_units,
    sum(case when status = 'Approved' then units_required else 0 end) as approved_units
  from public.blood_requests
  group by blood_group
) r on r.blood_group = bg.blood_group;

revoke all on public.blood_group_summary from anon, authenticated;
