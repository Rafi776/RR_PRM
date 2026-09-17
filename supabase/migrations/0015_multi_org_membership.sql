-- =====================================================================
-- PRM / Team Management Platform — Phase 5: multi-org membership
-- =====================================================================
-- Until now, `prm_members.id` WAS `auth.users.id` — one login, one org,
-- hard 1:1. A person can now be a member of more than one organization
-- under a single login, which means that 1:1 assumption has to break:
-- `prm_members.id` becomes "this org membership's id," a new
-- `prm_members.user_id` column points at the actual login, and a new
-- `user_active_organization` table tracks which of a person's
-- memberships is currently "in view" (read fresh on every RLS check —
-- switching takes effect immediately, no session/JWT refresh needed).
--
-- Every policy/helper function that used to compare a member/reporter/
-- id column to `auth.uid()` to mean "my own row" is redefined here to
-- use the new `current_member_id()` helper instead. Columns that record
-- "which login performed this action" (created_by, granted_by,
-- verified_by, reviewed_by, blocked_by — all `references auth.users`)
-- are untouched: they're audit trail, not identity, and correctly stay
-- keyed on the login regardless of which org is active.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. prm_members.user_id + one-membership-per-org uniqueness
-- ---------------------------------------------------------------------
alter table public.prm_members add column if not exists user_id uuid references auth.users(id) on delete cascade;
update public.prm_members set user_id = id where user_id is null;
alter table public.prm_members alter column user_id set not null;

alter table public.prm_members drop constraint if exists prm_members_id_fkey;
-- `id` was only ever populated by copying auth.users.id in — now that a
-- new membership row is its own independent identity (not a login), it
-- needs to generate its own value on insert.
alter table public.prm_members alter column id set default gen_random_uuid();
create unique index if not exists prm_members_user_org_idx
  on public.prm_members (user_id, organization_id);
create index if not exists prm_members_user_idx on public.prm_members (user_id);

-- ---------------------------------------------------------------------
-- 2. user_active_organization — the "which org am I viewing" pointer
-- ---------------------------------------------------------------------
create table if not exists public.user_active_organization (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  updated_at      timestamptz not null default now()
);

alter table public.user_active_organization enable row level security;

create policy user_active_organization_select_own
  on public.user_active_organization for select
  to authenticated
  using (user_id = auth.uid());

-- A user may only ever point this at an org they actually hold a
-- prm_members row in — this is what stops switching into an org you
-- don't belong to, independent of any app-layer check.
create policy user_active_organization_upsert_own
  on public.user_active_organization for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.prm_members m
      where m.user_id = auth.uid() and m.organization_id = user_active_organization.organization_id
    )
  );

create policy user_active_organization_update_own
  on public.user_active_organization for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.prm_members m
      where m.user_id = auth.uid() and m.organization_id = user_active_organization.organization_id
    )
  );

-- ---------------------------------------------------------------------
-- 3. Redefine current_org_id() and current_member_id()
-- ---------------------------------------------------------------------
create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.user_active_organization where user_id = auth.uid();
$$;

create or replace function public.current_member_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.prm_members
  where user_id = auth.uid() and organization_id = public.current_org_id();
$$;

-- ---------------------------------------------------------------------
-- 4. Helper functions: auth.uid() -> current_member_id() everywhere it
--    meant "my own membership row"
-- ---------------------------------------------------------------------
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
    where ur.member_id = public.current_member_id()
      and r.name = p_role_name
  );
$$;

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
      and tm.member_id = public.current_member_id()
      and (tm.is_coordinator = true or tm.is_deputy_coordinator = true)
  ) or public.is_super_admin();
$$;

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
    where my.member_id = public.current_member_id()
      and their.member_id = p_member_id
      and (my.is_coordinator = true or my.is_deputy_coordinator = true)
  ) or public.is_super_admin();
$$;

