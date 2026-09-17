-- =====================================================================
-- PRM / Team Management Platform — Phase 4: Multi-tenant, part 3
-- Org-scoped RLS
-- =====================================================================
-- Postgres has no "alter policy to add a condition" — every policy that
-- needs the org check is dropped and recreated with the same logic AS
-- BEFORE, AND'd with `organization_id = public.current_org_id()`. The
-- role-check helper functions from 0002 (`is_super_admin()`,
-- `is_core_team()`, `is_team_leadership()`, `shares_team_with()`) are
-- NOT changed — they already resolve through auth.uid()-scoped rows —
-- but several existing policies used them *unconditionally* (e.g.
-- `noc_select_reviewers`'s `... or is_core_team()`,
-- `meeting_minutes_select`'s central_core branch, several bare
-- `is_super_admin()` clauses). Those were harmless single-org, but are
-- direct cross-org leaks once a second org's rows exist in the same
-- table — every one of them is fixed here by the blanket org AND.
--
-- `roles` is intentionally untouched: it's a global 5-row lookup shared
-- by every org, not org-owned data.
-- =====================================================================

create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.prm_members where id = auth.uid();
$$;

-- Now that current_org_id() exists, give `organizations` its real
-- select policy (0011 enabled RLS on it with zero policies).
create policy organizations_select_own
  on public.organizations for select
  to authenticated
  using (id = public.current_org_id());

-- ---------------------------------------------------------------------
-- PRM_MEMBERS
-- ---------------------------------------------------------------------
drop policy if exists prm_members_select_authenticated on public.prm_members;
create policy prm_members_select_authenticated
  on public.prm_members for select
  to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists prm_members_update_self on public.prm_members;
create policy prm_members_update_self
  on public.prm_members for update
  to authenticated
  using (id = auth.uid() and organization_id = public.current_org_id())
  with check (id = auth.uid() and organization_id = public.current_org_id());

drop policy if exists prm_members_update_team_leadership on public.prm_members;
create policy prm_members_update_team_leadership
  on public.prm_members for update
  to authenticated
  using (public.shares_team_with(id) and organization_id = public.current_org_id())
  with check (public.shares_team_with(id) and organization_id = public.current_org_id());

drop policy if exists prm_members_insert_admin on public.prm_members;
create policy prm_members_insert_admin
  on public.prm_members for insert
  to authenticated
  with check (public.is_super_admin() and organization_id = public.current_org_id());

drop policy if exists prm_members_delete_admin on public.prm_members;
create policy prm_members_delete_admin
  on public.prm_members for delete
  to authenticated
  using (public.is_super_admin() and organization_id = public.current_org_id());

-- ---------------------------------------------------------------------
-- NOC_SUBMISSIONS
-- ---------------------------------------------------------------------
drop policy if exists noc_select_own on public.noc_submissions;
create policy noc_select_own
  on public.noc_submissions for select
  to authenticated
  using (member_id = auth.uid() and organization_id = public.current_org_id());

drop policy if exists noc_insert_own on public.noc_submissions;
create policy noc_insert_own
  on public.noc_submissions for insert
  to authenticated
  with check (member_id = auth.uid() and organization_id = public.current_org_id());

drop policy if exists noc_update_own_pending on public.noc_submissions;
create policy noc_update_own_pending
  on public.noc_submissions for update
  to authenticated
  using (member_id = auth.uid() and status = 'pending' and organization_id = public.current_org_id())
  with check (member_id = auth.uid() and organization_id = public.current_org_id());

drop policy if exists noc_select_reviewers on public.noc_submissions;
create policy noc_select_reviewers
  on public.noc_submissions for select
  to authenticated
  using (
    (public.shares_team_with(member_id) or public.is_core_team())
    and organization_id = public.current_org_id()
  );

drop policy if exists noc_update_reviewers on public.noc_submissions;
create policy noc_update_reviewers
  on public.noc_submissions for update
  to authenticated
  using (
    (public.shares_team_with(member_id) or public.is_super_admin())
    and organization_id = public.current_org_id()
  )
  with check (
    (public.shares_team_with(member_id) or public.is_super_admin())
    and organization_id = public.current_org_id()
  );

