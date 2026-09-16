-- =====================================================================
-- PRM / Team Management Platform — Phase 1 (cont.): Storage buckets
-- =====================================================================
-- Creates the three private Storage buckets used by Phase 3 upload UIs
-- and mirrors the same RBAC used for their metadata tables. All buckets
-- are private; objects are served via signed URLs generated server-side.
--
-- Path conventions (enforced by policy via storage.foldername):
--   nocs/{member_id}/{filename}
--   task-attachments/{task_id}/{member_id}/{filename}
--   meeting-minutes/{meeting_id}/{filename}
-- =====================================================================

insert into storage.buckets (id, name, public)
values
  ('nocs', 'nocs', false),
  ('task-attachments', 'task-attachments', false),
  ('meeting-minutes', 'meeting-minutes', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- nocs: owner uploads/reads own folder; team leadership + admins read.
-- ---------------------------------------------------------------------
create policy nocs_insert_own
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'nocs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy nocs_select_own_or_reviewer
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'nocs'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.shares_team_with(((storage.foldername(name))[1])::uuid)
      or public.is_core_team()
    )
  );

create policy nocs_delete_own_pending_or_admin
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'nocs'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_super_admin()
    )
  );

-- ---------------------------------------------------------------------
-- task-attachments: any team member who can see the task may read;
-- only the uploader may write/delete their own file.
-- ---------------------------------------------------------------------
create policy task_attachments_insert_own
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'task-attachments'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy task_attachments_select_team
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'task-attachments'
    and exists (
      select 1 from public.team_tasks tt
      where tt.id = ((storage.foldername(name))[1])::uuid
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

create policy task_attachments_delete_own_or_admin
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'task-attachments'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or public.is_super_admin()
    )
  );

-- ---------------------------------------------------------------------
-- meeting-minutes: readable by whoever can see the parent meeting;
-- writable only by team leadership / Core Team / admins.
-- ---------------------------------------------------------------------
create policy meeting_minutes_files_select
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'meeting-minutes'
    and exists (
      select 1 from public.team_meeting_minutes m
      where m.id = ((storage.foldername(name))[1])::uuid
        and (
          (m.scope = 'central_core' and public.is_core_team())
          or (m.scope = 'team' and exists (
            select 1 from public.team_memberships tm
            where tm.team_id = m.team_id and tm.member_id = auth.uid()
          ))
          or public.is_super_admin()
        )
    )
  );

create policy meeting_minutes_files_write
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'meeting-minutes'
    and exists (
      select 1 from public.team_meeting_minutes m
      where m.id = ((storage.foldername(name))[1])::uuid
        and (
          (m.scope = 'central_core' and public.is_core_team())
          or (m.scope = 'team' and public.is_team_leadership(m.team_id))
          or public.is_super_admin()
        )
    )
  );

create policy meeting_minutes_files_delete
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'meeting-minutes'
    and (
      public.is_super_admin()
      or exists (
        select 1 from public.team_meeting_minutes m
        where m.id = ((storage.foldername(name))[1])::uuid
          and (
            (m.scope = 'central_core' and public.is_core_team())
            or (m.scope = 'team' and public.is_team_leadership(m.team_id))
          )
      )
    )
  );

-- =====================================================================
-- End of 0003_storage.sql
-- =====================================================================
