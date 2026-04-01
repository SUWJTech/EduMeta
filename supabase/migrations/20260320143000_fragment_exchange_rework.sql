alter table public.profiles
  add column if not exists total_compute_mined integer not null default 0;

update public.profiles
set total_compute_mined = greatest(coalesce(total_compute_mined, 0), coalesce(compute_power, 0))
where coalesce(total_compute_mined, 0) < coalesce(compute_power, 0);

drop function if exists public.finalize_quantum_focus(integer, text, boolean, text);
drop function if exists public.finalize_quantum_focus(integer, text, boolean, text, text);
drop function if exists public.buy_city_asset(uuid);
drop function if exists public.settle_focus_session(integer, integer);
drop function if exists public.create_broadcast_ping(text, integer, integer);

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
    set compute_power = compute_power - p_cost,
        updated_at = now()
    where id = auth.uid()
      and compute_power >= p_cost;

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

alter table public.profiles
  drop column if exists meta_coins;

create table if not exists public.user_fragments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  fragment_type text not null check (fragment_type in ('Tech', 'Academic', 'Engine')),
  rarity text not null check (rarity in ('common', 'uncommon', 'rare', 'epic')),
  source_focus_tag text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fragment_listings (
  id uuid primary key default gen_random_uuid(),
  fragment_id uuid not null references public.user_fragments (id) on delete cascade,
  seller_id uuid not null references auth.users (id) on delete cascade,
  price_compute integer not null check (price_compute > 0),
  status text not null default 'active' check (status in ('active', 'sold', 'cancelled')),
  buyer_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  sold_at timestamptz,
  updated_at timestamptz not null default now()
);

create unique index if not exists fragment_listings_active_fragment_idx
on public.fragment_listings (fragment_id)
where status = 'active';

create index if not exists user_fragments_user_idx
on public.user_fragments (user_id, created_at desc);

create index if not exists fragment_listings_status_idx
on public.fragment_listings (status, created_at desc);

alter table public.user_fragments enable row level security;
alter table public.fragment_listings enable row level security;

drop policy if exists "user_fragments_select_authenticated" on public.user_fragments;
create policy "user_fragments_select_authenticated"
on public.user_fragments
for select
to authenticated
using (true);

drop policy if exists "user_fragments_insert_self" on public.user_fragments;
create policy "user_fragments_insert_self"
on public.user_fragments
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "user_fragments_update_self" on public.user_fragments;
create policy "user_fragments_update_self"
on public.user_fragments
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "user_fragments_delete_self" on public.user_fragments;
create policy "user_fragments_delete_self"
on public.user_fragments
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "fragment_listings_select_authenticated" on public.fragment_listings;
create policy "fragment_listings_select_authenticated"
on public.fragment_listings
for select
to authenticated
using (true);

drop policy if exists "fragment_listings_insert_self" on public.fragment_listings;
create policy "fragment_listings_insert_self"
on public.fragment_listings
for insert
to authenticated
with check (auth.uid() = seller_id);

drop policy if exists "fragment_listings_update_involved" on public.fragment_listings;
create policy "fragment_listings_update_involved"
on public.fragment_listings
for update
to authenticated
using (auth.uid() = seller_id or auth.uid() = buyer_id)
with check (auth.uid() = seller_id or auth.uid() = buyer_id);

create or replace function public.create_fragment_listing(
  p_fragment_id uuid,
  p_price_compute integer default 30
)
returns public.fragment_listings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fragment public.user_fragments;
  v_listing public.fragment_listings;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if p_fragment_id is null then
    raise exception 'INVALID_FRAGMENT';
  end if;

  if p_price_compute is null or p_price_compute <= 0 then
    raise exception 'INVALID_PRICE';
  end if;

  select *
    into v_fragment
    from public.user_fragments
    where id = p_fragment_id
      and user_id = auth.uid()
    for update;

  if not found then
    raise exception 'FRAGMENT_NOT_FOUND';
  end if;

  if exists (
    select 1
    from public.fragment_listings
    where fragment_id = p_fragment_id
      and status = 'active'
  ) then
    raise exception 'FRAGMENT_ALREADY_LISTED';
  end if;

  insert into public.fragment_listings (
    fragment_id,
    seller_id,
    price_compute,
    status
  )
  values (
    p_fragment_id,
    auth.uid(),
    p_price_compute,
    'active'
  )
  returning * into v_listing;

  return v_listing;
