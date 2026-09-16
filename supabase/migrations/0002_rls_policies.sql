-- =====================================================================
-- PRM / Team Management Platform — Phase 1: RLS Policies
-- =====================================================================
-- Enables Row Level Security and defines granular access policies for
-- every table called out in requirement #7, plus the supporting tables
-- created in 0001_init_schema.sql that also need protection.
--
-- NOTE on legacy tables: `prm_recruitment`, `prm_submissions`, and
-- `footer_config` are referenced in the spec but not otherwise defined
-- here. Minimal stub definitions are included below (guarded with
-- `if not exists`) so the RLS statements have something to attach to —
-- if these already exist in your project with a different shape, drop
-- the matching `create table` block and keep only the `alter table` /
-- `create policy` statements.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Helper functions (used throughout the policies below)
-- ---------------------------------------------------------------------

-- Current caller's prm_members.id (same as auth.uid() by construction,
-- but kept as a named helper for readability in policies).
create or replace function public.current_member_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid();
$$;

create or replace function public.has_role(p_role_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.member_id = auth.uid()
      and r.name = p_role_name
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role('Super Admin');
$$;

create or replace function public.is_core_team()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role('Core Team') or public.is_super_admin();
$$;

-- True if the caller is Coordinator or Deputy Coordinator of the given team.
create or replace function public.is_team_leadership(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.team_memberships tm
    where tm.team_id = p_team_id
      and tm.member_id = auth.uid()
      and (tm.is_coordinator = true or tm.is_deputy_coordinator = true)
  ) or public.is_super_admin();
$$;

-- True if the caller shares at least one team with the target member
-- (used so a Coordinator can only act on members of their own team).
create or replace function public.shares_team_with(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_memberships my
    join public.team_memberships their
      on their.team_id = my.team_id
    where my.member_id = auth.uid()
      and their.member_id = p_member_id
      and (my.is_coordinator = true or my.is_deputy_coordinator = true)
  ) or public.is_super_admin();
$$;

-- =====================================================================
-- 1. ROLES
-- =====================================================================
alter table public.roles enable row level security;

-- Everyone signed in can read the role catalog (needed for UI labels).
create policy roles_select_authenticated
  on public.roles for select
  to authenticated
  using (true);

-- Only Super Admins may modify the role catalog.
create policy roles_modify_super_admin
  on public.roles for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- =====================================================================
-- 2. PRM_MEMBERS
-- =====================================================================
alter table public.prm_members enable row level security;

-- Any authenticated user can view the member directory (name/team/avatar
-- are not sensitive and are needed for leaderboards, task assignment UI).
create policy prm_members_select_authenticated
  on public.prm_members for select
  to authenticated
  using (true);

-- A member may update their own profile fields.
create policy prm_members_update_self
  on public.prm_members for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Coordinators/Deputies may update members within their own team(s)
-- (e.g. correcting a bs_id or marking a member inactive).
create policy prm_members_update_team_leadership
  on public.prm_members for update
  to authenticated
  using (public.shares_team_with(id))
  with check (public.shares_team_with(id));

-- Only Super Admins can insert/delete member records directly (normal
-- onboarding happens via auth signup + a trigger, or bulk CSV import
-- run through a service-role admin API route).
create policy prm_members_insert_admin
  on public.prm_members for insert
  to authenticated
  with check (public.is_super_admin());

create policy prm_members_delete_admin
  on public.prm_members for delete
  to authenticated
  using (public.is_super_admin());

-- =====================================================================
-- 3. NOC_SUBMISSIONS
-- =====================================================================
alter table public.noc_submissions enable row level security;

-- Members can view and upload their own NOCs.
create policy noc_select_own
  on public.noc_submissions for select
  to authenticated
  using (member_id = auth.uid());

create policy noc_insert_own
  on public.noc_submissions for insert
  to authenticated
  with check (member_id = auth.uid());

-- Members may update their own submission only while still pending
-- (e.g. replace a file before it's reviewed).
create policy noc_update_own_pending
  on public.noc_submissions for update
  to authenticated
  using (member_id = auth.uid() and status = 'pending')
  with check (member_id = auth.uid());

-- Team Coordinators/Deputies can view & verify (update) NOCs for members
-- who share a team with them; Super Admins and Core Team see all.
create policy noc_select_reviewers
  on public.noc_submissions for select
  to authenticated
  using (public.shares_team_with(member_id) or public.is_core_team());

create policy noc_update_reviewers
  on public.noc_submissions for update
  to authenticated
  using (public.shares_team_with(member_id) or public.is_super_admin())
  with check (public.shares_team_with(member_id) or public.is_super_admin());

create policy noc_delete_admin
  on public.noc_submissions for delete
  to authenticated
  using (public.is_super_admin());

-- =====================================================================
-- 4. TASK_COMMENTS
-- =====================================================================
alter table public.task_comments enable row level security;

-- Anyone who can see the parent task may read its comments; visibility
-- follows team membership (team task) or is open (global task).
create policy task_comments_select
  on public.task_comments for select
  to authenticated
  using (
    exists (
      select 1 from public.team_tasks tt
      where tt.id = task_comments.task_id
        and (
          tt.team_id is null
          or exists (
            select 1 from public.team_memberships tm
            where tm.team_id = tt.team_id and tm.member_id = auth.uid()
          )
          or public.is_super_admin()
        )
    )
  );

-- A member may post a comment as themselves on any task they can see.
create policy task_comments_insert_self
  on public.task_comments for insert
  to authenticated
  with check (member_id = auth.uid());

-- Authors may edit/delete their own comments; admins may moderate.
create policy task_comments_update_own
  on public.task_comments for update
  to authenticated
  using (member_id = auth.uid() or public.is_super_admin())
  with check (member_id = auth.uid() or public.is_super_admin());

create policy task_comments_delete_own_or_admin
  on public.task_comments for delete
  to authenticated
  using (member_id = auth.uid() or public.is_super_admin());

-- =====================================================================
-- 5. TASK_ATTACHMENTS
-- =====================================================================
alter table public.task_attachments enable row level security;

create policy task_attachments_select
  on public.task_attachments for select
  to authenticated
  using (
    exists (
      select 1 from public.team_tasks tt
      where tt.id = task_attachments.task_id
        and (
          tt.team_id is null
          or exists (
            select 1 from public.team_memberships tm
            where tm.team_id = tt.team_id and tm.member_id = auth.uid()
          )
          or public.is_super_admin()
        )
    )
  );

create policy task_attachments_insert_self
  on public.task_attachments for insert
  to authenticated
  with check (member_id = auth.uid());

create policy task_attachments_delete_own_or_admin
  on public.task_attachments for delete
  to authenticated
  using (member_id = auth.uid() or public.is_super_admin());

-- =====================================================================
-- 6. PRM_RECRUITMENT  (legacy/public-facing recruitment form intake)
-- =====================================================================
create table if not exists public.prm_recruitment (
  id           uuid primary key default gen_random_uuid(),
  full_name    text not null,
  email        text not null,
  phone        text,
  team_interest uuid references public.teams(id),
  notes        text,
  status       text not null default 'new' check (status in ('new', 'reviewed', 'accepted', 'rejected')),
  created_at   timestamptz not null default now()
);

alter table public.prm_recruitment enable row level security;

-- Public recruitment form: anyone (even anon) may submit an application,
-- but only staff can read the resulting list.
create policy prm_recruitment_insert_public
  on public.prm_recruitment for insert
  to anon, authenticated
  with check (true);

create policy prm_recruitment_select_staff
  on public.prm_recruitment for select
  to authenticated
  using (public.is_core_team());

create policy prm_recruitment_update_staff
  on public.prm_recruitment for update
  to authenticated
  using (public.is_core_team())
  with check (public.is_core_team());

create policy prm_recruitment_delete_admin
  on public.prm_recruitment for delete
  to authenticated
  using (public.is_super_admin());

-- =====================================================================
-- 7. PRM_SUBMISSIONS  (legacy/general-purpose member submission log)
-- =====================================================================
create table if not exists public.prm_submissions (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references public.prm_members(id) on delete cascade,
  title        text not null,
  file_path    text,
  notes        text,
  created_at   timestamptz not null default now()
);

alter table public.prm_submissions enable row level security;

create policy prm_submissions_select_own_or_leadership
  on public.prm_submissions for select
  to authenticated
  using (member_id = auth.uid() or public.shares_team_with(member_id) or public.is_core_team());

create policy prm_submissions_insert_own
  on public.prm_submissions for insert
  to authenticated
  with check (member_id = auth.uid());

create policy prm_submissions_update_own_or_admin
  on public.prm_submissions for update
  to authenticated
  using (member_id = auth.uid() or public.is_super_admin())
  with check (member_id = auth.uid() or public.is_super_admin());

create policy prm_submissions_delete_own_or_admin
  on public.prm_submissions for delete
  to authenticated
  using (member_id = auth.uid() or public.is_super_admin());

-- =====================================================================
-- 8. FOOTER_CONFIG  (site-wide footer content, admin-managed)
-- =====================================================================
create table if not exists public.footer_config (
  id           uuid primary key default gen_random_uuid(),
  key          text not null unique,
  value        jsonb not null default '{}'::jsonb,
  updated_by   uuid references auth.users(id),
  updated_at   timestamptz not null default now()
);

alter table public.footer_config enable row level security;

-- Public content: anyone (including anonymous site visitors) can read it.
create policy footer_config_select_public
  on public.footer_config for select
  to anon, authenticated
  using (true);

create policy footer_config_modify_admin
  on public.footer_config for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- =====================================================================
-- 9. Additional tables from 0001 that also need RLS
--    (teams, user_roles, team_memberships, team_tasks,
--     task_member_status, team_meeting_minutes, meeting_attendance,
--     task_types)
-- =====================================================================

-- TEAMS: readable by all authenticated users; only admins manage.
alter table public.teams enable row level security;

create policy teams_select_authenticated
  on public.teams for select
  to authenticated
  using (true);

create policy teams_modify_admin
  on public.teams for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- USER_ROLES: members can see their own roles; leadership can see roles
-- of members on their team; only admins grant/revoke.
alter table public.user_roles enable row level security;

create policy user_roles_select_own_or_admin
  on public.user_roles for select
  to authenticated
  using (member_id = auth.uid() or public.is_core_team() or public.shares_team_with(member_id));

create policy user_roles_modify_admin
  on public.user_roles for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- TEAM_MEMBERSHIPS: visible to all authenticated (org chart / directory);
-- only admins or the relevant team's own leadership can modify.
alter table public.team_memberships enable row level security;

create policy team_memberships_select_authenticated
  on public.team_memberships for select
  to authenticated
  using (true);

create policy team_memberships_modify_admin_or_leadership
  on public.team_memberships for all
  to authenticated
  using (public.is_super_admin() or public.is_team_leadership(team_id))
  with check (public.is_super_admin() or public.is_team_leadership(team_id));

-- TASK_TYPES: readable by all; only admins manage point weightages.
alter table public.task_types enable row level security;

create policy task_types_select_authenticated
  on public.task_types for select
  to authenticated
  using (true);

create policy task_types_modify_admin
  on public.task_types for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- TEAM_TASKS: visible to team members (or everyone for global tasks);
-- created/edited by team leadership or admins.
alter table public.team_tasks enable row level security;

create policy team_tasks_select
  on public.team_tasks for select
  to authenticated
  using (
    team_id is null
    or exists (
      select 1 from public.team_memberships tm
      where tm.team_id = team_tasks.team_id and tm.member_id = auth.uid()
    )
    or public.is_super_admin()
  );

create policy team_tasks_modify_leadership_or_admin
  on public.team_tasks for all
  to authenticated
  using (public.is_super_admin() or (team_id is not null and public.is_team_leadership(team_id)))
  with check (public.is_super_admin() or (team_id is not null and public.is_team_leadership(team_id)));

-- TASK_MEMBER_STATUS: a member sees/updates their own submission status;
-- team leadership/admins review (select/update) all rows for their team.
alter table public.task_member_status enable row level security;

create policy task_member_status_select
  on public.task_member_status for select
  to authenticated
  using (member_id = auth.uid() or public.shares_team_with(member_id) or public.is_super_admin());

create policy task_member_status_insert_own
  on public.task_member_status for insert
  to authenticated
  with check (member_id = auth.uid() or public.is_super_admin());

-- Members may update their own row only to submit (not to self-select);
-- reviewers (leadership/admin) can set any status.
create policy task_member_status_update_own_submit
  on public.task_member_status for update
  to authenticated
  using (member_id = auth.uid())
  with check (member_id = auth.uid() and status in ('submitted', 'not_submitted'));

create policy task_member_status_update_reviewers
  on public.task_member_status for update
  to authenticated
  using (public.shares_team_with(member_id) or public.is_super_admin())
  with check (public.shares_team_with(member_id) or public.is_super_admin());

-- TEAM_MEETING_MINUTES: visible to team members (or all Core Team for
-- central meetings); created/edited by leadership or admins.
alter table public.team_meeting_minutes enable row level security;

create policy meeting_minutes_select
  on public.team_meeting_minutes for select
  to authenticated
  using (
    (scope = 'central_core' and public.is_core_team())
    or (scope = 'team' and exists (
      select 1 from public.team_memberships tm
      where tm.team_id = team_meeting_minutes.team_id and tm.member_id = auth.uid()
    ))
    or public.is_super_admin()
  );

create policy meeting_minutes_modify
  on public.team_meeting_minutes for all
  to authenticated
  using (
    public.is_super_admin()
    or (scope = 'central_core' and public.is_core_team())
    or (scope = 'team' and public.is_team_leadership(team_id))
  )
  with check (
    public.is_super_admin()
    or (scope = 'central_core' and public.is_core_team())
    or (scope = 'team' and public.is_team_leadership(team_id))
  );

-- MEETING_ATTENDANCE: same visibility as the parent meeting; only
-- leadership/admins record attendance.
alter table public.meeting_attendance enable row level security;

create policy meeting_attendance_select
  on public.meeting_attendance for select
  to authenticated
  using (
    member_id = auth.uid()
    or exists (
      select 1 from public.team_meeting_minutes m
      where m.id = meeting_attendance.meeting_id
        and (
          (m.scope = 'central_core' and public.is_core_team())
          or (m.scope = 'team' and public.is_team_leadership(m.team_id))
        )
    )
    or public.is_super_admin()
  );

create policy meeting_attendance_modify
  on public.meeting_attendance for all
  to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.team_meeting_minutes m
      where m.id = meeting_attendance.meeting_id
        and (
          (m.scope = 'central_core' and public.is_core_team())
          or (m.scope = 'team' and public.is_team_leadership(m.team_id))
        )
    )
  )
  with check (
    public.is_super_admin()
    or exists (
      select 1 from public.team_meeting_minutes m
      where m.id = meeting_attendance.meeting_id
        and (
          (m.scope = 'central_core' and public.is_core_team())
          or (m.scope = 'team' and public.is_team_leadership(m.team_id))
        )
    )
  );

-- =====================================================================
-- End of 0002_rls_policies.sql
-- =====================================================================