-- ---------------------------------------------------------------------
-- 5. Trigger functions
-- ---------------------------------------------------------------------
create or replace function public.restrict_self_member_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id = public.current_member_id() and not public.is_super_admin() then
    new.email          := old.email;
    new.bs_id          := old.bs_id;
    new.status         := old.status;
    new.blocked_at     := old.blocked_at;
    new.blocked_reason := old.blocked_reason;
    new.blocked_by     := old.blocked_by;
    new.organization_id := old.organization_id;
    new.user_id        := old.user_id;
    -- full_name, stage, scout_group, district, team_name, position,
    -- phone, and photo are self-editable (0008).
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Table policies: re-point "my own row" comparisons at
--    current_member_id()
-- ---------------------------------------------------------------------
drop policy if exists prm_members_update_self on public.prm_members;
create policy prm_members_update_self
  on public.prm_members for update
  to authenticated
  using (id = public.current_member_id())
  with check (id = public.current_member_id());

drop policy if exists noc_select_own on public.noc_submissions;
create policy noc_select_own
  on public.noc_submissions for select
  to authenticated
  using (member_id = public.current_member_id());

drop policy if exists noc_insert_own on public.noc_submissions;
create policy noc_insert_own
  on public.noc_submissions for insert
  to authenticated
  with check (member_id = public.current_member_id() and organization_id = public.current_org_id());

drop policy if exists noc_update_own_pending on public.noc_submissions;
create policy noc_update_own_pending
  on public.noc_submissions for update
  to authenticated
  using (member_id = public.current_member_id() and status = 'pending')
  with check (member_id = public.current_member_id());

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
            where tm.team_id = tt.team_id and tm.member_id = public.current_member_id()
          )
          or public.is_super_admin()
        )
    )
  );

drop policy if exists task_comments_insert_self on public.task_comments;
create policy task_comments_insert_self
  on public.task_comments for insert
  to authenticated
  with check (member_id = public.current_member_id() and organization_id = public.current_org_id());

drop policy if exists task_comments_update_own on public.task_comments;
create policy task_comments_update_own
  on public.task_comments for update
  to authenticated
  using (
    (member_id = public.current_member_id() or public.is_super_admin())
    and organization_id = public.current_org_id()
  )
  with check (
    (member_id = public.current_member_id() or public.is_super_admin())
    and organization_id = public.current_org_id()
  );

drop policy if exists task_comments_delete_own_or_admin on public.task_comments;
create policy task_comments_delete_own_or_admin
  on public.task_comments for delete
  to authenticated
  using (
    (member_id = public.current_member_id() or public.is_super_admin())
    and organization_id = public.current_org_id()
  );

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
            where tm.team_id = tt.team_id and tm.member_id = public.current_member_id()
          )
          or public.is_super_admin()
        )
    )
  );

drop policy if exists task_attachments_insert_self on public.task_attachments;
create policy task_attachments_insert_self
  on public.task_attachments for insert
  to authenticated
  with check (member_id = public.current_member_id() and organization_id = public.current_org_id());

drop policy if exists task_attachments_delete_own_or_admin on public.task_attachments;
create policy task_attachments_delete_own_or_admin
  on public.task_attachments for delete
  to authenticated
  using (
    (member_id = public.current_member_id() or public.is_super_admin())
    and organization_id = public.current_org_id()
  );

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
        where tm.team_id = team_tasks.team_id and tm.member_id = public.current_member_id()
      )
      or public.is_super_admin()
    )
  );

drop policy if exists task_member_status_insert_own on public.task_member_status;
create policy task_member_status_insert_own
  on public.task_member_status for insert
  to authenticated
  with check (
    (member_id = public.current_member_id() or public.is_super_admin())
    and organization_id = public.current_org_id()
  );

drop policy if exists task_member_status_update_own_submit on public.task_member_status;
create policy task_member_status_update_own_submit
  on public.task_member_status for update
  to authenticated
  using (member_id = public.current_member_id() and organization_id = public.current_org_id())
  with check (
    member_id = public.current_member_id()
    and status in ('submitted', 'not_submitted')
    and organization_id = public.current_org_id()
  );

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
        where tm.team_id = team_meeting_minutes.team_id and tm.member_id = public.current_member_id()
      ))
      or public.is_super_admin()
    )
  );

drop policy if exists meeting_attendance_select on public.meeting_attendance;
create policy meeting_attendance_select
  on public.meeting_attendance for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      member_id = public.current_member_id()
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

drop policy if exists member_reports_insert_own on public.member_reports;
create policy member_reports_insert_own
  on public.member_reports for insert
  to authenticated
  with check (reporter_id = public.current_member_id() and organization_id = public.current_org_id());

