-- =====================================================================
-- PRM / Team Management Platform — Phase 3 (cont.): admin/leadership
-- photo management (upload or URL) for members other than themselves
-- =====================================================================
-- 0005 only let a member insert/update objects in THEIR OWN folder of
-- the member-photos bucket. The member detail modal now lets a Super
-- Admin or a member's Team Coordinator/Deputy set that member's photo
-- (upload a file, or paste a URL) from the directory — which requires
-- writing into someone else's folder. These are additional permissive
-- policies (combined with OR alongside 0005's self-only ones), so
-- self-service upload keeps working unchanged.
-- =====================================================================

create policy member_photos_insert_admin_or_leadership
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'member-photos'
    and (
      public.is_super_admin()
      or public.shares_team_with(((storage.foldername(name))[1])::uuid)
    )
  );

create policy member_photos_update_admin_or_leadership
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'member-photos'
    and (
      public.is_super_admin()
      or public.shares_team_with(((storage.foldername(name))[1])::uuid)
    )
  );

-- =====================================================================
-- End of 0006_admin_photo_management.sql
-- =====================================================================
