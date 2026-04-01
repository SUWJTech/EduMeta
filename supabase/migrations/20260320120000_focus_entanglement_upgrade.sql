alter table public.profiles
  add column if not exists resonance_partners text[] not null default '{}'::text[];

update public.profiles
set resonance_partners = coalesce(resonance_partners, '{}'::text[])
where resonance_partners is null;

create or replace function public.finalize_quantum_focus(
  p_minutes integer,
  p_focus_tag text default null,
  p_is_online boolean default false,
  p_focus_domain text default null,
  p_partner_node_id text default null
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
  v_coins integer := 0;
  v_added_hours double precision;
  v_hash text;
  v_log_id uuid;
  v_profile public.profiles;
  v_partner text;
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

  v_partner := nullif(trim(coalesce(p_partner_node_id, '')), '');

  v_base := round(p_minutes * 1.4);
  v_bonus := case when coalesce(p_is_online, false) then round(v_base * 0.15) else 0 end;
  v_total := v_base + v_bonus;
  v_added_hours := p_minutes::double precision / 60.0;

  update public.profiles
    set compute_power = compute_power + v_total,
        focus_hours = focus_hours + v_added_hours,
        academic = academic + case when p_focus_domain = 'academic' then v_added_hours else 0 end,
        tech = tech + case when p_focus_domain = 'tech' then v_added_hours else 0 end,
        social = social + case when p_focus_domain = 'social' then v_added_hours else 0 end,
        resonance_partners = case
          when coalesce(p_is_online, false)
            and v_partner is not null
            and not (v_partner = any(coalesce(resonance_partners, '{}'::text[])))
            then (array_prepend(v_partner, coalesce(resonance_partners, '{}'::text[])))[1:20]
          else coalesce(resonance_partners, '{}'::text[])
        end,
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

grant execute on function public.finalize_quantum_focus(integer, text, boolean, text, text) to authenticated;