drop policy if exists noc_delete_admin on public.noc_submissions;
create policy noc_delete_admin
  on public.noc_submissions for delete
  to authenticated
  using (public.is_super_admin() and organization_id = public.current_org_id());

drop policy if exists noc_insert_admin_or_leadership on public.noc_submissions;
create policy noc_insert_admin_or_leadership
  on public.noc_submissions for insert
  to authenticated
  with check (
    (public.shares_team_with(member_id) or public.is_super_admin())
    and organization_id = public.current_org_id()
  );

-- ---------------------------------------------------------------------
-- TASK_COMMENTS
-- ---------------------------------------------------------------------
drop policy if exists task_comments_select on public.task_comments;
create policy task_comments_select
  on public.task_comments for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and exists (
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

drop policy if exists task_comments_insert_self on public.task_comments;
create policy task_comments_insert_self
  on public.task_comments for insert
  to authenticated
  with check (member_id = auth.uid() and organization_id = public.current_org_id());

drop policy if exists task_comments_update_own on public.task_comments;
create policy task_comments_update_own
  on public.task_comments for update
  to authenticated
  using (
    (member_id = auth.uid() or public.is_super_admin())
    and organization_id = public.current_org_id()
  )
  with check (
    (member_id = auth.uid() or public.is_super_admin())
    and organization_id = public.current_org_id()
  );

drop policy if exists task_comments_delete_own_or_admin on public.task_comments;
create policy task_comments_delete_own_or_admin
  on public.task_comments for delete
  to authenticated
  using (
    (member_id = auth.uid() or public.is_super_admin())
    and organization_id = public.current_org_id()
  );

-- ---------------------------------------------------------------------
-- TASK_ATTACHMENTS
-- ---------------------------------------------------------------------
drop policy if exists task_attachments_select on public.task_attachments;
create policy task_attachments_select
  on public.task_attachments for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and exists (
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

drop policy if exists task_attachments_insert_self on public.task_attachments;
create policy task_attachments_insert_self
  on public.task_attachments for insert
  to authenticated
  with check (member_id = auth.uid() and organization_id = public.current_org_id());

drop policy if exists task_attachments_delete_own_or_admin on public.task_attachments;
create policy task_attachments_delete_own_or_admin
  on public.task_attachments for delete
  to authenticated
  using (
    (member_id = auth.uid() or public.is_super_admin())
    and organization_id = public.current_org_id()
  );

-- ---------------------------------------------------------------------
-- TEAMS
-- ---------------------------------------------------------------------
drop policy if exists teams_select_authenticated on public.teams;
create policy teams_select_authenticated
  on public.teams for select
  to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists teams_modify_admin on public.teams;
create policy teams_modify_admin
  on public.teams for all
  to authenticated
  using (public.is_super_admin() and organization_id = public.current_org_id())
  with check (public.is_super_admin() and organization_id = public.current_org_id());

-- ---------------------------------------------------------------------
-- USER_ROLES
-- ---------------------------------------------------------------------
drop policy if exists user_roles_select_own_or_admin on public.user_roles;
create policy user_roles_select_own_or_admin
  on public.user_roles for select
  to authenticated
  using (
    (member_id = auth.uid() or public.is_core_team() or public.shares_team_with(member_id))
    and organization_id = public.current_org_id()
  );

drop policy if exists user_roles_modify_admin on public.user_roles;
create policy user_roles_modify_admin
  on public.user_roles for all
  to authenticated
  using (public.is_super_admin() and organization_id = public.current_org_id())
  with check (public.is_super_admin() and organization_id = public.current_org_id());

-- ---------------------------------------------------------------------
-- TEAM_MEMBERSHIPS
-- ---------------------------------------------------------------------
drop policy if exists team_memberships_select_authenticated on public.team_memberships;
create policy team_memberships_select_authenticated
  on public.team_memberships for select
  to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists team_memberships_modify_admin_or_leadership on public.team_memberships;
create policy team_memberships_modify_admin_or_leadership
  on public.team_memberships for all
  to authenticated
  using (
    (public.is_super_admin() or public.is_team_leadership(team_id))
    and organization_id = public.current_org_id()
  )
  with check (
    (public.is_super_admin() or public.is_team_leadership(team_id))
    and organization_id = public.current_org_id()
  );

-- ---------------------------------------------------------------------
-- TASK_TYPES
-- ---------------------------------------------------------------------
drop policy if exists task_types_select_authenticated on public.task_types;
create policy task_types_select_authenticated
  on public.task_types for select
  to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists task_types_modify_admin on public.task_types;
create policy task_types_modify_admin
  on public.task_types for all
  to authenticated
  using (public.is_super_admin() and organization_id = public.current_org_id())
  with check (public.is_super_admin() and organization_id = public.current_org_id());

-- ---------------------------------------------------------------------
-- TEAM_TASKS
-- ---------------------------------------------------------------------
drop policy if exists team_tasks_select on public.team_tasks;
create policy team_tasks_select
  on public.team_tasks for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      team_id is null
      or exists (
        select 1 from public.team_memberships tm
        where tm.team_id = team_tasks.team_id and tm.member_id = auth.uid()
      )
      or public.is_super_admin()
    )
  );

