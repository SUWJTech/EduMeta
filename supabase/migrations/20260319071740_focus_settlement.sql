do $$
declare
  v_type text;
begin
  select data_type
    into v_type
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'focus_hours';

  if v_type is not null and v_type <> 'double precision' then
    execute 'alter table public.profiles alter column focus_hours type double precision using focus_hours::double precision';
  end if;
end $$;

create or replace function public.settle_focus_session(p_minutes integer, p_coins_per_minute integer default 2)
returns table (
  added_focus_hours double precision,
  added_meta_coins integer,
  focus_hours double precision,
  meta_coins integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_added_hours double precision;
  v_added_coins integer;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if p_minutes is null or p_minutes <= 0 then
    raise exception 'INVALID_MINUTES';
  end if;

  if p_coins_per_minute is null or p_coins_per_minute < 0 then
    raise exception 'INVALID_RATE';
  end if;

  v_added_hours := (p_minutes::double precision) / 60.0;
  v_added_coins := p_minutes * p_coins_per_minute;

  update public.profiles
    set focus_hours = focus_hours + v_added_hours,
        meta_coins = meta_coins + v_added_coins,
        updated_at = now()
    where id = auth.uid()
    returning
      v_added_hours,
      v_added_coins,
      focus_hours,
      meta_coins
    into
      added_focus_hours,
      added_meta_coins,
      focus_hours,
      meta_coins;

  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  return;
end;
$$;

grant execute on function public.settle_focus_session(integer, integer) to authenticated;

