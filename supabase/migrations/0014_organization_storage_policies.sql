-- =====================================================================
-- PRM / Team Management Platform — Phase 4: Multi-tenant, part 4
-- Org-scoped storage policies
-- =====================================================================
-- `storage.objects` has no organization_id column of its own — every
-- path convention here already encodes an id (member_id/task_id/
-- meeting_id) that resolves back to an org-scoped row (now that 0012
-- added organization_id to those tables), so each policy below adds an
-- `exists (...)` check against the owning table instead of a plain
-- column comparison. Policies whose only branch was "my own folder"
-- (e.g. `nocs_insert_own`, `task_attachments_insert_own`,
-- `member_photos_insert_own`/`update_own`) are left untouched — writing
-- into your own folder is trivially already within your own org.
--
-- Note: `member-photos` is a PUBLIC bucket (0005) — its files are
-- served by direct URL with no RLS check at all, by original design
-- ("avoid a signed URL per avatar render"). That pre-existing tradeoff
-- is unrelated to multi-tenancy and is not changed here; a member
-- photo's URL isn't guessable without already knowing the member id.
-- =====================================================================

-- ---------------------------------------------------------------------
-- nocs
-- ---------------------------------------------------------------------
drop policy if exists nocs_select_own_or_reviewer on storage.objects;
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
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_super_admin()
    )
    and exists (
      select 1 from public.prm_members m
      where m.id = ((storage.foldername(name))[1])::uuid
        and m.organization_id = public.current_org_id()
    )
  );

-- ---------------------------------------------------------------------
-- task-attachments
-- ---------------------------------------------------------------------
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
            where tm.team_id = tt.team_id and tm.member_id = auth.uid()
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
      (storage.foldername(name))[2] = auth.uid()::text
      or public.is_super_admin()
    )
    and exists (
      select 1 from public.team_tasks tt
      where tt.id = ((storage.foldername(name))[1])::uuid
        and tt.organization_id = public.current_org_id()
    )
  );

-- ---------------------------------------------------------------------
-- meeting-minutes
-- ---------------------------------------------------------------------
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
            where tm.team_id = m.team_id and tm.member_id = auth.uid()
          ))
          or public.is_super_admin()
        )
    )
  );

drop policy if exists meeting_minutes_files_write on storage.objects;
create policy meeting_minutes_files_write
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'meeting-minutes'
    and exists (
      select 1 from public.team_meeting_minutes m
      where m.id = ((storage.foldername(name))[1])::uuid
        and m.organization_id = public.current_org_id()
        and (
          (m.scope = 'central_core' and public.is_core_team())
          or (m.scope = 'team' and public.is_team_leadership(m.team_id))
          or public.is_super_admin()
        )
    )
  );

drop policy if exists meeting_minutes_files_delete on storage.objects;
create policy meeting_minutes_files_delete
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'meeting-minutes'
    and exists (
      select 1 from public.team_meeting_minutes m
      where m.id = ((storage.foldername(name))[1])::uuid
        and m.organization_id = public.current_org_id()
        and (
          public.is_super_admin()
          or (m.scope = 'central_core' and public.is_core_team())
          or (m.scope = 'team' and public.is_team_leadership(m.team_id))
        )
    )
  );

-- ---------------------------------------------------------------------
-- member-photos (admin/leadership write paths only — see note above
-- about the bucket's public-read design being unchanged)
-- ---------------------------------------------------------------------
drop policy if exists member_photos_delete_own_or_admin on storage.objects;
create policy member_photos_delete_own_or_admin
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'member-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_super_admin()
    )
    and exists (
      select 1 from public.prm_members m
      where m.id = ((storage.foldername(name))[1])::uuid
        and m.organization_id = public.current_org_id()
    )
  );

drop policy if exists member_photos_insert_admin_or_leadership on storage.objects;
create policy member_photos_insert_admin_or_leadership
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'member-photos'
    and (
      public.is_super_admin()
      or public.shares_team_with(((storage.foldername(name))[1])::uuid)
    )
    and exists (
      select 1 from public.prm_members m
      where m.id = ((storage.foldername(name))[1])::uuid
        and m.organization_id = public.current_org_id()
    )
  );

drop policy if exists member_photos_update_admin_or_leadership on storage.objects;
create policy member_photos_update_admin_or_leadership
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'member-photos'
    and (
      public.is_super_admin()
      or public.shares_team_with(((storage.foldername(name))[1])::uuid)
    )
    and exists (
      select 1 from public.prm_members m
      where m.id = ((storage.foldername(name))[1])::uuid
        and m.organization_id = public.current_org_id()
    )
  );

-- =====================================================================
-- End of 0014_organization_storage_policies.sql
-- =====================================================================
