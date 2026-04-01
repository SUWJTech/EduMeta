create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  meta_coins integer not null default 100,
  compute_power integer not null default 100,
  focus_hours double precision not null default 0,
  academic double precision not null default 0,
  tech double precision not null default 0,
  social double precision not null default 0,
  building_style text not null default 'default' check (building_style in ('default', 'cyber_pagoda', 'void_monolith')),
  has_onboarded boolean not null default false,
  resonance_partners text[] not null default '{}'::text[],
  is_focusing boolean not null default false,
  focus_domain text check (focus_domain in ('academic', 'tech', 'social')),
  focus_started_at timestamptz,
  focus_duration_minutes integer check (focus_duration_minutes is null or focus_duration_minutes > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all"
on public.profiles
for select
to authenticated
using (true);

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create index if not exists profiles_focusing_idx
on public.profiles (is_focusing, focus_started_at desc);

create extension if not exists pgcrypto;

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_summary text not null,
  duration_minutes integer not null check (duration_minutes > 0),
  focus_spent double precision not null default 1,
  block_hash text not null,
  focus_tag text,
  is_online boolean not null default false,
  gained_compute integer not null default 0,
  gained_coins integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_user_created_idx on public.activity_logs (user_id, created_at desc);

alter table public.activity_logs enable row level security;

drop policy if exists "activity_logs_select_own" on public.activity_logs;
create policy "activity_logs_select_own"
on public.activity_logs
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "activity_logs_insert_self" on public.activity_logs;
create policy "activity_logs_insert_self"
on public.activity_logs
for insert
to authenticated
with check (auth.uid() = user_id);

create table if not exists public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  message text not null,
  cost integer not null default 5 check (cost >= 0),
  sender_label text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 seconds')
);

create index if not exists broadcasts_created_idx on public.broadcasts (created_at desc);
create index if not exists broadcasts_expires_idx on public.broadcasts (expires_at desc);

alter table public.broadcasts enable row level security;

drop policy if exists "broadcasts_select_authenticated" on public.broadcasts;
create policy "broadcasts_select_authenticated"
on public.broadcasts
for select
to authenticated
using (true);

drop policy if exists "broadcasts_insert_self" on public.broadcasts;
create policy "broadcasts_insert_self"
on public.broadcasts
for insert
to authenticated
with check (auth.uid() = user_id);

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'profiles'
  ) then
    execute 'alter publication supabase_realtime add table public.profiles';
  end if;
end $$;

create or replace function public.mint_activity_record(
  p_task_summary text,
  p_duration_minutes integer default 25
)
returns public.activity_logs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log public.activity_logs;
  v_hash text;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if p_task_summary is null or length(trim(p_task_summary)) = 0 then
    raise exception 'INVALID_SUMMARY';
  end if;

  if p_duration_minutes is null or p_duration_minutes <= 0 then
    raise exception 'INVALID_DURATION';
  end if;

  update public.profiles
    set focus_hours = focus_hours - 1,
        updated_at = now()
    where id = auth.uid()
      and focus_hours >= 1;

  if not found then
    raise exception 'INSUFFICIENT_FOCUS';
  end if;

  v_hash := encode(
    digest(auth.uid()::text || clock_timestamp()::text || trim(p_task_summary), 'sha256'),
    'hex'
  );

  insert into public.activity_logs (user_id, task_summary, duration_minutes, focus_spent, block_hash)
  values (auth.uid(), trim(p_task_summary), p_duration_minutes, 1, v_hash)
  returning * into v_log;

  return v_log;
end;
$$;

grant execute on function public.mint_activity_record(text, integer) to authenticated;

create or replace function public.create_broadcast_ping(
  p_message text,
  p_cost integer default 5,
  p_ttl_seconds integer default 10
)
returns public.broadcasts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_broadcast public.broadcasts;
  v_sender text;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if p_message is null or length(trim(p_message)) = 0 then
    raise exception 'INVALID_MESSAGE';
  end if;

  if p_cost is null or p_cost < 0 then
    raise exception 'INVALID_COST';
  end if;

  if p_ttl_seconds is null or p_ttl_seconds <= 0 then
    raise exception 'INVALID_TTL';
  end if;

  update public.profiles
    set meta_coins = meta_coins - p_cost,
        updated_at = now()
    where id = auth.uid()
      and meta_coins >= p_cost;

  if not found then
    raise exception 'INSUFFICIENT_BALANCE';
  end if;

  select coalesce(
      nullif(trim(display_name), ''),
      nullif(split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1), ''),
      '节点'
    )
    into v_sender
    from public.profiles
    where id = auth.uid();

  insert into public.broadcasts (user_id, message, cost, sender_label, expires_at)
  values (
    auth.uid(),
    trim(p_message),
    p_cost,
    v_sender,
    now() + make_interval(secs => p_ttl_seconds)
  )
  returning * into v_broadcast;

  return v_broadcast;
end;
$$;

grant execute on function public.create_broadcast_ping(text, integer, integer) to authenticated;

create or replace function public.purchase_building_style(p_style text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_cost integer := 0;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if p_style not in ('default', 'cyber_pagoda', 'void_monolith') then
    raise exception 'INVALID_STYLE';
  end if;

  select *
    into v_profile
    from public.profiles
    where id = auth.uid()
    for update;

  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  if v_profile.building_style = p_style then
    return v_profile;
  end if;

  if p_style = 'cyber_pagoda' then
    v_cost := 50;
  elsif p_style = 'void_monolith' then
    v_cost := 100;
  else
    v_cost := 0;
  end if;

  if v_cost > 0 and v_profile.compute_power < v_cost then
    raise exception 'INSUFFICIENT_COMPUTE';
  end if;

  update public.profiles
    set compute_power = compute_power - v_cost,
        building_style = p_style,
        updated_at = now()
    where id = auth.uid()
    returning * into v_profile;

  return v_profile;
end;
$$;

grant execute on function public.purchase_building_style(text) to authenticated;
