-- Physical blood stock, stock movement audit, and atomic request issuance.
-- Donor records are not physical blood inventory.

create table if not exists public.blood_inventory (
  blood_group text primary key
    check (blood_group in ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  units_available integer not null default 0
    check (units_available >= 0),
  updated_at timestamptz not null default now()
);

insert into public.blood_inventory (blood_group, units_available)
values
  ('A+', 0), ('A-', 0), ('B+', 0), ('B-', 0),
  ('AB+', 0), ('AB-', 0), ('O+', 0), ('O-', 0)
on conflict (blood_group) do nothing;

create table if not exists public.blood_issuances (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique
    references public.blood_requests(id) on delete restrict,
  blood_group text not null
    check (blood_group in ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  units_issued integer not null check (units_issued > 0),
  issued_by text not null,
  issued_at timestamptz not null default now()
);

create index if not exists blood_issuances_issued_at_idx
  on public.blood_issuances (issued_at desc);

create table if not exists public.blood_inventory_movements (
  id uuid primary key default gen_random_uuid(),
  blood_group text not null
    check (blood_group in ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  units_delta integer not null check (units_delta <> 0),
  movement_type text not null
    check (movement_type in ('stock_added','blood_issued')),
  request_id uuid references public.blood_requests(id) on delete restrict,
  performed_by text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists blood_inventory_movements_created_at_idx
  on public.blood_inventory_movements (created_at desc);

alter table public.blood_inventory enable row level security;
alter table public.blood_issuances enable row level security;
alter table public.blood_inventory_movements enable row level security;

revoke all on table public.blood_inventory from anon, authenticated;
revoke all on table public.blood_issuances from anon, authenticated;
revoke all on table public.blood_inventory_movements from anon, authenticated;

-- Only the trusted server-side service role can call these functions.
create or replace function public.add_blood_inventory(
  p_blood_group text,
  p_units integer,
  p_performed_by text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_units integer;
begin
  if p_blood_group is null
     or p_blood_group not in ('A+','A-','B+','B-','AB+','AB-','O+','O-') then
    raise exception 'Invalid blood group';
  end if;

  if p_units is null or p_units < 1 or p_units > 100000 then
    raise exception 'Units to add must be between 1 and 100000';
  end if;

  if nullif(trim(p_performed_by), '') is null then
    raise exception 'Administrator identity is required';
  end if;

  insert into public.blood_inventory (blood_group, units_available, updated_at)
  values (p_blood_group, p_units, now())
  on conflict (blood_group) do update
    set units_available = public.blood_inventory.units_available + excluded.units_available,
        updated_at = now()
    where public.blood_inventory.units_available <= 2147483647 - excluded.units_available
  returning units_available into v_units;

  if not found then
    raise exception 'Adding these units would exceed the maximum supported stock total';
  end if;

  insert into public.blood_inventory_movements (
    blood_group, units_delta, movement_type, performed_by, note
  )
  values (
    p_blood_group, p_units, 'stock_added', trim(p_performed_by),
    nullif(trim(coalesce(p_note, '')), '')
  );

  return jsonb_build_object(
    'success', true,
    'blood_group', p_blood_group,
    'units_available', v_units
  );
end;
$$;

-- Issue the full requested quantity exactly once.
-- The request row lock prevents concurrent duplicate issuance.
-- Approval itself never deducts stock.
create or replace function public.issue_blood_request(
  p_request_id uuid,
  p_issued_by text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.blood_requests%rowtype;
  v_stock integer;
begin
  if p_request_id is null then
    raise exception 'Request ID is required';
  end if;

  if nullif(trim(p_issued_by), '') is null then
    raise exception 'Administrator identity is required';
  end if;

  select *
    into v_request
    from public.blood_requests
   where id = p_request_id
   for update;

  if not found then
    raise exception 'Blood request not found';
  end if;

  if v_request.status <> 'Approved' then
    raise exception 'Only approved requests can be issued';
  end if;

  if exists (
    select 1 from public.blood_issuances
     where request_id = p_request_id
  ) then
    raise exception 'Blood has already been issued for this request';
  end if;

  select units_available
    into v_stock
    from public.blood_inventory
   where blood_group = v_request.blood_group
   for update;

  if not found then
    raise exception 'No inventory record exists for this blood group';
  end if;

  if v_stock < v_request.units_required then
    raise exception 'Insufficient physical stock for this request';
  end if;

  update public.blood_inventory
     set units_available = units_available - v_request.units_required,
         updated_at = now()
   where blood_group = v_request.blood_group;

  insert into public.blood_issuances (
    request_id, blood_group, units_issued, issued_by
  )
  values (
    v_request.id, v_request.blood_group, v_request.units_required,
    trim(p_issued_by)
  );

  insert into public.blood_inventory_movements (
    blood_group, units_delta, movement_type, request_id, performed_by, note
  )
  values (
    v_request.blood_group, -v_request.units_required, 'blood_issued',
    v_request.id, trim(p_issued_by), 'Issued against approved blood request'
  );

  update public.blood_requests
     set status = 'Completed'
   where id = v_request.id;

  return jsonb_build_object(
    'success', true,
    'request_id', v_request.id,
    'blood_group', v_request.blood_group,
    'units_issued', v_request.units_required,
    'units_remaining', v_stock - v_request.units_required,
    'status', 'Completed'
  );
end;
$$;

revoke all on function public.add_blood_inventory(text, integer, text, text)
  from public, anon, authenticated;
revoke all on function public.issue_blood_request(uuid, text)
  from public, anon, authenticated;

grant execute on function public.add_blood_inventory(text, integer, text, text)
  to service_role;
grant execute on function public.issue_blood_request(uuid, text)
  to service_role;

