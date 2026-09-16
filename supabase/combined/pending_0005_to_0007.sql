-- =====================================================================
-- PRM / Team Management Platform — Pending migrations 0005 -> 0007
-- =====================================================================
-- Your database already has 0001-0004 applied (confirmed via REST).
-- This combines the three still-pending migrations into one script:
--   0005: profile photo bucket + self-service column restriction
--   0006: admin/leadership photo management for other members
--   0007: admin role grants, member blocking, member reports
-- Paste this whole thing into the Supabase SQL Editor and run once.
-- =====================================================================

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


-- =====================================================================
-- PRM / Team Management Platform — Phase 3 (cont.): admin role grants,
-- member blocking (= membership cancellation), and member reports
-- =====================================================================
-- 1. No schema change needed to grant/revoke "Super Admin" — that's
--    just inserting/deleting a row in user_roles, already RLS-gated to
--    is_super_admin() by the `user_roles_modify_admin` policy in 0002.
--    (Noted here for completeness — the app-layer changes are in
--    lib/actions/admin.ts.)
--
-- 2. Blocking a member = membership cancellation: status -> 'inactive'
--    plus banning their auth.users row (via the Admin API, app-layer)
--    so an already-issued session can't keep working past its current
--    token lifetime. Adds an audit trail (who/when/why).
--
-- 3. member_reports: any member can report any member; visible only to
--    the reporter and Super Admins — nobody else, not even Team
--    Coordinators, per the requirement.
-- =====================================================================

alter table public.prm_members
  add column if not exists blocked_at     timestamptz,
  add column if not exists blocked_reason text,
  add column if not exists blocked_by     uuid references auth.users(id);

comment on column public.prm_members.blocked_at is
  'Set when a Super Admin blocks this member. Blocking sets status to inactive and bans the auth account — this column is the audit trail, not the enforcement mechanism.';

-- Self-service members must never be able to unblock themselves or
-- rewrite the audit trail — extend the same trigger from 0005.
create or replace function public.restrict_self_member_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id = auth.uid() and not public.is_super_admin() then
    new.full_name      := old.full_name;
    new.email          := old.email;
    new.bs_id          := old.bs_id;
    new.stage          := old.stage;
    new.scout_group    := old.scout_group;
    new.district       := old.district;
    new.team_name      := old.team_name;
    new.position       := old.position;
    new.status         := old.status;
    new.blocked_at     := old.blocked_at;
    new.blocked_reason := old.blocked_reason;
    new.blocked_by     := old.blocked_by;
    -- phone and photo are the only self-editable columns.
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- member_reports
-- ---------------------------------------------------------------------
create table if not exists public.member_reports (
  id                 uuid primary key default gen_random_uuid(),
  reporter_id        uuid not null references public.prm_members(id) on delete cascade,
  reported_member_id uuid not null references public.prm_members(id) on delete cascade,
  reason             text not null,
  details            text,
  status             text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at         timestamptz not null default now(),
  reviewed_at        timestamptz,
  reviewed_by        uuid references auth.users(id),
  constraint member_reports_not_self check (reporter_id <> reported_member_id)
);

create index if not exists member_reports_reporter_idx on public.member_reports (reporter_id);
create index if not exists member_reports_reported_idx on public.member_reports (reported_member_id);
create index if not exists member_reports_status_idx on public.member_reports (status);

alter table public.member_reports enable row level security;

-- Any authenticated member can file a report as themselves.
create policy member_reports_insert_own
  on public.member_reports for insert
  to authenticated
  with check (reporter_id = auth.uid());

-- Visible ONLY to the reporter and Super Admins — deliberately not
-- extended to Team Coordinators/Core Team, unlike most other tables
-- in this schema, per the requirement that reports stay private.
create policy member_reports_select_own_or_admin
  on public.member_reports for select
  to authenticated
  using (reporter_id = auth.uid() or public.is_super_admin());

-- Only admins triage reports (mark reviewed/dismissed); the reporter
-- cannot edit after filing, to keep the record trustworthy.
create policy member_reports_update_admin
  on public.member_reports for update
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy member_reports_delete_admin
  on public.member_reports for delete
  to authenticated
  using (public.is_super_admin());

-- =====================================================================
-- End of 0007_admin_roles_blocking_reports.sql
-- =====================================================================
