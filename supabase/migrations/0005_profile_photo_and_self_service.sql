-- =====================================================================
-- PRM / Team Management Platform — Phase 3 (cont.): profile photo
-- upload + column-level self-service restriction on prm_members
-- =====================================================================
-- Two things:
--
-- 1. A public "member-photos" Storage bucket for self-service avatar
--    uploads (rendered everywhere — directory, leaderboard, org chart —
--    so a public URL avoids generating a signed URL per avatar render).
--
-- 2. `prm_members_update_self` (0002) lets a member update their own
--    row, but a Postgres RLS policy cannot restrict WHICH COLUMNS
--    change — only whether the row-level USING/WITH CHECK passes. As
--    written, a member could currently call the REST API directly and
--    silently rewrite their own official fields (stage, district,
--    team_name, position, status, bs_id, full_name, email) — clearly
--    not the intent (those are admin/leadership-managed records; see
--    the comments on 0004). A BEFORE UPDATE trigger enforces the real
--    column-level boundary: when the actor is updating their OWN row
--    and is not a Super Admin, only `phone` and `photo` may change —
--    every other column is forced back to its OLD value. Leadership
--    editing a *different* member's row (already gated by
--    `shares_team_with()` in `prm_members_update_team_leadership`) is
--    untouched by this trigger, since that path's `NEW.id <> auth.uid()`.
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('member-photos', 'member-photos', true)
on conflict (id) do nothing;

create policy member_photos_insert_own
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'member-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy member_photos_update_own
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'member-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy member_photos_delete_own_or_admin
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'member-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_super_admin()
    )
  );

-- Bucket is public, but an explicit select policy keeps behavior
-- consistent if it's ever flipped private later.
create policy member_photos_select_public
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'member-photos');

-- ---------------------------------------------------------------------
-- Column-level self-service restriction
-- ---------------------------------------------------------------------
create or replace function public.restrict_self_member_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id = auth.uid() and not public.is_super_admin() then
    new.full_name    := old.full_name;
    new.email        := old.email;
    new.bs_id        := old.bs_id;
    new.stage        := old.stage;
    new.scout_group  := old.scout_group;
    new.district     := old.district;
    new.team_name    := old.team_name;
    new.position     := old.position;
    new.status       := old.status;
    -- phone and photo are the only self-editable columns.
  end if;
  return new;
end;
$$;

drop trigger if exists trg_restrict_self_member_update on public.prm_members;
create trigger trg_restrict_self_member_update
before update on public.prm_members
for each row
execute function public.restrict_self_member_update();

-- =====================================================================
-- End of 0005_profile_photo_and_self_service.sql
-- =====================================================================
