alter table public.activity_logs
  add column if not exists focus_tag text,
  add column if not exists is_online boolean not null default false,
  add column if not exists gained_compute integer not null default 0,
  add column if not exists gained_coins integer not null default 0;