drop policy if exists team_tasks_modify_leadership_or_admin on public.team_tasks;
create policy team_tasks_modify_leadership_or_admin
  on public.team_tasks for all
  to authenticated
  using (
    (public.is_super_admin() or (team_id is not null and public.is_team_leadership(team_id)))
    and organization_id = public.current_org_id()
  )
  with check (
    (public.is_super_admin() or (team_id is not null and public.is_team_leadership(team_id)))
    and organization_id = public.current_org_id()
  );

-- ---------------------------------------------------------------------
-- TASK_MEMBER_STATUS
-- ---------------------------------------------------------------------
drop policy if exists task_member_status_select on public.task_member_status;
create policy task_member_status_select
  on public.task_member_status for select
  to authenticated
  using (
    (member_id = auth.uid() or public.shares_team_with(member_id) or public.is_super_admin())
    and organization_id = public.current_org_id()
  );

drop policy if exists task_member_status_insert_own on public.task_member_status;
create policy task_member_status_insert_own
  on public.task_member_status for insert
  to authenticated
  with check (
    (member_id = auth.uid() or public.is_super_admin())
    and organization_id = public.current_org_id()
  );

drop policy if exists task_member_status_update_own_submit on public.task_member_status;
create policy task_member_status_update_own_submit
  on public.task_member_status for update
  to authenticated
  using (member_id = auth.uid() and organization_id = public.current_org_id())
  with check (
    member_id = auth.uid()
    and status in ('submitted', 'not_submitted')
    and organization_id = public.current_org_id()
  );

drop policy if exists task_member_status_update_reviewers on public.task_member_status;
create policy task_member_status_update_reviewers
  on public.task_member_status for update
  to authenticated
  using (
    (public.shares_team_with(member_id) or public.is_super_admin())
    and organization_id = public.current_org_id()
  )
  with check (
    (public.shares_team_with(member_id) or public.is_super_admin())
    and organization_id = public.current_org_id()
  );

-- ---------------------------------------------------------------------
-- TEAM_MEETING_MINUTES
-- ---------------------------------------------------------------------
drop policy if exists meeting_minutes_select on public.team_meeting_minutes;
create policy meeting_minutes_select
  on public.team_meeting_minutes for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      (scope = 'central_core' and public.is_core_team())
      or (scope = 'team' and exists (
        select 1 from public.team_memberships tm
        where tm.team_id = team_meeting_minutes.team_id and tm.member_id = auth.uid()
      ))
      or public.is_super_admin()
    )
  );