end;
$$;

grant execute on function public.create_fragment_listing(uuid, integer) to authenticated;

create or replace function public.buy_fragment_listing(p_listing_id uuid)
returns table (
  listing_id uuid,
  fragment_id uuid,
  fragment_type text,
  fragment_rarity text,
  seller_id uuid,
  buyer_id uuid,
  price_compute integer,
  buyer_compute_power integer,
  seller_compute_power integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing public.fragment_listings;
  v_fragment public.user_fragments;
  v_buyer public.profiles;
  v_seller public.profiles;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if p_listing_id is null then
    raise exception 'INVALID_LISTING';
  end if;

  select *
    into v_listing
    from public.fragment_listings
    where id = p_listing_id
    for update;

  if not found then
    raise exception 'LISTING_NOT_FOUND';
  end if;

  if v_listing.status <> 'active' then
    raise exception 'LISTING_NOT_ACTIVE';
  end if;

  if v_listing.seller_id = auth.uid() then
    raise exception 'SELF_PURCHASE_FORBIDDEN';
  end if;

  select *
    into v_fragment
    from public.user_fragments
    where id = v_listing.fragment_id
    for update;

  if not found then
    raise exception 'FRAGMENT_NOT_FOUND';
  end if;

  if v_fragment.user_id <> v_listing.seller_id then
    raise exception 'FRAGMENT_OWNER_CHANGED';
  end if;

  select *
    into v_buyer
    from public.profiles
    where id = auth.uid()
    for update;

  if not found then
    raise exception 'BUYER_PROFILE_NOT_FOUND';
  end if;

  select *
    into v_seller
    from public.profiles
    where id = v_listing.seller_id
    for update;

  if not found then
    raise exception 'SELLER_PROFILE_NOT_FOUND';
  end if;

  if v_buyer.compute_power < v_listing.price_compute then
    raise exception 'INSUFFICIENT_COMPUTE';
  end if;

  update public.profiles
    set compute_power = compute_power - v_listing.price_compute,
        updated_at = now()
    where id = auth.uid()
    returning * into v_buyer;

  update public.profiles
    set compute_power = compute_power + v_listing.price_compute,
        updated_at = now()
    where id = v_listing.seller_id
    returning * into v_seller;

  update public.fragment_listings
    set status = 'sold',
        buyer_id = auth.uid(),
        sold_at = now(),
        updated_at = now()
    where id = v_listing.id
    returning * into v_listing;

  update public.user_fragments
    set user_id = auth.uid(),
        updated_at = now()
    where id = v_fragment.id
    returning * into v_fragment;

  listing_id := v_listing.id;
  fragment_id := v_fragment.id;
  fragment_type := v_fragment.fragment_type;
  fragment_rarity := v_fragment.rarity;
  seller_id := v_listing.seller_id;
  buyer_id := auth.uid();
  price_compute := v_listing.price_compute;
  buyer_compute_power := v_buyer.compute_power;
  seller_compute_power := v_seller.compute_power;
  return next;
end;
$$;

grant execute on function public.buy_fragment_listing(uuid) to authenticated;

create or replace function public.finalize_focus_mining(
  p_minutes integer,
  p_is_online boolean default false,
  p_focus_domain text default null,
  p_focus_tag text default null
)
returns table (
  added_compute integer,
  profile_compute_power integer,
  profile_total_compute_mined integer,
  dropped_fragment_id uuid,
  dropped_fragment_type text,
  dropped_fragment_rarity text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rate numeric := case when coalesce(p_is_online, false) then 1.2 else 1 end;
  v_drop_chance numeric := case when coalesce(p_is_online, false) then 0.25 else 0.05 end;
  v_total integer;
  v_added_hours double precision;
  v_profile public.profiles;
  v_drop_roll numeric;
  v_type_roll numeric;
  v_rarity_roll numeric;
  v_fragment_type text;
  v_fragment_rarity text;
  v_fragment public.user_fragments;
  v_hash text;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if p_minutes is null or p_minutes <= 0 then
    raise exception 'INVALID_MINUTES';
  end if;

  if p_focus_domain is not null and p_focus_domain not in ('academic', 'tech', 'social') then
    raise exception 'INVALID_DOMAIN';
  end if;

  v_total := greatest(1, round(p_minutes * v_rate));
  v_added_hours := p_minutes::double precision / 60.0;

  update public.profiles
    set compute_power = compute_power + v_total,
        total_compute_mined = total_compute_mined + v_total,
        focus_hours = focus_hours + v_added_hours,
        academic = academic + case when p_focus_domain = 'academic' then v_added_hours else 0 end,
        tech = tech + case when p_focus_domain = 'tech' then v_added_hours else 0 end,
        social = social + case when p_focus_domain = 'social' then v_added_hours else 0 end,
        is_focusing = false,
        focus_domain = null,
        focus_started_at = null,
        focus_duration_minutes = null,
        updated_at = now()
    where id = auth.uid()
    returning * into v_profile;

  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  v_drop_roll := random();
  if v_drop_roll < v_drop_chance then
    if position('engine' in lower(coalesce(p_focus_tag, ''))) > 0 or position('引擎' in coalesce(p_focus_tag, '')) > 0 then
      v_fragment_type := 'Engine';
    elsif p_focus_domain = 'academic' then
      v_fragment_type := 'Academic';
    elsif p_focus_domain = 'tech' then
      v_fragment_type := 'Tech';
    else
      v_type_roll := random();
      v_fragment_type := case
        when v_type_roll < 0.34 then 'Tech'
        when v_type_roll < 0.67 then 'Academic'
        else 'Engine'
      end;
    end if;

    v_rarity_roll := random();
    v_fragment_rarity := case
      when v_rarity_roll < 0.03 then 'epic'
      when v_rarity_roll < 0.15 then 'rare'
      when v_rarity_roll < 0.4 then 'uncommon'
      else 'common'
    end;

    insert into public.user_fragments (user_id, fragment_type, rarity, source_focus_tag)
    values (
      auth.uid(),
      v_fragment_type,
      v_fragment_rarity,
      nullif(trim(coalesce(p_focus_tag, '')), '')
    )
    returning * into v_fragment;
  end if;

  v_hash := encode(
    digest(auth.uid()::text || clock_timestamp()::text || coalesce(trim(p_focus_tag), ''), 'sha256'),
    'hex'
  );

  insert into public.activity_logs (
    user_id,
    task_summary,
    duration_minutes,
    focus_spent,
    block_hash,
    focus_tag,
    is_online,
    gained_compute,
    gained_coins
  )
  values (
    auth.uid(),
    case when coalesce(p_is_online, false) then 'Quantum Resonance Mining · Entangled' else 'Quantum Resonance Mining · Solo' end,
    p_minutes,
    0,
    v_hash,
    coalesce(nullif(trim(p_focus_tag), ''), '未标注'),
    coalesce(p_is_online, false),
    v_total,
    0
  );

  added_compute := v_total;
  profile_compute_power := v_profile.compute_power;
  profile_total_compute_mined := v_profile.total_compute_mined;
  dropped_fragment_id := v_fragment.id;
  dropped_fragment_type := v_fragment.fragment_type;
  dropped_fragment_rarity := v_fragment.rarity;
  return next;
end;
$$;

grant execute on function public.finalize_focus_mining(integer, boolean, text, text) to authenticated;

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'user_fragments'
  ) then
    execute 'alter publication supabase_realtime add table public.user_fragments';
  end if;

  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'fragment_listings'
  ) then
    execute 'alter publication supabase_realtime add table public.fragment_listings';
  end if;
end $$;
