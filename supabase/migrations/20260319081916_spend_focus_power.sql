create or replace function public.spend_focus_power(p_focus_hours double precision default 1)
returns table (
  spent_focus_hours double precision,
  focus_hours double precision
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current double precision;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if p_focus_hours is null or p_focus_hours <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  select p.focus_hours into v_current
  from public.profiles p
  where p.id = auth.uid();

  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  if v_current < p_focus_hours then
    raise exception 'INSUFFICIENT_FOCUS';
  end if;

  update public.profiles
    set focus_hours = focus_hours - p_focus_hours,
        updated_at = now()
    where id = auth.uid()
    returning p_focus_hours, focus_hours
    into spent_focus_hours, focus_hours;

  return;
end;
$$;

grant execute on function public.spend_focus_power(double precision) to authenticated;