drop policy if exists meeting_minutes_modify on public.team_meeting_minutes;
create policy meeting_minutes_modify
  on public.team_meeting_minutes for all
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      public.is_super_admin()
      or (scope = 'central_core' and public.is_core_team())
      or (scope = 'team' and public.is_team_leadership(team_id))
    )
  )
  with check (
    organization_id = public.current_org_id()
    and (
      public.is_super_admin()
      or (scope = 'central_core' and public.is_core_team())
      or (scope = 'team' and public.is_team_leadership(team_id))
    )
  );

-- ---------------------------------------------------------------------
-- MEETING_ATTENDANCE
-- ---------------------------------------------------------------------
drop policy if exists meeting_attendance_select on public.meeting_attendance;
create policy meeting_attendance_select
  on public.meeting_attendance for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
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
    )
  );

drop policy if exists meeting_attendance_modify on public.meeting_attendance;
create policy meeting_attendance_modify
  on public.meeting_attendance for all
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
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
  )
  with check (
    organization_id = public.current_org_id()
    and (
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
  );

-- ---------------------------------------------------------------------
-- MEMBER_REPORTS
-- ---------------------------------------------------------------------
drop policy if exists member_reports_insert_own on public.member_reports;
create policy member_reports_insert_own
  on public.member_reports for insert
  to authenticated
  with check (reporter_id = auth.uid() and organization_id = public.current_org_id());

drop policy if exists member_reports_select_own_or_admin on public.member_reports;
create policy member_reports_select_own_or_admin
  on public.member_reports for select
  to authenticated
  using (
    (reporter_id = auth.uid() or public.is_super_admin())
    and organization_id = public.current_org_id()
  );

drop policy if exists member_reports_update_admin on public.member_reports;
create policy member_reports_update_admin
  on public.member_reports for update
  to authenticated
  using (public.is_super_admin() and organization_id = public.current_org_id())
  with check (public.is_super_admin() and organization_id = public.current_org_id());

drop policy if exists member_reports_delete_admin on public.member_reports;
create policy member_reports_delete_admin
  on public.member_reports for delete
  to authenticated
  using (public.is_super_admin() and organization_id = public.current_org_id());

-- ---------------------------------------------------------------------
-- Triggers: make org-aware
-- ---------------------------------------------------------------------

-- sync_core_team_membership: must target the CALLER's own org's Core
-- Team (not "the" Core Team globally — there's now one per org), and
-- must set organization_id on the rows it inserts (not-null column).
create or replace function public.sync_core_team_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id       uuid;
  v_core_team_id uuid;
  v_member_id    uuid;
  v_still_coordinator boolean;
begin
  v_member_id := coalesce(new.member_id, old.member_id);
  if v_member_id is null then
    return coalesce(new, old);
  end if;

  select organization_id into v_org_id from public.prm_members where id = v_member_id;
  select id into v_core_team_id from public.teams
    where is_core_team = true and organization_id = v_org_id
    limit 1;

  if v_core_team_id is null then
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
    insert into public.team_memberships (team_id, member_id, organization_id, is_auto_synced)
    values (v_core_team_id, v_member_id, v_org_id, true)
    on conflict (team_id, member_id) do nothing;

    insert into public.user_roles (member_id, role_id, organization_id)
    select v_member_id, r.id, v_org_id
    from public.roles r
    where r.name = 'Core Team'
    on conflict (member_id, role_id, team_id) do nothing;
  else
    delete from public.team_memberships
    where team_id = v_core_team_id
      and member_id = v_member_id
      and is_auto_synced = true
      and core_role is null;

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

-- restrict_self_member_update: also pin organization_id so a member can
-- never move themselves into another org via a self-update.
create or replace function public.restrict_self_member_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id = auth.uid() and not public.is_super_admin() then
    new.email          := old.email;
    new.bs_id          := old.bs_id;
    new.status         := old.status;
    new.blocked_at     := old.blocked_at;
    new.blocked_reason := old.blocked_reason;
    new.blocked_by     := old.blocked_by;
    new.organization_id := old.organization_id;
    -- full_name, stage, scout_group, district, team_name, position,
    -- phone, and photo are self-editable (0008).
  end if;
  return new;
end;
$$;

-- =====================================================================
-- End of 0013_organization_rls.sql
-- =====================================================================
