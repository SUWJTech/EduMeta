alter table public.profiles
  add column if not exists academic double precision not null default 0,
  add column if not exists tech double precision not null default 0,
  add column if not exists social double precision not null default 0;

update public.profiles
set
  academic = coalesce(academic, 0),
  tech = coalesce(tech, 0),
  social = coalesce(social, 0)
where
  academic is null
  or tech is null
  or social is null;
