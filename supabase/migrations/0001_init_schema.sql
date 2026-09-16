-- =====================================================================
-- PRM / Team Management Platform — Phase 1: Core Schema Migration
-- =====================================================================
-- This migration creates the foundational schema:
--   1. Extensions & enum types
--   2. roles / user_roles (RBAC)
--   3. teams
--   4. prm_members (1:1 with auth.users)
--   5. team_memberships (leadership flags + fixed core roles)
--   6. Core Team auto-sync trigger
--   7. noc_submissions
--   8. task_types / team_tasks / task_member_status / task_comments /
--      task_attachments
--   9. team_meeting_minutes / meeting_attendance
--  10. member_performance_ranking view (scoring engine)
--
-- RLS policies live in a separate migration: 0002_rls_policies.sql
-- Run these in order against your Supabase project (SQL editor or
-- `supabase db push`).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ---------------------------------------------------------------------
-- 0.1 Enum types
-- ---------------------------------------------------------------------
do $$ begin
  create type public.noc_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.task_status as enum ('not_submitted', 'submitted', 'selected', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.meeting_scope as enum ('central_core', 'team');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.attendance_status as enum ('present', 'absent', 'excused');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.member_status as enum ('active', 'inactive');
exception when duplicate_object then null; end $$;

-- =====================================================================
-- 1. ROLES & USER_ROLES  (RBAC)
-- =====================================================================
-- `roles` is a lookup table of the five system roles. Keeping it as a
-- table (rather than a hardcoded enum) lets an admin rename/describe
-- roles later without a migration.
create table if not exists public.roles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique
              check (name in ('Super Admin', 'Core Team', 'Team Coordinator', 'Deputy Coordinator', 'Member')),
  description text,
  created_at  timestamptz not null default now()
);

insert into public.roles (name, description) values
  ('Super Admin',      'Full system access; manages teams, roles, and all data.'),
  ('Core Team',        'Member of the auto-synced Core Team; elevated cross-team visibility.'),
  ('Team Coordinator', 'Leads an operational team; verifies NOCs and manages team tasks/meetings.'),
  ('Deputy Coordinator','Assists the Team Coordinator; same operational permissions within their team.'),
  ('Member',           'Standard operational team member.')
on conflict (name) do nothing;

