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
