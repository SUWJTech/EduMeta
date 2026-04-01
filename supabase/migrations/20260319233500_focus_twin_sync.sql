alter table public.profiles
  add column if not exists is_focusing boolean not null default false,
  add column if not exists focus_domain text,
  add column if not exists focus_started_at timestamptz,
  add column if not exists focus_duration_minutes integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_focus_domain_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_focus_domain_check
      check (focus_domain in ('academic', 'tech', 'social'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_focus_duration_minutes_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_focus_duration_minutes_check
      check (focus_duration_minutes is null or focus_duration_minutes > 0);
  end if;
end $$;

update public.profiles
set
  is_focusing = coalesce(is_focusing, false),
  focus_domain = case
    when focus_domain in ('academic', 'tech', 'social') then focus_domain
    else null
  end,
  focus_duration_minutes = case
    when focus_duration_minutes is not null and focus_duration_minutes > 0 then focus_duration_minutes
    else null
  end,
  focus_started_at = case
    when coalesce(is_focusing, false) then focus_started_at
    else null
  end;

create index if not exists profiles_focusing_idx
on public.profiles (is_focusing, focus_started_at desc);
