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

  v_hash := md5(auth.uid()::text || clock_timestamp()::text || coalesce(trim(p_focus_tag), ''));

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