drop policy if exists member_reports_select_own_or_admin on public.member_reports;
create policy member_reports_select_own_or_admin
  on public.member_reports for select
  to authenticated
  using (
    (reporter_id = public.current_member_id() or public.is_super_admin())
    and organization_id = public.current_org_id()
  );

-- ---------------------------------------------------------------------
-- 7. Storage policies: "my own folder" -> current_member_id()
-- ---------------------------------------------------------------------
drop policy if exists nocs_insert_own on storage.objects;
create policy nocs_insert_own
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'nocs'
    and (storage.foldername(name))[1] = public.current_member_id()::text
  );

drop policy if exists nocs_select_own_or_reviewer on storage.objects;
create policy nocs_select_own_or_reviewer
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'nocs'
    and (
      (storage.foldername(name))[1] = public.current_member_id()::text
      or public.shares_team_with(((storage.foldername(name))[1])::uuid)
      or public.is_core_team()
    )
    and exists (
      select 1 from public.prm_members m
      where m.id = ((storage.foldername(name))[1])::uuid
        and m.organization_id = public.current_org_id()
    )
  );

drop policy if exists nocs_delete_own_pending_or_admin on storage.objects;
create policy nocs_delete_own_pending_or_admin
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'nocs'
    and (
      (storage.foldername(name))[1] = public.current_member_id()::text
      or public.is_super_admin()
    )
    and exists (
      select 1 from public.prm_members m
      where m.id = ((storage.foldername(name))[1])::uuid
        and m.organization_id = public.current_org_id()
    )
  );

drop policy if exists task_attachments_insert_own on storage.objects;
create policy task_attachments_insert_own
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'task-attachments'
    and (storage.foldername(name))[2] = public.current_member_id()::text
  );

drop policy if exists task_attachments_select_team on storage.objects;
create policy task_attachments_select_team
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'task-attachments'
    and exists (
      select 1 from public.team_tasks tt
      where tt.id = ((storage.foldername(name))[1])::uuid
        and tt.organization_id = public.current_org_id()
        and (
          tt.team_id is null
          or exists (
            select 1 from public.team_memberships tm
            where tm.team_id = tt.team_id and tm.member_id = public.current_member_id()
          )
          or public.is_super_admin()
        )
    )
  );

drop policy if exists task_attachments_delete_own_or_admin on storage.objects;
create policy task_attachments_delete_own_or_admin
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'task-attachments'
    and (
      (storage.foldername(name))[2] = public.current_member_id()::text
      or public.is_super_admin()
    )
    and exists (
      select 1 from public.team_tasks tt
      where tt.id = ((storage.foldername(name))[1])::uuid
        and tt.organization_id = public.current_org_id()
    )
  );

drop policy if exists meeting_minutes_files_select on storage.objects;
create policy meeting_minutes_files_select
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'meeting-minutes'
    and exists (
      select 1 from public.team_meeting_minutes m
      where m.id = ((storage.foldername(name))[1])::uuid
        and m.organization_id = public.current_org_id()
        and (
          (m.scope = 'central_core' and public.is_core_team())
          or (m.scope = 'team' and exists (
            select 1 from public.team_memberships tm
            where tm.team_id = m.team_id and tm.member_id = public.current_member_id()
          ))
          or public.is_super_admin()
        )
    )
  );

drop policy if exists member_photos_insert_own on storage.objects;
create policy member_photos_insert_own
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'member-photos'
    and (storage.foldername(name))[1] = public.current_member_id()::text
  );

drop policy if exists member_photos_update_own on storage.objects;
create policy member_photos_update_own
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'member-photos'
    and (storage.foldername(name))[1] = public.current_member_id()::text
  );

drop policy if exists member_photos_delete_own_or_admin on storage.objects;
create policy member_photos_delete_own_or_admin
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'member-photos'
    and (
      (storage.foldername(name))[1] = public.current_member_id()::text
      or public.is_super_admin()
    )
    and exists (
      select 1 from public.prm_members m
      where m.id = ((storage.foldername(name))[1])::uuid
        and m.organization_id = public.current_org_id()
    )
  );

-- =====================================================================
-- End of 0015_multi_org_membership.sql
-- =====================================================================