-- =====================================================================
-- 2. TEAMS
-- =====================================================================
create table if not exists public.teams (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  slug          text not null unique,
  description   text,
  is_core_team  boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Guarantee there is exactly one Core Team row; the sync trigger targets it.
create unique index if not exists teams_single_core_team_idx
  on public.teams ((is_core_team))
  where is_core_team = true;

insert into public.teams (name, slug, description, is_core_team)
values ('Core Team', 'core-team', 'Auto-synced leadership body drawn from all operational teams.', true)
on conflict (slug) do nothing;

-- =====================================================================
-- 3. PRM_MEMBERS  (1:1 with auth.users)
-- =====================================================================
create table if not exists public.prm_members (
  id          uuid primary key references auth.users(id) on delete cascade,
  bs_id       text unique,                 -- external/BS roll number, kept as metadata only (NOT used as FK)
  full_name   text not null,
  email       text not null unique,
  phone       text,
  avatar_url  text,
  status      public.member_status not null default 'active',
  joined_at   timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists prm_members_status_idx on public.prm_members (status);

-- user_roles: many-to-many between members and roles, optionally scoped
-- to a specific team (e.g. "Team Coordinator" of "Design Team").
-- A NULL team_id means the role is global (e.g. Super Admin, Core Team).
create table if not exists public.user_roles (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.prm_members(id) on delete cascade,
  role_id     uuid not null references public.roles(id) on delete cascade,
  team_id     uuid references public.teams(id) on delete cascade,
  granted_at  timestamptz not null default now(),
  granted_by  uuid references auth.users(id),
  unique (member_id, role_id, team_id)
);

create index if not exists user_roles_member_idx on public.user_roles (member_id);
create index if not exists user_roles_role_idx on public.user_roles (role_id);

-- =====================================================================
-- 4. TEAM_MEMBERSHIPS  (per-team leadership + fixed core roles)
-- =====================================================================
create table if not exists public.team_memberships (
  id                     uuid primary key default gen_random_uuid(),
  team_id                uuid not null references public.teams(id) on delete cascade,
  member_id              uuid not null references public.prm_members(id) on delete cascade,
  is_coordinator         boolean not null default false,
  is_deputy_coordinator  boolean not null default false,
  -- Fixed Core Team roles. Only meaningful when team_id = the Core Team.
  core_role              text check (core_role in ('Convener', 'Joint Convener', 'Member Secretary', 'Deputy Member Secretary')),
  -- true when this row was created/maintained by sync_core_team_membership()
  -- rather than by a direct admin action; lets the trigger clean up after
  -- itself without touching rows an admin created manually.
  is_auto_synced         boolean not null default false,
  joined_at              timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (team_id, member_id)
);

create index if not exists team_memberships_team_idx on public.team_memberships (team_id);
create index if not exists team_memberships_member_idx on public.team_memberships (member_id);

-- Only one coordinator and one deputy coordinator per team.
create unique index if not exists team_memberships_one_coordinator_idx
  on public.team_memberships (team_id) where is_coordinator = true;
create unique index if not exists team_memberships_one_deputy_idx
  on public.team_memberships (team_id) where is_deputy_coordinator = true;

-- =====================================================================
-- 5. CORE TEAM AUTO-SYNC TRIGGER
-- =====================================================================
-- Whenever a member is marked as Team Coordinator (is_coordinator = true)
-- on ANY operational team, they must automatically gain membership in
-- the Core Team. If they are later removed as coordinator everywhere and
-- hold no fixed core_role, their auto-synced Core Team row is removed.
-- Manually-added Core Team members (core_role set, or is_auto_synced =
-- false) are never touched by this trigger.
create or replace function public.sync_core_team_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_core_team_id uuid;
  v_member_id    uuid;
  v_still_coordinator boolean;
begin
  select id into v_core_team_id from public.teams where is_core_team = true limit 1;

  -- Determine which member to evaluate (handles INSERT/UPDATE/DELETE).
  v_member_id := coalesce(new.member_id, old.member_id);

  if v_core_team_id is null or v_member_id is null then
    return coalesce(new, old);
  end if;

  -- Never act on changes to the Core Team row itself (avoid recursion).
  if coalesce(new.team_id, old.team_id) = v_core_team_id then
    return coalesce(new, old);
  end if;

  -- Is this member still a coordinator of ANY operational (non-core) team?
  select exists (
    select 1
    from public.team_memberships tm
    join public.teams t on t.id = tm.team_id
    where tm.member_id = v_member_id
      and t.is_core_team = false
      and tm.is_coordinator = true
  ) into v_still_coordinator;

  if v_still_coordinator then
    -- Grant/refresh Core Team membership.
    insert into public.team_memberships (team_id, member_id, is_auto_synced)
    values (v_core_team_id, v_member_id, true)
    on conflict (team_id, member_id) do nothing;

    -- Mirror the "Core Team" role in user_roles for RBAC checks.
    insert into public.user_roles (member_id, role_id)
    select v_member_id, r.id
    from public.roles r
    where r.name = 'Core Team'
    on conflict (member_id, role_id, team_id) do nothing;
  else
    -- Revoke ONLY if their Core Team row was auto-synced (not a manually
    -- assigned fixed core_role such as Convener).
    delete from public.team_memberships
    where team_id = v_core_team_id
      and member_id = v_member_id
      and is_auto_synced = true
      and core_role is null;

    -- Remove the mirrored Core Team role if they no longer hold any
    -- Core Team membership row at all.
    if not exists (
      select 1 from public.team_memberships
      where team_id = v_core_team_id and member_id = v_member_id
    ) then
      delete from public.user_roles ur
      using public.roles r
      where ur.role_id = r.id
        and r.name = 'Core Team'
        and ur.member_id = v_member_id
        and ur.team_id is null;
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sync_core_team_membership on public.team_memberships;
create trigger trg_sync_core_team_membership
after insert or update of is_coordinator or delete on public.team_memberships
for each row
execute function public.sync_core_team_membership();

-- =====================================================================
-- 6. NOC SUBMISSIONS
-- =====================================================================
-- Files live in Supabase Storage bucket "nocs" under path
-- {member_id}/{filename}. This table only tracks metadata + review state.
create table if not exists public.noc_submissions (
  id             uuid primary key default gen_random_uuid(),
  member_id      uuid not null references public.prm_members(id) on delete cascade,
  file_path      text not null,           -- storage object path: nocs/{member_id}/...
  file_name      text not null,
  status         public.noc_status not null default 'pending',
  submitted_at   timestamptz not null default now(),
  verified_at    timestamptz,
  verified_by    uuid references auth.users(id),
  rejection_reason text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists noc_submissions_member_idx on public.noc_submissions (member_id);
create index if not exists noc_submissions_status_idx on public.noc_submissions (status);

-- =====================================================================
-- 7. TASKS  (consolidated architecture)
-- =====================================================================
-- Dynamic point weightage per task type (e.g. "Blog Post" = 10 pts,
-- "Design Asset" = 15 pts). team_tasks.points defaults from here but can
-- be overridden per-task.
create table if not exists public.task_types (
  id             uuid primary key default gen_random_uuid(),
  name           text not null unique,
  default_points numeric(6,2) not null default 0,
  created_at     timestamptz not null default now()
);

-- A task is scoped to a team (team_id) OR global (team_id null, e.g. a
-- Central Core initiative). Supersedes any legacy isolated `tasks` table.
create table if not exists public.team_tasks (
  id             uuid primary key default gen_random_uuid(),
  team_id        uuid references public.teams(id) on delete cascade,
  task_type_id   uuid references public.task_types(id),
  title          text not null,
  description    text,
  points         numeric(6,2) not null default 0,
  due_date       timestamptz,
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists team_tasks_team_idx on public.team_tasks (team_id);
create index if not exists team_tasks_due_idx on public.team_tasks (due_date);

-- Per-member status against a task. This is what bulk CSV import and
-- submission review actually mutate.
create table if not exists public.task_member_status (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references public.team_tasks(id) on delete cascade,
  member_id    uuid not null references public.prm_members(id) on delete cascade,
  status       public.task_status not null default 'not_submitted',
  submission_url text,
  submitted_at timestamptz,
  reviewed_by  uuid references auth.users(id),
  reviewed_at  timestamptz,
  updated_at   timestamptz not null default now(),
  unique (task_id, member_id)
);

create index if not exists task_member_status_task_idx on public.task_member_status (task_id);
create index if not exists task_member_status_member_idx on public.task_member_status (member_id);
create index if not exists task_member_status_status_idx on public.task_member_status (status);

create table if not exists public.task_comments (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.team_tasks(id) on delete cascade,
  member_id   uuid not null references public.prm_members(id) on delete cascade,
  comment     text not null,
  created_at  timestamptz not null default now()
);

create index if not exists task_comments_task_idx on public.task_comments (task_id);

create table if not exists public.task_attachments (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references public.team_tasks(id) on delete cascade,
  member_id    uuid not null references public.prm_members(id) on delete cascade,
  file_path    text not null,   -- storage path, e.g. task-attachments/{task_id}/{member_id}/...
  file_name    text not null,
  uploaded_at  timestamptz not null default now()
);

create index if not exists task_attachments_task_idx on public.task_attachments (task_id);

-- =====================================================================
-- 8. MEETING MINUTES & ATTENDANCE
-- =====================================================================
create table if not exists public.team_meeting_minutes (
  id             uuid primary key default gen_random_uuid(),
  scope          public.meeting_scope not null,
  -- team_id is required when scope = 'team', and must be null for
  -- 'central_core' meetings (enforced below).
  team_id        uuid references public.teams(id) on delete cascade,
  title          text not null,
  meeting_date   timestamptz not null,
  agenda         text,
  summary        text,
  attachment_url text,          -- optional minutes document in Storage
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint meeting_scope_team_consistency check (
    (scope = 'team' and team_id is not null) or
    (scope = 'central_core' and team_id is null)
  )
);

create index if not exists meeting_minutes_scope_idx on public.team_meeting_minutes (scope);
create index if not exists meeting_minutes_team_idx on public.team_meeting_minutes (team_id);
create index if not exists meeting_minutes_date_idx on public.team_meeting_minutes (meeting_date);

-- Per-member attendance for a meeting; feeds the scoring engine directly.
create table if not exists public.meeting_attendance (
  id           uuid primary key default gen_random_uuid(),
  meeting_id   uuid not null references public.team_meeting_minutes(id) on delete cascade,
  member_id    uuid not null references public.prm_members(id) on delete cascade,
  status       public.attendance_status not null default 'absent',
  recorded_at  timestamptz not null default now(),
  unique (meeting_id, member_id)
);

create index if not exists meeting_attendance_meeting_idx on public.meeting_attendance (meeting_id);
create index if not exists meeting_attendance_member_idx on public.meeting_attendance (member_id);

-- =====================================================================
-- 9. PERFORMANCE SCORING VIEW
-- =====================================================================
-- Scoring constants (adjust here if the org changes point values):
--   present  = 5 pts, excused = 2 pts, absent = 0 pts
--   task points = team_tasks.points, counted only when
--   task_member_status.status = 'selected'
create or replace view public.member_performance_ranking as
with task_points as (
  select
    tms.member_id,
    coalesce(sum(tt.points), 0) as task_score
  from public.task_member_status tms
  join public.team_tasks tt on tt.id = tms.task_id
  where tms.status = 'selected'
  group by tms.member_id
),
attendance_points as (
  select
    ma.member_id,
    coalesce(sum(
      case ma.status
        when 'present' then 5
        when 'excused' then 2
        else 0
      end
    ), 0) as attendance_score
  from public.meeting_attendance ma
  group by ma.member_id
)
select
  m.id as member_id,
  m.full_name,
  m.email,
  coalesce(tp.task_score, 0) as task_score,
  coalesce(ap.attendance_score, 0) as attendance_score,
  coalesce(tp.task_score, 0) + coalesce(ap.attendance_score, 0) as total_score,
  rank() over (order by coalesce(tp.task_score, 0) + coalesce(ap.attendance_score, 0) desc) as global_rank
from public.prm_members m
left join task_points tp on tp.member_id = m.id
left join attendance_points ap on ap.member_id = m.id
where m.status = 'active';

-- Team-filtered variant: joins through team_memberships so a member
-- appearing in multiple teams shows once per team for team leaderboards.
create or replace view public.team_performance_ranking as
select
  tm.team_id,
  t.name as team_name,
  r.member_id,
  r.full_name,
  r.email,
  r.task_score,
  r.attendance_score,
  r.total_score,
  rank() over (partition by tm.team_id order by r.total_score desc) as team_rank
from public.team_memberships tm
join public.teams t on t.id = tm.team_id
join public.member_performance_ranking r on r.member_id = tm.member_id;

-- =====================================================================
-- End of 0001_init_schema.sql
-- =====================================================================
