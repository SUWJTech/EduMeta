alter table public.profiles
  add column if not exists compute_power integer not null default 100,
  add column if not exists building_style text not null default 'default';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_building_style_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_building_style_check
      check (building_style in ('default', 'cyber_pagoda', 'void_monolith'));
  end if;
end $$;

update public.profiles
set compute_power = greatest(
  0,
  round(
    coalesce(focus_hours, 0) * 10
    + (coalesce(academic, 0) + coalesce(tech, 0) + coalesce(social, 0)) * 8
  )::integer
)
where compute_power = 100;

update public.profiles
set building_style = 'default'
where building_style is null
  or building_style not in ('default', 'cyber_pagoda', 'void_monolith');

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
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
