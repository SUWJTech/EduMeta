create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  meta_coins integer not null default 100,
  focus_hours integer not null default 0,
  avatar_url text not null default 'default',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

do $$
begin
  create policy profiles_select_authenticated on public.profiles
    for select to authenticated
    using (true);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy profiles_insert_self on public.profiles
    for insert to authenticated
    with check (auth.uid() = id);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy profiles_update_self on public.profiles
    for update to authenticated
    using (auth.uid() = id);
exception
  when duplicate_object then null;
end $$;

create table if not exists public.market_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('技能', '硬件', '任务')),
  title text not null,
  description text not null default '',
  price integer not null check (price > 0),
  status text not null default 'open' check (status in ('open', 'claimed')),
  claimed_by uuid references auth.users (id),
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists market_items_created_at_idx on public.market_items (created_at desc);
create index if not exists market_items_status_idx on public.market_items (status);

alter table public.market_items enable row level security;

do $$
begin
  create policy market_items_select_authenticated on public.market_items
    for select to authenticated
    using (true);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy market_items_insert_self on public.market_items
    for insert to authenticated
    with check (auth.uid() = user_id);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy market_items_claim_open on public.market_items
    for update to authenticated
    using (status = 'open' and claimed_by is null)
    with check (
      status = 'claimed'
      and claimed_by = auth.uid()
      and claimed_at is not null
    );
exception
  when duplicate_object then null;
end $$;

alter publication supabase_realtime add table public.market_items;

create or replace function public.publish_market_item(
  p_type text,
  p_title text,
  p_description text,
  p_price integer
)
returns public.market_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.market_items;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'INVALID_TITLE';
  end if;

  if p_price is null or p_price <= 0 then
    raise exception 'INVALID_PRICE';
  end if;

  if p_type = '任务' then
    update public.profiles
      set meta_coins = meta_coins - p_price,
          updated_at = now()
      where id = auth.uid()
        and meta_coins >= p_price;

    if not found then
      raise exception 'INSUFFICIENT_BALANCE';
    end if;
  end if;

  insert into public.market_items (user_id, type, title, description, price)
    values (auth.uid(), p_type, trim(p_title), coalesce(p_description, ''), p_price)
    returning * into v_item;

  return v_item;
end;
$$;

grant execute on function public.publish_market_item(text, text, text, integer) to authenticated;

create or replace function public.accept_market_task(p_item_id uuid)
returns public.market_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.market_items;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select *
    into v_item
    from public.market_items
    where id = p_item_id
    for update;

  if not found then
    raise exception 'NOT_FOUND';
  end if;

  if v_item.status <> 'open' then
    raise exception 'ALREADY_CLAIMED';
  end if;

  update public.market_items
    set status = 'claimed',
        claimed_by = auth.uid(),
        claimed_at = now()
    where id = p_item_id
    returning * into v_item;

  update public.profiles
    set meta_coins = meta_coins + v_item.price,
        updated_at = now()
    where id = auth.uid();

  return v_item;
end;
$$;

grant execute on function public.accept_market_task(uuid) to authenticated;

