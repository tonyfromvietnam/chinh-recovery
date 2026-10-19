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

-- Profile (weight, wake times, weekly plan, active experiment): one row per user. Added with the morning brief.
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
