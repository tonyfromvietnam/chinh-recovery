-- CHINH cloud sync. Paste into Supabase → SQL Editor → New query → Run. Safe to run twice.
-- One row per day per user; the whole day (scores, HRV, ratings, directions) lives in `data`.

create table if not exists public.days (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  date       date        not null,
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

-- Row-level security: every query only ever sees the signed-in user's own rows
alter table public.days enable row level security;

drop policy if exists "Read own days" on public.days;
create policy "Read own days" on public.days
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Add own days" on public.days;
create policy "Add own days" on public.days
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Update own days" on public.days;
create policy "Update own days" on public.days
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Delete own days" on public.days;
create policy "Delete own days" on public.days
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Live updates: send changes on this table to signed-in devices (row-level security still applies)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'days'
  ) then
    alter publication supabase_realtime add table public.days;
  end if;
end $$;

-- Profile (wake times, weekly training plan): one row per user. Added with the morning brief.
create table if not exists public.profile (
  user_id    uuid        primary key default auth.uid() references auth.users (id) on delete cascade,
  data       jsonb       not null,
  updated_at timestamptz not null default now()
);

alter table public.profile enable row level security;

drop policy if exists "Read own profile" on public.profile;
create policy "Read own profile" on public.profile
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Add own profile" on public.profile;
create policy "Add own profile" on public.profile
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Update own profile" on public.profile;
create policy "Update own profile" on public.profile
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Decision records: one immutable row each time CHINH scores a day (app or server). Inputs, baselines,
-- each part of the score, every direction with its number, the training decision and the plan.
-- Read and add only: there are no update or delete policies, so the record can't be rewritten from the app.
-- The server (api/ingest.js) writes with the service-role key, which bypasses RLS by design.
create table if not exists public.decisions (
  id         bigint generated always as identity primary key,
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  date       date        not null,
  source     text        not null check (source in ('app', 'shortcut')),
  data       jsonb       not null,
  created_at timestamptz not null default now()
);
create index if not exists decisions_user_date on public.decisions (user_id, date desc);

alter table public.decisions enable row level security;

drop policy if exists "Read own decisions" on public.decisions;
create policy "Read own decisions" on public.decisions
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Add own decisions" on public.decisions;
create policy "Add own decisions" on public.decisions
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- AI trainer (M8.4): one plan a day plus 3 regenerations, counted per user per London day.
-- Users can read their own counts; the only way to add to them is claim_coach_request below.
create table if not exists public.coach_usage (
  user_id       uuid    not null default auth.uid() references auth.users (id) on delete cascade,
  date          date    not null,
  plans         integer not null default 0,
  regenerations integer not null default 0,
  primary key (user_id, date)
);

alter table public.coach_usage enable row level security;

drop policy if exists "Read own coach usage" on public.coach_usage;
create policy "Read own coach usage" on public.coach_usage
  for select to authenticated using ((select auth.uid()) = user_id);

-- Atomically claims one of today's requests for the signed-in user. Returns false once the limit is reached,
-- so api/coach.js can refuse before calling Claude. security definer: it can write the row RLS keeps read-only.
create or replace function public.claim_coach_request(kind text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'Europe/London')::date;
  claimed boolean;
begin
  if uid is null or kind not in ('plan', 'regenerate') then return false; end if;
  insert into public.coach_usage (user_id, date) values (uid, today) on conflict do nothing;
  if kind = 'plan' then
    update public.coach_usage set plans = plans + 1
      where user_id = uid and date = today and plans < 1 returning true into claimed;
  else
    update public.coach_usage set regenerations = regenerations + 1
      where user_id = uid and date = today and regenerations < 3 returning true into claimed;
  end if;
  return coalesce(claimed, false);
end $$;

revoke all on function public.claim_coach_request(text) from public, anon;
grant execute on function public.claim_coach_request(text) to authenticated;
