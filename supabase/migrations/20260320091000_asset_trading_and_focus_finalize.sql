create table if not exists public.node_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  asset_type text not null default 'package' check (asset_type in ('package', 'dataset', 'code', 'tool', 'document')),
  summary text not null default '',
  source_listing_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.city_asset_listings (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.node_assets (id) on delete cascade,
  seller_id uuid not null references auth.users (id) on delete cascade,
  asset_title text not null,
  asset_summary text not null default '',
  price_coins integer not null check (price_coins > 0),
  compute_cost integer not null default 10 check (compute_cost >= 0),
  status text not null default 'active' check (status in ('active', 'sold', 'cancelled')),
  buyer_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  sold_at timestamptz,
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'node_assets'
      and constraint_name = 'node_assets_source_listing_id_fkey'
  ) then
    alter table public.node_assets
      add constraint node_assets_source_listing_id_fkey
      foreign key (source_listing_id)
      references public.city_asset_listings (id)
      on delete set null;
  end if;
end $$;

create index if not exists node_assets_owner_created_idx on public.node_assets (owner_id, created_at desc);
create index if not exists city_asset_listings_status_idx on public.city_asset_listings (status, created_at desc);
create index if not exists city_asset_listings_seller_idx on public.city_asset_listings (seller_id, created_at desc);
create index if not exists city_asset_listings_buyer_idx on public.city_asset_listings (buyer_id, sold_at desc);

alter table public.node_assets enable row level security;
alter table public.city_asset_listings enable row level security;

drop policy if exists "node_assets_select_own" on public.node_assets;
create policy "node_assets_select_own"
on public.node_assets
for select
using (auth.uid() = owner_id);

drop policy if exists "node_assets_insert_self" on public.node_assets;
create policy "node_assets_insert_self"
on public.node_assets
for insert
with check (auth.uid() = owner_id);

drop policy if exists "node_assets_update_own" on public.node_assets;
create policy "node_assets_update_own"
on public.node_assets
for update
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "node_assets_delete_own" on public.node_assets;
create policy "node_assets_delete_own"
on public.node_assets
for delete
using (auth.uid() = owner_id);

drop policy if exists "city_asset_listings_select_authenticated" on public.city_asset_listings;
create policy "city_asset_listings_select_authenticated"
on public.city_asset_listings
for select
to authenticated
using (true);

create or replace function public.list_city_asset(
  p_asset_id uuid,
  p_price_coins integer default 20,
  p_summary text default null
)
returns public.city_asset_listings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asset public.node_assets;
  v_listing public.city_asset_listings;
  v_compute_cost integer := 10;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if p_asset_id is null then
    raise exception 'INVALID_ASSET';
  end if;

  if p_price_coins is null or p_price_coins <= 0 then
    raise exception 'INVALID_PRICE';
  end if;

  select *
    into v_asset
    from public.node_assets
    where id = p_asset_id
      and owner_id = auth.uid()
    for update;

  if not found then
    raise exception 'ASSET_NOT_FOUND';
  end if;

  if exists (
    select 1
    from public.city_asset_listings
    where asset_id = v_asset.id
      and seller_id = auth.uid()
      and status = 'active'
  ) then
    raise exception 'ALREADY_LISTED';
  end if;

  update public.profiles
    set compute_power = compute_power - v_compute_cost,
        updated_at = now()
    where id = auth.uid()
      and compute_power >= v_compute_cost;

  if not found then
    raise exception 'INSUFFICIENT_COMPUTE';
  end if;

  insert into public.city_asset_listings (
    asset_id,
    seller_id,
    asset_title,
    asset_summary,
    price_coins,
    compute_cost,
    status
  )
  values (
    v_asset.id,
    auth.uid(),
    v_asset.title,
    coalesce(nullif(trim(p_summary), ''), v_asset.summary, ''),
    p_price_coins,
    v_compute_cost,
    'active'
  )
  returning * into v_listing;

  return v_listing;
end;
$$;

grant execute on function public.list_city_asset(uuid, integer, text) to authenticated;

create or replace function public.buy_city_asset(p_listing_id uuid)
returns table (
  listing_id uuid,
  asset_id uuid,
  asset_title text,
  seller_id uuid,
  buyer_id uuid,
  price_coins integer,
  buyer_meta_coins integer,
  buyer_compute_power integer,
  seller_meta_coins integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing public.city_asset_listings;
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
    from public.city_asset_listings
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

  if v_buyer.meta_coins < v_listing.price_coins then
    raise exception 'INSUFFICIENT_COINS';
  end if;

  update public.profiles
    set meta_coins = meta_coins - v_listing.price_coins,
        updated_at = now()
    where id = auth.uid()
    returning * into v_buyer;

  update public.profiles
    set meta_coins = meta_coins + v_listing.price_coins,
        updated_at = now()
    where id = v_listing.seller_id
    returning * into v_seller;

  update public.city_asset_listings
    set status = 'sold',
        buyer_id = auth.uid(),
        sold_at = now(),
        updated_at = now()
    where id = v_listing.id
    returning * into v_listing;

  update public.node_assets
    set owner_id = auth.uid(),
        source_listing_id = v_listing.id,
        updated_at = now()
    where id = v_listing.asset_id;

  listing_id := v_listing.id;
  asset_id := v_listing.asset_id;
  asset_title := v_listing.asset_title;
  seller_id := v_listing.seller_id;
  buyer_id := auth.uid();
  price_coins := v_listing.price_coins;
  buyer_meta_coins := v_buyer.meta_coins;
  buyer_compute_power := v_buyer.compute_power;
  seller_meta_coins := v_seller.meta_coins;
  return next;
end;
$$;

grant execute on function public.buy_city_asset(uuid) to authenticated;

create or replace function public.finalize_quantum_focus(
  p_minutes integer,
  p_focus_tag text default null,
  p_is_online boolean default false,
  p_focus_domain text default null
)
returns table (
  added_compute integer,
  added_coins integer,
  profile_compute_power integer,
  profile_meta_coins integer,
  profile_focus_hours double precision,
  log_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base integer;
  v_bonus integer;
  v_total integer;
  v_coins integer;
  v_added_hours double precision;
  v_hash text;
  v_log_id uuid;
  v_profile public.profiles;
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

  v_base := round(p_minutes * 1.4);
  v_bonus := case when coalesce(p_is_online, false) then round(v_base * 0.2) else 0 end;
  v_total := v_base + v_bonus;
  v_coins := greatest(2, round(v_total * 0.45));
  v_added_hours := p_minutes::double precision / 60.0;

  update public.profiles
    set compute_power = compute_power + v_total,
        meta_coins = meta_coins + v_coins,
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
    case when coalesce(p_is_online, false) then 'Quantum Resonance · Entangled' else 'Quantum Resonance · Solo' end,
    p_minutes,
    0,
    v_hash,
    coalesce(nullif(trim(p_focus_tag), ''), '未标注'),
    coalesce(p_is_online, false),
    v_total,
    v_coins
  )
  returning id into v_log_id;

  added_compute := v_total;
  added_coins := v_coins;
  profile_compute_power := v_profile.compute_power;
  profile_meta_coins := v_profile.meta_coins;
  profile_focus_hours := v_profile.focus_hours;
  log_id := v_log_id;
  return next;
end;
$$;

grant execute on function public.finalize_quantum_focus(integer, text, boolean, text) to authenticated;

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'node_assets'
  ) then
    execute 'alter publication supabase_realtime add table public.node_assets';
  end if;

  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'city_asset_listings'
  ) then
    execute 'alter publication supabase_realtime add table public.city_asset_listings';
  end if;
end $$;
